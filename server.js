const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

const { connectDB } = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const seedAdmin = require('./seeds/adminSeed');

const app = express();

// ============ MIDDLEWARE ============

// Security
app.use(helmet());

// Logging
app.use(morgan('dev'));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl.split('?')[0] === '/api/v1/payments/rapidgateway/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate Limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  skip: () => process.env.NODE_ENV === 'development',
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/auth', authLimiter);

// ============ ROUTES ============

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'LocalBiz Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: 'NOT_FOUND',
  });
});

// Global error handler
app.use(errorHandler);

// ============ DATABASE CONNECTION & SERVER START ============

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Seed admin user
    await seedAdmin();
    
    app.listen(PORT, () => {
      console.log(`✅ LocalBiz Backend running on port ${PORT}`);
      console.log(`📧 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
