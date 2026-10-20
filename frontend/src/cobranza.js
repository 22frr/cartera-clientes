import { dinero, nombreNegocio, configNegocio } from './api';


export const DIAS_ATRASADO = 30;
export const esAtrasado = (c) => Number(c.saldo) > 0 && c.dias_sin_pagar > DIAS_ATRASADO;

// Colores por antigüedad de la deuda. Para cambiar cuándo cambia de color, tocar estos dos números:
//   hasta DIAS_ATENCION días  -> reciente (neutro, sin alarma)
//   hasta DIAS_ATRASADO días  -> atención (ámbar)
//   más de DIAS_ATRASADO días -> atrasado (rojo)
export const DIAS_ATENCION = 20;

export const NIVELES = {
  aldia: {
    avatar: 'bg-marca-100 dark:bg-marca-900 text-marca-700 dark:text-marca-300',
    monto: 'text-marca-600 dark:text-marca-400',
    texto: 'font-semibold text-marca-700 dark:text-marca-400',
  },
  reciente: {
    avatar: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
    monto: 'text-slate-800 dark:text-slate-100',
    texto: 'font-medium',
  },
  atencion: {
    avatar: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
    monto: 'text-amber-700 dark:text-amber-400',
    texto: 'font-bold text-amber-700 dark:text-amber-400',
  },
  atrasado: {
    avatar: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
    monto: 'text-red-600 dark:text-red-400',
    texto: 'font-bold text-red-600 dark:text-red-400',
  },
};

export function nivelDeuda(c) {
  if (!(Number(c.saldo) > 0)) return 'aldia';
  const d = c.dias_sin_pagar;
  if (d == null) return 'reciente';
  if (d > DIAS_ATRASADO) return 'atrasado';
  if (d > DIAS_ATENCION) return 'atencion';
  return 'reciente';
}

export function hace(d) {
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

export function diasUltimoAviso(c) {
  const avisos = [c.dias_ultimo_recordatorio, c.dias_ultima_cuenta].filter((d) => d != null);
  return avisos.length ? Math.min(...avisos) : null;
}


function codigoArea() {
  return String(configNegocio().codigo_area ?? '').replace(/\D/g, '');
}


export function telefonoParaWhatsApp(tel) {
  let n = String(tel ?? '').replace(/\D/g, '');
  if (!n) return null;

  if (n.startsWith('54')) {
    n = n.slice(2);
    if (n.startsWith('9')) n = n.slice(1);
  }
  if (n.startsWith('0')) n = n.slice(1);


  const area = codigoArea();
  if (area) {
    const local = 10 - area.length;
    if (n.length === local + 2 && n.startsWith('15')) n = n.slice(2);
    if (n.length === local) n = area + n;
  }

  // Con área y "15": 342 15 4123456 -> se saca el 15
  if (n.length === 12) {
    for (const a of [2, 3, 4]) {
      if (n.slice(a, a + 2) === '15') {
        n = n.slice(0, a) + n.slice(a + 2);
        break;
      }
    }
  }

  return n.length === 10 ? '549' + n : null;
}



// Mensaje por defecto. Las palabras entre llaves se reemplazan al enviar:
//   {CLIENTE} nombre del cliente, {saldo} lo que debe,
//   {negocio} nombre del negocio, {pago} alias/CBU (si no hay, esa línea no se envía)
export const PLANTILLA_POR_DEFECTO =
  'Hola {cliente}, te escribo de {negocio}. Tu saldo pendiente es de {saldo}.\n' +
  'Podés abonar con: {pago} .\n' +
  '¡Gracias!';

// Texto del recordatorio que se le manda al cliente
export function mensajeRecordatorio(cliente) {
  const cfg = configNegocio();
  const negocio = nombreNegocio();
  const primero = String(cliente.nombre || '').trim().split(/\s+/)[0];

  if (!(Number(cliente.saldo) > 0)) {
    return `Hola ${primero}, te escribo de ${negocio}. Tu cuenta está al día. ¡Gracias!`;
  }

  const pago = String(cfg.datos_pago || '').trim().replace(/[.\s]+$/, '');
  const plantilla = cfg.mensaje || PLANTILLA_POR_DEFECTO;

  return plantilla
    .split('\n')
    .filter((linea) => pago || !/\{pago\}/i.test(linea))
    .join('\n')
    .replace(/\{(cliente|nombre)\}/gi, () => primero)
    .replace(/\{saldo\}/gi, () => dinero(cliente.saldo))
    .replace(/\{negocio\}/gi, () => negocio)
    .replace(/\{pago\}/gi, () => pago)
    .trim();
}

export function esCelular() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
}


const CLAVE_MODO_WA = 'whatsapp_modo';

export function getModoWhatsApp() {
  try {
    return localStorage.getItem(CLAVE_MODO_WA) === 'app' ? 'app' : 'web';
  } catch {
    return 'web';
  }
}

export function setModoWhatsApp(modo) {
  try {
    localStorage.setItem(CLAVE_MODO_WA, modo === 'app' ? 'app' : 'web');
  } catch {
    
  }
}



export function armarLinkWhatsApp(cliente, texto) {
  const num = telefonoParaWhatsApp(cliente.telefono);
  if (!num) return null;
  const msg = encodeURIComponent(texto ?? mensajeRecordatorio(cliente));
  if (esCelular()) return `https://wa.me/${num}?text=${msg}`;
  return getModoWhatsApp() === 'app'
    ? `whatsapp://send?phone=${num}&text=${msg}`
    : `https://web.whatsapp.com/send?phone=${num}&text=${msg}`;
}

export function abrirWhatsApp(url) {
  if (url.startsWith('whatsapp:')) {
    window.location.href = url;
    return;
  }
  const w = window.open('', 'whatsapp');
  if (!w) {
    window.alert('El navegador bloqueó la ventana de WhatsApp. Permitila para este sitio.');
    return;
  }
  try { w.opener = null; } catch { /* ya era una pestaña de WhatsApp: no hace falta */ }
  w.location.href = url;
  try { w.focus(); } catch { /* algunos navegadores no dejan enfocar */ }
}