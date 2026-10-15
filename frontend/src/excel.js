import { esAtrasado } from './cobranza';
import { NOMBRE_APP } from './marca';

// Lectura de Excel, plantillas y exportaciones para importar productos y clientes.
// exceljs pesa bastante, así que se carga recién cuando el usuario toca "Importar" (import dinámico).

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const MAX_FILAS = { productos: 5000, clientes: 2000 };

// Nombres de columna aceptados (sin importar tildes, mayúsculas ni el orden de las columnas)
const COLUMNAS = {
  productos: {
    categoria: ['categoria', 'rubro'],
    nombre: ['nombre', 'producto', 'descripcion', 'articulo'],
    precio: ['precio', 'precio de venta', 'precio venta'],
    codigo_barras: ['codigo de barras', 'codigo barras', 'codigo', 'ean'],
  },
  clientes: {
    nombre: ['nombre', 'cliente', 'nombre y apellido', 'apellido y nombre'],
    telefono: ['telefono', 'tel', 'celular', 'whatsapp'],
    direccion: ['direccion', 'domicilio'],
    notas: ['notas', 'nota', 'observaciones'],
    saldo_inicial: ['saldo inicial', 'saldo', 'deuda', 'deuda actual'],
    deuda_desde: ['deuda desde', 'fecha de la deuda', 'desde'],
  },
};

async function cargarExcelJS() {
  // Bundle ya armado para navegador (evita que Vite tenga que elegir entre la versión de Node y la web)
  const m = await import('exceljs/dist/exceljs.min.js');
  return m.default ?? m;
}

// ---------- Lectura de celdas ----------
function crudo(cell) {
  let v = cell.value;
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if ('result' in v) v = v.result;
    else if ('text' in v) v = v.text;
    else return '';
    if (v instanceof Date) return v;
    if (v && typeof v === 'object') return '';
  }
  return v ?? '';
}

function texto(v) {
  if (v == null || v instanceof Date) return '';
  return String(v).trim();
}

