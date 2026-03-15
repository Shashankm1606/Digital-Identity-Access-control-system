const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const LoginActivity = require('../models/LoginActivity');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// GET /api/manager/stats - Returns manager dashboard statistics
router.get('/stats', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const managerId = req.user.id;
    
    // For now, get all users as team members (could be filtered by manager)
    const teamMembers = await User.countDocuments({ role: 'user' });
    
    // Get tasks assigned by this manager
    const tasksAssigned = await Task.countDocuments({ assignedBy: managerId });
    const tasksCompleted = await Task.countDocuments({ assignedBy: managerId, status: 'completed' });
    const pendingTasks = await Task.countDocuments({ assignedBy: managerId, status: 'pending' });
    
    // Get overdue tasks
    const now = new Date();
    const overdueTasks = await Task.countDocuments({ 
      assignedBy: managerId, 
      status: 'pending',
      dueDate: { $lt: now }
    });

    return res.status(200).json({
      success: true,
      teamMembers,
      tasksAssigned,
      tasksCompleted,
      pendingTasks,
      overdueTasks
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

// GET /api/manager/tasks - Returns tasks assigned by manager
router.get('/tasks', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const managerId = req.user.id;
    
    const tasks = await Task.find({ assignedBy: managerId })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
    });
  }
});

// POST /api/manager/tasks - Create a new task
router.post('/tasks', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const { title, description, assignedTo, priority, dueDate } = req.body;
    const managerId = req.user.id;

    if (!title || !assignedTo || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, assignee, and deadline are required',
      });
    }

    const task = await Task.create({
      title,
      description: description || '',
      assignedTo,
      assignedBy: managerId,
      priority: priority || 'medium',
      dueDate,
      status: 'pending'
    });

    // Populate assignedTo for response
    await task.populate('assignedTo', 'name email');

    // Create notification for the assigned user
    const assignedUser = await User.findById(assignedTo);
    if (assignedUser) {
      await Notification.create({
        recipientId: assignedTo,
        type: 'task_assigned',
        message: `You have been assigned a new task: ${title}`,
        relatedId: task._id
      });
    }

    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create task',
    });
  }
});

// PATCH /api/manager/tasks/:id/complete - Mark task as completed
router.patch('/tasks/:id/complete', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await Task.findByIdAndUpdate(
      id,
      { 
        status: 'completed',
        completedAt: new Date()
      },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Notify manager
    await Notification.create({
      recipientId: task.assignedBy,
      type: 'task_completed',
      message: `${task.assignedTo?.name || 'User'} completed task: ${task.title}`,
      relatedId: task._id
    });

    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to complete task',
    });
  }
});

// PATCH /api/manager/tasks/:id/approve - Approve completed task
router.patch('/tasks/:id/approve', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await Task.findByIdAndUpdate(
      id,
      { 
        status: 'approved',
        approvedAt: new Date()
      },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to approve task',
    });
  }
});

// PATCH /api/manager/tasks/:id/edit - Edit task
router.patch('/tasks/:id/edit', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, priority, dueDate } = req.body;
    
    const updateData = {};
    if (title) updateData.title = title;
    if (priority) updateData.priority = priority;
    if (dueDate) updateData.dueDate = dueDate;

    const task = await Task.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to edit task',
    });
  }
});

// GET /api/manager/team-members - Returns all users (team members)
router.get('/team-members', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('-password')
      .lean();

    // Get task counts for each user
    const usersWithTasks = await Promise.all(
      users.map(async (user) => {
        const taskCount = await Task.countDocuments({ assignedTo: user._id });
        const lastActivity = await LoginActivity.findOne({ userId: user._id })
          .sort({ loginAt: -1 })
          .lean();
        
        return {
          ...user,
          taskCount,
          lastLogin: lastActivity?.loginAt
        };
      })
    );

    return res.status(200).json({
      success: true,
      users: usersWithTasks
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team members',
    });
  }
});

// GET /api/manager/activity-logs - Returns activity logs for team
router.get('/activity-logs', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    // Get users with role 'user'
    const users = await User.find({ role: 'user' }).select('_id').lean();
    const userIds = users.map(u => u._id);

    // Get login activities for these users
    const loginActivities = await LoginActivity.find({
      userId: { $in: userIds }
    })
      .sort({ loginAt: -1 })
      .limit(50)
      .lean();

    const formattedActivities = loginActivities.map(activity => ({
      username: activity.email || activity.name || activity.username || 'unknown',
      action: activity.status === 'success' ? 'LOGIN' : (activity.status === 'failed' ? 'FAILED LOGIN' : 'BLOCKED'),
      ipAddress: activity.ipAddress,
      timestamp: activity.loginAt,
      loginStatus: activity.status
    }));

    return res.status(200).json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
    });
  }
});

// GET /api/manager/notifications - Returns notifications for manager
router.get('/notifications', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

// POST /api/manager/notifications/read-all - Mark all notifications as read
router.post('/notifications/read-all', authMiddleware, roleMiddleware('manager', 'admin'), async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.id, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
    });
  }
});

module.exports = router;
