import jwt from 'jsonwebtoken';

export function requiereAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.negocio_id = payload.negocio_id;
    req.usuario = payload.usuario;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}