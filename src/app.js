const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/saludo', (req, res) => {
    res.json({ mensaje: '¡Hola desde el backend de Zonika!' });
});

module.exports = app;