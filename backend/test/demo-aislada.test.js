import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { existsSync } from 'node:fs';
import { prepararDemo } from '../src/demo.js';

dotenv.config({ quiet: true });

test('Demo: inicialización, saldos, reinicio sin duplicados y rutas de producción', async (t) => {
  const schema = `fiados_demo_test_${process.pid}_${Date.now()}`;
  const config = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  };
  const admin = new pg.Pool(config);
  const demo = new pg.Pool({ ...config, options: `-c search_path=${schema}` });
  let server;
  let appPool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await prepararDemo(demo);
    await prepararDemo(demo);
    assert.equal(Number((await demo.query('SELECT count(*) FROM negocios')).rows[0].count), 1);
    assert.equal(Number((await demo.query('SELECT count(*) FROM clientes')).rows[0].count), 4);
    assert.equal(Number((await demo.query('SELECT sum(saldo) FROM saldos')).rows[0].sum), 27000);
    const { rows: [usuario] } = await demo.query('SELECT * FROM usuarios');
    assert.ok(await bcrypt.compare('FiadosDemo2026', usuario.password_hash));

    process.env.NODE_ENV = 'production';
    process.env.PGOPTIONS = `-c search_path=${schema}`;
    appPool = (await import('../src/db.js')).default;
    const { default: app } = await import('../src/app.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const desconocida = await fetch(`${base}/api/no-existe`);
    assert.equal(desconocida.status, 404);
    assert.match(desconocida.headers.get('content-type'), /json/);
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'demo', password: 'FiadosDemo2026' }),
    });
    assert.equal(login.status, 200);
    assert.ok((await login.json()).token);
    await t.test('React y recarga de rutas (compilar primero con npm run build)', {
      skip: !existsSync(new URL('../../frontend/dist/index.html', import.meta.url)),
    }, async () => {
      for (const ruta of ['/', '/clientes/1']) {
        const response = await fetch(`${base}${ruta}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /html/);
        assert.match(await response.text(), /<div id="root">/);
      }
    });
    await demo.query("UPDATE usuarios SET usuario = 'otra_cuenta'");
    await assert.rejects(prepararDemo(demo), /base vacía/);
    assert.equal(Number((await demo.query('SELECT count(*) FROM negocios')).rows[0].count), 1);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (appPool) await appPool.end();
    await demo.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
