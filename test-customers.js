const { sequelize } = require('./config/db');
const Customer = require('./models/Customer');

async function test() {
  try {
    await sequelize.authenticate();
    const customers = await Customer.find({})
      .sort({ createdAt: -1 })
      .limit(2);
    console.log(JSON.stringify(customers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
