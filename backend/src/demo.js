import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';

// Solo para una base dedicada a la demo. No borra ni reinicia datos al desplegar.
export async function prepararDemo(pool) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(71403281)');
    const { rows: [estado] } = await db.query("SELECT to_regclass('negocios') AS tabla");
    if (!estado.tabla) {
      await db.query(await readFile(new URL('../../schema.sql', import.meta.url), 'utf8'));
    }
    const { rows: usuarios } = await db.query('SELECT usuario FROM usuarios');
    if (usuarios.some(({ usuario }) => usuario === 'demo')) {
      await db.query('COMMIT');
      return;
    }
    if (usuarios.length) throw new Error('La demo requiere una base vacía y exclusiva para datos ficticios.');

    const { rows: [negocio] } = await db.query(
      'INSERT INTO negocios(nombre, rubro) VALUES ($1, $2) RETURNING id',
      ['Almacén de muestra · Demo', 'Datos ficticios para portfolio'],
    );
    await db.query('INSERT INTO usuarios(negocio_id, usuario, password_hash) VALUES ($1,$2,$3)',
      [negocio.id, 'demo', await bcrypt.hash('FiadosDemo2026', 10)]);

    const muestras = [
      ['Ana · Ejemplo', 12500, 5000],
      ['Bruno · Ejemplo', 8000, 8000],
      ['Carla · Ejemplo', 18000, 3000],
      ['Diego · Ejemplo', 4500, 0],
    ];
    for (const [nombre, compra, pago] of muestras) {
      const { rows: [cliente] } = await db.query(
        'INSERT INTO clientes(negocio_id,nombre,notas) VALUES ($1,$2,$3) RETURNING id',
        [negocio.id, nombre, 'Persona ficticia. Demo pública compartida: no ingresar datos personales.'],
      );
      const { rows: [venta] } = await db.query(
        "INSERT INTO ventas(negocio_id,cliente_id,total,observacion,fecha) VALUES ($1,$2,$3,'Compra de muestra',CURRENT_DATE - 7) RETURNING id",
        [negocio.id, cliente.id, compra],
      );
      await db.query('INSERT INTO venta_items(venta_id,producto,cantidad,precio_unitario,subtotal) VALUES ($1,$2,1,$3,$3)',
        [venta.id, 'Compra de muestra', compra]);
      if (pago) await db.query("INSERT INTO pagos(negocio_id,cliente_id,monto,medio_pago) VALUES ($1,$2,$3,'efectivo')",
        [negocio.id, cliente.id, pago]);
    }
    for (const [nombre, precio] of [['Yerba 500 g', 3200], ['Leche 1 L', 1800], ['Pan 1 kg', 2800]]) {
      await db.query('INSERT INTO productos(negocio_id,nombre,precio,categoria) VALUES ($1,$2,$3,$4)',
        [negocio.id, nombre, precio, 'Productos de muestra']);
    }
    await db.query('COMMIT');
    console.log('Demo preparada con datos ficticios.');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
