import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Se aplica antes de entregar cada conexión (sin consultas simultáneas al conectar).
  options: [process.env.PGOPTIONS, '-c timezone=America/Argentina/Buenos_Aires'].filter(Boolean).join(' '),
});

export default pool;
