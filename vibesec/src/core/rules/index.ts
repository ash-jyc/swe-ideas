import type { Rule } from '../types.js';
import { secretRules } from './secrets.js';
import { baasRules } from './baas.js';
import { injectionRules } from './injection.js';
import { webRules } from './web.js';
import { cryptoRules } from './crypto.js';
import { filesystemRules } from './filesystem.js';

export const allRules: Rule[] = [
  ...secretRules,
  ...baasRules,
  ...injectionRules,
  ...webRules,
  ...cryptoRules,
  ...filesystemRules,
];

const byId = new Map(allRules.map((r) => [r.id, r]));

export function getRule(id: string): Rule | undefined {
  return byId.get(id);
}
