import type { Request } from 'express';

/**
 * Read a route param regardless of how Express infers the handler's param type.
 * Needed for sub-routers using { mergeParams: true }, where a parent param like
 * :id is present at runtime but not inferred from the child route's path.
 */
export function getParam(req: Request, key: string): string {
  return (req.params as Record<string, string>)[key] ?? '';
}
