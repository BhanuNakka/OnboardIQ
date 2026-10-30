import mongoose from 'mongoose';
const fieldSchema = new mongoose.Schema({ fieldName: String, value: mongoose.Schema.Types.Mixed, confidence: { type: Number, min: 0, max: 1 }, source: { type: String, enum: ['MOCK', 'AI', 'OFFICER'], default: 'MOCK' } }, { _id: false });
const schema = new mongoose.Schema({ applicationId: { type: String, required: true, index: true }, documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true }, docType: { type: String, required: true }, confidence: { type: Number, min: 0, max: 1, default: 0 }, extractedFields: [fieldSchema], source: { type: String, enum: ['MOCK', 'AI', 'OFFICER'], default: 'MOCK' }, extractorVersion: { type: String, default: 'mock-v1' } }, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ documentId: 1 }, { unique: true });
export default mongoose.model('Extraction', schema);
