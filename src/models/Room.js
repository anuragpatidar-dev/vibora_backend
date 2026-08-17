const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Room title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [60, 'Title cannot exceed 60 characters'],
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['CHILL', 'MUSIC', 'GAMING', 'TALK_SHOW', 'FRIENDS', 'DATING', 'POETRY', 'PARTY'],
      default: 'CHILL',
      index: true,
    },
    coverImage: {
      type: String,
      default: '',
    },
    maxSeats: {
      type: Number,
      default: 8,
      min: 4,
      max: 12,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ENDED'],
      default: 'ACTIVE',
      index: true,
    },
    activeMemberCount: {
      type: Number,
      default: 1,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        // Don't leak raw password
        delete ret.password;
        return ret;
      },
    },
  }
);

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
