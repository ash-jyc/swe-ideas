import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { config, dataPath } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(config.dataDir, { recursive: true });
  const instance = new Database(dataPath('platform.sqlite'));
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.pragma('busy_timeout = 5000');
  db = instance;
  return db;
}
