import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const [,, usuario, nuevaClave] = process.argv;

if (!usuario || !nuevaClave) {
  console.log('Uso: node src/cambiar-clave.js usuario nueva_contraseña');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(nuevaClave, 10);
  const { rowCount } = await pool.query(
    'UPDATE usuarios SET password_hash = $1 WHERE usuario = $2',
    [hash, usuario]
  );
  if (rowCount === 0) {
    console.log(`No existe el usuario "${usuario}".`);
  } else {
    console.log(`Contraseña actualizada para "${usuario}".`);
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await pool.end();
}