// Acepta 1500, "1500", "$ 1.500", "1.500,50", "1500,5"
function parseMonto(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v instanceof Date) return NaN;
  let s = String(v).replace(/[$\s]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function haceAnios(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Devuelve AAAA-MM-DD o null si no se entiende. Acepta fechas de Excel, 25/12/2025, 25-12-25 y 2025-12-25
function fechaISO(v) {
  let a, m, d;
  if (v instanceof Date) {
    a = v.getUTCFullYear(); m = v.getUTCMonth() + 1; d = v.getUTCDate();
  } else {
    const s = String(v).trim();
    let r;
    if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      a = +r[1]; m = +r[2]; d = +r[3];
    } else if ((r = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/))) {
      d = +r[1]; m = +r[2]; a = +r[3];
      if (a < 100) a += 2000;
    } else return null;
  }
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------- Validación de cada fila ----------
function validarProducto(raw) {
  const nombre = texto(raw.nombre).slice(0, 150);
  if (!nombre) return { error: 'Falta el nombre' };
  const precio = parseMonto(raw.precio);
  if (Number.isNaN(precio) || (precio !== null && precio < 0)) {
    return { error: `El precio "${texto(raw.precio)}" no es válido` };
  }
  return {
    dato: {
      categoria: texto(raw.categoria).slice(0, 80) || null,
      nombre,
      precio,
      codigo_barras: texto(raw.codigo_barras).slice(0, 50) || null,
    },
  };
}

function validarCliente(raw) {
  const nombre = texto(raw.nombre).slice(0, 100);
  if (!nombre) return { error: 'Falta el nombre' };

  const saldo = parseMonto(raw.saldo_inicial);
  if (Number.isNaN(saldo)) return { error: `El saldo "${texto(raw.saldo_inicial)}" no es válido` };
  if (saldo !== null && saldo < 0) return { error: 'El saldo no puede ser negativo' };
  if (saldo !== null && saldo >= 1e10) return { error: 'El saldo es demasiado grande' };

  let deudaDesde = null;
  if (saldo > 0 && (raw.deuda_desde instanceof Date || texto(raw.deuda_desde) !== '')) {
    deudaDesde = fechaISO(raw.deuda_desde);
    if (!deudaDesde) return { error: `La fecha "${texto(raw.deuda_desde)}" no es válida (usá día/mes/año)` };
    if (deudaDesde > hoyLocal()) return { error: 'La fecha de la deuda no puede ser futura' };
    if (deudaDesde < haceAnios(10)) return { error: `La fecha ${texto(raw.deuda_desde)} es demasiado antigua (máximo 10 años)` };
  }

  return {
    dato: {
      nombre,
      telefono: texto(raw.telefono).slice(0, 30) || null,
      direccion: texto(raw.direccion).slice(0, 150) || null,
      notas: texto(raw.notas).slice(0, 500) || null,
      saldo_inicial: saldo > 0 ? saldo : 0,
      deuda_desde: deudaDesde,
    },
  };
}

// ---------- Leer un archivo .xlsx ----------
// Devuelve { filas: [...válidas], errores: [{ fila, error }] }
export async function leerArchivo(file, tipo) {
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo es muy grande (máximo 10 MB).');
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error('Solo se aceptan archivos .xlsx. Si es .xls o .csv, abrilo en Excel y guardalo como .xlsx.');
  }

  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('No se pudo leer el archivo. Revisá que sea un Excel (.xlsx) válido.');
  }

  const hoja = wb.worksheets.find((w) => norm(w.name) === tipo) ?? wb.worksheets[0];
  if (!hoja) throw new Error('El Excel no tiene hojas.');

  // Columnas: se buscan por el nombre del encabezado (primera fila)
  const mapa = {};
  hoja.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const h = norm(texto(crudo(cell)));
    for (const [campo, alias] of Object.entries(COLUMNAS[tipo])) {
      if (mapa[campo] === undefined && alias.includes(h)) mapa[campo] = col;
    }
  });
  if (!mapa.nombre) {
    throw new Error('No encontré la columna "Nombre" en la primera fila. Descargá la plantilla para ver el formato.');
  }

  const filas = [];
  const errores = [];
  hoja.eachRow({ includeEmpty: false }, (fila, n) => {
    if (n === 1) return;
    const raw = {};
    for (const [campo, col] of Object.entries(mapa)) raw[campo] = crudo(fila.getCell(col));
    if (Object.values(raw).every((v) => String(v).trim() === '')) return; // fila vacía

    const r = tipo === 'productos' ? validarProducto(raw) : validarCliente(raw);
    if (r.error) errores.push({ fila: n, error: r.error });
    else filas.push(r.dato);
  });

  if (filas.length > MAX_FILAS[tipo]) {
    throw new Error(`El archivo tiene ${filas.length} filas. El máximo por importación es ${MAX_FILAS[tipo]}.`);
  }
  return { filas, errores };
}

