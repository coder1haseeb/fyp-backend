const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
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
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        total: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    deliveryAddress: {
      street: String,
      city: String,
    },
    paymentMethod: {
      type: String,
      enum: ['jazzcash', 'easypaisa', 'rapidgateway', 'cod', 'pay_at_store'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'PKR',
    },
    timeline: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Create compound index for efficient queries
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ business: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
