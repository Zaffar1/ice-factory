const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const generateId = require('../utils/generateId');
const Customer = require('./Customer');
const { applyMongooseCompat } = require('../utils/sequelizeModelHelper');

const Payment = sequelize.define('Payment', {
  paymentId: {
    type: DataTypes.STRING,
    unique: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Amount must be at least 1'
      }
    }
  },
  method: {
    type: DataTypes.ENUM('Cash', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Cheque'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Cash', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Cheque']],
        msg: 'Invalid payment method'
      }
    }
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'Received'
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate: async (payment) => {
      if (!payment.paymentId) {
        payment.paymentId = await generateId('Payment', 'PAY');
      }
    }
  }
});

// Setup relationships (as 'customerAssociation' to avoid naming collisions and support Mongoose styles)
Payment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customerAssociation' });

applyMongooseCompat(Payment);

module.exports = Payment;