// ---------- Plantillas ----------
const PLANTILLAS = {
  productos: {
    hoja: 'Productos',
    columnas: [
      ['Categoría', 24],
      ['Nombre', 40],
      ['Precio', 14],
      ['Código de barras', 22, 'texto'],
    ],
    leame: [
      'Cómo completar la hoja "Productos"',
      '',
      '• Nombre es lo único obligatorio.',
      '• Categoría: la usás para filtrar el catálogo (ej: Golosinas, Bebidas).',
      '• Precio: solo el número, sin $ (ej: 1500). Puede quedar vacío.',
      '• Código de barras: opcional. No puede repetirse entre productos.',
      '• Los productos que ya tenés cargados (mismo nombre) se omiten, no se duplican.',
      '• Borrá esta hoja si querés; no afecta la importación.',
    ],
  },
  clientes: {
    hoja: 'Clientes',
    columnas: [
      ['Nombre', 32],
      ['Teléfono', 18, 'texto'],
      ['Dirección', 30],
      ['Notas', 30],
      ['Saldo inicial', 16, 'monto'],
      ['Deuda desde', 16, 'fecha'],
    ],
    leame: [
      'Cómo completar la hoja "Clientes"',
      '',
      '• Nombre es lo único obligatorio.',
      '• Teléfono: con código de área, sin 0 ni 15 (ej: 342 4123456).',
      '• Saldo inicial: lo que el cliente debe HOY, solo el número (ej: 12500). Vacío o 0 si no debe nada.',
      '• Deuda desde: fecha aproximada desde la que debe (ej: 15/08/2026). Sirve para saber hace cuánto no paga.',
      '  Si la dejás vacía se usa la fecha de hoy.',
      '• Los clientes con saldo inicial se cargan con una compra llamada "Saldo inicial".',
      '• Los clientes que ya tenés cargados (mismo nombre) se omiten, no se duplican.',
      '• Borrá esta hoja si querés; no afecta la importación.',
    ],
  },
};

// Ayuda que Excel muestra al elegir cada celda, y largo máximo de texto (mismos límites que el servidor)
const AYUDAS = {
  productos: {
    'Categoría': { max: 80, prompt: 'Opcional. Sirve para filtrar el catálogo. Ej: Golosinas' },
    'Nombre': { max: 150, prompt: 'Obligatorio. Ej: Alfajor Guaymallén Triple' },
    'Precio': { prompt: 'Opcional. Solo el número, sin $. Ej: 1500' },
    'Código de barras': { max: 50, prompt: 'Opcional. No puede repetirse entre productos.' },
  },
  clientes: {
    'Nombre': { max: 100, prompt: 'Obligatorio. Nombre y apellido. Ej: Claudia Torres' },
    'Teléfono': { max: 30, prompt: 'Opcional. Con código de área, sin 0 ni 15. Ej: 342 4123456' },
    'Dirección': { max: 150, prompt: 'Opcional.' },
    'Notas': { max: 500, prompt: 'Opcional.' },
    'Saldo inicial': { prompt: 'Opcional. Lo que debe HOY, solo el número. Ej: 12500. Vacío si no debe nada.' },
    'Deuda desde': { prompt: 'Opcional. Fecha aproximada desde la que debe: día/mes/año. Ej: 15/08/2026' },
  },
};

export async function descargarPlantilla(tipo) {
  const p = PLANTILLAS[tipo];
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();

  const hoja = wb.addWorksheet(p.hoja);
  // Formato de cada columna, ya aplicado a las celdas vacías:
  //  texto -> conserva ceros y no pasa a notación científica (teléfonos, códigos)
  //  fecha -> Excel muestra lo que se escriba como día/mes/año
  //  monto -> separador de miles
  const FORMATOS = { texto: '@', fecha: 'dd/mm/yyyy', monto: '#,##0' };
  hoja.columns = p.columnas.map(([header, width, formato]) => ({
    header,
    key: header,
    width,
    style: formato ? { numFmt: FORMATOS[formato] } : {},
  }));
  estiloEncabezado(hoja.getRow(1));
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  // Validación de datos: Excel avisa al escribir algo inválido y muestra una ayuda al elegir la celda
  const FILAS_VALIDADAS = tipo === 'clientes' ? MAX_FILAS.clientes : MAX_FILAS.productos;
  p.columnas.forEach(([header, , formato], i) => {
    let regla = null;
    if (formato === 'fecha') {
      regla = {
        type: 'date',
        operator: 'greaterThan',
        formulae: [new Date(Date.UTC(2000, 0, 1))],
        promptTitle: header,
        prompt: AYUDAS[tipo][header]?.prompt ?? 'Escribí día/mes/año. Ej: 15/08/2026',
        errorTitle: 'Fecha no válida',
        error: 'Escribí la fecha como día/mes/año. Ej: 15/08/2026',
      };
    } else if (formato === 'monto' || header === 'Precio') {
      regla = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        formulae: [0],
        promptTitle: header,
        prompt: AYUDAS[tipo][header]?.prompt ?? 'Solo el número, sin $. Ej: 12500',
        errorTitle: 'Monto no válido',
        error: 'Escribí solo un número mayor o igual a 0, sin el signo $.',
      };
    } else if (AYUDAS[tipo][header]?.max) {
      const a = AYUDAS[tipo][header];
      regla = {
        type: 'textLength',
        operator: 'lessThanOrEqual',
        formulae: [a.max],
        promptTitle: header,
        prompt: a.prompt,
        errorTitle: 'Texto demasiado largo',
        error: `Máximo ${a.max} caracteres.`,
      };
    }
    if (!regla) return;
    for (let fila = 2; fila <= FILAS_VALIDADAS + 1; fila++) {
      hoja.getCell(fila, i + 1).dataValidation = {
        ...regla,
        allowBlank: true,
        showInputMessage: true,
        showErrorMessage: true,
        errorStyle: 'stop',
      };
    }
  });

  const leame = wb.addWorksheet('Léame');
  leame.getColumn(1).width = 100;
  p.leame.forEach((linea, i) => {
    const fila = leame.addRow([linea]);
    if (i === 0) fila.font = { bold: true };
  });

  await guardarLibro(wb, `plantilla_${tipo}.xlsx`);
}

