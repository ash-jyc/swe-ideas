import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getDb } from './connection.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Apply the schema idempotently. Every statement uses IF NOT EXISTS, so this is
 * safe to run on every boot. A schema_version row is maintained for future
 * migrations that need to alter existing tables.
 */
export function migrate(): void {
  const db = getDb();
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const sql = readFileSync(resolve(here, 'schema.sql'), 'utf8');
  db.exec(sql);
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined;
  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);
  }
}
