// src/models/movement.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Movement = sequelize.define('Movement', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING, // ENTRADA / SALIDA
    allowNull: false,
  },
  item: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  user: {
    type: DataTypes.STRING,
  },
  time: {
    type: DataTypes.STRING,
  },
});

module.exports = Movement;