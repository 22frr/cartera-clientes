import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import clientesRoutes from './routes/clientes.js';
import ventasRoutes from './routes/ventas.js';
import pagosRoutes from './routes/pagos.js';
import { requiereAuth } from './auth.js';
import productosRoutes from './routes/productos.js';
import avisosRoutes from './routes/avisos.js';
import negocioRoutes from './routes/negocio.js';

dotenv.config();

const app = express();
app.use(cors());
// 5 MB: una importación de 1.000+ productos o clientes supera el límite por defecto (100 KB)
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/avisos', avisosRoutes);
app.use('/api/negocio', negocioRoutes);
app.get('/api/resumen', requiereAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0) AS total_deuda,
        COUNT(*) FILTER (WHERE saldo > 0) AS clientes_con_deuda,
        COUNT(*) AS total_clientes
      FROM saldos
      WHERE negocio_id = $1 AND NOT archivado
    `, [req.negocio_id]);
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el resumen' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});