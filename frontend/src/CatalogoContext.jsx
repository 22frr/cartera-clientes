import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProductos, crearProducto, editarProducto, activarProducto, eliminarProducto,
} from './api';

// Ancho mínimo de pantalla para mostrar el panel fijo a la derecha SIN tapar el contenido
// (el contenido ocupa 768px centrado + 360px del panel => ~1500px).
// Por debajo de eso, en PC el catálogo se abre como ventana emergente.
export const ANCHO_PANEL = 1500;
const ANCHO_PC = 768;
const CLAVE_PANEL = 'catalogoPanelAbierto';

const CatalogoContext = createContext(null);

export function useCatalogo() {
  const ctx = useContext(CatalogoContext);
  if (!ctx) throw new Error('useCatalogo debe usarse dentro de <CatalogoProvider>');
  return ctx;
}

function panelGuardado() {
  try {
    return localStorage.getItem(CLAVE_PANEL) === '1';
  } catch {
    return false;
  }
}

export function CatalogoProvider({ children }) {
  const navigate = useNavigate();

  const [productos, setProductos] = useState([]);
  const [error, setError] = useState('');
  const [panelAbierto, setPanelAbierto] = useState(panelGuardado);
  const [anchoSuficiente, setAnchoSuficiente] = useState(
    () => window.matchMedia(`(min-width: ${ANCHO_PANEL}px)`).matches
  );

  // "Destino": la compra que se está armando en la ficha del cliente (si hay una abierta)
  const [destinoActivo, setDestinoActivo] = useState(false); // en ESTA ventana
  const [destinoRemoto, setDestinoRemoto] = useState(false); // en OTRA ventana

  const canal = useRef(null);
  const popup = useRef(null);
  const destino = useRef(null);

  // ---------- Panel ----------
  const fijarPanel = useCallback((valor) => {
    setPanelAbierto(valor);
    try {
      localStorage.setItem(CLAVE_PANEL, valor ? '1' : '0');
    } catch {
      /* sin localStorage: no pasa nada */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${ANCHO_PANEL}px)`);
    const alCambiar = (e) => setAnchoSuficiente(e.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  // ---------- Datos ----------
  const recargar = useCallback(async () => {
    try {
      setProductos(await getProductos());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  // Ejecuta una acción sobre el catálogo, recarga y avisa a las otras ventanas
  const ejecutar = useCallback(async (accion) => {
    try {
      await accion();
      await recargar();
      canal.current?.postMessage({ tipo: 'catalogo' });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [recargar]);

  const crear = useCallback((datos) => ejecutar(() => crearProducto(datos)), [ejecutar]);
  const editar = useCallback((id, datos) => ejecutar(() => editarProducto(id, datos)), [ejecutar]);
  const cambiarActivo = useCallback((p) => ejecutar(() => activarProducto(p.id, !p.activo)), [ejecutar]);
  const eliminar = useCallback((id) => ejecutar(() => eliminarProducto(id)), [ejecutar]);

  const productosActivos = useMemo(() => productos.filter((p) => p.activo), [productos]);

  // ---------- Comunicación entre ventanas ----------
  useEffect(() => {
    const c = new BroadcastChannel('cartera-catalogo');
    canal.current = c;
    c.onmessage = (e) => {
      const m = e.data || {};
      if (m.tipo === 'catalogo') recargar();
      else if (m.tipo === 'acoplar') { popup.current = null; fijarPanel(true); }
      else if (m.tipo === 'agregar') destino.current?.(m.producto);
      else if (m.tipo === 'destino') setDestinoRemoto(!!m.activo);
      else if (m.tipo === 'pedirEstado' && destino.current) c.postMessage({ tipo: 'destino', activo: true });
    };
    c.postMessage({ tipo: 'pedirEstado' });
    return () => {
      c.close();
      canal.current = null;
    };
  }, [recargar, fijarPanel]);

  // Avisa a las otras ventanas cuando hay (o deja de haber) una compra abierta
  useEffect(() => {
    canal.current?.postMessage({ tipo: 'destino', activo: destinoActivo });
  }, [destinoActivo]);

  // La ficha del cliente registra acá cómo sumar un producto a la compra abierta (o null)
  const registrarDestino = useCallback((fn) => {
    destino.current = fn;
    setDestinoActivo(!!fn);
  }, []);

  const agregarProducto = useCallback((p) => {
    if (destino.current) destino.current(p);
    else if (destinoRemoto) canal.current?.postMessage({ tipo: 'agregar', producto: p });
  }, [destinoRemoto]);

  // ---------- Abrir / cerrar el catálogo ----------
  const abrirEnVentana = useCallback(() => {
    const w = 480, h = 720;
    const left = window.screenX + window.outerWidth - w - 40;
    const top = window.screenY + 80;
    const v = window.open(
      '/catalogo?ventana=1',
      'catalogo',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (v) {
      popup.current = v;
      fijarPanel(false);
    } else {
      setError('El navegador bloqueó la ventana emergente. Permitila para este sitio.');
    }
  }, [fijarPanel]);

  const alternarCatalogo = useCallback(() => {
    if (popup.current && !popup.current.closed) {
      popup.current.focus();
      return;
    }
    popup.current = null;
    if (anchoSuficiente) fijarPanel(!panelAbierto);
    else if (window.innerWidth >= ANCHO_PC) abrirEnVentana();
    else navigate('/catalogo');
  }, [anchoSuficiente, panelAbierto, fijarPanel, abrirEnVentana, navigate]);

  const cerrarPanel = useCallback(() => fijarPanel(false), [fijarPanel]);

  // Desde la ventana emergente: vuelve a mostrar el panel en la ventana principal
  const acoplar = useCallback(() => {
    canal.current?.postMessage({ tipo: 'acoplar' });
    window.close();
  }, []);

  const valor = {
    productos, productosActivos, error,
    crear, editar, cambiarActivo, eliminar,
    panelAbierto, anchoSuficiente,
    alternarCatalogo, cerrarPanel, abrirEnVentana, acoplar,
    registrarDestino, agregarProducto,
    puedeAgregar: destinoActivo || destinoRemoto,
  };

  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>;
}
