import { Router } from 'express';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';
import { fechaRazonable, MENSAJE_FECHA } from '../fechas.js';

const router = Router();
router.use(requiereAuth);


const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Debe haber al menos un producto';
  }
  for (const it of items) {
    if (!it.producto || !it.producto.trim()) return 'Todos los productos necesitan un nombre';
    if (!it.cantidad || Number(it.cantidad) <= 0) return 'La cantidad debe ser mayor a 0';
    if (!it.precio_unitario || Number(it.precio_unitario) <= 0) return 'El precio debe ser mayor a 0';
  }
  return null;
}

// Crear una compra con varios productos
router.post('/', async (req, res) => {
  const { cliente_id, items, fecha, observacion } = req.body;

  if (!cliente_id) return res.status(400).json({ error: 'Falta el cliente' });
  if (fecha && !fechaRazonable(fecha)) return res.status(400).json({ error: MENSAJE_FECHA });
  const errorItems = validarItems(items);
  if (errorItems) return res.status(400).json({ error: errorItems });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dueño = await client.query(
      'SELECT id FROM clientes WHERE id=$1 AND negocio_id=$2',
      [cliente_id, req.negocio_id]
    );
    if (dueño.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const total = redondear(items.reduce((acc, it) => acc + redondear(Number(it.cantidad) * Number(it.precio_unitario)), 0));

    const { rows } = await client.query(
      `INSERT INTO ventas (negocio_id, cliente_id, fecha, total, observacion)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5) RETURNING *`,
      [req.negocio_id, cliente_id, fecha || null, total, observacion || null]
    );
    const venta = rows[0];

    for (const it of items) {
      const subtotal = redondear(Number(it.cantidad) * Number(it.precio_unitario));
      await client.query(
        `INSERT INTO venta_items (venta_id, producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [venta.id, it.producto.trim(), it.cantidad, it.precio_unitario, subtotal]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(venta);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la venta' });
  } finally {
    client.release();
  }
});

// Editar una compra (reemplaza todos sus productos)
router.put('/:id', async (req, res) => {
  const { items, observacion, fecha } = req.body;

  const errorItems = validarItems(items);
  if (errorItems) return res.status(400).json({ error: errorItems });
  if (fecha && !fechaRazonable(fecha)) {
    return res.status(400).json({ error: MENSAJE_FECHA });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dueño = await client.query(
      'SELECT id FROM ventas WHERE id=$1 AND negocio_id=$2',
      [req.params.id, req.negocio_id]
    );
    if (dueño.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const total = items.reduce((acc, it) => acc + Number(it.cantidad) * Number(it.precio_unitario), 0);

    await client.query('DELETE FROM venta_items WHERE venta_id = $1', [req.params.id]);

    for (const it of items) {
      const subtotal = Number(it.cantidad) * Number(it.precio_unitario);
      await client.query(
        `INSERT INTO venta_items (venta_id, producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, it.producto.trim(), it.cantidad, it.precio_unitario, subtotal]
      );
    }

    const { rows } = await client.query(
      'UPDATE ventas SET total = $1, observacion = $2, fecha = COALESCE($4, fecha) WHERE id = $3 RETURNING *',
      [total, observacion || null, req.params.id, fecha || null]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al editar la venta' });
  } finally {
    client.release();
  }
});

// Anular una compra completa
router.patch('/:id/anular', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE ventas SET anulado = TRUE WHERE id = $1 AND negocio_id = $2 RETURNING *',
      [req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al anular la venta' });
  }
});

// Eliminar definitivamente una compra (solo si está anulada)
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM ventas WHERE id = $1 AND negocio_id = $2 AND anulado = TRUE',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Solo se pueden eliminar compras anuladas' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la compra' });
  }
});

// Restaurar una compra anulada
router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE ventas SET anulado = FALSE WHERE id = $1 AND negocio_id = $2 RETURNING *',
      [req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restaurar la venta' });
  }
});

export default router;