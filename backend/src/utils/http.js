export class HttpError extends Error {
  constructor(status, code, message, details = []) { super(message); this.status = status; this.code = code; this.details = details; }
}
export const ok = (res, message, data, status = 200) => res.status(status).json({ success: true, message, data });
export const fail = (status, code, message, details = []) => ({ success: false, message, error: { code, details } });
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function requireFields(obj, fields) {
  const details = fields.filter((key) => obj?.[key] === undefined || obj?.[key] === null || obj?.[key] === '').map((field) => ({ field, issue: 'Required field is missing.' }));
  if (details.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', details);
}
