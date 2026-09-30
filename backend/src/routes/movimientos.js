import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Registrar una compra o un pago
router.post('/', async (req, res) => {
  const { cliente_id, tipo, producto, cantidad, precio_unitario, monto, fecha, observacion } = req.body;

  if (!cliente_id || !['compra', 'pago'].includes(tipo)) {
    return res.status(400).json({ error: 'Faltan datos: cliente y tipo (compra o pago)' });
  }

  let montoFinal = monto;
  let cantidadFinal = cantidad || 1;

  if (tipo === 'compra') {
    if (!producto || !producto.trim()) {
      return res.status(400).json({ error: 'El producto es obligatorio' });
    }
    // Si no mandan el monto, se calcula: cantidad x precio unitario
    if (montoFinal === undefined || montoFinal === '') {
      montoFinal = Number(cantidadFinal) * Number(precio_unitario);
    }
  }

  if (!montoFinal || Number(montoFinal) <= 0 || isNaN(Number(montoFinal))) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO movimientos
        (cliente_id, tipo, producto, cantidad, precio_unitario, monto, fecha, observacion)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8)
       RETURNING *`,
      [cliente_id, tipo, producto, cantidadFinal, precio_unitario, montoFinal, fecha || null, observacion]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el movimiento' });
  }
});

// Anular un movimiento (no se borra, queda en el historial)
router.patch('/:id/anular', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE movimientos SET anulado = TRUE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al anular el movimiento' });
  }
});

export default router;