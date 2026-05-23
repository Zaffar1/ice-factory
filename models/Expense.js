const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const generateId = require('../utils/generateId');
const { applyMongooseCompat } = require('../utils/sequelizeModelHelper');

const Expense = sequelize.define('Expense', {
  expenseId: {
    type: DataTypes.STRING,
    unique: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  category: {
    type: DataTypes.ENUM(
      'Electricity',
      'Labor',
      'Fuel',
      'Maintenance',
      'Rent',
      'Transport',
      'Raw Material',
      'Other'
    ),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Expense category is required' }
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Expense amount must be at least 1'
      }
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Expense description is required' }
    }
  }
}, {
  hooks: {
    beforeCreate: async (expense) => {
      if (!expense.expenseId) {
        expense.expenseId = await generateId('Expense', 'EXP');
      }
    }
  }
});

applyMongooseCompat(Expense);

module.exports = Expense;
