import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, similarity } from '../src/services/nameMatch.service.js';
import { classifyRisk } from '../src/services/risk.service.js';
import { screenWatchlists } from '../src/services/watchlist.service.js';
import Application from '../src/models/Application.js';
import { evaluateKyc } from '../src/services/kycRules.service.js';

const makeCase = ({ fullName = 'Ravi Kumar Sharma', dob = '1990-05-15', panName = fullName, panNumber = 'ZZKPS1234Q', aadhaarName = fullName, docs = ['PAN_CARD', 'AADHAAR_CARD', 'ELECTRICITY_BILL'] } = {}) => {
  const application = { applicationId: 'A2000001', createdAt: new Date('2026-03-04T06:00:00Z'), submittedAt: new Date('2026-03-04T06:00:00Z'), personalDetails: { fullName, dob, panNumber, aadhaarLast4: '4821', occupationCode: 'SALARIED_PRIVATE', annualIncome: 900000 }, addressDetails: { pincode: '400001' } };
  const all = {
    PAN_CARD: [['name', panName], ['dob', dob], ['pan_number', panNumber]],
    AADHAAR_CARD: [['name', aadhaarName], ['dob', dob], ['aadhaar_last4', '4821']],
    ELECTRICITY_BILL: [['pincode', '400001'], ['document_date', '2026-02-20']],
    BANK_STATEMENT: [['pincode', '400001'], ['document_date', '2026-02-20']],
    DRIVING_LICENCE: [['pincode', '400001'], ['valid_until', '2030-01-01']]
  };
  const documents = docs.map((documentType, index) => ({ _id: `doc-${index}`, fileName: `D30000${index + 1}.txt`, documentType }));
  const extractions = documents.map((doc, index) => ({ documentId: doc._id, docType: doc.documentType, confidence: 0.9, extractedFields: all[doc.documentType].map(([fieldName, value]) => ({ fieldName, value, confidence: 0.9 })) }));
  return { application, documents, extractions };
};

test('name normalization removes titles and ignores token order', () => {
  assert.equal(normalizeName('Dr. Ravi-Kumar Sharma'), 'KUMAR RAVI SHARMA');
  assert.equal(similarity('Asha Rao', 'Rao Asha'), 1);
  assert.equal(Number(similarity('Ravi Kumar Sharma', 'Ravi K Sharma').toFixed(4)), 0.7647);
});

test('synthetic watchlists distinguish confirmed and possible matches by DOB', async () => {
  const sanctionsMatch = await screenWatchlists('Valko Quillon', '1986-02-23', '2026-03-04');
  assert.equal(sanctionsMatch.sanctionsStatus, 'MATCH');
  const sanctionsPossible = await screenWatchlists('Valko Quillon', '1900-01-01', '2026-03-04');
  assert.equal(sanctionsPossible.sanctionsStatus, 'POSSIBLE');
  const pepMatch = await screenWatchlists('Zoya Menon', '1982-10-15', '2026-03-04');
  assert.equal(pepMatch.pepStatus, 'MATCH');
});

test('rules produce approval, name review, age rejection, sanctions rejection, and missing-document review', async () => {
  const originalExists = Application.exists;
  Application.exists = async () => null;
  try {
    const approved = makeCase();
    assert.equal((await evaluateKyc(approved.application, approved.documents, approved.extractions)).decision, 'APPROVE');

    const nameReview = makeCase({ panName: 'Ravi K Sharma' });
    const nameDecision = await evaluateKyc(nameReview.application, nameReview.documents, nameReview.extractions);
    assert.equal(nameDecision.decision, 'REVIEW');
    assert.deepEqual(nameDecision.reasonCodes, ['NAME_MISMATCH_MINOR']);
    assert.equal(nameDecision.nameMatchScore, 0.7647);

    const underage = makeCase({ fullName: 'Kavya Iyer', panName: 'Kavya Iyer', aadhaarName: 'Kavya Iyer', dob: '2008-09-10' });
    assert.deepEqual((await evaluateKyc(underage.application, underage.documents, underage.extractions)).reasonCodes, ['AGE_BELOW_18']);

    const sanctioned = makeCase({ fullName: 'Valko Quillon', panName: 'Valko Quillon', aadhaarName: 'Valko Quillon', dob: '1986-02-23' });
    assert.deepEqual((await evaluateKyc(sanctioned.application, sanctioned.documents, sanctioned.extractions)).reasonCodes, ['SANCTIONS_MATCH']);

    const missing = makeCase({ docs: ['PAN_CARD', 'AADHAAR_CARD'] });
    assert.deepEqual((await evaluateKyc(missing.application, missing.documents, missing.extractions)).reasonCodes, ['DOCUMENT_MISSING']);
  } finally { Application.exists = originalExists; }
});

test('risk and re-KYC schedule follow the specified thresholds', () => {
  assert.deepEqual(classifyRisk({ occupationRisk: 'LOW', annualIncome: 900000, applicationDate: '2026-03-04' }), { riskCategory: 'LOW', rekycDueDate: '2036-03-04' });
  assert.deepEqual(classifyRisk({ occupationRisk: 'HIGH', annualIncome: 900000, applicationDate: '2026-03-04' }), { riskCategory: 'HIGH', rekycDueDate: '2028-03-04' });
});
