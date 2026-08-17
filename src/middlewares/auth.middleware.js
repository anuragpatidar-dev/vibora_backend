const { verifyAccessToken } = require('../services/token.service');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication token missing or invalid',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Access token expired or invalid',
      });
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User no longer exists',
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        message: `Account is ${user.status.toLowerCase()}`,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  requireAuth,
};
