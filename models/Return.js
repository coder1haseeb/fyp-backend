const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      unique: true,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    orderItem: {
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      quantity: Number,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business is required'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
    },
    description: {
      type: String,
      default: '',
    },
    images: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNote: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

returnSchema.index({ customer: 1, createdAt: -1 });
returnSchema.index({ business: 1, status: 1 });

module.exports = mongoose.model('Return', returnSchema);
