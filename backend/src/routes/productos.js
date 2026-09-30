import { Router } from 'express';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';

const router = Router();
router.use(requiereAuth);

// Lista completa (para el catálogo y para el autocompletado)
router.get('/', async (req, res) => {
  const soloActivos = req.query.activos === '1';
  try {
    const { rows } = await pool.query(
      `SELECT * FROM productos WHERE negocio_id = $1 ${soloActivos ? 'AND activo = TRUE' : ''} ORDER BY categoria NULLS LAST, nombre`,
      [req.negocio_id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Buscar por código de barras exacto (para cuando sumemos la pistola lectora)
router.get('/codigo/:codigo', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM productos WHERE negocio_id = $1 AND codigo_barras = $2 AND activo = TRUE',
      [req.negocio_id, req.params.codigo]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No hay ningún producto con ese código' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar el producto' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, categoria, precio, codigo_barras } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO productos (negocio_id, nombre, categoria, precio, codigo_barras) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.negocio_id, nombre.trim(), categoria || null, precio || null, codigo_barras || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') { // violación del índice único de código de barras
      return res.status(400).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

router.put('/:id', async (req, res) => {
  const { nombre, categoria, precio, codigo_barras } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE productos SET nombre=$1, categoria=$2, precio=$3, codigo_barras=$4 WHERE id=$5 AND negocio_id=$6 RETURNING *`,
      [nombre.trim(), categoria || null, precio || null, codigo_barras || null, req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al editar el producto' });
  }
});

router.patch('/:id/activo', async (req, res) => {
  const { activo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE productos SET activo=$1 WHERE id=$2 AND negocio_id=$3 RETURNING *`,
      [!!activo, req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM productos WHERE id=$1 AND negocio_id=$2',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

// Alta masiva, para importar desde el Excel
router.post('/importar', async (req, res) => {
  const { productos } = req.body;
  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'No hay productos para importar' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let insertados = 0;
    for (const p of productos) {
      if (!p.nombre || !p.nombre.trim()) continue;
      await client.query(
        `INSERT INTO productos (negocio_id, nombre, categoria, precio, codigo_barras) VALUES ($1,$2,$3,$4,$5)`,
        [req.negocio_id, p.nombre.trim(), p.categoria || null, p.precio || null, p.codigo_barras || null]
      );
      insertados++;
    }
    await client.query('COMMIT');
    res.json({ ok: true, insertados });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al importar productos' });
  } finally {
    client.release();
  }
});

export default router;