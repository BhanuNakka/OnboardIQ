import mongoose from 'mongoose';
const schema = new mongoose.Schema({ applicationId: { type: String, unique: true, required: true, index: true }, makerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, makerRecommendation: String, makerComments: String, checkerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, checkerDecision: String, checkerComments: String }, { timestamps: true });
export default mongoose.model('ReviewAction', schema);
