import Application from '../models/Application.js';
import Counter from '../models/Counter.js';
import Document from '../models/Document.js';
import Extraction from '../models/Extraction.js';
import Decision from '../models/Decision.js';
import { TRANSITIONS } from '../utils/enums.js';
import { HttpError, ok } from '../utils/http.js';
import { publicApplication } from '../utils/serializers.js';
import { recordAudit } from '../services/audit.service.js';
import { extractDocument } from '../services/extraction.service.js';
import { evaluateKyc } from '../services/kycRules.service.js';
import { createAccount } from '../services/coreBanking.service.js';

const validateDetails = (personal, address) => {
  const requiredPersonal = ['fullName', 'dob', 'gender', 'panNumber', 'aadhaarLast4', 'mobile', 'email', 'occupationCode', 'annualIncome'];
  const requiredAddress = ['address', 'city', 'state', 'pincode'];
  const isMissing = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  const details = [...requiredPersonal.filter((k) => isMissing(personal?.[k])).map((field) => ({ field: `personalDetails.${field}`, issue: 'Required field is missing.' })), ...requiredAddress.filter((k) => isMissing(address?.[k])).map((field) => ({ field: `addressDetails.${field}`, issue: 'Required field is missing.' }))];
  if (personal?.consentToKyc !== true) details.push({ field: 'personalDetails.consentToKyc', issue: 'Consent to KYC checks is required.' });
  if (personal?.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(personal.panNumber)) details.push({ field: 'personalDetails.panNumber', issue: 'PAN must match the required 10-character format.' });
  if (personal?.aadhaarLast4 && !/^\d{4}$/.test(personal.aadhaarLast4)) details.push({ field: 'personalDetails.aadhaarLast4', issue: 'Only the last four Aadhaar digits are accepted.' });
  if (personal?.mobile && !/^[6-9]\d{9}$/.test(personal.mobile)) details.push({ field: 'personalDetails.mobile', issue: 'Mobile must be a valid 10-digit number.' });
  if (personal?.email && !/^\S+@\S+\.\S+$/.test(personal.email)) details.push({ field: 'personalDetails.email', issue: 'Enter a valid email.' });
  if (address?.pincode && !/^[1-9]\d{5}$/.test(address.pincode)) details.push({ field: 'addressDetails.pincode', issue: 'Pincode must be a valid 6-digit number.' });
  if (personal?.dob && (Number.isNaN(Date.parse(personal.dob)) || new Date(personal.dob) > new Date())) details.push({ field: 'personalDetails.dob', issue: 'Date of birth must be valid and not in the future.' });
  if (personal?.annualIncome !== undefined && (!Number.isFinite(Number(personal.annualIncome)) || Number(personal.annualIncome) < 0)) details.push({ field: 'personalDetails.annualIncome', issue: 'Annual income must be a non-negative number.' });
  if (details.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', details);
};
const roleIsStaff = (role) => ['MAKER', 'CHECKER', 'COMPLIANCE', 'ADMIN'].includes(role);
async function getVisibleApplication(applicationId, user) {
  const app = await Application.findOne({ applicationId });
  if (!app) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (user.role === 'CUSTOMER' && String(app.userId) !== String(user._id)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this application');
  return app;
}
export async function createApplication(req, res) {
  const { personalDetails, addressDetails } = req.body;
  validateDetails(personalDetails, addressDetails);
  const dup = await Application.exists({ userId: req.user._id, 'personalDetails.panNumber': personalDetails.panNumber, status: { $nin: ['REJECTED', 'AUTO_REJECTED', 'CLOSED_EXPIRED'] } });
  if (dup) throw new HttpError(409, 'DUPLICATE_APPLICATION', 'An open application already exists for this PAN');
  await Counter.updateOne({ _id: 'applicationId' }, { $setOnInsert: { value: 2000000 } }, { upsert: true });
  const counter = await Counter.findByIdAndUpdate('applicationId', { $inc: { value: 1 } }, { new: true });
  const applicationId = `A${counter.value}`;
  const application = await Application.create({ applicationId, userId: req.user._id, personalDetails, addressDetails, status: 'SUBMITTED' });
  await recordAudit({ applicationId, actorId: req.user._id, action: 'APPLICATION_CREATED', details: { status: application.status } });
  return ok(res, 'Application created successfully', { application: publicApplication(application) }, 201);
}
export async function mine(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([Application.find({ userId: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit), Application.countDocuments({ userId: req.user._id })]);
  return ok(res, 'Applications retrieved successfully', { items: items.map((x) => publicApplication(x)), total, page, limit });
}
function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10)); const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '10', 10)));
  return { page, limit, skip: (page - 1) * limit };
}
export async function listAll(req, res) {
  const { page, limit, skip } = pagination(req.query); const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.riskCategory) filter.riskCategory = req.query.riskCategory;
  if (req.query.from || req.query.to) filter.createdAt = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(`${req.query.to}T23:59:59.999Z`) } : {}) };
  const [items, total] = await Promise.all([Application.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Application.countDocuments(filter)]);
  return ok(res, 'Applications retrieved successfully', { items: items.map((x) => publicApplication(x)), total, page, limit });
}
export async function getOne(req, res) { const app = await getVisibleApplication(req.params.applicationId, req.user); return ok(res, 'Application retrieved successfully', { application: publicApplication(app, { includeFullPan: roleIsStaff(req.user.role) }) }); }
export async function patchOne(req, res) {
  const app = await getVisibleApplication(req.params.applicationId, req.user);
  if (!['SUBMITTED', 'RESUBMISSION_REQUESTED'].includes(app.status)) throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application cannot be edited in its current status');
  const personal = { ...app.personalDetails.toObject(), ...(req.body.personalDetails || {}) }; const address = { ...app.addressDetails.toObject(), ...(req.body.addressDetails || {}) };
  validateDetails(personal, address);
  app.personalDetails = personal; app.addressDetails = address; app.version += 1; await app.save();
  await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'APPLICATION_UPDATED', details: { version: app.version } });
  return ok(res, 'Application updated successfully', { application: publicApplication(app) });
}
export async function listDocuments(req, res) {
  const app = await getVisibleApplication(req.params.applicationId, req.user);
  const { page, limit, skip } = pagination(req.query); const [items, total] = await Promise.all([Document.find({ application: app._id }).sort({ createdAt: 1 }).skip(skip).limit(limit).select('-storagePath -sha256 -createdBy'), Document.countDocuments({ application: app._id })]);
  return ok(res, 'Documents retrieved successfully', { items, total, page, limit });
}
export async function submit(req, res) {
  let app = await getVisibleApplication(req.params.applicationId, req.user);
  if (app.status !== 'SUBMITTED' && app.status !== 'RESUBMISSION_REQUESTED') throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application cannot be submitted in its current status');
  const docs = await Document.find({ application: app._id }).sort({ fileName: 1 });
  if (docs.length < 3) throw new HttpError(400, 'DOCUMENTS_REQUIRED', 'At least three documents are required before submission', [{ field: 'documents', issue: 'Upload at least three documents.' }]);
  if (app.status === 'RESUBMISSION_REQUESTED') {
    const reopened = await Application.findOneAndUpdate({ _id: app._id, status: 'RESUBMISSION_REQUESTED', version: app.version }, { $set: { status: 'SUBMITTED' }, $inc: { version: 1, __v: 1 } }, { new: true });
    if (!reopened) throw new HttpError(409, 'CONCURRENT_MODIFICATION', 'Application changed while being submitted');
    await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'APPLICATION_RESUBMITTED', details: { from: 'RESUBMISSION_REQUESTED', to: 'SUBMITTED' } }); app = reopened;
  }
  if (!TRANSITIONS[app.status]?.includes('EXTRACTING')) throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Invalid status transition');
  const previous = app.status; const submittedAt = new Date();
  const claimed = await Application.findOneAndUpdate({ _id: app._id, status: previous, version: app.version }, { $set: { status: 'EXTRACTING', submittedAt }, $inc: { version: 1, __v: 1 } }, { new: true });
  if (!claimed) throw new HttpError(409, 'CONCURRENT_MODIFICATION', 'Application changed while being submitted');
  app = claimed;
  await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'APPLICATION_SUBMITTED', details: { from: previous, to: app.status, documentCount: docs.length } });
  setImmediate(() => processSubmission(app.applicationId, docs.map((doc) => doc._id), req.user._id).catch((error) => console.error('Background application processing failed:', error)));
  return ok(res, 'Application submitted for processing', { applicationId: app.applicationId, status: 'EXTRACTING' }, 202);
}

