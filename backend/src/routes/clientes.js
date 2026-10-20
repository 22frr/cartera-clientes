import { Router } from 'express';
import pool from '../db.js';
import { requiereAuth } from '../auth.js';
import { fechaRazonable, MENSAJE_FECHA } from '../fechas.js';

const router = Router();
router.use(requiereAuth);

const COLUMNAS_COBRANZA = `
  CASE WHEN COALESCE(s.saldo, 0) > 0 THEN
    CURRENT_DATE - GREATEST(
      (SELECT MAX(p.fecha) FROM pagos p WHERE p.cliente_id = c.id AND NOT p.anulado),
      (SELECT MIN(t.fecha)
         FROM (
           SELECT v.fecha,
                  SUM(v.total) OVER (ORDER BY v.fecha, v.id) AS acumulado
           FROM ventas v
           WHERE v.cliente_id = c.id AND NOT v.anulado
         ) t
        WHERE t.acumulado > COALESCE(
          (SELECT SUM(p2.monto) FROM pagos p2 WHERE p2.cliente_id = c.id AND NOT p2.anulado), 0)
      )
    )
  END AS dias_sin_pagar,
  CURRENT_DATE - (SELECT MAX(a.creado_en) FROM avisos a
                  WHERE a.cliente_id = c.id AND a.tipo = 'recordatorio')::date AS dias_ultimo_recordatorio,
  CURRENT_DATE - (SELECT MAX(a.creado_en) FROM avisos a
                  WHERE a.cliente_id = c.id AND a.tipo = 'cuenta')::date AS dias_ultima_cuenta
`;

router.get('/', async (req, res) => {
  const archivados = req.query.archivados === '1';
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COALESCE(s.saldo, 0) AS saldo,
        ${COLUMNAS_COBRANZA}
      FROM clientes c
      LEFT JOIN saldos s ON s.id = c.id
      WHERE c.negocio_id = $1 AND c.archivado = $2
      ORDER BY c.nombre
    `, [req.negocio_id, archivados]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COALESCE(s.saldo, 0) AS saldo,
        ${COLUMNAS_COBRANZA}
      FROM clientes c
      LEFT JOIN saldos s ON s.id = c.id
      WHERE c.id = $1 AND c.negocio_id = $2
    `, [req.params.id, req.negocio_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cliente' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, telefono, direccion, notas } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (negocio_id, nombre, telefono, direccion, notas)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.negocio_id, nombre.trim(), telefono, direccion, notas]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
});

router.put('/:id', async (req, res) => {
  const { nombre, telefono, direccion, notas } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE clientes SET nombre=$1, telefono=$2, direccion=$3, notas=$4
       WHERE id=$5 AND negocio_id=$6 RETURNING *`,
      [nombre.trim(), telefono, direccion, notas, req.params.id, req.negocio_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar el cliente' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM clientes WHERE id = $1 AND negocio_id = $2 AND archivado = TRUE',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Solo se pueden eliminar clientes archivados' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
});

router.get('/:id/movimientos', async (req, res) => {
  try {
    const dueño = await pool.query(
      'SELECT id FROM clientes WHERE id=$1 AND negocio_id=$2',
      [req.params.id, req.negocio_id]
    );
    if (dueño.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows } = await pool.query(`
      SELECT v.id, 'venta' AS tipo, v.fecha, v.total AS monto, v.anulado, v.creado_en, v.observacion,
        (SELECT json_agg(json_build_object(
            'producto', vi.producto, 'cantidad', vi.cantidad,
            'precio_unitario', vi.precio_unitario, 'subtotal', vi.subtotal
          ) ORDER BY vi.id)
         FROM venta_items vi WHERE vi.venta_id = v.id) AS items
      FROM ventas v
      WHERE v.cliente_id = $1
      UNION ALL
      SELECT p.id, 'pago' AS tipo, p.fecha, p.monto, p.anulado, p.creado_en, p.observacion, NULL AS items
      FROM pagos p
      WHERE p.cliente_id = $1
      ORDER BY fecha DESC, creado_en DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los movimientos' });
  }
});

