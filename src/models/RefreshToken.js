const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    deviceInfo: {
      type: String,
      default: 'Unknown Device',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
