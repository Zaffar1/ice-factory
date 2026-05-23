const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getProductionReport,
  getRevenueReport,
  getProfitLossReport,
  getExpenseReport,
  getUdharReport,
  getInventoryReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

// All analytical reports require user authentication
router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/production', getProductionReport);
router.get('/revenue', getRevenueReport);
router.get('/profit-loss', getProfitLossReport);
router.get('/expenses', getExpenseReport);
router.get('/udhar', getUdharReport);
router.get('/inventory', getInventoryReport);

module.exports = router;
