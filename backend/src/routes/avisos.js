import { Router } from 'express';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';

const router = Router();
router.use(requiereAuth);

// Registrar que se le mandó un recordatorio o la cuenta a un cliente
router.post('/', async (req, res) => {
  const { cliente_id, tipo } = req.body;
  if (!cliente_id || !['recordatorio', 'cuenta'].includes(tipo)) {
    return res.status(400).json({ error: 'Faltan datos: cliente y tipo (recordatorio o cuenta)' });
  }
  try {
    // Verifica que el cliente sea de este negocio y toma su saldo actual
    const { rows: cli } = await pool.query(
      `SELECT c.id, COALESCE(s.saldo, 0) AS saldo
       FROM clientes c LEFT JOIN saldos s ON s.id = c.id
       WHERE c.id = $1 AND c.negocio_id = $2`,
      [cliente_id, req.negocio_id]
    );
    if (cli.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO avisos (negocio_id, cliente_id, tipo, saldo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.negocio_id, cliente_id, tipo, cli[0].saldo]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el aviso' });
  }
});

export default router;
