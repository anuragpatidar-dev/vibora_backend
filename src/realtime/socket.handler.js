const { Server } = require('socket.io');
const { verifyAccessToken } = require('../services/token.service');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');

let io = null;

const initSocketIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error('AUTHENTICATION_REQUIRED'));
      }

      const decoded = verifyAccessToken(token);
      if (!decoded) {
        return next(new Error('INVALID_OR_EXPIRED_TOKEN'));
      }

      const user = await User.findById(decoded.sub).lean();
      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('USER_NOT_FOUND_OR_BLOCKED'));
      }

      const profile = await Profile.findOne({ userId: user._id }).lean();

      socket.user = user;
      socket.profile = profile || {
        displayName: 'Vibora User',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${user._id}`,
      };

      next();
    } catch (err) {
      console.error('[Socket Auth Error]:', err.message);
      next(new Error('AUTHENTICATION_FAILED'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const userId = (socket.user._id || socket.user.id).toString();
    console.log(`âš¡ [Socket Connected] User: ${socket.profile.displayName} (@${socket.profile.username || userId}) | Socket ID: ${socket.id}`);

    // Join Room Event
    socket.on('room:join', async ({ roomId }) => {
      try {
        if (!roomId) return;

        socket.join(roomId);
        socket.currentRoomId = roomId;

        const count = io.sockets.adapter.rooms.get(roomId)?.size || 1;

        console.log(`ðŸšª [Room Join] ${socket.profile.displayName} joined Room: ${roomId} (Active: ${count})`);

        // Broadcast to everyone in room that a user joined
        io.to(roomId).emit('room:user_joined', {
          userId,
          profile: socket.profile,
          activeCount: count,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket room:join Error]:', err);
      }
    });

    // Leave Room Event
    socket.on('room:leave', async ({ roomId }) => {
      try {
        if (!roomId) return;

        socket.leave(roomId);
        socket.currentRoomId = null;

        const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;

        io.to(roomId).emit('room:user_left', {
          userId,
          profile: socket.profile,
          activeCount: count,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket room:leave Error]:', err);
      }
    });

    // Mic Request (User asks host for microphone)
    socket.on('mic:request', async ({ roomId, targetSeatIndex }) => {
      try {
        if (!roomId) return;

        console.log(`ðŸŽ™ï¸ [Mic Request] ${socket.profile.displayName} requested mic in Room ${roomId}`);

        // Broadcast to Host in room
        io.to(roomId).emit('mic:requested', {
          userId,
          profile: socket.profile,
          targetSeatIndex: targetSeatIndex || null,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket mic:request Error]:', err);
      }
    });

    // Mic Approve / Assign (Host grants microphone)
    socket.on('mic:approve', async ({ roomId, targetUserId, seatIndex }) => {
      try {
        if (!roomId || !targetUserId || seatIndex === undefined) return;

        // Update database membership
        await RoomMember.updateOne(
          { roomId, userId: targetUserId, leftAt: null },
          { role: 'SPEAKER', seatIndex }
        );

        const targetProfile = await Profile.findOne({ userId: targetUserId }).lean();

        console.log(`ðŸŽ¤ [Mic Approved] Seat ${seatIndex} assigned to ${targetUserId} in Room ${roomId}`);

        // Broadcast to all room members
        io.to(roomId).emit('mic:assigned', {
          userId: targetUserId,
          profile: targetProfile,
          seatIndex,
          isMuted: false,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket mic:approve Error]:', err);
      }
    });

    // Mic Demote (Host removes speaker from stage back to listener)
    socket.on('mic:demote', async ({ roomId, targetUserId }) => {
      try {
        if (!roomId || !targetUserId) return;

        // Update database: role back to LISTENER, seatIndex to null
        await RoomMember.updateOne(
          { roomId, userId: targetUserId, leftAt: null },
          { role: 'LISTENER', seatIndex: null }
        );

        console.log([Mic Demoted] User  moved to audience in Room );

        // Broadcast to everyone in the room
        io.to(roomId).emit('mic:demoted', {
          userId: targetUserId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket mic:demote Error]:', err);
      }
    });

    // Mic State Changed (Mute / Unmute)
    socket.on('mic:mute_toggle', async ({ roomId, isMuted }) => {
      try {
        if (!roomId) return;

        await RoomMember.updateOne(
          { roomId, userId, leftAt: null },
          { isMuted: !!isMuted }
        );

        io.to(roomId).emit('mic:state_changed', {
          userId,
          isMuted: !!isMuted,
        });
      } catch (err) {
        console.error('[Socket mic:mute_toggle Error]:', err);
      }
    });

    // Real-Time Room Chat (Phase 10 Foundation)
    socket.on('chat:send', ({ roomId, message }) => {
      try {
        if (!roomId || !message || !message.trim()) return;

        const cleanMsg = message.trim().slice(0, 200);

        const chatPayload = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          roomId,
          sender: socket.profile,
          userId,
          message: cleanMsg,
          timestamp: new Date().toISOString(),
        };

        io.to(roomId).emit('chat:message', chatPayload);
      } catch (err) {
        console.error('[Socket chat:send Error]:', err);
      }
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      console.log(`ðŸ”Œ [Socket Disconnected] User: ${socket.profile.displayName} (${socket.id})`);

      if (socket.currentRoomId) {
        const count = io.sockets.adapter.rooms.get(socket.currentRoomId)?.size || 0;
        io.to(socket.currentRoomId).emit('room:user_left', {
          userId,
          profile: socket.profile,
          activeCount: count,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

module.exports = {
  initSocketIO,
  getIO,
};

