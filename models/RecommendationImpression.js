const mongoose = require('mongoose');

const recommendationImpressionSchema = new mongoose.Schema({
  requestId: { type: String, required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  position: { type: Number, required: true },
  features: { type: [Number], required: true },
  baselineScore: { type: Number, required: true },
  model: { type: String, enum: ['hybrid', 'lightgbm'], required: true },
}, { timestamps: true });

recommendationImpressionSchema.index({ customer: 1, product: 1, createdAt: -1 });
recommendationImpressionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

module.exports = mongoose.model('RecommendationImpression', recommendationImpressionSchema);
