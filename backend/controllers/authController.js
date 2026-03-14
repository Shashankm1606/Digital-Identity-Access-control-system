const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

const PASSWORD_RESET_TTL_MINUTES = Math.min(
  Math.max(Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 15, 5),
  120
);

// Simple in-memory rate limiter for password reset (production should use Redis)
const passwordResetRateLimit = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 3; // Max 3 requests per window

const checkPasswordResetRateLimit = (email) => {
  const now = Date.now();
  const record = passwordResetRateLimit.get(email);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    passwordResetRateLimit.set(email, { windowStart: now, count: 1 });
    return { allowed: true };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, message: 'Too many reset requests. Please try again later.' };
  }
  
  record.count++;
  return { allowed: true };
};

const shouldExposeResetToken = () => {
  // Only expose tokens when explicitly enabled - never auto-expose in development
  return process.env.EXPOSE_RESET_TOKEN === 'true';
};

const normalizeEmail = (value) => String(value || '').toLowerCase().trim();

const hashResetToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

// Password complexity validation
const validatePasswordComplexity = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  
  if (complexityScore < 3) {
    return { 
      valid: false, 
      message: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters' 
    };
  }
  
  return { valid: true };
};

const createPasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  return { token, tokenHash, expiresAt };
};

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getIdentifierQuery = (loginIdentifier) => {
  const normalizedIdentifier = String(loginIdentifier || '').toLowerCase();
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

const parseUserAgent = (ua) => {
  const s = String(ua || '');
  let browser = 'Unknown';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/chrome\//i.test(s)) browser = 'Chrome';
  else if (/safari\//i.test(s) && !/chrome\//i.test(s)) browser = 'Safari';
  else if (/firefox\//i.test(s)) browser = 'Firefox';
  else if (/msie|trident/i.test(s)) browser = 'IE';

  let deviceName = 'Desktop';
  if (/mobile/i.test(s)) deviceName = 'Mobile';
  else if (/tablet/i.test(s)) deviceName = 'Tablet';

  return { browser, deviceName };
};

const trackLoginActivity = async (req, payload) => {
  try {
    const ua = req.headers['user-agent'] || 'unknown';
    const { browser, deviceName } = parseUserAgent(ua);
    await LoginActivity.create({
      userId: payload.user?._id,
      role: payload.user?.role || payload.role || 'unknown',
      name: payload.user?.name,
      email: payload.user?.email,
      username: payload.user?.name
        ? String(payload.user.name).toLowerCase().replace(/\s+/g, '_')
        : undefined,
      identifier: payload.identifier,
      ipAddress: getClientIp(req),
      userAgent: ua,
      deviceName,
      browser,
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
      await trackLoginActivity(req, { identifier: loginIdentifier, status: 'failed' });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      await trackLoginActivity(req, { identifier: loginIdentifier, status: 'blocked', user });
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
      await trackLoginActivity(req, { identifier: loginIdentifier, status: loginStatus, user });

      return res.status(401).json({
        success: false,
        message: user.isBlocked ? 'Account blocked after 5 failed login attempts' : 'Invalid credentials',
      });
    }

    user.failedAttempts = 0;
    user.isBlocked = false;
    await user.save({ validateBeforeSave: false });

    await trackLoginActivity(req, { identifier: loginIdentifier, status: 'success', user });

    const token = generateToken(user);
    res.cookie('token', token, cookieOptions);

    return res.status(200).json({ success: true, message: 'Login successful', user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res) => {
  res.clearCookie('token', cookieOptions);
  return res.status(200).json({ success: true, message: 'Logout successful' });
};

const getCurrentUser = async (req, res, next) => {
  try {
    const Model = req.user.role === 'admin' ? Admin : User;
    const user = await Model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const getMyLoginActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const activities = await LoginActivity.find({ userId: req.user.id, role: req.user.role })
      .sort({ loginAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, activities });
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
    const [recentSuccessLogins, recentFailedLogins, blockedLogins] = await Promise.all([
      LoginActivity.countDocuments({ status: 'success', loginAt: { $gte: last24h } }),
      LoginActivity.countDocuments({ status: 'failed', loginAt: { $gte: last24h } }),
      LoginActivity.countDocuments({ status: 'blocked', loginAt: { $gte: last24h } }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        recentSuccessLogins,
        recentFailedLogins,
        blockedLogins,
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

    const query = {};
    if (req.query.status) {
      query.status = { $in: String(req.query.status).split(',') };
    }
    if (req.query.user) {
      const v = String(req.query.user).trim();
      query.$or = [
        { email: v.toLowerCase() },
        { name: new RegExp(`^${escapeRegExp(v)}$`, 'i') },
        { username: new RegExp(`^${escapeRegExp(v)}$`, 'i') },
      ];
    }
    if (req.query.from || req.query.to) {
      query.loginAt = {};
      if (req.query.from) query.loginAt.$gte = new Date(req.query.from);
      if (req.query.to) query.loginAt.$lte = new Date(req.query.to);
    }

    const activities = await LoginActivity.find(query)
      .sort({ loginAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, activities });
  } catch (error) {
    return next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Apply rate limiting
    const rateLimitCheck = checkPasswordResetRateLimit(email);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ success: false, message: rateLimitCheck.message });
    }

    const [admin, user] = await Promise.all([Admin.findOne({ email }), User.findOne({ email })]);
    const account = admin || user;

    if (account) {
      const { token, tokenHash, expiresAt } = createPasswordResetToken();
      account.passwordResetTokenHash = tokenHash;
      account.passwordResetExpiresAt = expiresAt;
      account.passwordResetRequestedAt = new Date();
      await account.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        message: 'If an account exists for this email, a reset link has been created',
        ...(shouldExposeResetToken()
          ? { resetToken: token, expiresAt: expiresAt.toISOString() }
          : {}),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists for this email, a reset link has been created',
    });
  } catch (error) {
    return next(error);
  }
};

// Send password reset email (placeholder - no SMTP configured)
const sendPasswordResetEmail = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const Model = userRole === 'admin' ? Admin : User;
    
    const user = await Model.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Apply rate limiting per user
    const rateLimitCheck = checkPasswordResetRateLimit(user.email);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ success: false, message: rateLimitCheck.message });
    }

    // Generate reset token
    const { token, tokenHash, expiresAt } = createPasswordResetToken();
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    user.passwordResetRequestedAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Log the password reset request
    console.log(`[Password Reset] Reset email requested for user: ${user.email} (ID: ${user._id})`);
    console.log(`[Password Reset] Token would be sent to: ${user.email}`);
    
    // TODO: Implement actual email sending when SMTP is configured
    // For now, return success and log the action
    return res.status(200).json({
      success: true,
      message: 'Password reset email has been sent to your registered email address',
      // Expose token in development for testing
      ...(shouldExposeResetToken() ? { resetToken: token, expiresAt: expiresAt.toISOString() } : {}),
    });
  } catch (error) {
    return next(error);
  }
};

// Get all users (admin)
const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password').skip(skip).limit(limit).lean(),
      User.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Update user (admin)
const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, role, isBlocked } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      user.email = normalizedEmail;
    }
    if (role && ['user', 'manager'].includes(role)) {
      user.role = role;
    }
    if (typeof isBlocked === 'boolean') {
      user.isBlocked = isBlocked;
      if (isBlocked) {
        user.failedAttempts = 0;
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

// Delete user (admin)
const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
};

// Block/Unblock user (admin)
const toggleUserBlock = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isBlocked = Boolean(isBlocked);
    if (user.isBlocked) {
      user.failedAttempts = 0;
    }
    await user.save();

    return res.status(200).json({
      success: true,
      message: user.isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const verifyPasswordResetToken = async (req, res, next) => {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const tokenHash = hashResetToken(token);
    const now = new Date();

    const [admin, user] = await Promise.all([
      Admin.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } }).select('_id'),
      User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } }).select('_id'),
    ]);

    return res.status(200).json({ success: true, valid: Boolean(admin || user) });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '');

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ success: false, message: passwordValidation.message });
    }

    const tokenHash = hashResetToken(token);
    const now = new Date();

    const admin = await Admin.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } }).select('+password');
    const account =
      admin ||
      (await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } }).select('+password'));

    if (!account) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    account.password = newPassword;
    account.passwordChangedAt = new Date();
    account.passwordResetTokenHash = undefined;
    account.passwordResetExpiresAt = undefined;
    account.passwordResetRequestedAt = undefined;
    account.failedAttempts = 0;
    account.isBlocked = false;
    await account.save();

    res.clearCookie('token', cookieOptions);

    return res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    return next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ success: false, message: passwordValidation.message });
    }

    const Model = req.user.role === 'admin' ? Admin : User;
    const account = await Model.findById(req.user.id).select('+password');

    if (!account || !account.password) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, account.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    account.password = newPassword;
    account.passwordChangedAt = new Date();
    account.passwordResetTokenHash = undefined;
    account.passwordResetExpiresAt = undefined;
    account.passwordResetRequestedAt = undefined;
    account.failedAttempts = 0;
    account.isBlocked = false;
    await account.save();

    res.clearCookie('token', cookieOptions);

    return res.status(200).json({ success: true, message: 'Password updated successfully. Please log in again.' });
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
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
  changePassword,
  sendPasswordResetEmail,
  getAllUsers,
  updateUser,
  deleteUser,
  toggleUserBlock,
};
