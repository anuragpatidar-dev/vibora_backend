const express = require('express');
const router = express.Router();
const {
  requestOtp,
  verifyOtpAndLogin,
  firebaseLogin,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { otpRequestLimiter, otpVerifyLimiter } = require('../middlewares/rateLimiter');

// Public Auth Endpoints
router.post('/send-otp', otpRequestLimiter, requestOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtpAndLogin);
router.post('/firebase-login', firebaseLogin);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// Protected Endpoint (Validates active session)
router.get('/me', requireAuth, getMe);

module.exports = router;
