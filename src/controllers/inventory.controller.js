// src/controllers/inventory.controller.js
const Inventory = require('../models/inventory.model');
const Movement = require('../models/movement.model');

const getInventory = async (req, res) => {
  try {
    const items = await Inventory.findAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el inventario' });
  }
};

const createInventoryItem = async (req, res) => {
  try {
    const newProduct = await Inventory.create(req.body);
    res.status(201).json({ message: 'Producto registrado con éxito', product: newProduct });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el producto', details: error.message });
  }
};

const getMovements = async (req, res) => {
  try {
    const movements = await Movement.findAll({ order: [['createdAt', 'DESC']] });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los movimientos' });
  }
};

const createMovement = async (req, res) => {
  try {
    const newMovement = await Movement.create(req.body);
    res.status(201).json({ message: 'Movimiento registrado con éxito', movement: newMovement });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el movimiento', details: error.message });
  }
};

module.exports = {
  getInventory,
  createInventoryItem,
  getMovements,
  createMovement,
};