import { test } from 'node:test';
import assert from 'node:assert/strict';

// El módulo de sincronización es para el navegador; no mantener canales abiertos en Node.
globalThis.BroadcastChannel = undefined;
const { abrirWhatsApp, armarLinkWhatsApp } = await import('../src/cobranza.js');
const { crearLibroCliente, crearLibroClientes } = await import('../src/excel.js');
const cliente = { nombre: 'Cliente ficticio', telefono: '3424123456', saldo: 3000 };

test('WhatsApp móvil usa la app sin crear pestañas vacías y conserva el texto editado', () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Android', maxTouchPoints: 1 } });
  globalThis.localStorage = { getItem: () => null };
  globalThis.window = { location: { href: '/cliente/1' }, open: () => assert.fail('No debe abrir ventanas') };
  const url = armarLinkWhatsApp(cliente, 'Mensaje editado: $3.000');
  assert.equal(url, 'whatsapp://send?phone=5493424123456&text=Mensaje%20editado%3A%20%243.000');
  assert.equal(abrirWhatsApp(url), true);
  assert.equal(window.location.href, url);
});

test('WhatsApp Web abre URLs directas con el mismo destino y detecta bloqueo', () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Desktop', maxTouchPoints: 0 } });
  const llamadas = [];
  globalThis.window = { open: (...args) => { llamadas.push(args); return { focus() {} }; } };
  const url = armarLinkWhatsApp(cliente, 'Hola');
  abrirWhatsApp(url);
  abrirWhatsApp(url);
  assert.deepEqual(llamadas, [[url, 'fiados-whatsapp'], [url, 'fiados-whatsapp']]);
  let aviso = false;
  window.open = () => null;
  window.alert = () => { aviso = true; };
  assert.equal(abrirWhatsApp(url), false);
  assert.equal(aviso, true);
  assert.equal(armarLinkWhatsApp({ telefono: '123' }), null);
});

test('Excel omite compras y pagos anulados en todas las hojas y reconcilia el saldo', async () => {
  const item = { producto: 'Galletitas de ejemplo con un nombre largo '.repeat(4), cantidad: 1, precio_unitario: 5000, subtotal: 5000 };
  const movs = [
    { tipo: 'venta', fecha: '2026-01-01', monto: 5555, anulado: true, items: [{ ...item, producto: 'NO EXPORTAR' }] },
    { tipo: 'pago', fecha: '2026-01-02', monto: 500, anulado: true },
    { tipo: 'venta', fecha: '2026-01-03', monto: 5000, items: [item] },
    { tipo: 'pago', fecha: '2026-01-04', monto: 2000 },
  ];
  const wb = await crearLibroCliente(cliente, movs);
  // Verificar también el archivo serializado y vuelto a abrir.
  const buffer = await wb.xlsx.writeBuffer();
  const ExcelJS = (await import('exceljs')).default;
  const leido = await new ExcelJS.Workbook().xlsx.load(buffer);
  const hoja = leido.getWorksheet('Movimientos');
  assert.equal(hoja.rowCount, 9);
  assert.equal(hoja.getCell('E8').value, 5000);
  assert.equal(hoja.getCell('E9').value, 3000);
  assert.equal(hoja.getCell('B4').value, 3000);
  assert.equal(leido.getWorksheet('Detalle de compras').rowCount, 2);
  assert.equal(JSON.stringify(leido.model).includes('NO EXPORTAR'), false);
  assert.ok(hoja.getRow(8).height > 30);
  assert.equal(hoja.getCell('C8').border.left.style, 'thin');
});

test('Excel distingue saldo a favor y totaliza únicamente lo adeudado', async () => {
  const wb = await crearLibroClientes([cliente, { ...cliente, nombre: 'A favor', saldo: -1000 }]);
  const hoja = wb.worksheets[0];
  assert.equal(hoja.getCell('F3').value, 'A favor');
  assert.equal(hoja.getCell('E5').value, 3000);
  assert.equal(hoja.getCell('E2').numFmt.includes('.00'), true);
  assert.equal(hoja.getRow(1).height, 36);
});