async function processSubmission(applicationId, documentIds, actorId) {
  try {
    for (const documentId of documentIds) await extractDocument(documentId, actorId);
    const app = await Application.findOne({ applicationId }); if (!app || app.status !== 'EXTRACTING') return;
    const [docs, extractions] = await Promise.all([Document.find({ application: app._id }).sort({ fileName: 1 }), Extraction.find({ applicationId })]);
    const result = await evaluateKyc(app, docs, extractions);
    const targetStatus = result.decision === 'REJECT' ? 'AUTO_REJECTED' : result.decision === 'REVIEW' ? 'IN_REVIEW' : result.riskCategory === 'HIGH' ? 'PENDING_CHECKER' : 'AUTO_APPROVED';
    const updated = await Application.findOneAndUpdate({ _id: app._id, status: 'EXTRACTING', version: app.version }, { $set: { status: targetStatus, decision: result.decision, reasonCodes: result.reasonCodes, nameMatchScore: result.nameMatchScore, riskCategory: result.riskCategory, rekycDueDate: result.rekycDueDate }, $inc: { version: 1, __v: 1 } }, { new: true });
    if (!updated) throw new HttpError(409, 'CONCURRENT_MODIFICATION', 'Application changed during processing');
    await Decision.findOneAndUpdate({ applicationId }, { ...result, applicationId, status: targetStatus }, { upsert: true, new: true });
    await recordAudit({ applicationId, actorId, action: 'APPLICATION_EVALUATED', details: { decision: result.decision, reasonCodes: result.reasonCodes, status: targetStatus, watchlist: result.evidence.watchlist } });
    if (targetStatus === 'AUTO_APPROVED') await createAccount(applicationId, null);
  } catch (error) {
    const app = await Application.findOne({ applicationId, status: 'EXTRACTING' });
    if (app) { app.status = 'IN_REVIEW'; app.decision = 'REVIEW'; app.reasonCodes = ['LOW_EXTRACTION_CONFIDENCE']; app.riskCategory = 'LOW'; app.version += 1; await app.save(); await recordAudit({ applicationId, actorId, action: 'APPLICATION_PROCESSING_FAILED', details: { status: 'IN_REVIEW' } }); }
    throw error;
  }
}
export async function evaluate(req, res) {
  const app = await getVisibleApplication(req.params.applicationId, req.user);
  if (!['EXTRACTING', 'IN_REVIEW'].includes(app.status)) throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application cannot be evaluated in its current status');
  const [docs, extractions] = await Promise.all([Document.find({ application: app._id }).sort({ fileName: 1 }), Extraction.find({ applicationId: app.applicationId })]);
  const result = await evaluateKyc(app, docs, extractions);
  const reviewed = app.status === 'IN_REVIEW'; const target = result.decision === 'REJECT' ? 'AUTO_REJECTED' : result.decision === 'REVIEW' ? 'IN_REVIEW' : reviewed || result.riskCategory === 'HIGH' ? 'PENDING_CHECKER' : 'AUTO_APPROVED';
  app.status = target; app.decision = result.decision; app.reasonCodes = result.reasonCodes; app.riskCategory = result.riskCategory; app.nameMatchScore = result.nameMatchScore; app.rekycDueDate = result.rekycDueDate; await app.save();
  const decision = await Decision.findOneAndUpdate({ applicationId: app.applicationId }, { ...result, applicationId: app.applicationId, status: target }, { upsert: true, new: true });
  await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'APPLICATION_EVALUATED', details: { decision: result.decision, reasonCodes: result.reasonCodes, status: target, watchlist: result.evidence.watchlist } });
  if (target === 'AUTO_APPROVED') await createAccount(app.applicationId, req.user._id);
  return ok(res, 'Application evaluated successfully', { decision: { applicationId: app.applicationId, decision: decision.decision, reasonCodes: decision.reasonCodes, nameMatchScore: decision.nameMatchScore, riskCategory: decision.riskCategory, rekycDueDate: decision.rekycDueDate, evaluatedAt: decision.evaluatedAt, status: target, documents: decision.documents } });
}
export async function getDecision(req, res) {
  const app = await getVisibleApplication(req.params.applicationId, req.user); const decision = await Decision.findOne({ applicationId: app.applicationId });
  if (!decision) throw new HttpError(404, 'DECISION_NOT_FOUND', 'Decision not found');
  const value = { applicationId: decision.applicationId, decision: decision.decision, reasonCodes: decision.reasonCodes, nameMatchScore: decision.nameMatchScore, riskCategory: decision.riskCategory, rekycDueDate: decision.rekycDueDate, evaluatedAt: decision.evaluatedAt, status: decision.status, documents: decision.documents };
  if (req.user.role === 'CUSTOMER') delete value.documents;
  return ok(res, 'Decision retrieved successfully', { decision: value });
}
