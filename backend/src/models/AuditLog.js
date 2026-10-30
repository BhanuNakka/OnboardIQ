import mongoose from 'mongoose';
const schema = new mongoose.Schema({ applicationId: { type: String, index: true }, actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, action: { type: String, required: true }, details: { type: mongoose.Schema.Types.Mixed, default: {} }, timestamp: { type: Date, default: Date.now, immutable: true } }, { versionKey: false });
schema.pre('findOneAndUpdate', function blockUpdate() { throw new Error('Audit logs are append-only'); });
schema.pre('updateOne', function blockUpdate() { throw new Error('Audit logs are append-only'); });
schema.pre('deleteOne', function blockDelete() { throw new Error('Audit logs are append-only'); });
export default mongoose.model('AuditLog', schema);
