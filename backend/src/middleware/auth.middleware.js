import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from '../utils/http.js';
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || ''; const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
    let payload; try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { throw new HttpError(401, e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED', 'Invalid or expired token'); }
    const user = await User.findById(payload.sub); if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
    req.user = user; next();
  } catch (error) { next(error); }
}
