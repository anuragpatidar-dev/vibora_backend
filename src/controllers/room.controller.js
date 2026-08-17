const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const Profile = require('../models/Profile');

const CATEGORIES = [
  { id: 'CHILL', name: 'Chill & Relax', icon: '☕' },
  { id: 'MUSIC', name: 'Live Music & Jam', icon: '🎵' },
  { id: 'GAMING', name: 'Gaming Lounge', icon: '🎮' },
  { id: 'TALK_SHOW', name: 'Talk Show & Podcasts', icon: '🎙️' },
  { id: 'FRIENDS', name: 'Make Friends', icon: '🤝' },
  { id: 'DATING', name: 'Dating & Vibes', icon: '💖' },
  { id: 'POETRY', name: 'Poetry & Shayari', icon: '📖' },
  { id: 'PARTY', name: 'Late Night Party', icon: '🎉' },
];

/**
 * GET /api/v1/rooms/categories
 */
const getCategories = (req, res) => {
  return res.status(200).json({
    success: true,
    categories: CATEGORIES,
  });
};

/**
 * GET /api/v1/rooms
 * Step 11: Home Discovery Feed
 */
const getRooms = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const query = { status: 'ACTIVE' };

    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }

    if (search && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const rooms = await Room.find(query)
      .sort({ activeMemberCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // Attach host profile to each room
    const hostUserIds = rooms.map((r) => r.hostId);
    const hostProfiles = await Profile.find({ userId: { $in: hostUserIds } }).lean();
    const profileMap = new Map(hostProfiles.map((p) => [p.userId.toString(), p]));

    const populatedRooms = rooms.map((r) => ({
      ...r,
      id: r._id,
      host: profileMap.get(r.hostId.toString()) || {
        displayName: 'Vibora Host',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${r.hostId}`,
      },
    }));

    return res.status(200).json({
      success: true,
      count: populatedRooms.length,
      rooms: populatedRooms,
    });
  } catch (error) {
    console.error('[Room Controller Error - GetRooms]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/rooms
 * Step 12: Host creates room
 */
const createRoom = async (req, res) => {
  try {
    const hostId = req.user.id || req.user._id;
    const { title, category, coverImage, maxSeats, isPrivate, password, tags } = req.body;

    if (!title || title.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Room title must be at least 2 characters',
      });
    }

    // Default category cover image
    const finalCover =
      coverImage ||
      `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60`;

    const room = await Room.create({
      title: title.trim(),
      hostId,
      category: category || 'CHILL',
      coverImage: finalCover,
      maxSeats: maxSeats || 8,
      isPrivate: !!isPrivate,
      password: isPrivate && password ? password.trim() : '',
      status: 'ACTIVE',
      activeMemberCount: 1,
      tags: Array.isArray(tags) ? tags : [],
    });

    // Automatically create Host membership on Seat 0
    await RoomMember.create({
      roomId: room._id,
      userId: hostId,
      role: 'HOST',
      seatIndex: 0,
      isMuted: false,
    });

    // Fetch Host profile
    const hostProfile = await Profile.findOne({ userId: hostId });

    return res.status(201).json({
      success: true,
      message: 'Room created successfully',
      room: {
        ...room.toJSON(),
        host: hostProfile,
      },
    });
  } catch (error) {
    console.error('[Room Controller Error - CreateRoom]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/rooms/:roomId
 * Get single room details and active members
 */
const getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId).lean();
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'ROOM_NOT_FOUND',
        message: 'Room does not exist',
      });
    }

    const hostProfile = await Profile.findOne({ userId: room.hostId });

    // Fetch active room members (leftAt === null)
    const members = await RoomMember.find({ roomId, leftAt: null }).lean();
    const memberUserIds = members.map((m) => m.userId);
    const profiles = await Profile.find({ userId: { $in: memberUserIds } }).lean();
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const populatedMembers = members.map((m) => ({
      ...m,
      id: m._id,
      profile: profileMap.get(m.userId.toString()) || {
        displayName: 'Guest User',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${m.userId}`,
      },
    }));

    return res.status(200).json({
      success: true,
      room: {
        ...room,
        id: room._id,
        host: hostProfile,
        members: populatedMembers,
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

/**
 * POST /api/v1/rooms/:roomId/join
 * Phase 6: Join Room Membership
 */
const joinRoom = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { roomId } = req.params;
    const { password } = req.body;

    const room = await Room.findById(roomId);
    if (!room || room.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        error: 'ROOM_INACTIVE',
        message: 'This room is no longer active',
      });
    }

    // Password verification for private rooms
    if (room.isPrivate && room.password && room.hostId.toString() !== userId.toString()) {
      if (!password || password.trim() !== room.password) {
        return res.status(403).json({
          success: false,
          error: 'INCORRECT_PASSWORD',
          message: 'Incorrect room password',
        });
      }
    }

    // Check if user was already in room
    let membership = await RoomMember.findOne({ roomId, userId });

    if (membership) {
      membership.leftAt = null;
      await membership.save();
    } else {
      const isHost = room.hostId.toString() === userId.toString();
      membership = await RoomMember.create({
        roomId,
        userId,
        role: isHost ? 'HOST' : 'LISTENER',
        seatIndex: isHost ? 0 : null,
      });
    }

    // Recalculate active member count
    const activeCount = await RoomMember.countDocuments({ roomId, leftAt: null });
    room.activeMemberCount = activeCount;
    await room.save();

    const profile = await Profile.findOne({ userId });

    return res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      membership,
      profile,
    });
  } catch (error) {
    console.error('[Room Controller Error - JoinRoom]:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/rooms/:roomId/leave
 * Phase 6: Leave Room
 */
const leaveRoom = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { roomId } = req.params;

    const membership = await RoomMember.findOne({ roomId, userId, leftAt: null });
    if (membership) {
      membership.leftAt = new Date();
      membership.seatIndex = null;
      await membership.save();
    }

    // Update count
    const activeCount = await RoomMember.countDocuments({ roomId, leftAt: null });
    await Room.updateOne({ _id: roomId }, { activeMemberCount: activeCount });

    return res.status(200).json({
      success: true,
      message: 'Left room successfully',
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
 * PATCH /api/v1/rooms/:roomId/end
 * End room by host
 */
const endRoom = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
    }

    if (room.hostId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only the room host can end this room',
      });
    }

    room.status = 'ENDED';
    room.activeMemberCount = 0;
    await room.save();

    // Mark all members as left
    await RoomMember.updateMany({ roomId, leftAt: null }, { leftAt: new Date() });

    return res.status(200).json({
      success: true,
      message: 'Room ended successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

const { generateRtcToken } = require('../services/rtc.service');

/**
 * GET /api/v1/rooms/:roomId/rtc-token
 * Phase 8: Agora Live Voice Audio Access Token
 */
const getRtcToken = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room || room.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        error: 'ROOM_NOT_FOUND',
        message: 'Active room not found',
      });
    }

    const membership = await RoomMember.findOne({ roomId, userId, leftAt: null });
    const isPublisher = membership && (membership.role === 'HOST' || membership.role === 'SPEAKER');

    // Generate Agora RTC token
    const rtcConfig = generateRtcToken(
      room.title ? 'vibora' : 'vibora',
      Math.floor(Math.random() * 100000),
      isPublisher ? 'publisher' : 'subscriber'
    );

    return res.status(200).json({
      success: true,
      rtc: {
        ...rtcConfig,
        role: isPublisher ? 'SPEAKER' : 'LISTENER',
        channelName: 'vibora',
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
  getCategories,
  getRooms,
  createRoom,
  getRoomDetails,
  joinRoom,
  leaveRoom,
  endRoom,
  getRtcToken,
};

