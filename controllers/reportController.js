const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/db');
const Order = require('../models/Order');
const Production = require('../models/Production');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');

/**
 * Helper to build Sequelize date range where filters
 */
const buildSequelizeDateFilter = (from, to) => {
  let where = {};
  if (from || to) {
    where.date = {};
    if (from) {
      where.date[Op.gte] = new Date(from);
    }
    if (to) {
      where.date[Op.lte] = new Date(to);
    }
  }
  return where;
};

/**
 * Helper to build raw SQL date range filters
 */
const buildSqlDateFilter = (from, to) => {
  let sql = '';
  if (from) {
    // Format to MySQL date format YYYY-MM-DD HH:MM:SS
    const fromStr = new Date(from).toISOString().slice(0, 19).replace('T', ' ');
    sql += ` AND date >= '${fromStr}'`;
  }
  if (to) {
    const toStr = new Date(to).toISOString().slice(0, 19).replace('T', ' ');
    sql += ` AND date <= '${toStr}'`;
  }
  return sql;
};

/**
 * @desc    Get dashboard summary statistics
 * @route   GET /api/reports/dashboard
 * @access  Private
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilter = buildSequelizeDateFilter(from, to);

    // 1. Total Revenue: Sum order amounts where payment is 'Paid'
    const totalRevenue = await Order.sum('amount', {
      where: {
        payment: 'Paid',
        ...dateFilter
      }
    }) || 0;

    // 2. Total Orders: count of orders in range
    const totalOrders = await Order.count({ where: dateFilter });

    // 3. Daily Production: Sum of (produced - damaged) in range
    const produced = await Production.sum('produced', {
      where: {
        status: 'Completed',
        ...dateFilter
      }
    }) || 0;
    
    const damaged = await Production.sum('damaged', {
      where: {
        status: 'Completed',
        ...dateFilter
      }
    }) || 0;

    const dailyProduction = (parseFloat(produced) || 0) - (parseFloat(damaged) || 0);

    // 4. Pending Payments: sum of positive outstanding customer balances
    const pendingPayments = await Customer.sum('balance', {
      where: {
        balance: { [Op.gt]: 0 }
      }
    }) || 0;

    // 5. Recent Orders (limit 5, populated with customer name)
    const recentOrders = await Order.findAll({
      where: dateFilter,
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{
        model: Customer,
        as: 'customerAssociation',
        attributes: ['name', 'customerId']
      }]
    });

    // 6. Low Stock Alerts: items where qty < minQty
    const lowStockAlerts = await Inventory.findAll({
      where: Sequelize.literal('qty < minQty')
    });

    // 7. Total Expenses: sum of all expenses in range
    const totalExpenses = await Expense.sum('amount', {
      where: dateFilter
    }) || 0;

    // 8. Total Profit: Revenue - Expenses
    const totalProfit = (parseFloat(totalRevenue) || 0) - (parseFloat(totalExpenses) || 0);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: parseFloat(totalRevenue) || 0,
        totalOrders: totalOrders || 0,
        dailyProduction: dailyProduction || 0,
        pendingPayments: parseFloat(pendingPayments) || 0,
        recentOrders,
        lowStockAlerts,
        totalExpenses: parseFloat(totalExpenses) || 0,
        totalProfit: totalProfit || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get production totals grouped by ice type and day
 * @route   GET /api/reports/production
 * @access  Private
 */
