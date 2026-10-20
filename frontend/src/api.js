import { avisarCambio } from './sync';

function getToken() {
  return localStorage.getItem('token');
}

// Deja un mensaje para mostrarlo como aviso en la pantalla de login (sobrevive a la recarga)
function avisoParaLogin(texto) {
  try { sessionStorage.setItem('aviso_login', texto); } catch { /* sin sessionStorage: no pasa nada */ }
}

function borrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('negocio');
  localStorage.removeItem('negocio_config');
}

async function pedir(url, opciones = {}) {
  const token = getToken();
  const headers = { ...(opciones.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...opciones, headers });
  } catch {
    throw new Error('Sin conexión con el servidor. Revisá tu internet.');
  }

  if (res.status === 401) {
    borrarSesion();
    avisoParaLogin('Tu sesión expiró. Ingresá de nuevo.');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  let datos = {};
  try { datos = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) throw new Error(datos.error || 'Error en el servidor');

  // Toda modificación (POST, PUT, PATCH, DELETE) avisa a las otras pestañas
  const metodo = (opciones.method || 'GET').toUpperCase();
  if (metodo !== 'GET' && !url.startsWith('/api/productos')) avisarCambio();

  return datos;
}

// Auth
export async function login(usuario, password) {
  let res;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    });
  } catch {
    throw new Error('Sin conexión con el servidor. Revisá tu internet.');
  }
  let datos = {};
  try { datos = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) throw new Error(datos.error || 'Error al iniciar sesión');
  localStorage.setItem('token', datos.token);
  localStorage.setItem('negocio', datos.negocio);
  return datos;
}

export function logout() {
  borrarSesion();
  avisoParaLogin('Cerraste sesión. ¡Hasta pronto!');
}

export function estaLogueado() {
  return !!getToken();
}

export function nombreNegocio() {
  return localStorage.getItem('negocio') || '';
}

// Configuración del negocio (código de área, datos de pago).
// Se guarda en este navegador para poder leerla al instante al armar mensajes de WhatsApp.
function guardarConfigLocal(n) {
  try {
    if (n.nombre) localStorage.setItem('negocio', n.nombre);
      localStorage.setItem('negocio_config', JSON.stringify({
      codigo_area: n.codigo_area || '',
      datos_pago: n.datos_pago || '',
      mensaje: n.mensaje_recordatorio || '',
    }));
  } catch { /* sin localStorage: no pasa nada */ }
}

export function configNegocio() {
  try {
    return JSON.parse(localStorage.getItem('negocio_config')) || {};
  } catch {
    return {};
  }
}

export const getNegocio = () => pedir('/api/negocio');

// Se llama al entrar a la app. Si falla (sin conexión) se usa lo último guardado.
export async function cargarConfigNegocio() {
  try {
    guardarConfigLocal(await getNegocio());
  } catch { /* se usa la copia guardada */ }
}

export async function guardarNegocio(datos) {
  const r = await pedir('/api/negocio', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  guardarConfigLocal(r);
  return r;
}

export const cambiarClave = (actual, nueva) =>
  pedir('/api/negocio/clave', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actual, nueva }),
  });

// Clientes
export const getClientes = (archivados = false) =>
  pedir(`/api/clientes${archivados ? '?archivados=1' : ''}`);
export const getCliente = (id) => pedir(`/api/clientes/${id}`);
export const getResumen = () => pedir('/api/resumen');

export const crearCliente = (cliente) =>
  pedir('/api/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cliente),
  });

export const editarCliente = (id, datos) =>
  pedir(`/api/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

export const eliminarCliente = (id) =>
  pedir(`/api/clientes/${id}`, { method: 'DELETE' });

export const archivarCliente = (id) => pedir(`/api/clientes/${id}/archivar`, { method: 'PATCH' });
export const restaurarCliente = (id) => pedir(`/api/clientes/${id}/restaurar`, { method: 'PATCH' });

// Movimientos
export const getMovimientos = (id) => pedir(`/api/clientes/${id}/movimientos`);

export const crearVenta = (venta) =>
  pedir('/api/ventas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(venta),
  });

export const editarVenta = (id, datos) =>
  pedir(`/api/ventas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

export const anularVenta = (id) => pedir(`/api/ventas/${id}/anular`, { method: 'PATCH' });
export const eliminarVenta = (id) => pedir(`/api/ventas/${id}`, { method: 'DELETE' });
export const restaurarVenta = (id) => pedir(`/api/ventas/${id}/restaurar`, { method: 'PATCH' });

export const crearPago = (pago) =>
  pedir('/api/pagos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pago),
  });

export const anularPago = (id) => pedir(`/api/pagos/${id}/anular`, { method: 'PATCH' });
export const eliminarPago = (id) => pedir(`/api/pagos/${id}`, { method: 'DELETE' });
export const restaurarPago = (id) => pedir(`/api/pagos/${id}/restaurar`, { method: 'PATCH' });

// Productos (catálogo)
export const getProductos = (soloActivos = false) =>
  pedir(`/api/productos${soloActivos ? '?activos=1' : ''}`);

export const buscarPorCodigoBarras = (codigo) =>
  pedir(`/api/productos/codigo/${encodeURIComponent(codigo)}`);

export const crearProducto = (p) =>
  pedir('/api/productos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });

export const editarProducto = (id, p) =>
  pedir(`/api/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });

export const activarProducto = (id, activo) =>
  pedir(`/api/productos/${id}/activo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  });

export const eliminarProducto = (id) =>
  pedir(`/api/productos/${id}`, { method: 'DELETE' });

// probar = true: el servidor simula y devuelve los números sin guardar nada (vista previa)
export const importarProductos = (productos, probar = false) =>
  pedir('/api/productos/importar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productos, probar }),
  });

export const importarClientes = (clientes, probar = false) =>
  pedir('/api/clientes/importar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientes, probar }),
  });

// Avisos de cobranza: registra que se le mandó un recordatorio o la cuenta a un cliente
export const registrarAviso = (clienteId, tipo) =>
  pedir('/api/avisos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente_id: clienteId, tipo }),
  });

// Formato
export const dinero = (valor) =>
  Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

export const fecha = (valor) => {
  const [a, m, d] = String(valor).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};