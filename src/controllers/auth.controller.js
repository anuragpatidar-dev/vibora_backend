const User = require('../models/User');
const { sendOtp, verifyOtp } = require('../services/otp.service');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAndRotateRefreshToken,
  revokeRefreshToken,
} = require('../services/token.service');

/**
 * Normalizes phone number to E.164-like clean format
 */
const normalizePhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

/**
 * POST /api/v1/auth/send-otp
 * Step 1 & 2: User requests OTP on mobile number
 */
const requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'A valid phone number including country code (e.g. +919876543210) is required',
      });
    }

    const cleanPhone = normalizePhone(phone);
    const result = await sendOtp(cleanPhone);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Auth Controller Error - SendOtp]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to send OTP. Please try again.',
    });
  }
};

/**
 * POST /api/v1/auth/verify-otp
 * Step 3 & 4: User submits OTP, backend authenticates/registers user
 */
const verifyOtpAndLogin = async (req, res) => {
  try {
    const { phone, otp, deviceInfo } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Phone number and OTP code are required',
      });
    }

    const cleanPhone = normalizePhone(phone);
    const verifyResult = await verifyOtp(cleanPhone, otp);

    if (!verifyResult.success) {
      return res.status(400).json(verifyResult);
    }

    // Step 4: Decide if New User or Existing User
    let user = await User.findOne({ phone: cleanPhone });
    let isNewUser = false;

    if (!user) {
      // New user
      user = await User.create({
        phone: cleanPhone,
        phoneVerified: true,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });
      isNewUser = true;
    } else {
      // Existing user
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_BLOCKED',
          message: `Your account is ${user.status.toLowerCase()}`,
        });
      }
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Generate Session Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, deviceInfo || 'Vibora Mobile App');

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      isNewUser,
      user: {
        id: user.id || user._id,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      },
    });
  } catch (error) {
    console.error('[Auth Controller Error - VerifyOtp]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to verify OTP. Please try again.',
    });
  }
};

/**
 * POST /api/v1/auth/firebase-login
 * Direct Firebase client-verified login
 */
const firebaseLogin = async (req, res) => {
  try {
    const { phone, firebaseUid, deviceInfo } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PHONE',
        message: 'Phone number is required',
      });
    }

    const cleanPhone = normalizePhone(phone);

    let user = await User.findOne({ phone: cleanPhone });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        phone: cleanPhone,
        phoneVerified: true,
        firebaseUid: firebaseUid || undefined,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });
      isNewUser = true;
    } else {
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_BLOCKED',
          message: `Your account is ${user.status.toLowerCase()}`,
        });
      }
      if (firebaseUid && !user.firebaseUid) {
        user.firebaseUid = firebaseUid;
      }
      user.lastLoginAt = new Date();
      await user.save();
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, deviceInfo || 'Vibora Mobile App (Firebase)');

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account registered successfully' : 'Login successful',
      isNewUser,
      user: {
        id: user.id || user._id,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      },
    });
  } catch (error) {
    console.error('[Auth Controller Error - FirebaseLogin]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Authentication failed',
    });
  }
};

/**
 * POST /api/v1/auth/refresh-token
 * Renew access token with valid refresh token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: rawRefreshToken } = req.body;

    if (!rawRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Refresh token is required',
      });
    }

    const result = await verifyAndRotateRefreshToken(rawRefreshToken);

    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Session has expired or token is invalid. Please log in again.',
      });
    }

    return res.status(200).json({
      success: true,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      },
      user: {
        id: result.user.id || result.user._id,
        phone: result.user.phone,
        status: result.user.status,
      },
    });
  } catch (error) {
    console.error('[Auth Controller Error - RefreshToken]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to refresh session',
    });
  }
};

/**
 * POST /api/v1/auth/logout
 * Revokes current session refresh token
 */
const logout = async (req, res) => {
  try {
    const { refreshToken: rawRefreshToken } = req.body;
    await revokeRefreshToken(rawRefreshToken);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[Auth Controller Error - Logout]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to log out',
    });
  }
};

/**
 * GET /api/v1/auth/me
 * Step 7: Validate existing session on mobile app startup
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id || req.user._id,
        phone: req.user.phone,
        status: req.user.status,
        phoneVerified: req.user.phoneVerified,
        createdAt: req.user.createdAt,
        lastLoginAt: req.user.lastLoginAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  requestOtp,
  verifyOtpAndLogin,
  firebaseLogin,
  refreshToken,
  logout,
  getMe,
};