exports.getProductionReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const sqlDateFilter = buildSqlDateFilter(from, to);

    const productionSummary = await sequelize.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m-%d') AS date,
        type,
        CAST(SUM(produced) AS SIGNED) AS totalProduced,
        CAST(SUM(damaged) AS SIGNED) AS totalDamaged,
        CAST((SUM(produced) - SUM(damaged)) AS SIGNED) AS netProduced
      FROM Productions
      WHERE 1=1 ${sqlDateFilter}
      GROUP BY DATE_FORMAT(date, '%Y-%m-%d'), type
      ORDER BY date ASC, type ASC
    `, { type: sequelize.QueryTypes.SELECT });

    res.status(200).json({
      success: true,
      data: productionSummary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get monthly revenue trend (from orders with payment=Paid)
 * @route   GET /api/reports/revenue
 * @access  Private
 */
exports.getRevenueReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const sqlDateFilter = buildSqlDateFilter(from, to);

    const revenueTrend = await sequelize.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') AS month,
        CAST(SUM(amount) AS DECIMAL(10, 2)) AS revenue,
        COUNT(*) AS orderCount
      FROM Orders
      WHERE payment = 'Paid' ${sqlDateFilter}
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY month ASC
    `, { type: sequelize.QueryTypes.SELECT });

    // Format fields to numeric values
    const formattedTrend = revenueTrend.map(item => ({
      month: item.month,
      revenue: parseFloat(item.revenue || 0),
      orderCount: parseInt(item.orderCount || 0, 10)
    }));

    res.status(200).json({
      success: true,
      data: formattedTrend
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Profit-Loss (Revenue vs Expenses comparison)
 * @route   GET /api/reports/profit-loss
 * @access  Private
 */
exports.getProfitLossReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const sqlDateFilter = buildSqlDateFilter(from, to);

    // Aggregate monthly revenue (Paid orders)
    const revResult = await sequelize.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') AS month,
        CAST(SUM(amount) AS DECIMAL(10, 2)) AS revenue
      FROM Orders
      WHERE payment = 'Paid' ${sqlDateFilter}
      GROUP BY DATE_FORMAT(date, '%Y-%m')
    `, { type: sequelize.QueryTypes.SELECT });

    // Aggregate monthly expenses
    const expResult = await sequelize.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') AS month,
        CAST(SUM(amount) AS DECIMAL(10, 2)) AS expenses
      FROM Expenses
      WHERE 1=1 ${sqlDateFilter}
      GROUP BY DATE_FORMAT(date, '%Y-%m')
    `, { type: sequelize.QueryTypes.SELECT });

    // Format & merge monthly financials
    const financialsMap = {};

    revResult.forEach((item) => {
      const revenueVal = parseFloat(item.revenue || 0);
      financialsMap[item.month] = {
        month: item.month,
        revenue: revenueVal,
        expenses: 0,
        profit: revenueVal
      };
    });

    expResult.forEach((item) => {
      const expensesVal = parseFloat(item.expenses || 0);
      if (!financialsMap[item.month]) {
        financialsMap[item.month] = {
          month: item.month,
          revenue: 0,
          expenses: expensesVal,
          profit: -expensesVal
        };
      } else {
        financialsMap[item.month].expenses = expensesVal;
        financialsMap[item.month].profit = financialsMap[item.month].revenue - expensesVal;
      }
    });

    const report = Object.values(financialsMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get operational expense breakdown by category
 * @route   GET /api/reports/expenses
 * @access  Private
 */
exports.getExpenseReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const sqlDateFilter = buildSqlDateFilter(from, to);

    const expenseBreakdown = await sequelize.query(`
      SELECT 
        category,
        CAST(SUM(amount) AS DECIMAL(10, 2)) AS totalAmount,
        COUNT(*) AS count
      FROM Expenses
      WHERE 1=1 ${sqlDateFilter}
      GROUP BY category
      ORDER BY totalAmount DESC
    `, { type: sequelize.QueryTypes.SELECT });

    const formattedBreakdown = expenseBreakdown.map(item => ({
      category: item.category,
      totalAmount: parseFloat(item.totalAmount || 0),
      count: parseInt(item.count || 0, 10)
    }));

    res.status(200).json({
      success: true,
      data: formattedBreakdown
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get outstanding receivables (Udhar/Credit ledger)
 * @route   GET /api/reports/udhar
 * @access  Private
 */
exports.getUdharReport = async (req, res, next) => {
  try {
    const udharBalances = await Customer.findAll({
      where: {
        balance: { [Op.gt]: 0 }
      },
      order: [['balance', 'DESC']],
      attributes: ['name', 'customerId', 'phone', 'type', 'balance', 'balanceType', 'status']
    });

    res.status(200).json({
      success: true,
      data: udharBalances
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory stock level audit report
 * @route   GET /api/reports/inventory
 * @access  Private
 */
exports.getInventoryReport = async (req, res, next) => {
  try {
    const inventoryStats = await Inventory.findAll({
      order: [['qty', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: inventoryStats
    });
  } catch (error) {
    next(error);
  }
};
