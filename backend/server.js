const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ensureDefaultAdmin = require('./utils/ensureDefaultAdmin');

dotenv.config();

const app = express();

// Set UTF-8 encoding for JSON responses
app.use((req, res, next) => {
  if (req.accepts('html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ encoding: 'utf-8' }));
app.use(cookieParser());

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '..')));

app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  ensureDefaultAdmin()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`  🚀 ObsidianAuth Server Running`);
        console.log(`========================================`);
        console.log(`  📱 Frontend: http://localhost:${PORT}/obsidianauth.html`);
        console.log(`  🔌 API:     http://localhost:${PORT}/api`);
        console.log(`  💚 Health:   http://localhost:${PORT}/health`);
        console.log(`========================================\n`);
      });
    })
    .catch((error) => {
      console.error(`Default admin seed error: ${error.message}`);
      process.exit(1);
    });
});

