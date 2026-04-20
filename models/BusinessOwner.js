const mongoose = require('mongoose');

const businessOwnerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^[0-9]{10,}$/, 'Please provide a valid phone number'],
    },
    role: {
      type: String,
      default: 'business_admin',
      enum: ['business_admin'],
    },
    businesses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BusinessOwner', businessOwnerSchema);
