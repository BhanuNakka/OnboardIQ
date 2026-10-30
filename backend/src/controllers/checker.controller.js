import Application from '../models/Application.js';
import ReviewAction from '../models/ReviewAction.js';
import { CHECKER_DECISIONS } from '../utils/enums.js';
import { HttpError, ok } from '../utils/http.js';
import { recordAudit } from '../services/audit.service.js';
import { createAccount } from '../services/coreBanking.service.js';
export async function pending(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10)); const filter = { status: 'PENDING_CHECKER' };
  const [apps, total] = await Promise.all([Application.find(filter).sort({ submittedAt: 1 }).skip((page - 1) * limit).limit(limit), Application.countDocuments(filter)]);
  const items = await Promise.all(apps.map(async (app) => ({ ...app.toObject(), makerAction: await ReviewAction.findOne({ applicationId: app.applicationId }) })));
  return ok(res, 'Pending checker applications retrieved successfully', { items, total, page, limit });
}
export async function decide(req, res) {
  const { decision, comments } = req.body;
  if (!CHECKER_DECISIONS.includes(decision) || typeof comments !== 'string' || comments.trim().length < 10) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'decision', issue: 'Provide a valid decision and a comment of at least 10 characters.' }]);
  const app = await Application.findOne({ applicationId: req.params.applicationId }); if (!app) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (app.status !== 'PENDING_CHECKER') throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application is not awaiting checker action');
  const action = await ReviewAction.findOne({ applicationId: app.applicationId });
  if (action?.makerId && String(action.makerId) === String(req.user._id)) throw new HttpError(403, 'FORBIDDEN', 'Maker and checker must be different users');
  const next = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'IN_REVIEW';
  if (!action && app.riskCategory !== 'HIGH') throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Only a maker recommendation or high-risk application can enter checker review');
  const updated = await Application.findOneAndUpdate({ _id: app._id, status: 'PENDING_CHECKER', version: app.version }, { $set: { status: next }, $inc: { version: 1, __v: 1 } }, { new: true });
  if (!updated) throw new HttpError(409, 'CONCURRENT_MODIFICATION', 'Another checker changed this application');
  if (action) { action.checkerId = req.user._id; action.checkerDecision = decision; action.checkerComments = comments; await action.save(); }
  await recordAudit({ applicationId: app.applicationId, actorId: req.user._id, action: 'CHECKER_DECISION', details: { decision, comments, status: next } });
  const account = decision === 'APPROVE' ? await createAccount(app.applicationId, req.user._id) : null;
  return ok(res, 'Checker decision recorded successfully', { applicationId: app.applicationId, checkerDecision: decision, status: next, ...(account ? { account: { customerId: account.customerId, accountNumber: account.accountNumber } } : {}) });
}
