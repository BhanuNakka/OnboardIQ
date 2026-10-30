import Application from '../models/Application.js';
import AuditLog from '../models/AuditLog.js';
import { HttpError, ok } from '../utils/http.js';
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export async function dashboard(req, res) {
  const filter = {};
  if (req.query.from || req.query.to) filter.createdAt = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(`${req.query.to}T23:59:59.999Z`) } : {}) };
  const [byStatus, byRiskCategory, decidedCount, reviewCount, pendingCheckerCount, rejectCount, applications] = await Promise.all([
    Application.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.aggregate([{ $match: filter }, { $group: { _id: '$riskCategory', count: { $sum: 1 } } }]),
    Application.countDocuments({ ...filter, decision: { $ne: null } }), Application.countDocuments({ ...filter, decision: 'REVIEW' }),
    Application.countDocuments({ ...filter, status: 'PENDING_CHECKER' }), Application.countDocuments({ ...filter, decision: 'REJECT' }),
    Application.find({ ...filter, reasonCodes: { $exists: true, $ne: [] } }).select('reasonCodes submittedAt createdAt updatedAt status')
  ]);
  const reasons = new Map(); for (const app of applications) for (const code of app.reasonCodes || []) reasons.set(code, (reasons.get(code) || 0) + 1);
  const reviewed = applications.filter((x) => x.status !== 'IN_REVIEW'); const duration = reviewed.length ? reviewed.reduce((sum, x) => sum + Math.max(0, (x.updatedAt - (x.submittedAt || x.createdAt)) / 1000), 0) / reviewed.length : 0;
  const statusMap = Object.fromEntries(byStatus.map((x) => [x._id, x.count])); const riskMap = Object.fromEntries(byRiskCategory.filter((x) => x._id).map((x) => [x._id, x.count]));
  return ok(res, 'Dashboard retrieved successfully', { byStatus: statusMap, byRiskCategory: riskMap, decidedCount, straightThroughRate: decidedCount ? (statusMap.AUTO_APPROVED || 0) / decidedCount : 0, reviewRate: decidedCount ? reviewCount / decidedCount : 0, rejectRate: decidedCount ? rejectCount / decidedCount : 0, topReasonCodes: [...reasons].map(([reasonCode, count]) => ({ reasonCode, count })).sort((a, b) => b.count - a.count).slice(0, 5), averageReviewTimeSeconds: Math.round(duration), pendingCheckerCount });
}
export async function audit(req, res) {
  if (!await Application.exists({ applicationId: req.params.applicationId })) throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10)); const filter = { applicationId: req.params.applicationId };
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ timestamp: 1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments(filter)]);
  return ok(res, 'Audit history retrieved successfully', { items, total, page, limit });
}
export async function exportDecisions(req, res) {
  const filter = {};
  if (req.query.from || req.query.to) filter.createdAt = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(`${req.query.to}T23:59:59.999Z`) } : {}) };
  const apps = await Application.find(filter).sort({ applicationId: 1 });
  const lines = ['application_id,decision,reason_codes,name_match_score,risk_category,rekyc_due_date', ...apps.map((app) => [app.applicationId, app.decision, (app.reasonCodes || []).join('|'), app.nameMatchScore === null ? '' : Number(app.nameMatchScore).toFixed(4), app.riskCategory, app.rekycDueDate].map(csvCell).join(','))];
  await import('../services/audit.service.js').then(({ recordAudit }) => recordAudit({ actorId: req.user._id, action: 'DECISIONS_EXPORTED', details: { count: apps.length } }));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="decisions.csv"' }); return res.status(200).send(lines.join('\r\n'));
}
