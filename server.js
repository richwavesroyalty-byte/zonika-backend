

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./src/config/db');
const apiRoutes = require('./src/routes/api.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

// Iniciar servidor después de comprobar PostgreSQL
const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');

    console.log('PostgreSQL conectado correctamente.');

    app.listen(PORT, () => {
      console.log(
        `Zonika funcionando en http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error(
      'No se pudo conectar a la base de datos:',
      error.message
    );

    process.exit(1);
  }
};

startServer();

