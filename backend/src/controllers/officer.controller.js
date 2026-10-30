import Application from '../models/Application.js';
import Document from '../models/Document.js';
import Extraction from '../models/Extraction.js';
import ReviewAction from '../models/ReviewAction.js';
import { evaluateKyc } from '../services/kycRules.service.js';
import { recordAudit } from '../services/audit.service.js';
import { HttpError, ok } from '../utils/http.js';
import { MAKER_RECOMMENDATIONS } from '../utils/enums.js';
import fs from 'node:fs/promises';
import { maskPan } from '../utils/serializers.js';

export async function queue(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const filter = { status: 'IN_REVIEW' };
  const [records, total] = await Promise.all([Application.find(filter).sort({ submittedAt: 1 }), Application.countDocuments(filter)]);
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 }; const items = records.sort((a, b) => (rank[a.riskCategory] ?? 3) - (rank[b.riskCategory] ?? 3) || new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt)).slice((page - 1) * limit, page * limit);
  return ok(res, 'Review queue retrieved successfully', { items, total, page, limit });
}
export async function detail(req, res) {
  const app = await Application.findOne({ applicationId: req.params.applicationId });
  if (!app) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (app.status !== 'IN_REVIEW') throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application is not in the review queue');
  const docs = await Document.find({ application: app._id }).select('+storagePath').sort({ _id: 1 }); const extractions = await Extraction.find({ applicationId: app.applicationId });
  const items = [];
  for (const doc of docs) { const text = await fs.readFile(doc.storagePath, 'utf8'); const extraction = extractions.find((x) => String(x.documentId) === String(doc._id)); items.push({ documentId: String(doc._id), fileName: doc.fileName, text, docType: extraction?.docType || 'OTHER', fields: extraction?.extractedFields || [] }); await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'DOCUMENT_VIEWED', details: { documentId: String(doc._id), role: req.user.role } }); }
  return ok(res, 'Review case retrieved successfully', { application: app, documents: items, decision: { decision: app.decision, reasonCodes: app.reasonCodes } });
}
export async function recommend(req, res) {
  const { recommendation, comments, corrections = [] } = req.body;
  if (!MAKER_RECOMMENDATIONS.includes(recommendation) || typeof comments !== 'string' || comments.trim().length < 10) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'recommendation', issue: 'Provide a valid recommendation and a comment of at least 10 characters.' }]);
  const app = await Application.findOne({ applicationId: req.params.applicationId });
  if (!app) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (app.status !== 'IN_REVIEW') throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application is not awaiting maker review');
  for (const correction of corrections) {
    if (!correction.reason?.trim()) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'corrections.reason', issue: 'A correction reason is required.' }]);
    const ext = await Extraction.findOne({ applicationId: app.applicationId, documentId: correction.documentId }); if (!ext) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Extraction not found');
    const target = ext.extractedFields.find((f) => f.fieldName === correction.fieldName); const before = target?.value ?? null;
    if (target) { target.value = correction.value; target.confidence = 1; target.source = 'OFFICER'; } else ext.extractedFields.push({ fieldName: correction.fieldName, value: correction.value, confidence: 1, source: 'OFFICER' });
    await ext.save(); const sensitive = correction.fieldName === 'pan_number'; await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'FIELD_CORRECTED', details: { documentId: correction.documentId, fieldName: correction.fieldName, before: sensitive ? maskPan(before) : before, after: sensitive ? maskPan(correction.value) : correction.value, reason: correction.reason } });
  }
  const docs = await Document.find({ application: app._id }).sort({ _id: 1 }), extractions = await Extraction.find({ applicationId: app.applicationId });
  const result = await evaluateKyc(app, docs, extractions);
  const targetStatus = recommendation === 'REQUEST_RESUBMISSION' ? 'RESUBMISSION_REQUESTED' : 'PENDING_CHECKER';
  app.decision = result.decision; app.reasonCodes = result.reasonCodes; app.riskCategory = result.riskCategory; app.nameMatchScore = result.nameMatchScore; app.rekycDueDate = result.rekycDueDate; app.status = targetStatus; app.version += 1; await app.save();
  const action = await ReviewAction.findOneAndUpdate({ applicationId: app.applicationId }, { $set: { applicationId: app.applicationId, makerId: req.user._id, makerRecommendation: recommendation, makerComments: comments }, $unset: { checkerId: 1, checkerDecision: 1, checkerComments: 1 } }, { upsert: true, new: true });
  await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'MAKER_RECOMMENDATION', details: { recommendation, comments, status: targetStatus, reasonCodes: result.reasonCodes } });
  return ok(res, 'Maker recommendation recorded successfully', { makerChecker: action, status: targetStatus, decision: { decision: result.decision, reasonCodes: result.reasonCodes, riskCategory: result.riskCategory, rekycDueDate: result.rekycDueDate } });
}
