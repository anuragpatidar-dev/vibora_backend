const rateLimit = require('express-rate-limit');

// Rate limiter for OTP requests (e.g. max 5 OTP requests per 10 minutes per IP)
const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many OTP requests. Please wait a few minutes before trying again.',
  },
});

// Rate limiter for verification attempts
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TOO_MANY_ATTEMPTS',
    message: 'Too many verification attempts. Please wait a few minutes.',
  },
});

module.exports = {
  otpRequestLimiter,
  otpVerifyLimiter,
};
