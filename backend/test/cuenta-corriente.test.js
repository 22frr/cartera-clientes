import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';

let api = process.env.TEST_API_URL;

async function request(path, status, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${api}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data.error ?? '')}`);
  return data;
}

test('cuenta corriente: compra, pago, anulación, restauración y aislamiento', async (t) => {
  // Sin API externa configurada, iniciar la misma aplicación en un puerto temporal.
  let servidor;
  const negocios = [];
  t.after(async () => {
    try {
      await pool.query('DELETE FROM negocios WHERE id = ANY($1::int[])', [negocios]);
    } finally {
      if (servidor) await new Promise((resolve) => servidor.close(resolve));
      await pool.end();
    }
  });

  if (!api) {
    const { default: app } = await import('../src/app.js');
    servidor = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => servidor.once('listening', resolve));
    api = `http://127.0.0.1:${servidor.address().port}/api`;
  }

  const password = randomUUID();
  const hash = await bcrypt.hash(password, 10);

  async function iniciarSesion() {
    const usuario = `prueba_${randomUUID()}`;
    const { rows: [negocio] } = await pool.query(
      'INSERT INTO negocios (nombre) VALUES ($1) RETURNING id',
      ['Comercio de prueba']
    );
    negocios.push(negocio.id);
    await pool.query(
      'INSERT INTO usuarios (negocio_id, usuario, password_hash) VALUES ($1, $2, $3)',
      [negocio.id, usuario, hash]
    );
    const sesion = await request('/auth/login', 200, {
      method: 'POST',
      body: { usuario, password },
    });
    assert.ok(sesion.token);
    return sesion.token;
  }

  const token = await iniciarSesion();
  const otroToken = await iniciarSesion();

  const cliente = await request('/clientes', 201, {
    token,
    method: 'POST',
    body: { nombre: 'Cliente de prueba' },
  });
  const ficha = `/clientes/${cliente.id}`;
  const compra = await request('/ventas', 201, {
    token,
    method: 'POST',
    body: {
      cliente_id: cliente.id,
      items: [{ producto: 'Queso', cantidad: 1.25, precio_unitario: 100.20 }],
    },
  });

  async function verificarSaldo(esperado) {
    const { saldo } = await request(ficha, 200, { token });
    assert.equal(Number(saldo), esperado);
  }

  await verificarSaldo(125.25);
  const pago = await request('/pagos', 201, {
    token,
    method: 'POST',
    body: { cliente_id: cliente.id, monto: 25.10 },
  });
  await verificarSaldo(100.15);

  await request(ficha, 404, { token: otroToken });
  assert.deepEqual(await request('/clientes', 200, { token: otroToken }), []);
  await request(`/ventas/${compra.id}/anular`, 404, { token: otroToken, method: 'PATCH' });
  await request(`/pagos/${pago.id}/anular`, 404, { token: otroToken, method: 'PATCH' });
  await verificarSaldo(100.15);

  await request(`/pagos/${pago.id}/anular`, 200, { token, method: 'PATCH' });
  await verificarSaldo(125.25);
  await request(`/ventas/${compra.id}/anular`, 200, { token, method: 'PATCH' });
  await verificarSaldo(0.00);
  await request(`/ventas/${compra.id}/restaurar`, 200, { token, method: 'PATCH' });
  await request(`/pagos/${pago.id}/restaurar`, 200, { token, method: 'PATCH' });
  await verificarSaldo(100.15);
});
