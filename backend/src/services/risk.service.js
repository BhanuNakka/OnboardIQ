import fs from 'node:fs';
import path from 'node:path';
function rulesConfig() {
  const file = path.resolve(process.env.RULE_CONFIG_PATH || './config/rules.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
function addYears(dateString, years) {
  const [y, m, d] = dateString.split('-').map(Number); const day = m === 2 && d === 29 ? 28 : d;
  const target = new Date(Date.UTC(y + years, m - 1, day)); return target.toISOString().slice(0, 10);
}
export function occupationLevel(occupationCode) {
  const file = path.resolve(process.env.OCCUPATIONS_FILE || './data/watchlists/occupations.csv');
  if (!fs.existsSync(file)) return 'LOW';
  const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1);
  const row = rows.map((line) => line.split(',')).find(([code]) => code === occupationCode);
  const level = row?.at(-1);
  return ['LOW', 'MEDIUM', 'HIGH'].includes(level) ? level : 'LOW';
}
export function classifyRisk({ occupationRisk = 'LOW', annualIncome = 0, pepMatch = false, sanctionsPossible = false, applicationDate }) {
  const config = rulesConfig();
  const riskCategory = pepMatch || sanctionsPossible || occupationRisk === 'HIGH' ? 'HIGH' : occupationRisk === 'MEDIUM' || annualIncome >= Number(config.medium_income_threshold || 2500000) ? 'MEDIUM' : 'LOW';
  const years = Number(config.rekyc_years?.[riskCategory] || (riskCategory === 'HIGH' ? 2 : riskCategory === 'MEDIUM' ? 8 : 10));
  return { riskCategory, rekycDueDate: addYears(applicationDate, years) };
}
