import { config } from '../config.js';
import type { ProjectFileTree } from '@vibe/shared';
import { getProjectFiles } from '../db/repositories/files.js';
import { listTurns } from '../db/repositories/turns.js';
import { buildFileTree } from '../util/fileTree.js';
import { buildSystemPrompt } from './systemPrompt.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BuiltContext {
  system: string;
  messages: ChatMessage[];
}

export function projectFileTree(projectId: string): ProjectFileTree {
  const files = getProjectFiles(projectId);
  return buildFileTree(
    files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, 'utf8') })),
  );
}

function cap(content: string): string {
  if (content.length <= config.contextFileCap) return content;
  return (
    content.slice(0, config.contextFileCap) +
    `\n... [truncated ${content.length - config.contextFileCap} chars] ...`
  );
}

/**
 * Assemble the model context:
 *   system prompt (with current file tree + available deps)
 *   → compact prior-turn history (prompt + assistant summary)
 *   → current full file contents (size-capped)
 *   → the new user prompt
 */
export function buildContext(projectId: string, prompt: string): BuiltContext {
  const tree = projectFileTree(projectId);
  const system = buildSystemPrompt(tree);

  const messages: ChatMessage[] = [];
  for (const turn of listTurns(projectId)) {
    if (turn.status !== 'complete') continue;
    messages.push({ role: 'user', content: turn.prompt });
    messages.push({
      role: 'assistant',
      content: turn.summary?.trim() || '(updated the project files)',
    });
  }

  const files = getProjectFiles(projectId);
  let filesBlock = '';
  if (files.length > 0) {
    filesBlock =
      'Here are the current contents of every project file:\n\n' +
      files
        .map((f) => `=== ${f.path} ===\n${cap(f.content)}`)
        .join('\n\n') +
      '\n\n';
  }

  messages.push({ role: 'user', content: filesBlock + prompt });
  return { system, messages };
}
