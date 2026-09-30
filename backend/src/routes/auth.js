import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.*, n.nombre AS negocio_nombre FROM usuarios u
       JOIN negocios n ON n.id = u.negocio_id
       WHERE u.usuario = $1`,
      [usuario]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const token = jwt.sign(
      { negocio_id: user.negocio_id, usuario: user.usuario },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, negocio: user.negocio_nombre, usuario: user.usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

export default router;