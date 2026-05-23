const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const generateId = require('../utils/generateId');
const { applyMongooseCompat } = require('../utils/sequelizeModelHelper');

const Customer = sequelize.define('Customer', {
  customerId: {
    type: DataTypes.STRING,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Customer name is required' }
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Customer phone number is required' }
    }
  },
  type: {
    type: DataTypes.ENUM('Retail', 'Wholesale'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Retail', 'Wholesale']],
        msg: 'Customer type must be Retail or Wholesale'
      }
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  balanceType: {
    type: DataTypes.ENUM('Credit', 'Advance'),
    defaultValue: 'Credit'
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active'
  }
}, {
  hooks: {
    beforeCreate: async (customer) => {
      if (!customer.customerId) {
        customer.customerId = await generateId('Customer', 'CUST');
      }
    }
  }
});

applyMongooseCompat(Customer);

module.exports = Customer;
