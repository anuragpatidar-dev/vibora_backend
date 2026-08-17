const express = require('express');
const router = express.Router();
const {
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowing,
} = require('../controllers/follow.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.post('/:targetUserId', requireAuth, followUser);
router.delete('/:targetUserId', requireAuth, unfollowUser);
router.get('/:targetUserId/status', requireAuth, getFollowStatus);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;
