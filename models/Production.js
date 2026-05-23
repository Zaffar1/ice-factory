const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const generateId = require('../utils/generateId');
const { applyMongooseCompat } = require('../utils/sequelizeModelHelper');

const Production = sequelize.define('Production', {
  productionId: {
    type: DataTypes.STRING,
    unique: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  shift: {
    type: DataTypes.ENUM('Morning', 'Evening', 'Night'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Morning', 'Evening', 'Night']],
        msg: 'Invalid shift'
      }
    }
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
  produced: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: 'Produced quantity must be at least 1'
      }
    }
  },
  damaged: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Damaged quantity cannot be negative'
      }
    }
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Operator name is required' }
    }
  },
  status: {
    type: DataTypes.ENUM('In Progress', 'Completed'),
    defaultValue: 'In Progress'
  }
}, {
  hooks: {
    beforeCreate: async (production) => {
      if (!production.productionId) {
        production.productionId = await generateId('Production', 'PROD');
      }
    }
  }
});

applyMongooseCompat(Production);

module.exports = Production;
