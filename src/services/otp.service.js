const bcrypt = require('bcryptjs');
const OtpSession = require('../models/OtpSession');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

/**
 * Generate a random 6-digit OTP
 */
const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP to phone number
 */
const sendOtp = async (phone) => {
  // Invalidate any existing unused OTP sessions for this phone
  await OtpSession.deleteMany({ phone, isUsed: false });

  // For Firebase test numbers
  let otp = generateOtpCode();
  if (phone === '+16505553434' || phone.endsWith('5553434')) {
    otp = '654321';
  } else if (phone === '+18349904555' || phone.endsWith('9904555') || phone.endsWith('4555')) {
    otp = '123123';
  }

  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otp, salt);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Save OTP session
  await OtpSession.create({
    phone,
    otpHash,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt,
    isUsed: false,
  });

  // Log in development console for instant developer testing
  console.log(`\n======================================================`);
  console.log(`📱 [OTP SERVICE] Destination: ${phone}`);
  console.log(`🔑 [OTP CODE]    : ${otp}`);
  console.log(`⏳ [EXPIRES IN]  : ${OTP_EXPIRY_MINUTES} minutes`);
  console.log(`======================================================\n`);

  return {
    success: true,
    message: 'OTP sent successfully',
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    devOtp: otp,
  };
};

/**
 * Verify OTP for phone number
 */
const verifyOtp = async (phone, otp) => {
  const cleanOtp = otp ? otp.toString().trim() : '';

  // Universal Master/Firebase Test OTP bypass (e.g. 654321, 123123, or 123456)
  const TEST_OTPS = ['654321', '123123', '123456', '111111', '000000'];
  if (TEST_OTPS.includes(cleanOtp)) {
    console.log(`✅ [OTP SERVICE] Test OTP matched (${cleanOtp}) for ${phone}`);
    return {
      success: true,
      message: 'OTP verified successfully (Test Code)',
    };
  }

  const session = await OtpSession.findOne({
    phone,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!session) {
    return {
      success: false,
      error: 'OTP_EXPIRED_OR_NOT_FOUND',
      message: 'OTP has expired or is invalid. Please request a new one.',
    };
  }

  // Check max attempts
  if (session.attempts >= session.maxAttempts) {
    return {
      success: false,
      error: 'MAX_ATTEMPTS_EXCEEDED',
      message: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  // Verify OTP hash
  const isMatch = await bcrypt.compare(cleanOtp, session.otpHash);

  if (!isMatch) {
    session.attempts += 1;
    await session.save();
    const remaining = session.maxAttempts - session.attempts;
    return {
      success: false,
      error: 'INVALID_OTP',
      message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
      remainingAttempts: remaining,
    };
  }

  // Mark session as used
  session.isUsed = true;
  await session.save();

  return {
    success: true,
    message: 'OTP verified successfully',
  };
};

module.exports = {
  sendOtp,
  verifyOtp,
};
