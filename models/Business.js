const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
    },
    location: { type: new mongoose.Schema({
      type: { type: String, enum: ['Point'], required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: value => Array.isArray(value) && value.length === 2 &&
            Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
            Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90,
          message: 'Invalid store coordinates',
        },
      },
    }, { _id: false }), default: undefined },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^[0-9]{10,}$/, 'Please provide a valid phone number'],
    },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      iban: { type: String, default: '' },
    },
    operatingHours: {
      type: Map,
      of: String,
      default: new Map(),
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessOwner',
      required: [true, 'Owner is required'],
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

businessSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Business', businessSchema);
