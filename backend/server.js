// backend/server.js
// ============================================================
// AI-Based Invigilation Duty Allocation System — Backend Server
// ============================================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const facultyRoutes = require('./routes/faculty');
const subjectRoutes = require('./routes/subjects');
const availabilityRoutes = require('./routes/availability');
const examRoutes = require('./routes/exams');
const uploadRoutes = require('./routes/upload');
const facultyUploadRoutes = require('./routes/faculty_upload');
const allocationRoutes = require('./routes/allocation');
const reportRoutes  = require('./routes/report');
const reexamRoutes  = require('./routes/reexam');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

// ── Security Middleware ─────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limiter: 200 requests / 15 min per IP (bypassed in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 99999,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── API Routes ──────────────────────────────────────────────
app.use('/api', authRoutes);                      // POST /api/login, /api/register
app.use('/api/faculty', facultyRoutes);           // CRUD /api/faculty
app.use('/api/subjects', subjectRoutes);          // CRUD /api/subjects
app.use('/api/availability', availabilityRoutes); // /api/availability
app.use('/api/exams', examRoutes);                // CRUD /api/exams
app.use('/api/upload', uploadRoutes);             // POST /api/upload
app.use('/api/faculty-upload', facultyUploadRoutes); // POST /api/faculty-upload
app.use('/api', allocationRoutes);                // POST /api/generate-allocation, GET /api/allocations
app.use('/api/report', reportRoutes);             // GET /api/report
app.use('/api/reexam', reexamRoutes);             // Re-Exam module

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

// ── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Invigilation System Backend running on http://localhost:${PORT}`);
});

module.exports = app;
