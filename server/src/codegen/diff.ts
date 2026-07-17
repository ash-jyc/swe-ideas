import { createPatch } from 'diff';

/** Unified diff of a single file between two revisions. */
export function unifiedDiff(
  path: string,
  before: string,
  after: string,
): string {
  return createPatch(path, before, after, 'before', 'after', { context: 3 });
}
