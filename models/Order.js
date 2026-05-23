const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const generateId = require('../utils/generateId');
const Customer = require('./Customer');
const { applyMongooseCompat } = require('../utils/sequelizeModelHelper');

const Order = sequelize.define('Order', {
  orderId: {
    type: DataTypes.STRING,
    unique: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  type: {
    type: DataTypes.ENUM('Block Ice', 'Tube Ice', 'Crushed Ice'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Block Ice', 'Tube Ice', 'Crushed Ice']],
        msg: 'Invalid ice type'
      }
    }
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Quantity must be at least 1'
      }
    }
  },
  rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Rate must be at least 1'
      }
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2)
  },
  payment: {
    type: DataTypes.ENUM('Paid', 'Pending', 'Credit', 'Refunded'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Paid', 'Pending', 'Credit', 'Refunded']],
        msg: 'Invalid payment status'
      }
    }
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Processing', 'Delivered', 'Cancelled'),
    defaultValue: 'Pending'
  }
}, {
  hooks: {
    beforeValidate: (order) => {
      if (order.qty && order.rate) {
        order.amount = parseFloat(order.qty) * parseFloat(order.rate);
      }
    },
    beforeCreate: async (order) => {
      if (!order.orderId) {
        order.orderId = await generateId('Order', 'ORD');
      }
    }
  }
});

// Setup relationships (as 'customerAssociation' to avoid naming collisions and support Mongoose styles)
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customerAssociation' });

applyMongooseCompat(Order);

module.exports = Order;
