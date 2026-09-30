import { Router } from 'express';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';

const router = Router();
router.use(requiereAuth);

router.get('/', async (req, res) => {
  const archivados = req.query.archivados === '1';
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COALESCE(s.saldo, 0) AS saldo
      FROM clientes c
      LEFT JOIN saldos s ON s.id = c.id
      WHERE c.negocio_id = $1 AND c.archivado = $2
      ORDER BY c.nombre
    `, [req.negocio_id, archivados]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COALESCE(s.saldo, 0) AS saldo
      FROM clientes c
      LEFT JOIN saldos s ON s.id = c.id
      WHERE c.id = $1 AND c.negocio_id = $2
    `, [req.params.id, req.negocio_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cliente' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, telefono, direccion, notas } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (negocio_id, nombre, telefono, direccion, notas)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.negocio_id, nombre.trim(), telefono, direccion, notas]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
});

router.put('/:id', async (req, res) => {
  const { nombre, telefono, direccion, notas } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE clientes SET nombre=$1, telefono=$2, direccion=$3, notas=$4
       WHERE id=$5 AND negocio_id=$6 RETURNING *`,
      [nombre.trim(), telefono, direccion, notas, req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar el cliente' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM clientes WHERE id = $1 AND negocio_id = $2 AND archivado = TRUE',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Solo se pueden eliminar clientes archivados' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
});

router.get('/:id/movimientos', async (req, res) => {
  try {
    const dueño = await pool.query(
      'SELECT id FROM clientes WHERE id=$1 AND negocio_id=$2',
      [req.params.id, req.negocio_id]
    );
    if (dueño.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows } = await pool.query(`
      SELECT v.id, 'venta' AS tipo, v.fecha, v.total AS monto, v.anulado, v.creado_en, v.observacion,
        (SELECT json_agg(json_build_object(
            'producto', vi.producto, 'cantidad', vi.cantidad,
            'precio_unitario', vi.precio_unitario, 'subtotal', vi.subtotal
          ) ORDER BY vi.id)
         FROM venta_items vi WHERE vi.venta_id = v.id) AS items
      FROM ventas v
      WHERE v.cliente_id = $1
      UNION ALL
      SELECT p.id, 'pago' AS tipo, p.fecha, p.monto, p.anulado, p.creado_en, p.observacion, NULL AS items
      FROM pagos p
      WHERE p.cliente_id = $1
      ORDER BY fecha DESC, creado_en DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los movimientos' });
  }
});

router.patch('/:id/archivar', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE clientes SET archivado = TRUE WHERE id = $1 AND negocio_id = $2',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al archivar el cliente' });
  }
});

router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE clientes SET archivado = FALSE WHERE id = $1 AND negocio_id = $2',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restaurar el cliente' });
  }
});



export default router;