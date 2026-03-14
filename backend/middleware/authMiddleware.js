const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: token missing',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const Model = decoded.role === 'admin' ? Admin : User;
    const user = await Model.findById(decoded.id).select(
      'isBlocked passwordChangedAt'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user no longer exists',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is blocked due to multiple failed login attempts',
      });
    }

    if (user.passwordChangedAt && decoded.iat) {
      const issuedAtMs = decoded.iat * 1000;
      if (issuedAtMs < user.passwordChangedAt.getTime()) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: session expired. Please log in again.',
        });
      }
    }

    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: invalid or expired token',
    });
  }
};

module.exports = authMiddleware;

