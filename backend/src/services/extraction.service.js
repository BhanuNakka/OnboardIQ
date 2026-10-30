import fs from 'node:fs/promises';
import Extraction from '../models/Extraction.js';
import Document from '../models/Document.js';
import { recordAudit } from './audit.service.js';

const patterns = [
  ['pan_number', /\b([A-Z]{5}[0-9]{4}[A-Z])\b/i], ['aadhaar_last4', /(?:last\s*4|xxxx\s*xxxx\s*|aadhaar)[^\d]{0,20}(\d{4})/i],
  ['dob', /(?:dob|date of birth)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i],
  ['pincode', /(?:pincode|pin)\s*[:\-]?\s*(\d{6})/i], ['document_date', /(?:document date|bill date|statement date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i],
  ['valid_until', /(?:valid until|expiry|expires)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i],
  ['name', /(?:name|holder)\s*[:\-]?\s*([A-Z][A-Z .'-]{2,60})/i]
];
function dateNormalize(value) { if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const parts = value.split(/[/-]/).map(Number); const [d, m, y] = parts; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
export async function extractDocument(documentId, actorId = null) {
  const doc = await Document.findById(documentId).select('+storagePath');
  if (!doc) { const error = new Error('Document not found'); error.status = 404; error.code = 'DOCUMENT_NOT_FOUND'; throw error; }
  doc.extractionStatus = 'PROCESSING'; await doc.save();
  try {
    const text = await fs.readFile(doc.storagePath, 'utf8');
    let docType = 'OTHER';
    if (!/ignore all previous instructions/i.test(text)) {
      if (/driving licence|driver license/i.test(text)) docType = 'DRIVING_LICENCE'; else if (/electricity bill|power bill/i.test(text)) docType = 'ELECTRICITY_BILL'; else if (/bank statement/i.test(text)) docType = 'BANK_STATEMENT'; else if (/aadhaar/i.test(text)) docType = 'AADHAAR_CARD'; else if (/permanent account number|pan card/i.test(text)) docType = 'PAN_CARD';
    }
    const confidence = docType === 'OTHER' ? 0 : 0.9;
    const extractedFields = docType === 'OTHER' ? [] : patterns.flatMap(([fieldName, pattern]) => { const match = pattern.exec(text); if (!match) return []; let value = match[1].trim(); if (fieldName === 'pan_number') value = value.toUpperCase(); if (['dob', 'document_date', 'valid_until'].includes(fieldName)) value = dateNormalize(value); return [{ fieldName, value, confidence: 0.9, source: 'MOCK' }]; });
    const record = await Extraction.findOneAndUpdate({ documentId: doc._id }, { applicationId: doc.applicationId, docType, confidence, extractedFields, source: 'MOCK', extractorVersion: 'text-regex-mock-v1' }, { upsert: true, new: true, setDefaultsOnInsert: true });
    doc.extractionStatus = 'COMPLETED'; await doc.save();
    await recordAudit({ applicationId: doc.applicationId, actorId, action: 'DOCUMENT_EXTRACTED', details: { documentId: String(doc._id), docType, fieldCount: extractedFields.length, provider: 'MOCK' } });
    return record;
  } catch (error) { doc.extractionStatus = 'FAILED'; await doc.save(); await recordAudit({ applicationId: doc.applicationId, actorId, action: 'DOCUMENT_EXTRACTION_FAILED', details: { documentId: String(doc._id) } }); throw error; }
}
