const { sequelize } = require('./config/db');
const Order = require('./models/Order');
const Production = require('./models/Production');
const Inventory = require('./models/Inventory');
const Customer = require('./models/Customer');
const Expense = require('./models/Expense');
const { Op, Sequelize } = require('sequelize');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('DB Connected');
    
    let dateFilter = {};
    const totalRevenue = await Order.sum('amount', {
      where: { payment: 'Paid' }
    }) || 0;
    
    const totalOrders = await Order.count();

    const produced = await Production.sum('produced', {
      where: { status: 'Completed' }
    }) || 0;
    
    const damaged = await Production.sum('damaged', {
      where: { status: 'Completed' }
    }) || 0;

    const dailyProduction = (parseFloat(produced) || 0) - (parseFloat(damaged) || 0);

    const pendingPayments = await Customer.sum('balance', {
      where: { balance: { [Op.gt]: 0 } }
    }) || 0;

    const recentOrders = await Order.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['name', 'customerId']
      }]
    });

    const lowStockAlerts = await Inventory.findAll({
      where: Sequelize.literal('qty < minQty')
    });

    const totalExpenses = await Expense.sum('amount') || 0;

    const totalProfit = (parseFloat(totalRevenue) || 0) - (parseFloat(totalExpenses) || 0);

    const result = {
      totalRevenue: parseFloat(totalRevenue) || 0,
      totalOrders: totalOrders || 0,
      dailyProduction: dailyProduction || 0,
      pendingPayments: parseFloat(pendingPayments) || 0,
      recentOrders,
      lowStockAlerts,
      totalExpenses: parseFloat(totalExpenses) || 0,
      totalProfit: totalProfit || 0
    };
    
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