router.patch('/:id/archivar', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE clientes SET archivado = TRUE WHERE id = $1 AND negocio_id = $2',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al archivar el cliente' });
  }
});

router.patch('/:id/restaurar', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE clientes SET archivado = FALSE WHERE id = $1 AND negocio_id = $2',
      [req.params.id, req.negocio_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al restaurar el cliente' });
  }
});


// Alta masiva desde Excel. Con { probar: true } solo simula y devuelve los números, sin guardar.
// Los clientes con saldo_inicial > 0 se crean con una compra "Saldo inicial" (fecha = deuda_desde u hoy),
// así el saldo y los "días sin pagar" quedan correctos desde el primer día.
// Omite los que ya existen en el negocio (mismo nombre, incluso archivados) y los repetidos del archivo.
router.post('/importar', async (req, res) => {
  const { clientes, probar } = req.body;
  if (!Array.isArray(clientes) || clientes.length === 0) {
    return res.status(400).json({ error: 'No hay clientes para importar' });
  }
  if (clientes.length > 2000) {
    return res.status(400).json({ error: 'Máximo 2000 clientes por importación' });
  }

  const limpios = [];
  for (const c of clientes) {
    const nombre = String(c.nombre ?? '').trim().slice(0, 100);
    if (!nombre) continue;

    const bruto = c.saldo_inicial;
    const saldo = bruto === undefined || bruto === null || bruto === '' ? 0 : Number(bruto);
    if (!Number.isFinite(saldo) || saldo < 0 || saldo >= 1e10) {
      return res.status(400).json({ error: `El saldo de "${nombre}" no es válido` });
    }
    const desde = saldo > 0 && c.deuda_desde ? String(c.deuda_desde) : null;
    if (desde && !fechaRazonable(desde)) {
      return res.status(400).json({ error: `${MENSAJE_FECHA}: deuda de "${nombre}"` });
    }

    limpios.push({
      nombre,
      telefono: String(c.telefono ?? '').trim().slice(0, 30) || null,
      direccion: String(c.direccion ?? '').trim().slice(0, 150) || null,
      notas: String(c.notas ?? '').trim().slice(0, 500) || null,
      saldo: Math.round(saldo * 100) / 100,
      desde,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existentes } = await client.query(
      'SELECT lower(trim(nombre)) AS n FROM clientes WHERE negocio_id = $1',
      [req.negocio_id]
    );
    const vistos = new Set(existentes.map((e) => e.n));
    const nuevos = limpios.filter((c) => {
      const k = c.nombre.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

    let creados = 0;
    if (!probar) {
      for (const c of nuevos) {
        const { rows } = await client.query(
          `INSERT INTO clientes (negocio_id, nombre, telefono, direccion, notas)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [req.negocio_id, c.nombre, c.telefono, c.direccion, c.notas]
        );
        creados++;
        if (c.saldo > 0) {
          const v = await client.query(
            `INSERT INTO ventas (negocio_id, cliente_id, fecha, total, observacion)
             VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, 'Saldo inicial') RETURNING id`,
            [req.negocio_id, rows[0].id, c.desde, c.saldo]
          );
          await client.query(
            `INSERT INTO venta_items (venta_id, producto, cantidad, precio_unitario, subtotal)
             VALUES ($1, 'Saldo inicial', 1, $2, $2)`,
            [v.rows[0].id, c.saldo]
          );
        }
      }
    }

    await client.query('COMMIT');
    const conSaldo = nuevos.filter((c) => c.saldo > 0);
    res.json({
      ok: true,
      nuevos: nuevos.length,
      creados,
      ya_existian: limpios.length - nuevos.length,
      con_saldo: conSaldo.length,
      total_saldo: Math.round(conSaldo.reduce((acc, c) => acc + c.saldo, 0) * 100) / 100,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al importar clientes' });
  } finally {
    client.release();
  }
});

export default router;