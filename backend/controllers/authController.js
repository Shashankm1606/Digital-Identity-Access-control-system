const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Admin = require('../models/Admin');
const LoginActivity = require('../models/LoginActivity');
const generateToken = require('../utils/generateToken');

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
};

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getIdentifierQuery = (loginIdentifier) => {
  const normalizedIdentifier = loginIdentifier.toLowerCase();
  return {
    $or: [
      { email: normalizedIdentifier },
      { name: { $regex: `^${escapeRegExp(loginIdentifier)}$`, $options: 'i' } },
    ],
  };
};

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return (
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

const trackLoginActivity = async (req, payload) => {
  try {
    await LoginActivity.create({
      userId: payload.user?._id,
      role: payload.user?.role || payload.role || 'unknown',
      name: payload.user?.name,
      email: payload.user?.email,
      identifier: payload.identifier,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      status: payload.status,
      loginAt: new Date(),
    });
  } catch (error) {
    console.error(`Login activity tracking failed: ${error.message}`);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'This email belongs to an admin account and cannot be registered as a user',
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body;
    const loginIdentifier = (identifier || email || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required',
      });
    }

    const admin = await Admin.findOne(getIdentifierQuery(loginIdentifier)).select('+password');
    const user = admin || (await User.findOne(getIdentifierQuery(loginIdentifier)).select('+password'));

    if (!user || !user.password) {
      await trackLoginActivity(req, {
        identifier: loginIdentifier,
        status: 'failed',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (user.isBlocked) {
      await trackLoginActivity(req, {
        identifier: loginIdentifier,
        status: 'blocked',
        user,
      });

      return res.status(403).json({
        success: false,
        message: 'Account is blocked due to multiple failed login attempts',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.failedAttempts += 1;

      if (user.failedAttempts >= 5) {
        user.isBlocked = true;
      }

      await user.save({ validateBeforeSave: false });

      const loginStatus = user.isBlocked ? 'blocked' : 'failed';
      await trackLoginActivity(req, {
        identifier: loginIdentifier,
        status: loginStatus,
        user,
      });

      return res.status(401).json({
        success: false,
        message: user.isBlocked
          ? 'Account blocked after 5 failed login attempts'
          : 'Invalid credentials',
      });
    }

    user.failedAttempts = 0;
    user.isBlocked = false;
    await user.save({ validateBeforeSave: false });

    await trackLoginActivity(req, {
      identifier: loginIdentifier,
      status: 'success',
      user,
    });

    const token = generateToken(user);
    res.cookie('token', token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res) => {
  res.clearCookie('token', cookieOptions);

  return res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
};

const getCurrentUser = async (req, res, next) => {
  try {
    const Model = req.user.role === 'admin' ? Admin : User;
    const user = await Model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const getMyLoginActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const activities = await LoginActivity.find({
      userId: req.user.id,
      role: req.user.role,
    })
      .sort({ loginAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminOverview = async (req, res, next) => {
  try {
    const [totalUsers, blockedUsers, blockedAdmins] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBlocked: true }),
      Admin.countDocuments({ isBlocked: true }),
    ]);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentSuccessLogins, recentFailedLogins] = await Promise.all([
      LoginActivity.countDocuments({
        status: 'success',
        loginAt: { $gte: last24h },
      }),
      LoginActivity.countDocuments({
        status: { $in: ['failed', 'blocked'] },
        loginAt: { $gte: last24h },
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        recentSuccessLogins,
        recentFailedLogins,
        blockedAccounts: blockedUsers + blockedAdmins,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getRecentLoginActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const activities = await LoginActivity.find()
      .sort({ loginAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  getMyLoginActivity,
  getAdminOverview,
  getRecentLoginActivity,
};
