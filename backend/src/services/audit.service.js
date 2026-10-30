import AuditLog from '../models/AuditLog.js';
export async function recordAudit({ applicationId = null, actorId = null, action, details = {} }) {
  return AuditLog.create({ applicationId, actorId, action, details, timestamp: new Date() });
}
