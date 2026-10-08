import { dinero, nombreNegocio } from './api';

// Un cliente es "atrasado" si debe y pasaron más de estos días desde su último pago
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

// Días desde el último aviso (recordatorio o cuenta), o null si nunca se le avisó
export function diasUltimoAviso(c) {
  const avisos = [c.dias_ultimo_recordatorio, c.dias_ultima_cuenta].filter((d) => d != null);
  return avisos.length ? Math.min(...avisos) : null;
}

// Código de área que se agrega cuando el teléfono está guardado sin él (ej. "412-3456")
export const CODIGO_AREA_POR_DEFECTO = '342';

// Devuelve el número listo para wa.me (549 + área + número) o null si no se puede armar
export function telefonoParaWhatsApp(tel) {
  let n = String(tel ?? '').replace(/\D/g, '');
  if (!n) return null;

  if (n.startsWith('54')) {
    n = n.slice(2);
    if (n.startsWith('9')) n = n.slice(1);
  }
  if (n.startsWith('0')) n = n.slice(1);

  // Sin código de área: "4123456" o "15 4123456"
  if (n.length === 9 && n.startsWith('15')) n = n.slice(2);
  if (n.length === 7) n = CODIGO_AREA_POR_DEFECTO + n;

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

// Texto del recordatorio que se le manda al cliente
export function mensajeRecordatorio(cliente) {
  const nombre = String(cliente.nombre || '').trim().split(/\s+/)[0];
  const negocio = nombreNegocio();
  const saldo = Number(cliente.saldo);
  return saldo > 0
    ? `Hola ${nombre}, te escribo de ${negocio}. Tu saldo pendiente es de ${dinero(saldo)}. ¡Gracias!`
    : `Hola ${nombre}, te escribo de ${negocio}. Tu cuenta está al día. ¡Gracias!`;
}

// ¿Es un celular? (ahí wa.me abre la app de WhatsApp sin problemas)
export function esCelular() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
}

// En la compu hay dos formas de abrir el chat:
//  'web' -> WhatsApp Web, en el navegador (recarga la pestaña en cada chat)
//  'app' -> la aplicación de WhatsApp instalada en la compu (abre cada chat en la misma
//           ventana, sin pestañas nuevas ni recargas)
// Se guarda en este navegador. Por defecto 'web', que funciona sin instalar nada.
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
    /* sin localStorage: no pasa nada */
  }
}

// Link de WhatsApp con el mensaje armado, o null si el cliente no tiene un teléfono válido.
export function armarLinkWhatsApp(cliente) {
  const num = telefonoParaWhatsApp(cliente.telefono);
  if (!num) return null;
  const texto = encodeURIComponent(mensajeRecordatorio(cliente));
  if (esCelular()) return `https://wa.me/${num}?text=${texto}`;
  return getModoWhatsApp() === 'app'
    ? `whatsapp://send?phone=${num}&text=${texto}`
    : `https://web.whatsapp.com/send?phone=${num}&text=${texto}`;
}

// Abre el chat. Con la app instalada se entrega el link al programa (la página queda como está);
// con WhatsApp Web se reutiliza siempre la misma pestaña en vez de abrir una nueva cada vez.
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
