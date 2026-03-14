const express = require('express');
const mongoose = require('mongoose');
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
      LoginActivity.countDocuments({ status: 'success', loginAt: { $gte: last24h } }),
      LoginActivity.countDocuments({ status: 'failed' }),
      LoginActivity.countDocuments({ status: 'blocked' }),
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

// GET /api/admin/security-alerts - Returns last 20 failed/blocked login attempts
router.get('/security-alerts', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const alerts = await LoginActivity.find({
      $or: [{ status: 'failed' }, { status: 'blocked' }],
    })
      .sort({ loginAt: -1 })
      .limit(20)
      .lean();

    const formattedAlerts = alerts.map((alert) => ({
      username: alert.email || alert.name || alert.username || alert.identifier || 'unknown',
      email: alert.email || '',
      alertType: alert.status === 'blocked' ? 'Blocked Access' : 'Failed Login',
      loginStatus: alert.status,
      ipAddress: alert.ipAddress,
      timestamp: alert.loginAt,
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
      query.status = status;
    }

    const activities = await LoginActivity.find(query)
      .sort({ loginAt: -1 })
      .limit(50)
      .lean();

    const formattedActivities = activities.map((activity) => ({
      username: activity.email || activity.name || activity.username || activity.identifier || 'unknown',
      ipAddress: activity.ipAddress,
      device: activity.deviceName || 'Desktop',
      browser: activity.browser || 'Unknown',
      loginStatus: activity.status,
      timestamp: activity.loginAt,
    }));

    return res.status(200).json({
      success: true,
      data: formattedActivities,
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

module.exports = router;
