const Follow = require('../models/Follow');
const Profile = require('../models/Profile');
const User = require('../models/User');

/**
 * Follow a user
 * POST /api/v1/follows/:targetUserId
 */
const followUser = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const { targetUserId } = req.params;

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'SELF_FOLLOW_NOT_ALLOWED',
        message: 'You cannot follow yourself',
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Target user does not exist',
      });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId: currentUserId,
      followingId: targetUserId,
    });

    if (existingFollow) {
      return res.status(200).json({
        success: true,
        alreadyFollowing: true,
        message: 'Already following this user',
      });
    }

    // Create follow relationship
    await Follow.create({
      followerId: currentUserId,
      followingId: targetUserId,
    });

    // Update counts atomically
    await Profile.updateOne({ userId: currentUserId }, { $inc: { followingCount: 1 } });
    await Profile.updateOne({ userId: targetUserId }, { $inc: { followersCount: 1 } });

    return res.status(200).json({
      success: true,
      message: 'Successfully followed user',
    });
  } catch (error) {
    console.error('[Follow Controller Error - Follow]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * Unfollow a user
 * DELETE /api/v1/follows/:targetUserId
 */
const unfollowUser = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const { targetUserId } = req.params;

    const followRecord = await Follow.findOneAndDelete({
      followerId: currentUserId,
      followingId: targetUserId,
    });

    if (!followRecord) {
      return res.status(400).json({
        success: false,
        error: 'NOT_FOLLOWING',
        message: 'You are not following this user',
      });
    }

    // Decrement counters
    await Profile.updateOne(
      { userId: currentUserId, followingCount: { $gt: 0 } },
      { $inc: { followingCount: -1 } }
    );
    await Profile.updateOne(
      { userId: targetUserId, followersCount: { $gt: 0 } },
      { $inc: { followersCount: -1 } }
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user',
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
 * Check relationship status
 * GET /api/v1/follows/:targetUserId/status
 */
const getFollowStatus = async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const { targetUserId } = req.params;

    const followRecord = await Follow.findOne({
      followerId: currentUserId,
      followingId: targetUserId,
    });

    return res.status(200).json({
      success: true,
      isFollowing: !!followRecord,
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
 * Get user's followers list
 * GET /api/v1/follows/:userId/followers
 */
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const follows = await Follow.find({ followingId: userId }).select('followerId createdAt');
    const followerUserIds = follows.map((f) => f.followerId);

    const profiles = await Profile.find({ userId: { $in: followerUserIds } });

    return res.status(200).json({
      success: true,
      count: profiles.length,
      followers: profiles,
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
 * Get users that this user follows
 * GET /api/v1/follows/:userId/following
 */
const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const follows = await Follow.find({ followerId: userId }).select('followingId createdAt');
    const followingUserIds = follows.map((f) => f.followingId);

    const profiles = await Profile.find({ userId: { $in: followingUserIds } });

    return res.status(200).json({
      success: true,
      count: profiles.length,
      following: profiles,
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
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowing,
};
