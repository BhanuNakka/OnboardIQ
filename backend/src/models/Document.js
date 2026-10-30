import mongoose from 'mongoose';
import { DOC_TYPES } from '../utils/enums.js';
const schema = new mongoose.Schema({
  applicationId: { type: String, required: true, index: true }, application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  documentType: { type: String, enum: DOC_TYPES.filter((x) => x !== 'OTHER'), required: true }, fileName: { type: String, required: true },
  storagePath: { type: String, required: true, select: false }, sha256: { type: String, required: true }, extractionStatus: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ application: 1, sha256: 1 }, { unique: true });
export default mongoose.model('Document', schema);
