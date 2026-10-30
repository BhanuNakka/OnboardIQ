import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError, ok, requireFields } from '../utils/http.js';
import { recordAudit } from '../services/audit.service.js';

const safeUser = (user) => ({ _id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
const tokenFor = (user) => jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
export async function register(req, res) {
  requireFields(req.body, ['name', 'email', 'password']);
  const { name, email, password } = req.body;
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'email', issue: 'Enter a valid email.' }]);
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'password', issue: 'Password must contain at least 8 characters.' }]);
  if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'CUSTOMER' });
  await recordAudit({ actorId: user._id, action: 'USER_REGISTERED', details: { role: 'CUSTOMER' } });
  return ok(res, 'User registered successfully', { user: safeUser(user), token: tokenFor(user) }, 201);
}
export async function login(req, res) {
  requireFields(req.body, ['email', 'password']);
  if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'email', issue: 'Email and password must be text values.' }]);
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  await recordAudit({ actorId: user._id, action: 'USER_LOGIN', details: { role: user.role } });
  return ok(res, 'Login successful', { user: safeUser(user), token: tokenFor(user) });
}
export function me(req, res) { return ok(res, 'User retrieved successfully', { user: safeUser(req.user) }); }
