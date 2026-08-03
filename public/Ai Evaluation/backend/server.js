import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import sequelize from './models/db.js';

// Route Imports
import uploadRouter from './routes/upload.js';
import resultsRouter from './routes/results.js';
import leaderboardRouter from './routes/leaderboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Allow all origins for development testing
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploads directory statically
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Mount API Routes
app.use('/api/upload', uploadRouter);
app.use('/api/result', resultsRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Support exact spec endpoints (fallback routes pointing to the same routers)
app.use('/upload', uploadRouter);
app.use('/result', resultsRouter);
app.use('/leaderboard', leaderboardRouter);

// Base route for check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'EdTechra Handwriting Evaluator API is running' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred on the server',
  });
});

// Sync database and start server
async function startServer() {
  try {
    // Authenticate database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync models (creates tables if they don't exist, and alters them to match schema updates)
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized successfully.');

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database or start server:', error);
    process.exit(1);
  }
}

startServer();
