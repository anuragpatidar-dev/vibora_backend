const express = require('express');
const router = express.Router();
const {
  getCategories,
  getRooms,
  createRoom,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  endRoom,
  getRtcToken,
} = require('../controllers/room.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Categories & Discovery
router.get('/categories', getCategories);
router.get('/', getRooms);
router.get('/:roomId/rtc-token', requireAuth, getRtcToken);
router.get('/:roomId', getRoomDetails);

// Actions requiring Authentication
router.post('/', requireAuth, createRoom);
router.post('/:roomId/join', requireAuth, joinRoom);
router.post('/:roomId/leave', requireAuth, leaveRoom);
router.patch('/:roomId/end', requireAuth, endRoom);

module.exports = router;
