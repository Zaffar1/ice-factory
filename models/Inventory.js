const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const generateId = require('../utils/generateId');
const { applyMongooseCompat } = require('../utils/sequelizeModelHelper');

const Inventory = sequelize.define('Inventory', {
  inventoryId: {
    type: DataTypes.STRING,
    unique: true
  },
  item: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Item name is required' }
    }
  },
  category: {
    type: DataTypes.ENUM('Raw Material', 'Finished Goods', 'Packaging', 'Spare Parts'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Raw Material', 'Finished Goods', 'Packaging', 'Spare Parts']],
        msg: 'Invalid item category'
      }
    }
  },
  qty: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Quantity cannot be negative'
      }
    }
  },
  unit: {
    type: DataTypes.ENUM('Kg', 'Blocks', 'Bags', 'Liters', 'Pcs'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Kg', 'Blocks', 'Bags', 'Liters', 'Pcs']],
        msg: 'Invalid unit'
      }
    }
  },
  minQty: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Minimum quantity cannot be negative'
      }
    }
  },
  status: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.qty >= this.minQty ? 'In Stock' : 'Low Stock';
    }
  }
}, {
  hooks: {
    beforeCreate: async (inventory) => {
      if (!inventory.inventoryId) {
        inventory.inventoryId = await generateId('Inventory', 'INV');
      }
    }
  }
});

applyMongooseCompat(Inventory);

module.exports = Inventory;
