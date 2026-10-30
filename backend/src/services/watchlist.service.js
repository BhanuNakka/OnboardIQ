import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { similarity } from './nameMatch.service.js';
const ruleFile = path.resolve(process.env.RULE_CONFIG_PATH || './config/rules.json');
const rules = fs.existsSync(ruleFile) ? JSON.parse(fs.readFileSync(ruleFile, 'utf8')) : {};
const require = createRequire(import.meta.url);
const csv = require('csv-parser');

async function loadCsv(file) {
  if (!fs.existsSync(file)) return [];
  return new Promise((resolve, reject) => { const rows = []; fs.createReadStream(file).pipe(csv()).on('data', (row) => rows.push(row)).on('end', () => resolve(rows)).on('error', reject); });
}
export async function screenWatchlists(fullName, dob, applicationDate = new Date()) {
  const dir = process.env.WATCHLIST_DIR || './data/watchlists';
  const [sanctions, pep] = await Promise.all([loadCsv(path.join(dir, 'sanctions.csv')), loadCsv(path.join(dir, 'pep.csv'))]);
  const compare = (entry, idField) => {
    const best = Math.max(similarity(fullName, entry.name), similarity(fullName, entry.alias || ''));
    const sameDob = !entry.dob || entry.dob === dob;
    const matchThreshold = Number(rules.watchlist_match || 0.9), possibleThreshold = Number(rules.watchlist_possible || 0.8);
    const status = best >= matchThreshold && sameDob ? 'MATCH' : (best >= matchThreshold && !sameDob) || (best >= possibleThreshold && best < matchThreshold) ? 'POSSIBLE' : 'NO_MATCH';
    return { id: entry[idField], name: entry.name, alias: entry.alias || '', dob: entry.dob || '', similarity: best, status, category: entry.category || '', position: entry.position || '', program: entry.program || '' };
  };
  const sanctionsResults = sanctions.map((entry) => compare(entry, 'list_id'));
  const pepResults = pep.map((entry) => compare(entry, 'pep_id'));
  return {
    sanctions: sanctionsResults.sort((a, b) => b.similarity - a.similarity), pep: pepResults.sort((a, b) => b.similarity - a.similarity),
    sanctionsStatus: sanctionsResults.some((x) => x.status === 'MATCH') ? 'MATCH' : sanctionsResults.some((x) => x.status === 'POSSIBLE') ? 'POSSIBLE' : 'NO_MATCH',
    pepStatus: pepResults.some((x) => x.status === 'MATCH') ? 'MATCH' : pepResults.some((x) => x.status === 'POSSIBLE') ? 'POSSIBLE' : 'NO_MATCH',
    applicationDate: new Date(applicationDate).toISOString().slice(0, 10)
  };
}
