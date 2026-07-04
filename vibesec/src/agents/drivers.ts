import type { AgentName } from './definitions.js';

export interface AgentTask {
  agent: AgentName;
  systemPrompt: string;
  prompt: string;
  /** Project directory the agent may read (never write). */
  cwd: string;
}

/**
 * Abstraction over "run an agent, get its final text back". Production uses
 * the Claude Agent SDK; tests use ScriptedDriver so the whole pipeline runs
 * offline and deterministically.
 */
export interface ModelDriver {
  readonly name: string;
  run(task: AgentTask): Promise<string>;
}

export type ScriptedResponse = string | ((task: AgentTask) => string);

/** Replays canned responses per agent, in order. Entries may be functions that compute the reply from the task (e.g. to echo finding ids from the prompt). */
export class ScriptedDriver implements ModelDriver {
  readonly name = 'scripted';
  readonly calls: AgentTask[] = [];
  private readonly script: Partial<Record<AgentName, ScriptedResponse[]>>;

  constructor(script: Partial<Record<AgentName, ScriptedResponse[]>>) {
    this.script = script;
  }

  async run(task: AgentTask): Promise<string> {
    this.calls.push(task);
    const queue = this.script[task.agent];
    const next = queue?.shift();
    if (next === undefined) {
      throw new Error(`ScriptedDriver: no scripted response left for agent "${task.agent}"`);
    }
    return typeof next === 'function' ? next(task) : next;
  }
}

/**
 * Runs agents on Claude via the Claude Agent SDK with read-only code tools.
 * Imported lazily so offline/scan-only use never loads (or needs) the SDK.
 */
export class ClaudeAgentDriver implements ModelDriver {
  readonly name = 'claude-agent-sdk';
  private readonly model: string | undefined;

  constructor(options: { model?: string } = {}) {
    this.model = options.model;
  }

  async run(task: AgentTask): Promise<string> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const stream = query({
      prompt: task.prompt,
      options: {
        cwd: task.cwd,
        model: this.model,
        systemPrompt: task.systemPrompt,
        allowedTools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'default',
        maxTurns: 30,
      },
    });

    let result = '';
    for await (const message of stream) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          result = message.result;
        } else {
          throw new Error(`agent "${task.agent}" did not complete: ${message.subtype}`);
        }
      }
    }
    if (!result) {
      throw new Error(`agent "${task.agent}" returned no result`);
    }
    return result;
  }
}

/**
 * Picks the production driver when credentials exist, otherwise null (callers
 * fall back to scan-only mode).
 */
export function defaultDriver(): ModelDriver | null {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return new ClaudeAgentDriver();
  }
  return null;
}
