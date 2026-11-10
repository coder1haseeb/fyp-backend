const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: function () { return this.interactionType !== 'search'; },
    },
    interactionType: {
      type: String,
      enum: ['view', 'add_to_cart', 'purchase', 'search'],
      required: true,
    },
    searchQuery: { type: String, trim: true, maxlength: 160, default: '' },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

interactionSchema.index({ customer: 1, createdAt: -1 });
interactionSchema.index({ product: 1 });
interactionSchema.index({ customer: 1, product: 1 });
interactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Interaction', interactionSchema);
