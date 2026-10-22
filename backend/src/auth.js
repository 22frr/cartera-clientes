import jwt from 'jsonwebtoken';
import pool from './db.js';

export async function requiereAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  try {
    // Si el negocio se desactivó, queda afuera aunque tenga la sesión abierta
    const { rows } = await pool.query(
      'SELECT activo FROM negocios WHERE id = $1',
      [payload.negocio_id]
    );
    if (rows.length === 0 || rows[0].activo === false) {
      return res.status(401).json({ error: 'Cuenta desactivada' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al verificar la sesión' });
  }

  req.negocio_id = payload.negocio_id;
  req.usuario = payload.usuario;
  next();
}