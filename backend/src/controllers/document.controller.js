import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Document from '../models/Document.js';
import Extraction from '../models/Extraction.js';
import Application from '../models/Application.js';
import { DOC_TYPES } from '../utils/enums.js';
import { HttpError, ok } from '../utils/http.js';
import { recordAudit } from '../services/audit.service.js';
import { extractDocument } from '../services/extraction.service.js';

async function ownedApp(applicationId, user) {
  const app = await Application.findOne({ applicationId });
  if (!app) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (user.role === 'CUSTOMER' && String(app.userId) !== String(user._id)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this application');
  return app;
}
export async function upload(req, res) {
  const app = await ownedApp(req.params.applicationId, req.user);
  if (!['SUBMITTED', 'RESUBMISSION_REQUESTED'].includes(app.status)) { if (req.file?.path) await fs.unlink(req.file.path).catch(() => {}); throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Documents cannot be uploaded in the current application status'); }
  if (!req.file) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'file', issue: 'A document file is required.' }]);
  const documentType = req.body.documentType;
  if (!DOC_TYPES.includes(documentType) || documentType === 'OTHER') { await fs.unlink(req.file.path).catch(() => {}); throw new HttpError(400, 'UNSUPPORTED_DOCUMENT_TYPE', 'Unsupported declared document type'); }
  const buffer = await fs.readFile(req.file.path);
  const text = buffer.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(buffer)) { await fs.unlink(req.file.path).catch(() => {}); throw new HttpError(400, 'INVALID_FILE_ENCODING', 'Document must be UTF-8 text'); }
  if (!text.includes('SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT')) { await fs.unlink(req.file.path).catch(() => {}); throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'file', issue: 'Synthetic document marker is required.' }]); }
  const hash = createHash('sha256').update(buffer).digest('hex');
  const existing = await Document.findOne({ application: app._id, sha256: hash }).select('-storagePath -sha256 -createdBy');
  if (existing) { await fs.unlink(req.file.path).catch(() => {}); return ok(res, 'Document already uploaded', { document: existing }); }
  const document = await Document.create({ applicationId: app.applicationId, application: app._id, documentType, fileName: req.file.originalname, storagePath: req.file.path, sha256: hash, createdBy: req.user._id });
  app.documentIds.addToSet(document._id); await app.save();
  await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'DOCUMENT_UPLOADED', details: { documentId: String(document._id), documentType, fileName: document.fileName, sha256: hash } });
  return ok(res, 'Document uploaded successfully', { document: { _id: String(document._id), applicationId: document.applicationId, documentType: document.documentType, fileName: document.fileName, extractionStatus: document.extractionStatus, createdAt: document.createdAt } }, 201);
}
export async function extract(req, res) {
  const result = await extractDocument(req.params.documentId, req.user._id);
  return ok(res, 'Document extraction completed', { documentId: String(result.documentId), docType: result.docType, confidence: result.confidence, fields: result.extractedFields.map((x) => ({ fieldName: x.fieldName, value: x.value, confidence: x.confidence })), extractionStatus: 'COMPLETED', source: result.source, extractorVersion: result.extractorVersion });
}
export async function listExtractions(req, res) {
  const app = await ownedApp(req.params.applicationId, req.user);
  if (req.user.role === 'CUSTOMER') throw new HttpError(403, 'FORBIDDEN', 'Extraction details are available to staff only');
  const { page, limit } = pagination(req.query);
  const [items, total] = await Promise.all([Extraction.find({ applicationId: app.applicationId }).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit), Extraction.countDocuments({ applicationId: app.applicationId })]);
  return ok(res, 'Extractions retrieved successfully', { items: items.map((x) => ({ _id: String(x._id), applicationId: x.applicationId, documentId: String(x.documentId), extractedFields: x.extractedFields, confidence: x.confidence, source: x.source, extractorVersion: x.extractorVersion, createdAt: x.createdAt })), total, page, limit });
}
function pagination(query) { const page = Math.max(1, Number.parseInt(query.page || '1', 10)); const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '10', 10))); return { page, limit }; }
