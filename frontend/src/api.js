function getToken() {
  return localStorage.getItem('token');
}

async function pedir(url, opciones = {}) {
  const token = getToken();
  const headers = { ...(opciones.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...opciones, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('negocio');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error || 'Error en el servidor');
  return datos;
}

// Auth
export async function login(usuario, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password }),
  });
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error || 'Error al iniciar sesión');
  localStorage.setItem('token', datos.token);
  localStorage.setItem('negocio', datos.negocio);
  return datos;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('negocio');
}

export function estaLogueado() {
  return !!getToken();
}

export function nombreNegocio() {
  return localStorage.getItem('negocio') || '';
}

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

// Movimientos
export const getMovimientos = (id) => pedir(`/api/clientes/${id}/movimientos`);

export const crearVenta = (venta) =>
  pedir('/api/ventas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(venta),
  });

export const anularVenta = (id) => pedir(`/api/ventas/${id}/anular`, { method: 'PATCH' });

export const crearPago = (pago) =>
  pedir('/api/pagos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pago),
  });

export const anularPago = (id) => pedir(`/api/pagos/${id}/anular`, { method: 'PATCH' });

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

export const editarVenta = (id, datos) =>
  pedir(`/api/ventas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  
  export const editarCliente = (id, datos) =>
  pedir(`/api/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

export const eliminarCliente = (id) =>
  pedir(`/api/clientes/${id}`, { method: 'DELETE' });

export const eliminarVenta = (id) => pedir(`/api/ventas/${id}`, { method: 'DELETE' });
export const eliminarPago = (id) => pedir(`/api/pagos/${id}`, { method: 'DELETE' });
export const archivarCliente = (id) => pedir(`/api/clientes/${id}/archivar`, { method: 'PATCH' });
export const restaurarCliente = (id) => pedir(`/api/clientes/${id}/restaurar`, { method: 'PATCH' });
export const restaurarVenta = (id) => pedir(`/api/ventas/${id}/restaurar`, { method: 'PATCH' });
export const restaurarPago = (id) => pedir(`/api/pagos/${id}/restaurar`, { method: 'PATCH' });

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

export const importarProductos = (productos) =>
  pedir('/api/productos/importar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productos }),
  });