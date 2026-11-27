import app from './app.js';
import pool from './db.js';
import { prepararDemo } from './demo.js';

if (process.env.DEMO_MODE === 'true') await prepararDemo(pool);
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