// ---------- Exportaciones ----------
const FMT_MONTO = '"$" #,##0;[Red]-"$" #,##0';
const FMT_FECHA = 'dd/mm/yyyy';
const COLOR = {
  encabezado: 'FF047857', // verde de la marca
  linea: 'FFE2E8F0',
  zebra: 'FFF8FAFC',
  total: 'FFE2E8F0',
  rojo: 'FFB91C1C',
  verde: 'FF047857',
  gris: 'FF94A3B8',
  tinta: 'FF0F172A',
};
const MARGENES = { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };

async function guardarLibro(wb, nombreArchivo) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// '2026-10-09' (o con hora) -> fecha de Excel, sin corrimientos de zona horaria
function aFecha(valor) {
  const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function fechaTexto(fecha = new Date()) {
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
}

// Encabezado de tabla: fondo verde, texto blanco. `derecha` = columnas alineadas a la derecha
function estiloEncabezado(fila, derecha = []) {
  fila.height = 22;
  fila.eachCell((celda, col) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.encabezado } };
    celda.alignment = { vertical: 'middle', horizontal: derecha.includes(col) ? 'right' : undefined };
  });
}

// Fila de datos: línea fina abajo y sombreado alternado muy suave
function estiloFila(fila, columnas, indice) {
  for (let c = 1; c <= columnas; c++) {
    const celda = fila.getCell(c);
    celda.border = { bottom: { style: 'thin', color: { argb: COLOR.linea } } };
    if (indice % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
  }
}

function configurarImpresion(hoja, { horizontal, filaEncabezado }) {
  hoja.pageSetup = {
    paperSize: 9, // A4
    orientation: horizontal ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0, // todas las hojas que hagan falta a lo alto
    printTitlesRow: `${filaEncabezado}:${filaEncabezado}`,
    margins: MARGENES,
  };
  hoja.headerFooter = { oddFooter: `&LGenerado con ${NOMBRE_APP}&RPágina &P de &N` };
}

// Lista de clientes tal como se está viendo (con los filtros y el orden elegidos)
export async function exportarClientes(lista, { archivados = false } = {}) {
  if (!lista.length) throw new Error('No hay clientes para exportar');
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet(archivados ? 'Clientes archivados' : 'Clientes');

  const centrado = { alignment: { horizontal: 'center' } };
  hoja.columns = [
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Teléfono', key: 'telefono', width: 18, style: { numFmt: '@', alignment: { horizontal: 'left' } } },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Notas', key: 'notas', width: 30 },
    { header: 'Saldo', key: 'saldo', width: 16, style: { numFmt: FMT_MONTO } },
    { header: 'Estado', key: 'estado', width: 12, style: centrado },
    { header: 'Días sin pagar', key: 'dias', width: 15, style: centrado },
    { header: 'Días desde el último aviso', key: 'aviso', width: 26, style: centrado },
  ];
  estiloEncabezado(hoja.getRow(1), [5]);
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  let totalDeuda = 0;
  lista.forEach((c, i) => {
    const saldo = Number(c.saldo) || 0;
    if (saldo > 0) totalDeuda += saldo;
    const avisos = [c.dias_ultimo_recordatorio, c.dias_ultima_cuenta].filter((d) => d != null);
    const estado = saldo <= 0 ? 'Al día' : esAtrasado(c) ? 'Atrasado' : 'Debe';

    const fila = hoja.addRow({
      nombre: c.nombre,
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      notas: c.notas || '',
      saldo,
      estado,
      dias: saldo > 0 && c.dias_sin_pagar != null ? Number(c.dias_sin_pagar) : null,
      aviso: avisos.length ? Math.min(...avisos.map(Number)) : null,
    });
    estiloFila(fila, 8, i);
    fila.getCell(6).font = { bold: true, color: { argb: estado === 'Al día' ? COLOR.verde : COLOR.rojo } };
    if (saldo > 0) fila.getCell(5).font = { bold: true, color: { argb: COLOR.rojo } };
  });
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  hoja.addRow([]); // la fila vacía separa el total de los filtros
  const total = hoja.addRow({ nombre: 'Total que te deben', saldo: totalDeuda });
  for (let c = 1; c <= 8; c++) {
    const celda = total.getCell(c);
    celda.font = { bold: true, color: { argb: c === 5 ? COLOR.rojo : COLOR.tinta } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.total } };
    celda.border = { top: { style: 'medium', color: { argb: COLOR.tinta } } };
  }

  configurarImpresion(hoja, { horizontal: true, filaEncabezado: 1 });
  await guardarLibro(wb, `${archivados ? 'clientes_archivados' : 'clientes'}_${hoyLocal()}.xlsx`);
}

