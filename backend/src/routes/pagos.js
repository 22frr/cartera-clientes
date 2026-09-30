import { Router } from 'express';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';

const router = Router();
router.use(requiereAuth);

router.post('/', async (req, res) => {
  const { cliente_id, monto, fecha, observacion } = req.body;
  if (!cliente_id || !monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'Cliente y monto (mayor a 0) son obligatorios' });
  }
  try {
    const dueño = await pool.query(
      'SELECT id FROM clientes WHERE id=$1 AND negocio_id=$2',
      [cliente_id, req.negocio_id]
    );
    if (dueño.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO pagos (negocio_id, cliente_id, monto, fecha, observacion)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5) RETURNING *`,
      [req.negocio_id, cliente_id, monto, fecha || null, observacion || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

router.patch('/:id/anular', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE pagos SET anulado = TRUE WHERE id = $1 AND negocio_id = $2 RETURNING *',
      [req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al anular el pago' });
  }
});

// Eliminar definitivamente un pago (solo si está anulado)
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM pagos WHERE id = $1 AND negocio_id = $2 AND anulado = TRUE',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Solo se pueden eliminar pagos anulados' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el pago' });
  }
});

// Restaurar un pago anulado
router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE pagos SET anulado = FALSE WHERE id = $1 AND negocio_id = $2 RETURNING *',
      [req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restaurar el pago' });
  }
});

export default router;