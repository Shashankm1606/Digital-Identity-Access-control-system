const express = require('express');
const {
  register,
  login,
  logout,
  getCurrentUser,
  getMyLoginActivity,
  getAdminOverview,
  getRecentLoginActivity,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

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

module.exports = router;

