const User = require('../models/User');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const Production = require('../models/Production');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Counter = require('../models/Counter');

/**
 * Seeds administrative user and initial factory operation records on first startup
 */
const seedData = async () => {
  try {
    // 1. Seed Default Admin User
    const adminExists = await User.findOne({ email: 'admin@coldchain.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@coldchain.com',
        password: 'admin123',
        role: 'Admin'
      });
      console.log('✅ [Seeder] Seeded default Admin user (admin@coldchain.com / admin123)');
    }

    // 2. Check if collections are empty. If so, populate demo data.
    const customerCount = await Customer.countDocuments();
    if (customerCount === 0) {
      console.log('🚀 [Seeder] Empty database detected. Initializing factory demo dataset...');

      // Clear sequential ID tracker counters to avoid prefix offsets
      await Counter.deleteMany({});

      // Seed Customers
      const customers = await Customer.create([
        {
          name: 'Ahmad Ice Depo',
          phone: '03001234567',
          type: 'Wholesale',
          balance: 45000,
          balanceType: 'Credit',
          status: 'Active'
        },
        {
          name: 'City Fish Market',
          phone: '03217654321',
          type: 'Retail',
          balance: 12000,
          balanceType: 'Credit',
          status: 'Active'
        },
        {
          name: 'Ali Juice Corner',
          phone: '03339876543',
          type: 'Retail',
          balance: 0,
          balanceType: 'Credit',
          status: 'Active'
        },
        {
          name: 'Zaman Cold Storage',
          phone: '03124567890',
          type: 'Wholesale',
          balance: 150000,
          balanceType: 'Credit',
          status: 'Active'
        },
        {
          name: 'Kashmir Hotel',
          phone: '03451122334',
          type: 'Retail',
          balance: 5000,
          balanceType: 'Credit',
          status: 'Active'
        }
      ]);
      console.log(`✅ [Seeder] Seeded ${customers.length} Customers`);

      // Seed Inventory items
      const inventory = await Inventory.create([
        {
          item: 'Block Ice',
          category: 'Finished Goods',
          qty: 450,
          unit: 'Blocks',
          minQty: 100
        },
        {
          item: 'Ammonia Gas',
          category: 'Raw Material',
          qty: 15,
          unit: 'Kg',
          minQty: 20
        },
        {
          item: 'Salt',
          category: 'Raw Material',
          qty: 50,
          unit: 'Kg',
          minQty: 100
        },
        {
          item: 'Crushed Ice',
          category: 'Finished Goods',
          qty: 1200,
          unit: 'Kg',
          minQty: 500
        },
        {
          item: 'Tube Ice',
          category: 'Finished Goods',
          qty: 300,
          unit: 'Bags',
          minQty: 50
        },
        {
          item: 'Packaging Bags',
          category: 'Packaging',
          qty: 200,
          unit: 'Pcs',
          minQty: 500
        }
      ]);
      console.log(`✅ [Seeder] Seeded ${inventory.length} Inventory items`);

      // Retrieve customer references for building relations
      const ahmad = customers.find((c) => c.name === 'Ahmad Ice Depo');
      const cityFish = customers.find((c) => c.name === 'City Fish Market');
      const juiceCorner = customers.find((c) => c.name === 'Ali Juice Corner');
      const zaman = customers.find((c) => c.name === 'Zaman Cold Storage');
      const kashmir = customers.find((c) => c.name === 'Kashmir Hotel');

      // Seed Production logs
      const productions = await Production.create([
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          shift: 'Morning',
          type: 'Block Ice',
          produced: 150,
          damaged: 5,
          operator: 'Sajid Khan',
          status: 'Completed'
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          shift: 'Evening',
          type: 'Tube Ice',
          produced: 120,
          damaged: 2,
          operator: 'Irfan Ali',
          status: 'Completed'
        },
        {
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          shift: 'Night',
          type: 'Crushed Ice',
          produced: 800,
          damaged: 10,
          operator: 'M. Ramzan',
          status: 'Completed'
        },
        {
          date: new Date(),
          shift: 'Morning',
          type: 'Block Ice',
          produced: 180,
          damaged: 4,
          operator: 'Sajid Khan',
          status: 'In Progress'
        }
      ]);
      console.log(`✅ [Seeder] Seeded ${productions.length} Production logs`);

      // Seed Orders
      const orders = await Order.create([
        {
          date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          customer: ahmad._id,
          type: 'Block Ice',
          qty: 100,
          rate: 300,
          payment: 'Paid',
          status: 'Delivered'
        },
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          customer: cityFish._id,
          type: 'Crushed Ice',
          qty: 200,
          rate: 50,
          payment: 'Pending',
          status: 'Pending'
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          customer: zaman._id,
          type: 'Tube Ice',
          qty: 150,
          rate: 1000,
          payment: 'Credit',
          status: 'Delivered'
        },
        {
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          customer: kashmir._id,
          type: 'Block Ice',
          qty: 20,
          rate: 350,
          payment: 'Pending',
          status: 'Processing'
        },
        {
          date: new Date(),
          customer: juiceCorner._id,
          type: 'Crushed Ice',
          qty: 50,
          rate: 50,
          payment: 'Paid',
          status: 'Delivered'
        }
      ]);
      console.log(`✅ [Seeder] Seeded ${orders.length} Sales Orders`);

      // Seed Payments
      const payments = await Payment.create([
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          customer: ahmad._id,
          amount: 30000,
          method: 'Cash',
          note: 'Advance deposit'
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          customer: zaman._id,
          amount: 50000,
          method: 'Bank Transfer',
          note: 'Cleared partial credit'
        },
        {
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          customer: cityFish._id,
          amount: 10000,
          method: 'Easypaisa',
          note: 'Online wallet payment'
        },
        {
          date: new Date(Date.now() - 12 * 60 * 60 * 1000),
          customer: kashmir._id,
          amount: 7000,
          method: 'JazzCash',
          note: 'Mobile shop payment'
        },
        {
          date: new Date(),
          customer: zaman._id,
          amount: 100000,
          method: 'Cheque',
          note: 'HBL Cheque #2039402'
        }
      ]);
      console.log(`✅ [Seeder] Seeded ${payments.length} Payments`);

      // Seed Expenses
      const expenses = await Expense.create([
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          category: 'Electricity',
          amount: 85000,
          description: 'Factory commercial electric bill - Apr'
        },
        {
          date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          category: 'Labor',
          amount: 45000,
          description: 'Weekly wages for operators and helpers'
        },
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          category: 'Fuel',
          amount: 18000,
          description: 'Diesel for power generator backup'
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          category: 'Maintenance',
          amount: 12500,
          description: 'Ammonia compressor valve replacement'
        },
        {
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          category: 'Transport',
          amount: 9000,
          description: 'Ice block delivery vehicle fuel'
        },
        {
          date: new Date(),
          category: 'Other',
          amount: 3500,
          description: 'Office refreshments and stationary'
        }
      ]);
      console.log(`✅ [Seeder] Seeded ${expenses.length} Operational Expenses`);
      console.log('🎉 [Seeder] Database demo dataset initialized successfully!');
    }
  } catch (error) {
    console.error('❌ [Seeder] Error during database seeding operations:', error);
  }
};

module.exports = seedData;
