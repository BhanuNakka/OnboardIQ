import { screenWatchlists } from './watchlist.service.js';
import { similarity } from './nameMatch.service.js';
import { classifyRisk } from './risk.service.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { occupationLevel } from './risk.service.js';
const require = createRequire(import.meta.url); const csv = require('csv-parser');

const configFile = path.resolve(process.env.RULE_CONFIG_PATH || './config/rules.json');
const RULES = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
const MIN_CONFIDENCE = Number(RULES.min_field_confidence ?? 0.8);
const usable = (field) => field && field.value !== '' && field.value !== null && field.value !== undefined && Number(field.confidence) >= MIN_CONFIDENCE;
const field = (extraction, name) => extraction?.extractedFields?.find((f) => f.fieldName === name);
const dateOnly = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return `${parts.find((x) => x.type === 'year').value}-${parts.find((x) => x.type === 'month').value}-${parts.find((x) => x.type === 'day').value}`;
};
function ageAt(dob, on) { const b = new Date(`${dateOnly(dob)}T00:00:00Z`), d = new Date(`${dateOnly(on)}T00:00:00Z`); let age = d.getUTCFullYear() - b.getUTCFullYear(); if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--; return age; }

export async function evaluateKyc(application, documents, extractions, occupationRisk = 'LOW') {
  const codes = [];
  const byDoc = documents.map((doc) => ({ doc, extraction: extractions.find((x) => String(x.documentId) === String(doc._id)) }));
  const usableType = (extraction) => extraction && extraction.confidence >= MIN_CONFIDENCE && extraction.docType !== 'OTHER';
  const panPair = byDoc.find(({ extraction }) => usableType(extraction) && extraction.docType === 'PAN_CARD');
  const aadhaarPair = byDoc.find(({ extraction }) => usableType(extraction) && extraction.docType === 'AADHAAR_CARD');
  const addresses = byDoc.filter(({ extraction }) => usableType(extraction) && ['ELECTRICITY_BILL', 'BANK_STATEMENT', 'DRIVING_LICENCE'].includes(extraction?.docType)).sort((a, b) => String(a.doc.fileName).localeCompare(String(b.doc.fileName), undefined, { numeric: true }));
  const addressPair = addresses[0];
  if (!panPair || !aadhaarPair || !addressPair) codes.push('DOCUMENT_MISSING');
  if (byDoc.some(({ doc, extraction }) => extraction && extraction.docType !== doc.documentType)) codes.push('DOCUMENT_TYPE_MISMATCH');
  const requirements = { PAN_CARD: ['name', 'dob', 'pan_number'], AADHAAR_CARD: ['name', 'dob', 'aadhaar_last4'], ELECTRICITY_BILL: ['pincode', 'document_date'], BANK_STATEMENT: ['pincode', 'document_date'], DRIVING_LICENCE: ['pincode', 'valid_until'] };
  const selected = [panPair, aadhaarPair, addressPair].filter(Boolean);
  const low = byDoc.some(({ extraction }) => !extraction || extraction.confidence < MIN_CONFIDENCE) || selected.some(({ extraction }) => (requirements[extraction.docType] || []).some((f) => !usable(field(extraction, f))));
  if (low) codes.push('LOW_EXTRACTION_CONFIDENCE');

  const p = application.personalDetails; const appDate = dateOnly(application.submittedAt || application.createdAt);
  if (ageAt(p.dob, appDate) < Number(RULES.minimum_age || 18)) codes.push('AGE_BELOW_18');
  if (!new RegExp(RULES.pan_pattern || '^[A-Z]{5}[0-9]{4}[A-Z]$').test(p.panNumber) || p.panNumber[3] !== (RULES.pan_holder_type_character || 'P')) codes.push('PAN_INVALID');
  const panNumber = field(panPair?.extraction, 'pan_number');
  if (usable(panNumber) && panNumber.value !== p.panNumber) codes.push('PAN_MISMATCH');
  const panDob = field(panPair?.extraction, 'dob'), aadhaarDob = field(aadhaarPair?.extraction, 'dob');
  if ((usable(panDob) && dateOnly(panDob.value) !== dateOnly(p.dob)) || (usable(aadhaarDob) && dateOnly(aadhaarDob.value) !== dateOnly(p.dob))) codes.push('DOB_MISMATCH');
  const aadhaar = field(aadhaarPair?.extraction, 'aadhaar_last4');
  if (usable(aadhaar) && aadhaar.value !== p.aadhaarLast4) codes.push('AADHAAR_MISMATCH');
  const nameFields = [field(panPair?.extraction, 'name'), field(aadhaarPair?.extraction, 'name')].filter(usable);
  const nameMatchScore = nameFields.length ? Math.min(...nameFields.map((f) => similarity(p.fullName, f.value))) : null;
  if (nameMatchScore !== null && nameMatchScore < Number(RULES.name_match_reject_below || 0.75)) codes.push('NAME_MISMATCH');
  const watch = await screenWatchlists(p.fullName, p.dob, appDate);
  if (watch.sanctionsStatus === 'MATCH') codes.push('SANCTIONS_MATCH');
  if (nameMatchScore !== null && nameMatchScore >= Number(RULES.name_match_reject_below || 0.75) && nameMatchScore < Number(RULES.name_match_pass || 0.9)) codes.push('NAME_MISMATCH_MINOR');
  if (addressPair?.extraction?.docType === 'DRIVING_LICENCE') {
    const until = field(addressPair.extraction, 'valid_until'); if (usable(until) && dateOnly(until.value) < appDate) codes.push('DOCUMENT_EXPIRED');
  } else if (addressPair) {
    const docDate = field(addressPair.extraction, 'document_date'); if (usable(docDate)) { const age = (Date.parse(`${appDate}T00:00:00Z`) - Date.parse(`${dateOnly(docDate.value)}T00:00:00Z`)) / 86400000; if (age > Number(RULES.address_proof_max_age_days || 90) || age < 0) codes.push('ADDRESS_PROOF_STALE'); }
  }
  const pin = field(addressPair?.extraction, 'pincode');
  if (usable(pin) && pin.value !== application.addressDetails.pincode) codes.push('ADDRESS_MISMATCH');
  if (watch.sanctionsStatus === 'POSSIBLE') codes.push('SANCTIONS_POSSIBLE_MATCH');
  if (watch.pepStatus === 'MATCH') codes.push('PEP_MATCH');
  const duplicate = await import('../models/Application.js').then(({ default: Application }) => Application.exists({ 'personalDetails.panNumber': p.panNumber, applicationId: { $ne: application.applicationId }, status: { $nin: ['REJECTED', 'AUTO_REJECTED', 'CLOSED_EXPIRED'] } })) || await existingCustomerHasPan(p.panNumber);
  if (duplicate) codes.push('DUPLICATE_CUSTOMER');

  const reject = codes.some((code) => /^R(?:4|5|6|7|8|9|10)$/.test(({ AGE_BELOW_18: 'R4', PAN_INVALID: 'R5', PAN_MISMATCH: 'R6', DOB_MISMATCH: 'R7', AADHAAR_MISMATCH: 'R8', NAME_MISMATCH: 'R9', SANCTIONS_MATCH: 'R10' })[code] || ''));
  const decision = reject ? 'REJECT' : codes.length ? 'REVIEW' : 'APPROVE';
  const risk = decision === 'REJECT' ? { riskCategory: null, rekycDueDate: null } : classifyRisk({ occupationRisk: occupationLevel(p.occupationCode) || occupationRisk, annualIncome: p.annualIncome, pepMatch: watch.pepStatus === 'MATCH', sanctionsPossible: watch.sanctionsStatus === 'POSSIBLE', applicationDate: appDate });
  return { decision, reasonCodes: codes, nameMatchScore: nameMatchScore === null ? null : Number(nameMatchScore.toFixed(4)), ...risk, evidence: { watchlist: watch }, evaluatedAt: new Date(), documents: byDoc.map(({ doc, extraction }) => ({ documentId: String(doc._id), docType: extraction?.docType || 'OTHER', confidence: extraction?.confidence || 0 })) };
}

async function existingCustomerHasPan(panNumber) {
  const file = path.resolve(process.env.EXISTING_CUSTOMERS_FILE || './data/existing_customers.csv');
  if (!fs.existsSync(file)) return false;
  return new Promise((resolve, reject) => { let found = false; fs.createReadStream(file).pipe(csv()).on('data', (row) => { if (row.pan_number === panNumber || row.panNumber === panNumber) found = true; }).on('end', () => resolve(found)).on('error', reject); });
}
