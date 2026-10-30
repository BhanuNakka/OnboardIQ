import mongoose from 'mongoose';
const schema = new mongoose.Schema({ applicationId: { type: String, unique: true }, customerId: { type: String, unique: true }, accountNumber: { type: String, unique: true }, createdAt: { type: Date, default: Date.now } });
export default mongoose.model('CoreAccount', schema);
