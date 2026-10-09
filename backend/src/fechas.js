// Fechas "razonables" para compras, pagos y deudas importadas:
// formato AAAA-MM-DD, fecha real del calendario, no futura y de los últimos 10 años.
// Evita que un error de tipeo (ej. año 0026) arruine el saldo y los avisos de atrasados.
export function fechaRazonable(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f) return false;

  const hoy = new Date();
  const maximo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1)); // +1 día: zona horaria
  const minimo = new Date(Date.UTC(hoy.getUTCFullYear() - 10, hoy.getUTCMonth(), hoy.getUTCDate()));
  return d >= minimo && d <= maximo;
}

export const MENSAJE_FECHA = 'La fecha no es válida (tiene que ser de los últimos 10 años y no futura)';
