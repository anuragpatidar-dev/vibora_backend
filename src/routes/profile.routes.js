const express = require('express');
const router = express.Router();
const {
  checkUsername,
  createProfile,
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
} = require('../controllers/profile.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Public lookup
router.get('/check-username/:username', checkUsername);

// Protected routes
router.post('/', requireAuth, createProfile);
router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, updateMyProfile);

// Public profile view (with optional auth for follow status)
router.get('/:identifier', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return requireAuth(req, res, next);
  }
  next();
}, getPublicProfile);

module.exports = router;
