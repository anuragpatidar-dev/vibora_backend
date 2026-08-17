require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const followRoutes = require('./routes/follow.routes');
const roomRoutes = require('./routes/room.routes');

const app = express();

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'VIBORA Backend API',
    phasesSupported: ['Phase 0: Foundation', 'Phase 1: Auth', 'Phase 2: Profile', 'Phase 3: Follow', 'Phase 4: Discovery', 'Phase 5: Create Room', 'Phase 6: Room Membership'],
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/follows', followRoutes);
app.use('/api/v1/rooms', roomRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
  });
});

module.exports = app;
