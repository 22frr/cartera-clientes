import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

// Uso:
//   node src/importar-productos.js ruta/al/archivo.xlsx usuario            (importa de verdad)
//   node src/importar-productos.js ruta/al/archivo.xlsx usuario --probar   (solo muestra qué haría)

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const soloProbar = process.argv.includes('--probar');
const [archivo, usuario] = args;

if (!archivo || !usuario) {
  console.log('Uso: node src/importar-productos.js ruta/al/archivo.xlsx usuario [--probar]');
  process.exit(1);
}

function texto(celda) {
  const v = celda.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.result ?? v.text ?? '').trim();
  return String(v).trim();
}

const client = await pool.connect();

try {
  // 1) Leer el Excel (hoja "Productos": Categoría | Nombre | Precio | Código de barras)
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);
  const hoja = wb.getWorksheet('Productos');
  if (!hoja) throw new Error('El Excel no tiene una hoja llamada "Productos".');

  const filas = [];
  hoja.eachRow((fila, n) => {
    if (n === 1) return; // encabezados
    const categoria = texto(fila.getCell(1));
    const nombre = texto(fila.getCell(2));
    const precioTxt = texto(fila.getCell(3)).replace(',', '.');
    const codigo = texto(fila.getCell(4));
    if (!nombre) return;
    const precio = precioTxt !== '' && !Number.isNaN(Number(precioTxt)) ? Number(precioTxt) : null;
    filas.push({
      categoria: categoria || null,
      nombre: nombre.slice(0, 150),
      precio,
      codigo: codigo || null,
    });
  });

  // 2) Buscar el negocio del usuario
  const { rows: u } = await client.query('SELECT negocio_id FROM usuarios WHERE usuario = $1', [usuario]);
  if (u.length === 0) throw new Error(`No existe el usuario "${usuario}".`);
  const negocioId = u[0].negocio_id;

  // 3) Saltear los que ya existen en ese negocio (mismo nombre, sin importar mayúsculas)
  const { rows: existentes } = await client.query(
    'SELECT lower(nombre) AS n FROM productos WHERE negocio_id = $1',
    [negocioId]
  );
  const yaEstan = new Set(existentes.map((e) => e.n));
  const nuevos = filas.filter((f) => {
    const k = f.nombre.toLowerCase();
    if (yaEstan.has(k)) return false;
    yaEstan.add(k); // también evita repetidos dentro del mismo Excel
    return true;
  });

  console.log(`Filas leídas del Excel:        ${filas.length}`);
  console.log(`Ya existían (se omiten):       ${filas.length - nuevos.length}`);
  console.log(`Productos nuevos a importar:   ${nuevos.length}`);

  if (soloProbar) {
    console.log('\nModo prueba: no se guardó nada.');
  } else {
    // 4) Insertar todo en una sola transacción: o entra todo, o no entra nada
    await client.query('BEGIN');
    for (const p of nuevos) {
      await client.query(
        `INSERT INTO productos (negocio_id, categoria, nombre, precio, codigo_barras)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [negocioId, p.categoria, p.nombre, p.precio, p.codigo]
      );
    }
    await client.query('COMMIT');
    console.log(`\nListo: se importaron ${nuevos.length} productos al negocio id ${negocioId}.`);
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Error:', error.message);
} finally {
  client.release();
  await pool.end();
}