// Ficha de un cliente: datos, historial con saldo acumulado y detalle de productos
export async function exportarCliente(cliente, movimientos) {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();

  const clave = (m) => `${String(m.fecha).slice(0, 10)}|${String(m.creado_en)}`;
  const orden = [...movimientos].sort((a, b) => clave(a).localeCompare(clave(b)));

  // ----- Hoja 1: movimientos -----
  const hoja = wb.addWorksheet('Movimientos');
  [16, 10, 50, 16, 16, 12].forEach((w, i) => { hoja.getColumn(i + 1).width = w; });

  const saldoActual = Number(cliente.saldo) || 0;
  const info = [
    ['Cliente', cliente.nombre],
    ['Teléfono', cliente.telefono || ''],
    ['Dirección', cliente.direccion || ''],
    ['Saldo pendiente', saldoActual],
    ['Exportado el', fechaTexto()],
  ];
  info.forEach(([etiqueta, valor], i) => {
    const r = i + 1;
    const rotulo = hoja.getCell(r, 1);
    rotulo.value = etiqueta;
    rotulo.font = { bold: true, color: { argb: 'FF475569' } };
    hoja.mergeCells(r, 2, r, 3);
    const celda = hoja.getCell(r, 2);
    celda.value = valor;
    celda.alignment = { horizontal: 'left' };
    if (etiqueta === 'Cliente') celda.font = { bold: true, size: 13 };
    if (etiqueta === 'Teléfono') celda.numFmt = '@';
    if (etiqueta === 'Saldo pendiente') {
      celda.numFmt = FMT_MONTO;
      celda.font = { bold: true, size: 13, color: { argb: saldoActual > 0 ? COLOR.rojo : COLOR.verde } };
    }
  });

  const filaEnc = info.length + 2;
  const enc = hoja.getRow(filaEnc);
  ['Fecha', 'Tipo', 'Detalle', 'Monto', 'Saldo', 'Estado'].forEach((h, i) => { enc.getCell(i + 1).value = h; });
  estiloEncabezado(enc, [4, 5]);
  hoja.views = [{ state: 'frozen', ySplit: filaEnc }];

  let saldo = 0;
  orden.forEach((m, i) => {
    const esVenta = m.tipo === 'venta';
    const monto = (Number(m.monto) || 0) * (esVenta ? 1 : -1);
    if (!m.anulado) saldo += monto;

    const items = m.items || [];
    const detalle = esVenta
      ? items.length === 1 && Number(items[0].cantidad) === 1
        ? items[0].producto
        : items.map((it) => `${Number(it.cantidad)} x ${it.producto}`).join('; ') || 'Compra'
      : 'Pago recibido' + (m.observacion ? ` — ${m.observacion}` : '');

    const fila = hoja.addRow([
      aFecha(m.fecha),
      esVenta ? 'Compra' : 'Pago',
      detalle,
      monto,
      m.anulado ? null : saldo,
      m.anulado ? 'Anulado' : '',
    ]);
    estiloFila(fila, 6, i);
    fila.getCell(1).numFmt = FMT_FECHA;
    fila.getCell(1).alignment = { horizontal: 'left', vertical: 'top' };
    fila.getCell(2).alignment = { horizontal: 'center', vertical: 'top' };
    fila.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    fila.getCell(4).numFmt = FMT_MONTO;
    fila.getCell(5).numFmt = FMT_MONTO;

    if (m.anulado) {
      fila.font = { color: { argb: COLOR.gris }, strike: true };
    } else {
      const color = esVenta ? COLOR.rojo : COLOR.verde;
      fila.getCell(2).font = { bold: true, color: { argb: color } };
      fila.getCell(4).font = { bold: true, color: { argb: color } };
      fila.getCell(5).font = { bold: true };
    }
  });

  configurarImpresion(hoja, { horizontal: false, filaEncabezado: filaEnc });

  // ----- Hoja 2: productos de cada compra -----
  const compras = orden.filter((m) => m.tipo === 'venta' && (m.items || []).length > 0);
  if (compras.length > 0) {
    const h2 = wb.addWorksheet('Detalle de compras');
    h2.columns = [
      { header: 'Fecha', key: 'fecha', width: 14, style: { numFmt: FMT_FECHA, alignment: { horizontal: 'left' } } },
      { header: 'Producto', key: 'producto', width: 44 },
      { header: 'Cantidad', key: 'cantidad', width: 12, style: { alignment: { horizontal: 'center' } } },
      { header: 'Precio unitario', key: 'precio', width: 16, style: { numFmt: FMT_MONTO } },
      { header: 'Subtotal', key: 'subtotal', width: 16, style: { numFmt: FMT_MONTO } },
      { header: 'Estado', key: 'estado', width: 12 },
    ];
    estiloEncabezado(h2.getRow(1), [4, 5]);
    h2.views = [{ state: 'frozen', ySplit: 1 }];

    let n = 0;
    for (const m of compras) {
      for (const it of m.items) {
        const fila = h2.addRow({
          fecha: aFecha(m.fecha),
          producto: it.producto,
          cantidad: Number(it.cantidad),
          precio: Number(it.precio_unitario),
          subtotal: Number(it.subtotal),
          estado: m.anulado ? 'Anulado' : '',
        });
        estiloFila(fila, 6, n++);
        if (m.anulado) fila.font = { color: { argb: COLOR.gris }, strike: true };
      }
    }
    configurarImpresion(h2, { horizontal: false, filaEncabezado: 1 });
  }

  const nombre = String(cliente.nombre).replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'cliente';
  await guardarLibro(wb, `${nombre}_${hoyLocal()}.xlsx`);
}
