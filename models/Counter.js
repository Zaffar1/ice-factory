const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Counter = sequelize.define('Counter', {
  idName: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  seq: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  timestamps: false
});

module.exports = Counter;
