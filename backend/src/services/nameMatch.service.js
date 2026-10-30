import fs from 'node:fs';
import path from 'node:path';
const configPath = path.resolve(process.env.RULE_CONFIG_PATH || './config/rules.json');
const titleTokens = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')).name_title_tokens : null;
export function normalizeName(value, tokens = titleTokens || ['MR', 'MRS', 'MS', 'MISS', 'DR', 'SHRI', 'SMT', 'KUMARI']) {
  return String(value ?? '').toUpperCase().replace(/[.-]/g, ' ').replace(/[^A-Z ]/g, ' ').split(/\s+/).filter((x) => x && !tokens.includes(x)).sort().join(' ');
}
export function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let diagonal = prev[0]; prev[0] = i; for (let j = 1; j <= b.length; j++) { const old = prev[j]; prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)); diagonal = old; } }
  return prev[b.length];
}
export function similarity(a, b) { const x = normalizeName(a), y = normalizeName(b); if (!x && !y) return 1; return 1 - levenshtein(x, y) / Math.max(x.length, y.length, 1); }
