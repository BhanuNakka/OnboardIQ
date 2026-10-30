import mongoose from 'mongoose';
import { DECISIONS, RISK_CATEGORIES, STATUSES } from '../utils/enums.js';

const personalSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true }, dob: { type: String, required: true }, gender: { type: String, required: true },
  panNumber: { type: String, required: true, uppercase: true, trim: true }, aadhaarLast4: { type: String, required: true },
  mobile: { type: String, required: true }, email: { type: String, required: true, lowercase: true, trim: true },
  occupationCode: { type: String, required: true }, annualIncome: { type: Number, min: 0, required: true }, consentToKyc: { type: Boolean, required: true }
}, { _id: false });
const addressSchema = new mongoose.Schema({ address: { type: String, required: true }, city: { type: String, required: true }, state: { type: String, required: true }, pincode: { type: String, required: true } }, { _id: false });

const schema = new mongoose.Schema({
  applicationId: { type: String, unique: true, index: true }, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  personalDetails: { type: personalSchema, required: true }, addressDetails: { type: addressSchema, required: true },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }], status: { type: String, enum: STATUSES, default: 'SUBMITTED', index: true },
  riskCategory: { type: String, enum: [...RISK_CATEGORIES, null], default: null }, decision: { type: String, enum: [...DECISIONS, null], default: null },
  reasonCodes: { type: [String], default: [] }, nameMatchScore: { type: Number, default: null }, rekycDueDate: { type: String, default: null },
  submittedAt: Date, version: { type: Number, default: 0 }
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.model('Application', schema);
