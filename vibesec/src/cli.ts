#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { runAudit } from './agents/pipeline.js';
import { defaultDriver, ClaudeAgentDriver } from './agents/drivers.js';
import { renderReport } from './report/markdown.js';

const USAGE = `vibesec — multi-agent security audit for vibe-coded projects

Usage:
  vibesec audit <dir> [options]

Options:
  --offline        Deterministic rule scan only; never call a model
  --fix            Ask the Fixer agent for patches (written to vibesec-fixes/, never auto-applied)
  --json           Print the raw report JSON instead of Markdown
  --out <file>     Also write the Markdown report to <file>
  --model <name>   Model for the agent pipeline (default: the Agent SDK default)
  -h, --help       Show this help

Exit codes: 0 = no critical/high findings, 1 = critical/high findings present, 2 = usage/error.

Without ANTHROPIC_API_KEY (or with --offline) vibesec runs its deterministic scanner only.
With a key it also runs the agent pipeline: Auditor (hunts broken access control — the flaw
class behind the Lovable/Tea/Moltbook breaches), Verifier (kills false positives), and Fixer.`;

interface CliArgs {
  dir: string;
  offline: boolean;
  fix: boolean;
  json: boolean;
  out?: string;
  model?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv;
  if (command !== 'audit') {
    throw new Error(command ? `unknown command: ${command}` : 'missing command');
  }
  const args: CliArgs = { dir: '', offline: false, fix: false, json: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    switch (arg) {
      case '--offline':
        args.offline = true;
        break;
      case '--fix':
        args.fix = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--out':
        args.out = rest[++i];
        break;
      case '--model':
        args.model = rest[++i];
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
        if (args.dir) throw new Error(`unexpected argument: ${arg}`);
        args.dir = arg;
    }
  }
  if (!args.dir) throw new Error('missing <dir> to audit');
  return args;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }

  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`error: ${(error as Error).message}\n`);
    console.error(USAGE);
    return 2;
  }

  const stat = await fs.stat(args.dir).catch(() => null);
  if (!stat?.isDirectory()) {
    console.error(`error: not a directory: ${args.dir}`);
    return 2;
  }

  const driver = args.offline ? null : args.model ? new ClaudeAgentDriver({ model: args.model }) : defaultDriver();

  const report = await runAudit(args.dir, {
    driver,
    offline: args.offline,
    fix: args.fix,
    log: (message) => console.error(`[vibesec] ${message}`),
  });

  if (report.patches.length) {
    const fixesDir = path.join(path.resolve(args.dir), 'vibesec-fixes');
    await fs.mkdir(fixesDir, { recursive: true });
    for (const patch of report.patches) {
      if (!patch.diff.trim()) continue;
      const name = `${patch.findingId}-${path.basename(patch.file)}.diff`;
      await fs.writeFile(path.join(fixesDir, name), patch.diff, 'utf8');
    }
    console.error(`[vibesec] patches written to ${fixesDir} — review before applying`);
  }

  const markdown = renderReport(report);
  console.log(args.json ? JSON.stringify(report, null, 2) : markdown);
  if (args.out) {
    await fs.writeFile(args.out, markdown, 'utf8');
    console.error(`[vibesec] report written to ${args.out}`);
  }

  const actionable = report.findings.some(
    (f) => (f.severity === 'critical' || f.severity === 'high') && f.status !== 'rejected',
  );
  return actionable ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`error: ${(error as Error).message}`);
    process.exit(2);
  },
);
