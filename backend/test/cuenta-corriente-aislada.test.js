import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ quiet: true });

test('Cuenta corriente: alta, compra rápida, pago parcial, anulaciones y aislamiento por negocio', async () => {
  // Un esquema nuevo por ejecución: nunca modifica clientes ni movimientos reales.
  const schema = `fiados_test_${process.pid}_${Date.now()}`;
  const admin = new pg.Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  let server;
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    process.env.PGOPTIONS = `-c search_path=${schema}`;
    const modulo = await import('../src/db.js');
    pool = modulo.default;
    await pool.query(await readFile(new URL('../../schema.sql', import.meta.url), 'utf8'));
    const { default: app } = await import('../src/app.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let token;
    async function api(ruta, method = 'GET', body, status = 200) {
      const r = await fetch(base + ruta, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const datos = await r.json();
      assert.equal(r.status, status, `${method} ${ruta}: ${JSON.stringify(datos)}`);
      return datos;
    }
    const { rows: [negocio] } = await pool.query("INSERT INTO negocios(nombre) VALUES ('Comercio ficticio QA') RETURNING id");
    await pool.query('INSERT INTO usuarios(negocio_id,usuario,password_hash) VALUES ($1,$2,$3)',
      [negocio.id, 'qa_ficticio', await bcrypt.hash('clave-ficticia-qa', 4)]);
    token = (await api('/auth/login', 'POST', { usuario: 'qa_ficticio', password: 'clave-ficticia-qa' })).token;
    assert.ok(token);
    const cliente = await api('/clientes', 'POST', { nombre: 'Cliente ficticio QA', telefono: '', notas: 'Prueba automatizada' }, 201);
    const venta = await api('/ventas', 'POST', { cliente_id: cliente.id, items: [{ producto: 'Compra rápida ficticia', cantidad: 1, precio_unitario: 5000 }] }, 201);
    assert.equal(Number((await api(`/clientes/${cliente.id}`)).saldo), 5000);
    const pago = await api('/pagos', 'POST', { cliente_id: cliente.id, monto: 2000, medio_pago: 'efectivo' }, 201);
    assert.equal(Number((await api(`/clientes/${cliente.id}`)).saldo), 3000);
    const resumen = await api('/resumen');
    assert.equal(Number(resumen.total_deuda), 3000);
    assert.equal(resumen.hoy.cobrado, 2000);
    await api(`/pagos/${pago.id}/anular`, 'PATCH');
    assert.equal(Number((await api(`/clientes/${cliente.id}`)).saldo), 5000);
    await api(`/pagos/${pago.id}/restaurar`, 'PATCH');
    await api(`/ventas/${venta.id}/anular`, 'PATCH');
    assert.equal(Number((await api(`/clientes/${cliente.id}`)).saldo), -2000);
    await api(`/ventas/${venta.id}/restaurar`, 'PATCH');
    assert.equal(Number((await api(`/clientes/${cliente.id}`)).saldo), 3000);
    const { rows: [otro] } = await pool.query("INSERT INTO negocios(nombre) VALUES ('Otro comercio ficticio') RETURNING id");
    const jwt = (await import('jsonwebtoken')).default;
    token = jwt.sign({ negocio_id: otro.id, usuario: 'otro_qa' }, process.env.JWT_SECRET);
    await api(`/clientes/${cliente.id}`, 'GET', undefined, 404);
    await api('/pagos', 'POST', { cliente_id: cliente.id, monto: 1 }, 404);
    assert.equal((await api('/clientes')).length, 0);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
