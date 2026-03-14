const express = require('express');
const {
  register,
  login,
  logout,
  getCurrentUser,
  getMyLoginActivity,
  getAdminOverview,
  getRecentLoginActivity,
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
  changePassword,
  sendPasswordResetEmail,
  getAllUsers,
  updateUser,
  deleteUser,
  toggleUserBlock,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/password/forgot', requestPasswordReset);
router.get('/password/reset/verify', verifyPasswordResetToken);
router.post('/password/reset', resetPassword);
router.post('/password/change', authMiddleware, changePassword);
router.post('/password/reset-email', authMiddleware, sendPasswordResetEmail);

// Admin routes
router.get('/admin/users', authMiddleware, roleMiddleware('admin'), getAllUsers);
router.put('/admin/users/:userId', authMiddleware, roleMiddleware('admin'), updateUser);
router.delete('/admin/users/:userId', authMiddleware, roleMiddleware('admin'), deleteUser);
router.post('/admin/users/:userId/toggle-block', authMiddleware, roleMiddleware('admin'), toggleUserBlock);

router.get('/dashboard', authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Authenticated dashboard route',
    user: req.user,
  });
});

router.get('/me', authMiddleware, getCurrentUser);
router.get('/activity/me', authMiddleware, getMyLoginActivity);
router.get('/admin/overview', authMiddleware, roleMiddleware('admin'), getAdminOverview);
router.get('/admin/recent-logins', authMiddleware, roleMiddleware('admin'), getRecentLoginActivity);

router.get('/admin', authMiddleware, roleMiddleware('admin'), (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Admin-only route access granted',
  });
});

// User profile route
router.get('/user/profile', authMiddleware, getCurrentUser);

// Send password reset email (placeholder)
router.post('/send-reset-email', (req, res) => {
  const { email } = req.body;
  console.log('Password reset requested for: ' + email);
  return res.status(200).json({
    success: true,
    message: 'Password reset email will be sent to ' + email,
  });
});

module.exports = router;

