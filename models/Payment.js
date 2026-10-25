const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    method: {
      type: String,
      enum: ['jazzcash', 'easypaisa', 'rapidgateway', 'safepay', 'cod', 'pay_at_store', 'bank_transfer'],
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'PKR',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    transactionReference: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    proofImage: { type: String, default: '', select: false },
    proofStatus: { type: String, enum: ['none', 'submitted', 'accepted', 'rejected'], default: 'none' },
    proofSubmittedAt: { type: Date, default: null },
    proofReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ order: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
