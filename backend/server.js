const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const managerRoutes = require('./routes/managerRoutes');
const ensureDefaultAdmin = require('./utils/ensureDefaultAdmin');

dotenv.config();

const app = express();

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE'],
    allowedHeaders: ['Content-Type','Authorization']
  })
);
app.use(express.json({ encoding: 'utf-8' }));
app.use(cookieParser());

// Serve static files from the project root
console.log('[DEBUG] Static files root:', path.join(__dirname, '..'));

// Serve CSS with correct MIME type - specific route first
app.use('/styles.css', express.static(path.join(__dirname, '..', 'styles.css'), {
  headers: {
    'Content-Type': 'text/css'
  }
}));

// Debug route for styles.css
app.get('/debug/styles.css', (req, res) => {
  console.log('[DEBUG] Serving styles.css directly');
  res.sendFile(path.join(__dirname, '..', 'styles.css'));
});

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '..'), {
  index: ['obsidianauth.html', 'index.html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Root route to serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, '..', 'obsidianauth.html')
  );
});

// Explicit route for obsidianauth.html
app.get('/obsidianauth.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, '..', 'obsidianauth.html')
  );
});

app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/manager', managerRoutes);

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
      const server = app.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`  🚀 ObsidianAuth Server Running`);
        console.log(`========================================`);
        console.log(`  📱 Frontend: http://localhost:${PORT}/obsidianauth.html`);
        console.log(`  🔌 API:     http://localhost:${PORT}/api`);
        console.log(`  💚 Health:   http://localhost:${PORT}/health`);
        console.log(`========================================\n`);
      });

      server.on('error', (error) => {
        if (error && error.code === 'EADDRINUSE') {
          console.error(`\n[ERROR] Port ${PORT} is already in use.`);
          console.error(
            `Stop the other server process, or run with a different port (PowerShell example):\n  $env:PORT=5001; node server.js\n`
          );
          process.exit(1);
        }

        console.error('[ERROR] Server failed to start:', error);
        process.exit(1);
      });
    })
    .catch((error) => {
      console.error(`Default admin seed error: ${error.message}`);
      process.exit(1);
    });
});
