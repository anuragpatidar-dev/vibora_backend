const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: true,
    },
    firebaseUid: {
      type: String,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'BANNED', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
