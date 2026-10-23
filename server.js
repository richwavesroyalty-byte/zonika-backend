const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Base de datos en memoria temporal
let inventoryDb = [
  { id: 'INV-001', epc: 'E280689400004001F82B', name: 'Lector Biométrico ZKTeco', category: 'Seguridad', stock: 45, rfidTagged: 45, location: 'Madefront Ferretería - Estante A1', status: 'Optimal' },
  { id: 'INV-002', epc: 'E280689400004001F82C', name: 'Cámara IP Domo 4K', category: 'CCTV', stock: 12, rfidTagged: 10, location: 'Madefront Ferretería - Estante B3', status: 'Low' }
];

let movementsDb = [
  { id: 'MOV-501', type: 'ENTRADA', item: 'Lector Biométrico ZKTeco', qty: 15, user: 'Admin', time: 'Hace 10 min' }
];

app.get('/api/inventory', (req, res) => {
  res.json(inventoryDb);
});

app.post('/api/inventory', (req, res) => {
  const newProduct = req.body;
  inventoryDb.unshift(newProduct);
  res.status(201).json({ message: 'Producto registrado con éxito', product: newProduct });
});

app.get('/api/movements', (req, res) => {
  res.json(movementsDb);
});

app.post('/api/movements', (req, res) => {
  const newMovement = req.body;
  movementsDb.unshift(newMovement);
  res.status(201).json({ message: 'Movimiento registrado con éxito', movement: newMovement });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend de Zonika corriendo en http://localhost:${PORT}`);
});