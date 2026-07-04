import type { Rule } from '../types.js';

export const baasRules: Rule[] = [
  {
    id: 'baas/firestore-rules-open',
    category: 'baas',
    severity: 'critical',
    cwe: 'CWE-284',
    title: 'Firebase security rules allow unrestricted access',
    description:
      'A Firestore/Storage rules file grants read or write with "if true", so anyone on the internet can read or modify this data — no authentication required.',
    fix: 'Write per-collection rules that check request.auth (e.g. `allow read, write: if request.auth != null && request.auth.uid == userId`).',
    incident:
      'The Tea app breach (72K ID photos, 1.1M private messages) came from a publicly accessible Firebase storage bucket.',
    pathPattern: /\.rules$/,
    pattern: /allow\s+(?:read|write|create|update|delete|get|list)(?:\s*,\s*\w+)*\s*:\s*if\s+true\b/,
    examples: {
      vulnerable: [{ code: 'allow read, write: if true;', file: 'firestore.rules' }],
      clean: [{ code: 'allow read, write: if request.auth != null && request.auth.uid == userId;', file: 'firestore.rules' }],
    },
  },
  {
    id: 'baas/firebase-json-rules-open',
    category: 'baas',
    severity: 'critical',
    cwe: 'CWE-284',
    title: 'Firebase Realtime Database rules are world-readable/writable',
    description: 'A database rules JSON sets ".read" or ".write" to true, exposing the whole database publicly.',
    fix: 'Scope rules to authenticated users: `".read": "auth != null"` and per-path ownership checks.',
    extensions: ['.json'],
    pattern: /"\.(?:read|write)"\s*:\s*true\b/,
    examples: {
      vulnerable: [{ code: '{ "rules": { ".read": true, ".write": true } }', file: 'database.rules.json' }],
      clean: [{ code: '{ "rules": { ".read": "auth != null", ".write": "auth != null" } }', file: 'database.rules.json' }],
    },
  },
  {
    id: 'baas/supabase-rls-disabled',
    category: 'baas',
    severity: 'critical',
    cwe: 'CWE-284',
    title: 'Row Level Security disabled on a Supabase/Postgres table',
    description:
      'DISABLE ROW LEVEL SECURITY removes the only barrier between the public anon key and the entire table. With RLS off, anyone holding the (intentionally public) anon key can read and write every row.',
    fix: 'ALTER TABLE ... ENABLE ROW LEVEL SECURITY and write policies for each role; test with the anon key.',
    incident:
      'Moltbook (Jan 2026): RLS disabled + anon key in client JS exposed 1.5M API keys — the fix was two SQL statements.',
    extensions: ['.sql'],
    pattern: /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    examples: {
      vulnerable: [{ code: 'ALTER TABLE agents DISABLE ROW LEVEL SECURITY;', file: 'supabase/migrations/001_init.sql' }],
      clean: [{ code: 'ALTER TABLE agents ENABLE ROW LEVEL SECURITY;', file: 'supabase/migrations/001_init.sql' }],
    },
  },
  {
    id: 'baas/public-bucket-acl',
    category: 'baas',
    severity: 'high',
    cwe: 'CWE-284',
    title: 'Storage bucket configured with a public ACL',
    description: 'A storage bucket/object is created with a public-read or public-read-write ACL.',
    fix: 'Default to private buckets; serve files through signed URLs or an authenticated endpoint.',
    pattern: /['"]public-read(?:-write)?['"]/,
    examples: {
      vulnerable: [{ code: "await s3.putObject({ Bucket, Key, ACL: 'public-read-write' });", file: 'server/upload.js' }],
      clean: [{ code: "await s3.putObject({ Bucket, Key, ACL: 'private' });", file: 'server/upload.js' }],
    },
  },
];
