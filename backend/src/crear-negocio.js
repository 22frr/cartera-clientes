import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const [,, nombreNegocio, usuario, password, telefono, rubro, direccion] = process.argv;

if (!nombreNegocio || !usuario || !password) {
  console.log('Uso: node src/crear-negocio.js "Nombre del negocio" usuario contraseña [telefono] [rubro] [direccion]');
  process.exit(1);
}

try {
  const { rows: neg } = await pool.query(
    `INSERT INTO negocios (nombre, telefono, rubro, direccion) VALUES ($1,$2,$3,$4) RETURNING id`,
    [nombreNegocio, telefono || null, rubro || null, direccion || null]
  );
  const negocioId = neg[0].id;

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO usuarios (negocio_id, usuario, password_hash) VALUES ($1,$2,$3)`,
    [negocioId, usuario, hash]
  );

  console.log(`Negocio "${nombreNegocio}" creado con id ${negocioId}. Usuario: ${usuario}`);
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await pool.end();
}