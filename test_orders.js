const Order = require('./models/Order');
const Customer = require('./models/Customer');
const { connectDB } = require('./config/db');

async function test() {
  await connectDB();
  const rawOrders = await Order.findAll();
  console.log('Total orders:', rawOrders.length);
  
  const populatedOrders = await Order.findAll({
    include: [{ association: 'customerAssociation' }]
  });
  console.log('Orders with customerAssociation populated:', populatedOrders.map(o => o.get({ plain: true })));
  
  process.exit(0);
}

test();
