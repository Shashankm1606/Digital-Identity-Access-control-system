const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// GET /api/admin/stats - Returns dashboard statistics
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalUsers, activeSessions, failedLogins, blockedLogins] = await Promise.all([
      User.countDocuments(),
      LoginActivity.countDocuments({ loginStatus: 'success', timestamp: { $gte: last24h } }),
      LoginActivity.countDocuments({ loginStatus: 'failed' }),
      LoginActivity.countDocuments({ loginStatus: 'blocked' }),
    ]);

    return res.status(200).json({
      success: true,
      totalUsers,
      activeSessions,
      failedLogins,
      blockedLogins,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

// GET /api/admin/recent-logs - Returns last 10 login activities
router.get('/recent-logs', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const logs = await LoginActivity.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const formattedLogs = logs.map((log) => ({
      username: log.username || 'unknown',
      email: log.email || '',
      ipAddress: log.ipAddress || 'N/A',
      device: log.device || 'Desktop',
      browser: log.browser || 'Unknown',
      loginStatus: log.loginStatus,
      timestamp: log.timestamp,
    }));

    return res.status(200).json({
      success: true,
      data: formattedLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent logs',
    });
  }
});

// GET /api/admin/security-monitoring - Returns last 30 login activities
router.get('/security-monitoring', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const activities = await LoginActivity.find()
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    const formattedActivities = activities.map((activity) => ({
      username: activity.username || 'unknown',
      email: activity.email || '',
      ipAddress: activity.ipAddress || 'N/A',
      device: activity.device || 'Desktop',
      browser: activity.browser || 'Unknown',
      loginStatus: activity.loginStatus,
      action: activity.loginStatus === 'success' ? 'LOGIN' : activity.loginStatus === 'failed' ? 'FAILED LOGIN' : 'BLOCKED ACCESS',
      timestamp: activity.timestamp,
    }));

    return res.status(200).json({
      success: true,
      data: formattedActivities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch security monitoring data',
    });
  }
});

// GET /api/admin/check-username - Check if username exists
router.get('/check-username', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ exists: false });
    }
    
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    return res.status(200).json({ exists: !!existingUser });
  } catch (error) {
    return res.status(500).json({ exists: false });
  }
});

// GET /api/admin/check-email - Check if email exists
router.get('/check-email', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ exists: false });
    }
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    return res.status(200).json({ exists: !!existingUser });
  } catch (error) {
    return res.status(500).json({ exists: false });
  }
});

// POST /api/admin/create-account - Create new admin or manager account
router.post('/create-account', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { fullName, username, email, password, role } = req.body;

    // Validate required fields
    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all fields',
      });
    }

    // Validate role
    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'USERNAME ALREADY EXISTS',
      });
    }

    // Check if email exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'EMAIL ALREADY REGISTERED',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      role,
      isActive: true,
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: 'ACCOUNT CREATED SUCCESSFULLY',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
    });
  }
});

// GET /api/admin/security-alerts - Returns last 20 failed/blocked login attempts
router.get('/security-alerts', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const alerts = await LoginActivity.find({
      $or: [{ loginStatus: 'failed' }, { loginStatus: 'blocked' }],
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    const formattedAlerts = alerts.map((alert) => ({
      username: alert.username || 'unknown',
      email: alert.email || '',
      alertType: alert.loginStatus === 'blocked' ? 'Blocked Access' : 'Failed Login',
      loginStatus: alert.loginStatus,
      ipAddress: alert.ipAddress,
      timestamp: alert.timestamp,
    }));

    return res.status(200).json({
      success: true,
      data: formattedAlerts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch security alerts',
    });
  }
});

// GET /api/admin/activity-logs - Returns login activity with optional status filter
router.get('/activity-logs', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.loginStatus = status;
    }

    const activities = await LoginActivity.find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const formattedActivities = activities.map((activity) => ({
      username: activity.username || 'unknown',
      email: activity.email || '',
      ipAddress: activity.ipAddress || 'N/A',
      device: activity.device || 'Desktop',
      browser: activity.browser || 'Unknown',
      loginStatus: activity.loginStatus,
      timestamp: activity.timestamp,
    }));

    return res.status(200).json({
      success: true,
      data: formattedActivities,
      count: formattedActivities.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
    });
  }
});

// GET /api/admin/system-health - Returns system health status
router.get('/system-health', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState === 1 ? 'healthy' : 'warning';

    return res.status(200).json({
      success: true,
      authService: 'healthy',
      database: dbState,
      apiGateway: 'healthy',
      securityScanner: 'healthy',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch system health',
    });
  }
});

// GET /api/admin/blocked-users - Returns all blocked users with pagination
router.get('/blocked-users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [blockedUsers, total] = await Promise.all([
      User.find({ isBlocked: true })
        .select('-password')
        .lean()
        .skip(skip)
        .limit(limit),
      User.countDocuments({ isBlocked: true }),
    ]);

    return res.status(200).json({
      success: true,
      users: blockedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked users',
    });
  }
});

// GET /api/admin/suspicious-ips - Returns IPs with multiple failed attempts
router.get('/suspicious-ips', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const suspiciousIps = await LoginActivity.aggregate([
      { $match: { loginStatus: 'failed' } },
      {
        $group: {
          _id: '$ipAddress',
          failedAttempts: { $sum: 1 },
        },
      },
      { $match: { failedAttempts: { $gte: 3 } } },
      { $sort: { failedAttempts: -1 } },
      { $limit: 10 },
    ]);

    const formatted = suspiciousIps.map((ip) => ({
      ipAddress: ip._id || 'Unknown',
      attemptCount: ip.failedAttempts,
      riskLevel: ip.failedAttempts > 10 ? 'HIGH' : ip.failedAttempts > 5 ? 'MEDIUM' : 'LOW',
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suspicious IPs',
    });
  }
});

// GET /api/admin/role-counts - Returns count of users by role
router.get('/role-counts', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const [adminCount, managerCount, userCount] = await Promise.all([
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'manager' }),
      User.countDocuments({ role: 'user' }),
    ]);

    return res.status(200).json({
      success: true,
      counts: {
        admin: adminCount,
        manager: managerCount,
        user: userCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch role counts',
    });
  }
});

// GET /api/admin/users - Returns all users with their last login info (paginated)
router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Use aggregation to fetch users with their last login in a single query
    const usersWithLastLogin = await User.aggregate([
      { $match: {} },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'loginactivities',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$userId'] }, status: 'success' } },
            { $sort: { loginAt: -1 } },
            { $limit: 1 },
          ],
          as: 'lastActivity',
        },
      },
      {
        $addFields: {
          lastIp: { $arrayElemAt: ['$lastActivity.ipAddress', 0] },
          lastDevice: { $arrayElemAt: ['$lastActivity.deviceName', 0] },
          lastLogin: { $arrayElemAt: ['$lastActivity.loginAt', 0] },
        },
      },
      {
        $project: {
          password: 0,
          lastActivity: 0,
        },
      },
    ]);

    const total = await User.countDocuments();

    return res.status(200).json({
      success: true,
      users: usersWithLastLogin,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
});

// PATCH /api/admin/users/:id/role - Update user role
router.patch('/users/:id/role', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    if (!role || !['user', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be user, manager, or admin',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role',
    });
  }
});

// PATCH /api/admin/users/:id/unblock - Unblock a user
router.patch('/users/:id/unblock', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isBlocked: false, failedAttempts: 0 },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to unblock user',
    });
  }
});

module.exports = router;
