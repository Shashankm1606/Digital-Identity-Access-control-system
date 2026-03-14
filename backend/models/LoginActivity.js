const mongoose = require('mongoose');

const loginActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'user', 'unknown'],
      default: 'unknown',
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
    },
    identifier: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    deviceName: {
      type: String,
      trim: true,
    },
    browser: {
      type: String,
      trim: true,
    },
    loginStatus: {
      type: String,
      enum: ['success', 'failed', 'blocked'],
    },
    alertType: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    device: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'blocked'],
      required: true,
    },
    loginAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

loginActivitySchema.index({ userId: 1, loginAt: -1 });
loginActivitySchema.index({ loginAt: -1 });
loginActivitySchema.index({ status: 1, loginAt: -1 });

const LoginActivity = mongoose.model('LoginActivity', loginActivitySchema);

module.exports = LoginActivity;
