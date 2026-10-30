import mongoose from 'mongoose';
import { ROLES } from '../utils/enums.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'CUSTOMER', required: true }
}, { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform(_doc, ret) { delete ret.passwordHash; delete ret.__v; return ret; } } });

export default mongoose.model('User', userSchema);
