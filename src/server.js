const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocketIO } = require('./realtime/socket.handler');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io Realtime Infrastructure (Phase 7)
initSocketIO(server);

// Connect Database and Start Server
const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 [VIBORA Backend] Server listening on http://0.0.0.0:${PORT} (Local: http://localhost:${PORT}, LAN: http://192.168.1.14:${PORT})`);
      console.log(`📡 [Auth API] Endpoint: http://localhost:${PORT}/api/v1/auth`);
      console.log(`⚡ [Realtime WebSocket] Socket.IO Engine Online (Phase 7)\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
