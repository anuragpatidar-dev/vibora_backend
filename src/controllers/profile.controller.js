const Profile = require('../models/Profile');
const Follow = require('../models/Follow');

/**
 * Check if a username is available
 * GET /api/v1/profiles/check-username/:username
 */
const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const cleanUsername = username?.toLowerCase().trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Username must be at least 3 characters',
      });
    }

    const existing = await Profile.findOne({ username: cleanUsername });

    return res.status(200).json({
      success: true,
      available: !existing,
      username: cleanUsername,
      message: existing ? 'Username is already taken' : 'Username is available',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * Create or complete profile for authenticated user
 * POST /api/v1/profiles
 */
const createProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { username, displayName, avatarUrl, bio, gender } = req.body;

    if (!username || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Username and Display Name are required',
      });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Check if profile already exists for this user
    const existingProfile = await Profile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        error: 'PROFILE_EXISTS',
        message: 'Profile already created for this account',
        profile: existingProfile,
      });
    }

    // Check if username taken by someone else
    const usernameTaken = await Profile.findOne({ username: cleanUsername });
    if (usernameTaken) {
      return res.status(400).json({
        success: false,
        error: 'USERNAME_TAKEN',
        message: 'Username is already in use',
      });
    }

    // Generate fallback avatar if none provided
    const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${cleanUsername}`;

    const profile = await Profile.create({
      userId,
      username: cleanUsername,
      displayName: displayName.trim(),
      avatarUrl: finalAvatar,
      bio: bio ? bio.trim() : 'Hey there! I am using VIBORA.',
      gender: gender || 'PREFER_NOT_TO_SAY',
      level: 1,
      vipLevel: 0,
    });

    return res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      profile,
    });
  } catch (error) {
    console.error('[Profile Controller Error - Create]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * Get current user's profile
 * GET /api/v1/profiles/me
 */
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let profile = await Profile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'PROFILE_NOT_FOUND',
        message: 'Profile has not been created yet',
      });
    }

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * Update current user's profile
 * PUT /api/v1/profiles/me
 */
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { displayName, avatarUrl, bio, gender } = req.body;

    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'PROFILE_NOT_FOUND',
        message: 'Profile not found',
      });
    }

    if (displayName) profile.displayName = displayName.trim();
    if (avatarUrl) profile.avatarUrl = avatarUrl;
    if (bio !== undefined) profile.bio = bio.trim();
    if (gender) profile.gender = gender;

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * Get Public Profile by ID or Username
 * GET /api/v1/profiles/:identifier
 */
const getPublicProfile = async (req, res) => {
  try {
    const { identifier } = req.params;
    const currentUserId = req.user ? (req.user.id || req.user._id) : null;

    let query = {};
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      query = { $or: [{ userId: identifier }, { _id: identifier }, { username: identifier.toLowerCase() }] };
    } else {
      query = { username: identifier.toLowerCase() };
    }

    const profile = await Profile.findOne(query);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'PROFILE_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    // Check if current user follows this target user
    let isFollowing = false;
    if (currentUserId && currentUserId.toString() !== profile.userId.toString()) {
      const followRecord = await Follow.findOne({
        followerId: currentUserId,
        followingId: profile.userId,
      });
      isFollowing = !!followRecord;
    }

    return res.status(200).json({
      success: true,
      profile: {
        ...profile.toJSON(),
        isFollowing,
        isSelf: currentUserId ? currentUserId.toString() === profile.userId.toString() : false,
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
  checkUsername,
  createProfile,
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
};
