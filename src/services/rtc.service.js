const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const AGORA_APP_ID = process.env.AGORA_APP_ID || 'fa51813244794d95b5788baad38b0acd';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';
const AGORA_TEMP_TOKEN =
  process.env.AGORA_TEMP_TOKEN ||
  '007eJxTYMie5r5OevUfb+G+JEFuxuMOj2Nz8g84tBboTal1F9iSaq/AkJZoamhhaGxkYmJuaZJiaZpkam5hkZSYmGJskWSQmJxi8q0uqyGQkSFEI5qVkQECQXw2hrLMpPyiRAYGAK7zHUw=';
const AGORA_DEFAULT_CHANNEL = process.env.AGORA_DEFAULT_CHANNEL || 'vibora';

/**
 * Generate RTC Token for a Room & User
 */
const generateRtcToken = (channelName, uid, role = 'subscriber') => {
  const channel = channelName || AGORA_DEFAULT_CHANNEL;

  // If App Certificate is available, generate dynamic token
  if (AGORA_APP_CERTIFICATE && AGORA_APP_ID) {
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600 * 24; // 24 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channel,
      uid || 0,
      agoraRole,
      privilegeExpiredTs
    );

    return {
      appId: AGORA_APP_ID,
      channelName: channel,
      token,
      uid: uid || 0,
    };
  }

  // Fallback to provided valid Agora token
  return {
    appId: AGORA_APP_ID,
    channelName: AGORA_DEFAULT_CHANNEL,
    token: AGORA_TEMP_TOKEN,
    uid: uid || 0,
  };
};

module.exports = {
  generateRtcToken,
  AGORA_APP_ID,
};
