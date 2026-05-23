require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const seedData = require('./utils/seeder');
const errorHandler = require('./middleware/errorHandler');

// Import modular routing schemas
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const productionRoutes = require('./routes/production');
const inventoryRoutes = require('./routes/inventory');
const paymentRoutes = require('./routes/payments');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');

// Instantiate express service
const app = express();

// Initialize Database connection and execute Seeders
const initDBAndSeed = async () => {
  try {
    await connectDB();
    await seedData();
  } catch (error) {
    console.error('Critical failure during server startup initialization:', error);
  }
};
initDBAndSeed();

// Core body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS configurations for Vite dev servers
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true
  })
);

// Setup Request Logger
app.use(morgan('dev'));

// Mount Route Endpoints under /api/ prefix
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Base sanity check landing
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Cold Chain Ice Factory ERP REST API is active and healthy.'
  });
});

// Capture all undefined routes (404)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint '${req.originalUrl}' does not exist on this server`
  });
});

// Inject Global Error interceptor
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server successfully launched on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
});
