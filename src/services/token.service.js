const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const JWT_SECRET = process.env.JWT_SECRET || 'vibora_default_jwt_secret_dev_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/**
 * Generate Access Token (JWT)
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id || user._id,
      phone: user.phone,
      status: user.status,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate and store Refresh Token
 */
const generateRefreshToken = async (user, deviceInfo = 'Mobile Client') => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await RefreshToken.create({
    userId: user.id || user._id,
    tokenHash,
    deviceInfo,
    expiresAt,
  });

  return rawToken;
};

/**
 * Verify Access Token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Refresh an existing valid refresh token
 */
const verifyAndRotateRefreshToken = async (rawRefreshToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  
  const existingRecord = await RefreshToken.findOne({
    tokenHash,
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).populate('userId');

  if (!existingRecord || !existingRecord.userId) {
    return null;
  }

  // Revoke old token (rotation pattern)
  existingRecord.revoked = true;
  await existingRecord.save();

  // Create new refresh token and access token
  const newAccessToken = generateAccessToken(existingRecord.userId);
  const newRefreshToken = await generateRefreshToken(existingRecord.userId, existingRecord.deviceInfo);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: existingRecord.userId,
  };
};

/**
 * Revoke a refresh token on logout
 */
const revokeRefreshToken = async (rawRefreshToken) => {
  if (!rawRefreshToken) return false;
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const result = await RefreshToken.updateOne({ tokenHash }, { revoked: true });
  return result.modifiedCount > 0;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyAndRotateRefreshToken,
  revokeRefreshToken,
};
