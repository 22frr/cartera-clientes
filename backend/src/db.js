import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Cada conexión usa hora argentina: CURRENT_DATE depende de esto (en un hosting suele ser UTC)
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'America/Argentina/Buenos_Aires'").catch((e) => console.error('Zona horaria:', e.message));
});

export default pool;