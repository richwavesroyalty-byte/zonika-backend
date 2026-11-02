
const { Router } = require('express');
const pool = require('../config/db');

const router = Router();

// ==========================================
// 1. COMPROBAR CONEXIÓN CON POSTGRESQL
// ==========================================
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT current_database() AS database, NOW() AS server_time
    `);

    res.json({
      status: 'OK',
      application: 'Zonika',
      database: result.rows[0].database,
      message: 'Conexión con PostgreSQL exitosa',
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error('Error de conexión:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'No se pudo conectar con PostgreSQL'
    });
  }
});

// ==========================================
// 2. CONSULTAR INVENTARIO
// ==========================================
router.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.category,
        p.description,
        w.code AS warehouse_code,
        w.name AS warehouse,
        wl.id AS location_id,
        wl.code AS location_code,
        wl.name AS location,
        COALESCE(SUM(ins.quantity), 0)::INTEGER AS stock,
        COUNT(DISTINCT rt.id)::INTEGER AS rfid_tagged
      FROM products p
      LEFT JOIN inventory_stock ins
        ON ins.product_id = p.id
      LEFT JOIN warehouse_locations wl
        ON wl.id = ins.location_id
      LEFT JOIN warehouses w
        ON w.id = wl.warehouse_id
      LEFT JOIN rfid_tags rt
        ON rt.product_id = p.id
        AND rt.location_id = wl.id
        AND rt.status = 'ACTIVE'
      WHERE p.active = TRUE
      GROUP BY
        p.id, p.sku, p.name, p.category, p.description,
        w.code, w.name, wl.id, wl.code, wl.name
      ORDER BY p.id DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error al consultar inventario:', error.message);
    res.status(500).json({
      error: 'Error al obtener el inventario'
    });
  }
});

// ==========================================
// 3. REGISTRAR PRODUCTO
// ==========================================
router.post('/inventory', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      sku,
      name,
      category,
      description
    } = req.body;

    if (!sku || !name) {
      return res.status(400).json({
        error: 'El SKU y el nombre del producto son obligatorios'
      });
    }

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO products (sku, name, category, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      sku,
      name,
      category || null,
      description || null
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Producto registrado correctamente',
      product: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error al registrar producto:', error.message);

    res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505'
        ? 'Ya existe un producto con ese SKU'
        : 'Error al registrar el producto'
    });

  } finally {
    client.release();
  }
});

// ==========================================
// 4. CONSULTAR MOVIMIENTOS
// ==========================================
router.get('/movements', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.code,
        m.movement_type AS type,
        m.reason,
        m.description,
        m.created_at,
        u.full_name AS user,
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', p.id,
              'sku', p.sku,
              'name', p.name,
              'quantity', mi.quantity
            )
          ) FILTER (WHERE mi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM movements m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN movement_items mi ON mi.movement_id = m.id
      LEFT JOIN products p ON p.id = mi.product_id
      GROUP BY m.id, u.full_name
      ORDER BY m.created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error al consultar movimientos:', error.message);

    res.status(500).json({
      error: 'Error al obtener los movimientos'
    });
  }
});

// ==========================================
// 5. REGISTRAR MOVIMIENTO
// ==========================================
router.post('/movements', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      code,
      movement_type,
      origin_location_id,
      destination_location_id,
      user_id,
      reason,
      description,
      items
    } = req.body;

    const validTypes = ['ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE'];

    if (!code || !validTypes.includes(movement_type)) {
      return res.status(400).json({
        error: 'Código y tipo de movimiento válido son obligatorios'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Debe incluir al menos un producto'
      });
    }

    for (const item of items) {
      if (
        !Number.isInteger(Number(item.product_id)) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      ) {
        return res.status(400).json({
          error: 'Cada producto debe tener un ID válido y una cantidad positiva'
        });
      }
    }

    await client.query('BEGIN');

    const movementResult = await client.query(`
      INSERT INTO movements (
        code,
        movement_type,
        origin_location_id,
        destination_location_id,
        user_id,
        reason,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      code,
      movement_type,
      origin_location_id || null,
      destination_location_id || null,
      user_id || null,
      reason || null,
      description || null
    ]);

    const movement = movementResult.rows[0];

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      const productResult = await client.query(
        'SELECT id FROM products WHERE id = $1 AND active = TRUE',
        [productId]
      );

      if (productResult.rowCount === 0) {
        throw new Error(`Producto ${productId} no encontrado o inactivo`);
      }

      await client.query(`
        INSERT INTO movement_items (
          movement_id,
          product_id,
          quantity
        )
        VALUES ($1, $2, $3)
      `, [
        movement.id,
        productId,
        quantity
      ]);

      // SALIDA: descontar existencias
      if (movement_type === 'SALIDA') {
        const stockResult = await client.query(`
          UPDATE inventory_stock
          SET quantity = quantity - $1,
              updated_at = NOW()
          WHERE product_id = $2
            AND location_id = $3
            AND quantity >= $1
          RETURNING id
        `, [
          quantity,
          productId,
          origin_location_id
        ]);

        if (stockResult.rowCount === 0) {
          throw new Error(
            `Stock insuficiente o ubicación inexistente para producto ${productId}`
          );
        }
      }

      // ENTRADA: sumar existencias
      if (movement_type === 'ENTRADA') {
        if (!destination_location_id) {
          throw new Error('La entrada requiere una ubicación de destino');
        }

        await client.query(`
          INSERT INTO inventory_stock (
            product_id,
            location_id,
            quantity
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, location_id)
          DO UPDATE SET
            quantity = inventory_stock.quantity + EXCLUDED.quantity,
            updated_at = NOW()
        `, [
          productId,
          destination_location_id,
          quantity
        ]);
      }

      // TRASLADO: descontar origen y sumar destino
      if (movement_type === 'TRASLADO') {
        if (!origin_location_id || !destination_location_id) {
          throw new Error('El traslado requiere origen y destino');
        }

        if (Number(origin_location_id) === Number(destination_location_id)) {
          throw new Error('El origen y el destino deben ser diferentes');
        }

        const stockResult = await client.query(`
          UPDATE inventory_stock
          SET quantity = quantity - $1,
              updated_at = NOW()
          WHERE product_id = $2
            AND location_id = $3
            AND quantity >= $1
          RETURNING id
        `, [
          quantity,
          productId,
          origin_location_id
        ]);

        if (stockResult.rowCount === 0) {
          throw new Error(
            `Stock insuficiente en origen para producto ${productId}`
          );
        }

        await client.query(`
          INSERT INTO inventory_stock (
            product_id,
            location_id,
            quantity
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, location_id)
          DO UPDATE SET
            quantity = inventory_stock.quantity + EXCLUDED.quantity,
            updated_at = NOW()
        `, [
          productId,
          destination_location_id,
          quantity
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Movimiento registrado correctamente',
      movement
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error al registrar movimiento:', error.message);

    res.status(400).json({
      error: error.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;