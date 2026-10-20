import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';

const router = Router();
router.use(requiereAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT nombre, codigo_area, datos_pago, mensaje_recordatorio FROM negocios WHERE id = $1',
      [req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los datos del negocio' });
  }
});

router.put('/', async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim();
  const codigoArea = String(req.body.codigo_area ?? '').trim();
  const datosPago = String(req.body.datos_pago ?? '').trim();
  const mensaje = String(req.body.mensaje_recordatorio ?? '').trim();

  if (!nombre) return res.status(400).json({ error: 'El nombre del negocio es obligatorio' });
  if (nombre.length > 100) return res.status(400).json({ error: 'El nombre es demasiado largo (máximo 100)' });
  if (codigoArea && !/^\d{2,4}$/.test(codigoArea)) {
    return res.status(400).json({ error: 'El código de área son 2 a 4 números, sin 0 ni 15 (ej: 342)' });
  }
    if (mensaje.length > 600) {
    return res.status(400).json({ error: 'El mensaje es demasiado largo (máximo 600 caracteres)' });
  }

  try {
      const { rows } = await pool.query(
      `UPDATE negocios SET nombre = $1, codigo_area = $2, datos_pago = $3, mensaje_recordatorio = $4
       WHERE id = $5 RETURNING nombre, codigo_area, datos_pago, mensaje_recordatorio`,
      [nombre, codigoArea || null, datosPago || null, mensaje || null, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar los datos del negocio' });
  }
});

// Cambiar la contraseña.
router.patch('/clave', async (req, res) => {
  const actual = String(req.body.actual ?? '');
  const nueva = String(req.body.nueva ?? '');

  if (!actual || !nueva) return res.status(400).json({ error: 'Completá la contraseña actual y la nueva' });
  if (nueva.length < 6) return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' });
  if (nueva.length > 72) return res.status(400).json({ error: 'La contraseña nueva es demasiado larga (máximo 72)' });
  if (nueva === actual) return res.status(400).json({ error: 'La contraseña nueva tiene que ser distinta de la actual' });

  try {
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM usuarios WHERE usuario = $1 AND negocio_id = $2',
      [req.usuario, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(actual, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'La contraseña actual no es correcta' });

    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

export default router;