const mongoose = require('mongoose');

const roomMemberSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['HOST', 'SPEAKER', 'LISTENER'],
      default: 'LISTENER',
    },
    seatIndex: {
      type: Number,
      default: null, // null if listener, 0 to (maxSeats - 1) if speaker
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for fast queries of active room members
roomMemberSchema.index({ roomId: 1, userId: 1, leftAt: 1 });

const RoomMember = mongoose.model('RoomMember', roomMemberSchema);

module.exports = RoomMember;
