import { HttpError } from '../utils/http.js';
export const allowRoles = (...roles) => (req, _res, next) => roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource'));
