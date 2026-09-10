import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js';
import { seedDefaultStakingPlans, cleanupDuplicateStakingPlans } from './seed.js';
import { processStakingYields } from './controllers/stakingController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.options('/*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stakelab-backend', time: new Date() });
});

// API Routes (supports both /api prefix and root routes)
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

app.listen(PORT, async () => {
  console.log(`🚀 Stakelab Backend API running on http://localhost:${PORT}`);
  try {
    await seedDefaultStakingPlans();
    await cleanupDuplicateStakingPlans();
  } catch (err) {
    console.error('Startup seed error:', err.message);
  }
  
  // Background runner: Process daily yields & maturity payouts on startup & every 1 hour
  processStakingYields().catch((err) => console.error('Yield runner error:', err.message));
  setInterval(() => {
    processStakingYields().catch((err) => console.error('Yield runner error:', err.message));
  }, 60 * 60 * 1000);
});
