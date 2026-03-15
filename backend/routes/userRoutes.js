const express = require('express');
const Task = require('../models/Task');
const LoginActivity = require('../models/LoginActivity');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/user/profile - Get current user profile (also serves as /api/user/me)
router.get('/profile', async (req, res) => {
  try {
    // req.user is populated by authMiddleware
    const user = req.user;
    
    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
});

// GET /api/user/last-login - Get last login activity
router.get('/last-login', async (req, res) => {
  try {
    const lastActivity = await LoginActivity.findOne({
      userId: req.user._id,
      status: 'success',
    }).sort({ loginAt: -1 }).lean();

    if (!lastActivity) {
      return res.status(200).json({
        success: true,
        lastLogin: null,
        ipAddress: null,
      });
    }

    return res.status(200).json({
      success: true,
      lastLogin: lastActivity.loginAt,
      ipAddress: lastActivity.ipAddress,
      device: lastActivity.deviceName || lastActivity.device,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch last login',
    });
  }
});

// GET /api/user/activity - Get login activity for current user
router.get('/activity', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const activities = await LoginActivity.find({ userId: req.user._id })
      .sort({ loginAt: -1 })
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
    });
  }
});

// GET /api/user/tasks - Get all tasks for the logged-in user
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id })
      .sort({ status: 1, createdAt: -1 }); // Pending first, then by date
    
    return res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
    });
  }
});

// POST /api/user/tasks - Create a new task
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required',
      });
    }

    const task = await Task.create({
      userId: req.user._id,
      title: title.trim(),
      description: description?.trim() || '',
      priority: priority || 'low',
      dueDate: dueDate || null,
    });

    return res.status(201).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create task',
    });
  }
});

// PATCH /api/user/tasks/:id/complete - Mark task as completed
router.patch('/tasks/:id/complete', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    task.status = 'completed';
    await task.save();

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to complete task',
    });
  }
});

// PATCH /api/user/tasks/:id/reopen - Reopen a completed task
router.patch('/tasks/:id/reopen', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    task.status = 'pending';
    await task.save();

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reopen task',
    });
  }
});

// DELETE /api/user/tasks/:id - Delete a task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete task',
    });
  }
});

module.exports = router;
