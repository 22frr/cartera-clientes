import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/avisos', avisosRoutes);
app.use('/api/negocio', negocioRoutes);
app.get('/api/resumen', requiereAuth, async (req, res) => {
  try {
    const [resumen, pagosHoy, ventasHoy] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0) AS total_deuda,
          COUNT(*) FILTER (WHERE saldo > 0) AS clientes_con_deuda,
          COUNT(*) AS total_clientes
        FROM saldos
        WHERE negocio_id = $1 AND NOT archivado
      `, [req.negocio_id]),
      // Lo cobrado hoy incluye clientes archivados: la plata entró igual
      pool.query(`
        SELECT COALESCE(medio_pago, 'sin_medio') AS medio, SUM(monto) AS total
        FROM pagos
        WHERE negocio_id = $1 AND fecha = CURRENT_DATE AND NOT anulado
        GROUP BY 1
      `, [req.negocio_id]),
      // El "Saldo inicial" de una importación no es fiado del día
      pool.query(`
        SELECT COALESCE(SUM(total), 0) AS total
        FROM ventas
        WHERE negocio_id = $1 AND fecha = CURRENT_DATE AND NOT anulado
          AND observacion IS DISTINCT FROM 'Saldo inicial'
      `, [req.negocio_id]),
    ]);

    const por_medio = {};
    let cobrado = 0;
    for (const r of pagosHoy.rows) {
      por_medio[r.medio] = Number(r.total);
      cobrado += Number(r.total);
    }

    res.json({
      ...resumen.rows[0],
      hoy: { cobrado, fiado: Number(ventasHoy.rows[0].total), por_medio },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el resumen' });
  }
});

// Una sola URL para React y la API; las rutas del navegador sobreviven a la recarga.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
if (process.env.NODE_ENV === 'production') {
  const dist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  app.use(express.static(dist));
  app.get('/{*ruta}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

export default app;
