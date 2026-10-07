import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCliente, getMovimientos, crearVenta, crearPago, editarVenta,
  anularVenta, anularPago, eliminarVenta, eliminarPago,
  restaurarVenta, restaurarPago,
  archivarCliente, restaurarCliente ,
  editarCliente, eliminarCliente, dinero, fecha, registrarAviso,
} from './api';
import { useCatalogo } from './CatalogoContext';
import { flechasEnFormulario } from './teclado';
import ThemeToggle from './ThemeToggle';
import { hace, diasUltimoAviso, armarLinkWhatsApp, abrirWhatsApp } from './cobranza';

const filaVacia = { producto: '', cantidad: '1', precio_unitario: '', total: '' };

// Fecha de hoy como AAAA-MM-DD en hora LOCAL (toISOString usaría UTC y de noche daría "mañana")
function hoy() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Modo de carga de compra recordado en este navegador: 'rapida' (monto + descripción) o 'productos' (planilla)
const CLAVE_MODO_COMPRA = 'compra_modo';
function modoCompraGuardado() {
  try {
    return localStorage.getItem(CLAVE_MODO_COMPRA) === 'productos' ? 'productos' : 'rapida';
  } catch {
    return 'rapida';
  }
}
function guardarModoCompra(m) {
  try { localStorage.setItem(CLAVE_MODO_COMPRA, m); } catch { /* sin localStorage: no pasa nada */ }
}

// Compra rápida = una venta con un solo ítem de cantidad 1 (la descripción es el nombre del ítem)
function esRapida(m) {
  const items = m.items || [];
  return m.tipo === 'venta' && items.length === 1 && Number(items[0].cantidad) === 1;
}

function itemsRapida(monto, descripcion) {
  return [{ producto: descripcion.trim() || 'Compra', cantidad: 1, precio_unitario: Number(monto) }];
}

// Selector "Rápida / Con productos"
function SelectorModoCompra({ valor, onCambiar }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[['rapida', 'Rápida'], ['productos', 'Con productos']].map(([v, etiqueta]) => (
        <button
          key={v}
          type="button"
          onClick={() => onCambiar(v)}
          className={`py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
            valor === v
              ? 'bg-slate-800 dark:bg-marca-600 border-slate-800 dark:border-marca-600 text-white'
              : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
          }`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

function actualizarFila(filas, i, campo, valor) {
  const nuevas = [...filas];
  const f = { ...nuevas[i], [campo]: valor };
  const cant = Number(f.cantidad) || 0;
  const precio = Number(f.precio_unitario) || 0;
  const total = Number(f.total) || 0;

  if (campo === 'cantidad' || campo === 'precio_unitario') {
    f.total = cant && precio ? String(cant * precio) : '';
  } else if (campo === 'total') {
    f.precio_unitario = cant > 0 ? String((total / cant).toFixed(2)) : f.precio_unitario;
  }
  nuevas[i] = f;
  return nuevas;
}

function filaCompleta(f) {
  return f.producto.trim() && Number(f.cantidad) > 0 && Number(f.precio_unitario) > 0;
}

function enfocar(refs, i, c) {
  setTimeout(() => refs.current[i]?.[c]?.focus(), 0);
}

// Enter: producto -> cantidad -> precio -> producto de la fila siguiente
// (si estás en la última fila y está completa, crea una nueva)
function manejarEnter(filas, setFilas, refs, i, c) {
  if (c < 2) return enfocar(refs, i, c + 1);
  if (i < filas.length - 1) return enfocar(refs, i + 1, 0);

  const f = filas[i];
  if (filaCompleta(f)) {
    setFilas((prev) => [...prev, { ...filaVacia }]);
    enfocar(refs, i + 1, 0);
  } else if (!f.producto.trim()) enfocar(refs, i, 0);
  else if (!(Number(f.cantidad) > 0)) enfocar(refs, i, 1);
  else enfocar(refs, i, 2);
}

function agregarFila(filas, setFilas, refs) {
  setFilas((prev) => [...prev, { ...filaVacia }]);
  enfocar(refs, filas.length, 0);
}

// Minúsculas y sin tildes, para que "cafe" encuentre "Café"
function normalizar(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Coincidencias del catálogo: todas las palabras escritas deben estar en el nombre
// (en cualquier orden). Primero los que empiezan con lo escrito. Máximo 8.
function buscarSugerencias(catalogo, texto) {
  const q = normalizar(texto).trim();
  if (!q) return [];
  const palabras = q.split(/\s+/);
  const puntaje = (n) => {
    if (n.startsWith(q)) return 0;
    const inicios = n.split(/\s+/);
    return palabras.every((w) => inicios.some((x) => x.startsWith(w))) ? 1 : 2;
  };
  return catalogo
    .map((p) => ({ p, n: normalizar(p.nombre) }))
    .filter(({ n }) => palabras.every((w) => n.includes(w)))
    .sort((a, b) => puntaje(a.n) - puntaje(b.n) || a.n.localeCompare(b.n))
    .slice(0, 20)
    .map(({ p }) => p);
}

// Suma un producto a la tabla: si ya está, +1 cantidad; si no, usa la primera fila vacía o agrega una
function sumarProducto(filas, p) {
  const nombre = p.nombre.trim().toLowerCase();
  const i = filas.findIndex((f) => f.producto.trim().toLowerCase() === nombre);
  if (i >= 0) return actualizarFila(filas, i, 'cantidad', String((Number(filas[i].cantidad) || 0) + 1));

  const precio = p.precio != null && Number(p.precio) > 0 ? String(Number(p.precio)) : '';
  const nueva = { producto: p.nombre, cantidad: '1', precio_unitario: precio, total: precio };
  const vacia = filas.findIndex((f) => !f.producto.trim() && !f.precio_unitario);
  if (vacia >= 0) {
    const copia = [...filas];
    copia[vacia] = nueva;
    return copia;
  }
  return [...filas, nueva];
}

function TablaProductos({ filas, catalogo = [], onEditar, onQuitar, onEnter, onAgregar, refsProducto }) {
  const [abierto, setAbierto] = useState(null);   // índice de la fila con el desplegable abierto
  const [resaltado, setResaltado] = useState(-1); // sugerencia marcada con flechas (-1 = ninguna)
  const listaRef = useRef(null);

  const sugerencias =
    abierto !== null && filas[abierto] ? buscarSugerencias(catalogo, filas[abierto].producto) : [];

    // Mantiene visible la sugerencia marcada con las flechas
  useEffect(() => {
    const ul = listaRef.current;
    const li = ul?.children[resaltado];
    if (!ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight)
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight;
  }, [resaltado]);

  function cerrarSugerencias() {
    setAbierto(null);
    setResaltado(-1);
  }

  // Autocompleta producto y precio; el foco pasa a Cantidad
  function elegir(i, p) {
    onEditar(i, 'producto', p.nombre);
    if (p.precio != null && Number(p.precio) > 0) {
      onEditar(i, 'precio_unitario', String(Number(p.precio)));
    }
    cerrarSugerencias();
    enfocar(refsProducto, i, 1);
  }

  // Props extra SOLO para el campo Producto (pisan onChange/onKeyDown de campo())
  const propsProducto = (i) => ({
    autoComplete: 'off',
    onChange: (e) => {
      onEditar(i, 'producto', e.target.value);
      setAbierto(i);
      setResaltado(-1);
    },
    onBlur: cerrarSugerencias,
        onFocus: (e) => {
      e.target.select();
      const texto = filas[i].producto;
      const resuelto = catalogo.some((p) => normalizar(p.nombre) === normalizar(texto));
      // Si hay algo escrito que todavía no es un producto del catálogo, vuelve a mostrar las sugerencias
      if (texto.trim() && !resuelto) {
        setAbierto(i);
        setResaltado(-1);
      }
    },
        onKeyDown: (e) => {
      const hay = abierto === i && sugerencias.length > 0;
      if (hay && e.key === 'ArrowDown') {
        e.preventDefault();
        setResaltado((r) => (r + 1) % sugerencias.length);
      } else if (hay && e.key === 'ArrowUp') {
        e.preventDefault();
        setResaltado((r) => (r <= 0 ? sugerencias.length - 1 : r - 1));
      } else if (hay && e.key === 'Escape') {
        cerrarSugerencias();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (hay && resaltado >= 0) {
          elegir(i, sugerencias[resaltado]);
        } else {
          cerrarSugerencias();
          onEnter(i, 0);
        }
      } else {
        manejarFlechas(e, i, 0);
      }
    },
  });

  // Flechas entre celdas, como en una planilla.
  function manejarFlechas(e, i, c) {
    const { key } = e;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return;

    const irA = (fila, col) => {
      e.preventDefault();
      refsProducto.current[fila]?.[col]?.focus();
    };

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault(); // evita que los campos numéricos suban/bajen el valor
      const fila = key === 'ArrowDown' ? i + 1 : i - 1;
      if (fila >= 0 && fila < filas.length) irA(fila, c);
      return;
    }

    let inicio = null, fin = null;
    try { inicio = e.target.selectionStart; fin = e.target.selectionEnd; } catch { /* campo numérico */ }
    const largo = e.target.value.length;
    const alInicio = inicio === null || (inicio === 0 && fin === 0);
    const alFinal = inicio === null || (inicio === largo && fin === largo);

    if (key === 'ArrowRight' && alFinal) {
      if (c < 3) irA(i, c + 1);
      else if (i < filas.length - 1) irA(i + 1, 0);
    } else if (key === 'ArrowLeft' && alInicio) {
      if (c > 0) irA(i, c - 1);
      else if (i > 0) irA(i - 1, 3);
    }
  }

  const inputCls =
    'w-full min-w-0 border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-marca-500';
  const labelCls = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 sm:hidden mb-0.5';

  const campo = (i, c, nombre) => ({
    ref: (el) => {
      if (!refsProducto.current[i]) refsProducto.current[i] = [];
      refsProducto.current[i][c] = el;
    },
    className: inputCls,
    value: filas[i][nombre],
    enterKeyHint: c < 2 ? 'next' : 'done',
    onChange: (e) => onEditar(i, nombre, e.target.value),
    onFocus: (e) => e.target.select(),
        onKeyDown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter(i, c);
      } else {
        manejarFlechas(e, i, c);
      }
    },
  });

  const botonQuitar = (i, extra) => (
    <button
      type="button"
      onClick={() => onQuitar(i)}
      className={`text-slate-600 dark:text-slate-300 hover:text-red-500 text-xl leading-none transition-colors ${extra}`}
      title="Quitar producto"
    >
      ×
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_70px_110px_120px_28px] gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">
        <span>Producto</span>
        <span>Cant.</span>
        <span>P. unit.</span>
        <span>Total</span>
        <span></span>
      </div>

      {filas.map((f, i) => (
        <div
          key={i}
          className="grid grid-cols-3 gap-2 items-end border-2 border-slate-500 dark:border-slate-600 rounded-lg p-2 sm:border-0 sm:p-0 sm:grid-cols-[minmax(0,1fr)_70px_110px_120px_28px] sm:items-center"
        >
          <div className="col-span-3 sm:col-span-1 flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0 relative">
              <span className={labelCls}>Producto</span>
              <input {...campo(i, 0, 'producto')} {...propsProducto(i)} />
              {abierto === i && sugerencias.length > 0 && (
                <ul
                    ref={listaRef}
                    className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 rounded-lg shadow-lg"
                  >
                  {sugerencias.map((p, idx) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        // mousedown (y no click) + preventDefault: evita que el input pierda el foco antes de elegir
                        onMouseDown={(e) => {
                          e.preventDefault();
                          elegir(i, p);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
                          idx === resaltado
                            ? 'bg-marca-100 dark:bg-marca-900'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block break-words text-slate-800 dark:text-slate-100">{p.nombre}</span>
                          {p.categoria && (
                            <span className="block break-words text-[11px] text-slate-700 dark:text-slate-300">{p.categoria}</span>
                          )}
                        </span>
                        <span className="numero shrink-0 text-slate-600 dark:text-slate-300">
                          {p.precio != null ? dinero(p.precio) : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {botonQuitar(i, 'sm:hidden self-end pb-1')}
          </div>

          <div className="min-w-0">
            <span className={labelCls}>Cant.</span>
            <input type="number" inputMode="decimal" {...campo(i, 1, 'cantidad')} />
          </div>

          <div className="min-w-0">
            <span className={labelCls}>P. unit.</span>
            <input type="number" inputMode="decimal" {...campo(i, 2, 'precio_unitario')} />
          </div>

          <div className="min-w-0">
            <span className={labelCls}>Total</span>
            <input type="number" inputMode="decimal" {...campo(i, 3, 'total')} />
          </div>

          {botonQuitar(i, 'hidden sm:block')}
        </div>
      ))}

      <button
        type="button"
        onClick={onAgregar}
        className="w-full py-2 rounded-lg border border-dashed border-slate-500 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 transition-colors"
      >
        + Agregar producto
      </button>
    </div>
  );
}

export default function Cliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [movs, setMovs] = useState([]);
  const [modo, setModo] = useState(null);
  

  const [filas, setFilas] = useState([{ ...filaVacia }]);
  const refsProducto = useRef([]);

  const [editando, setEditando] = useState(null);
  const [filasEdit, setFilasEdit] = useState([]);
  const [fechaEdicion, setFechaEdicion] = useState('');
  const refsProductoEdit = useRef([]);

  const [compraModo, setCompraModo] = useState(modoCompraGuardado); // 'rapida' | 'productos'
  const [montoRapido, setMontoRapido] = useState('');
  const [descRapida, setDescRapida] = useState('');

  const [editModo, setEditModo] = useState('productos');
  const [montoEdit, setMontoEdit] = useState('');
  const [descEdit, setDescEdit] = useState('');

  const [montoPago, setMontoPago] = useState('');
  const [descPago, setDescPago] = useState('');
  const [fechaCompra, setFechaCompra] = useState(hoy);
  const [fechaPago, setFechaPago] = useState(hoy);
  const [expandidos, setExpandidos] = useState(new Set());
  const [error, setError] = useState('');

  const [editandoCliente, setEditandoCliente] = useState(false);
  const [formCliente, setFormCliente] = useState({ nombre: '', telefono: '', direccion: '', notas: '' });

  const [vista, setVista] = useState('activos'); // 'activos' | 'anulados'
  const [orden, setOrden] = useState('recientes');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'venta' | 'pago'

  const [seleccionandoMovs, setSeleccionandoMovs] = useState(false);
  const [movsSeleccionados, setMovsSeleccionados] = useState(new Set());
  const [procesandoMovs, setProcesandoMovs] = useState(false);

  const { productosActivos: catalogo, alternarCatalogo, registrarDestino } = useCatalogo();


  async function cargar() {
    try {
      const [c, m] = await Promise.all([getCliente(id), getMovimientos(id)]);
      setCliente(c);
      setMovs(m);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { cargar(); }, [id]);

// Mientras haya una compra abierta (nueva o en edición), el catálogo puede sumarle productos
  useEffect(() => {
    if (editando !== null && editModo === 'productos') registrarDestino((p) => setFilasEdit((prev) => sumarProducto(prev, p)));
    else if (editando === null && modo === 'compra' && compraModo === 'productos') registrarDestino((p) => setFilas((prev) => sumarProducto(prev, p)));
    else registrarDestino(null);
    return () => registrarDestino(null);
  }, [modo, compraModo, editando, editModo, registrarDestino]);

  function empezarEdicionCliente() {
    setFormCliente({
      nombre: cliente.nombre ?? '',
      telefono: cliente.telefono ?? '',
      direccion: cliente.direccion ?? '',
      notas: cliente.notas ?? '',
    });
    setEditandoCliente(true);
  }

  async function guardarCliente(e) {
    e.preventDefault();
    try {
      await editarCliente(id, formCliente);
      setEditandoCliente(false);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function eliminar() {
    const deuda = Number(cliente.saldo) > 0
      ? `\n\nOJO: este cliente todavía debe ${dinero(cliente.saldo)}.`
      : '';
    const ok = window.confirm(
      `¿Eliminar a ${cliente.nombre}? Se borran también todas sus compras y pagos. Esto no se puede deshacer.${deuda}`
    );
    if (!ok) return;
    try {
      await eliminarCliente(id);
      navigate(-1);
    } catch (e) {
      setError(e.message);
    }
  }


  async function archivar() {
  const deuda = Number(cliente.saldo) > 0
    ? `\n\nOJO: todavía debe ${dinero(cliente.saldo)}, y dejará de contar en el resumen mientras esté archivado.`
    : '';
  if (!window.confirm(`¿Archivar a ${cliente.nombre}? Desaparece de la lista pero conserva todo su historial y lo podés restaurar.${deuda}`)) return;
  try {
    await archivarCliente(id);
    navigate(-1);
  } catch (e) {
    setError(e.message);
  }
}

  async function restaurar() {
    try {
      await restaurarCliente(id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  
  function abrir(t) {
    setModo(modo === t ? null : t);
    setFilas([{ ...filaVacia }]);
    setMontoRapido('');
    setDescRapida('');
    setMontoPago('');
    setDescPago('');
    setFechaCompra(hoy());
    setFechaPago(hoy());
    cancelarEdicion();
  }

  function cambiarModoCompra(m) {
    setCompraModo(m);
    guardarModoCompra(m);
  }

  function cancelarCompra() {
  setModo(null);
  setFilas([{ ...filaVacia }]);
  setMontoRapido('');
  setDescRapida('');
  setFechaCompra(hoy());
  }

  function cancelarPago() {
    setModo(null);
    setMontoPago('');
    setDescPago('');
    setFechaPago(hoy());
  }

  function editarFilaNueva(i, campo, valor) {
    setFilas((prev) => actualizarFila(prev, i, campo, valor));
  }

  function quitarFilaNueva(i) {
    setFilas((prev) => (prev.length === 1 ? [{ ...filaVacia }] : prev.filter((_, idx) => idx !== i)));
  }

  const totalCompra = filas.reduce((acc, f) => acc + (Number(f.total) || 0), 0);

  async function confirmarCompra() {
    const items = filas.filter(filaCompleta).map((f) => ({
      producto: f.producto.trim(),
      cantidad: Number(f.cantidad),
      precio_unitario: Number(f.precio_unitario),
    }));
    if (items.length === 0) {
      setError('Cargá al menos un producto completo (nombre, cantidad y precio)');
      return;
    }
    try {
      await crearVenta({ cliente_id: Number(id), items, fecha: fechaCompra || undefined });
      setModo(null);
      setFilas([{ ...filaVacia }]);
      setFechaCompra(hoy());
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarCompraRapida(e) {
    e.preventDefault();
    if (!(Number(montoRapido) > 0)) {
      setError('Ingresá un monto mayor a 0');
      return;
    }
    try {
      await crearVenta({
        cliente_id: Number(id),
        items: itemsRapida(montoRapido, descRapida),
        fecha: fechaCompra || undefined,
      });
      setModo(null);
      setMontoRapido('');
      setDescRapida('');
      setFechaCompra(hoy());
      setError('');
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function empezarEdicion(m) {
    setModo(null);
    setEditando(m.id);
    setFechaEdicion(String(m.fecha).slice(0, 10));
    if (esRapida(m)) {
      const nombre = m.items[0].producto;
      setEditModo('rapida');
      setMontoEdit(String(Number(m.monto)));
      setDescEdit(nombre === 'Compra' ? '' : nombre);
    } else {
      setEditModo('productos');
    }
    setFilasEdit(
      (m.items || []).map((it) => ({
        producto: it.producto,
        cantidad: String(Number(it.cantidad)),
        precio_unitario: String(Number(it.precio_unitario)),
        total: String(Number(it.subtotal)),
      }))
    );
  }

  function cancelarEdicion() {
    setEditando(null);
    setFilasEdit([]);
    setFechaEdicion('');
    setEditModo('productos');
    setMontoEdit('');
    setDescEdit('');
  }

  // Pasa de la edición rápida a la planilla, conservando lo que ya estaba escrito
  function editarConPlanilla() {
    setFilasEdit([{
      producto: descEdit.trim() || 'Compra',
      cantidad: '1',
      precio_unitario: montoEdit,
      total: montoEdit,
    }]);
    setEditModo('productos');
  }

  function editarFilaEdicion(i, campo, valor) {
    setFilasEdit((prev) => actualizarFila(prev, i, campo, valor));
  }

  function quitarFilaEdicion(i) {
    setFilasEdit((prev) => (prev.length === 1 ? [{ ...filaVacia }] : prev.filter((_, idx) => idx !== i)));
  }

  const totalEdicion = filasEdit.reduce((acc, f) => acc + (Number(f.total) || 0), 0);

  async function guardarEdicion() {
    let items;
    if (editModo === 'rapida') {
      if (!(Number(montoEdit) > 0)) {
        setError('Ingresá un monto mayor a 0');
        return;
      }
      items = itemsRapida(montoEdit, descEdit);
    } else {
      items = filasEdit.filter(filaCompleta).map((f) => ({
        producto: f.producto.trim(),
        cantidad: Number(f.cantidad),
        precio_unitario: Number(f.precio_unitario),
      }));
      if (items.length === 0) {
        setError('Cargá al menos un producto completo (nombre, cantidad y precio)');
        return;
      }
    }
    try {
      await editarVenta(editando, { items, fecha: fechaEdicion || undefined });
      cancelarEdicion();
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarPago(e) {
    e.preventDefault();
    try {
      await crearPago({
        cliente_id: Number(id),
        monto: Number(montoPago),
        fecha: fechaPago || undefined,
        observacion: descPago.trim() || undefined,
      });
      setModo(null);
      setMontoPago('');
      setDescPago('');
      setFechaPago(hoy());
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function anular(m) {
    if (!window.confirm('¿Anular este movimiento? Quedará en el historial pero no cuenta en el saldo.')) return;
    try {
      if (m.tipo === 'venta') await anularVenta(m.id);
      else await anularPago(m.id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function restaurarMov(m) {
  try {
    if (m.tipo === 'venta') await restaurarVenta(m.id);
    else await restaurarPago(m.id);
    cargar();
  } catch (e) {
    setError(e.message);
  }
}

async function eliminarMov(m) {
  if (!window.confirm('¿Eliminar definitivamente este movimiento? Esto no se puede deshacer.')) return;
  try {
    if (m.tipo === 'venta') await eliminarVenta(m.id);
    else await eliminarPago(m.id);
    cargar();
  } catch (e) {
    setError(e.message);
  }
}

function claveMov(m) {
  return `${m.tipo}-${m.id}`;
}

function toggleSeleccionMov(m) {
  const k = claveMov(m);
  setMovsSeleccionados((prev) => {
    const nuevo = new Set(prev);
    nuevo.has(k) ? nuevo.delete(k) : nuevo.add(k);
    return nuevo;
  });
}

function cancelarSeleccionMovs() {
  setSeleccionandoMovs(false);
  setMovsSeleccionados(new Set());
}

function movsElegidos() {
  return movsVisibles.filter((m) => movsSeleccionados.has(claveMov(m)));
}

async function anularMovsSeleccionados() {
  const elegidos = movsElegidos();
  if (!window.confirm(`¿Anular ${elegidos.length} movimiento(s)? Quedan en el historial pero no cuentan en el saldo.`)) return;
  setProcesandoMovs(true);
  try {
    await Promise.all(elegidos.map((m) => (m.tipo === 'venta' ? anularVenta(m.id) : anularPago(m.id))));
    cancelarSeleccionMovs();
    cargar();
  } catch (e) {
    setError(e.message);
  } finally {
    setProcesandoMovs(false);
  }
}

async function restaurarMovsSeleccionados() {
  const elegidos = movsElegidos();
  setProcesandoMovs(true);
  try {
    await Promise.all(elegidos.map((m) => (m.tipo === 'venta' ? restaurarVenta(m.id) : restaurarPago(m.id))));
    cancelarSeleccionMovs();
    cargar();
  } catch (e) {
    setError(e.message);
  } finally {
    setProcesandoMovs(false);
  }
}

async function eliminarMovsSeleccionados() {
  const elegidos = movsElegidos();
  if (!window.confirm(`¿Eliminar definitivamente ${elegidos.length} movimiento(s)? Esto no se puede deshacer.`)) return;
  setProcesandoMovs(true);
  try {
    await Promise.all(elegidos.map((m) => (m.tipo === 'venta' ? eliminarVenta(m.id) : eliminarPago(m.id))));
    cancelarSeleccionMovs();
    cargar();
  } catch (e) {
    setError(e.message);
  } finally {
    setProcesandoMovs(false);
  }
}

  function toggleExpandido(idVenta) {
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(idVenta) ? nuevo.delete(idVenta) : nuevo.add(idVenta);
      return nuevo;
    });
  }

  // Registra que se le avisó al cliente (para ver "último aviso")
  async function marcarAviso() {
    if (!window.confirm(`¿Registrar que le avisaste a ${cliente.nombre}?`)) return;
    try {
      await registrarAviso(Number(id), 'recordatorio');
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const linkWhatsApp = cliente ? armarLinkWhatsApp(cliente) : null;

  // Historial: filtrado y ordenado
  const cantAnulados = movs.filter((m) => m.anulado).length;

  const clave = (m) => `${String(m.fecha).slice(0, 10)}|${String(m.creado_en)}`;

  const movsVisibles = movs
    .filter((m) => (vista === 'anulados' ? m.anulado : !m.anulado))
    .filter((m) => filtroTipo === 'todos' || m.tipo === filtroTipo)
    .sort((a, b) => {
      if (orden === 'recientes') return clave(b).localeCompare(clave(a));
      if (orden === 'antiguos') return clave(a).localeCompare(clave(b));
      if (orden === 'mayor') return Number(b.monto) - Number(a.monto);
      return Number(a.monto) - Number(b.monto); // 'menor'
    });

  return (
    <div className="min-h-screen fondo-app">
      <header className="cabecera py-4">
          <div className="max-w-3xl mx-auto px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(-1)} className="text-2xl leading-none shrink-0">←</button>
              <h1 className="font-display font-extrabold text-2xl tracking-tight break-words leading-tight">{cliente ? cliente.nombre : 'Cliente'}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <button
                onClick={alternarCatalogo}
                className="text-sm bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-lg transition-colors"
              >
                📦 Catálogo
              </button>
            </div>
          </div>
        </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg">{error}</div>
        )}

        {cliente && (
          <>
            {/* Tarjeta del cliente */}
            <div className="tarjeta p-4">
              {editandoCliente ? (
                <form onSubmit={guardarCliente} className="space-y-3" onKeyDown={flechasEnFormulario}>
                  {[
                    ['nombre', 'Nombre *'],
                    ['telefono', 'Teléfono'],
                    ['direccion', 'Dirección'],
                    ['notas', 'Notas'],
                  ].map(([campo, etiqueta]) => (
                    <label key={campo} className="block text-sm text-slate-600 dark:text-slate-300">
                      {etiqueta}
                      <input
                        className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                        value={formCliente[campo]}
                        onChange={(e) => setFormCliente({ ...formCliente, [campo]: e.target.value })}
                      />
                    </label>
                  ))}
                  <div className="flex gap-2">
                    <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-semibold transition-colors">
                      Guardar cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoCliente(false)}
                      className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center">
                  {cliente.archivado && (
                    <span className="inline-block text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full mb-2">
                      Archivado
                    </span>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-300">Saldo pendiente</p>
                  <p className={`numero font-display text-3xl font-extrabold ${Number(cliente.saldo) > 0 ? 'text-red-500' : 'text-marca-500'}`}>
                    {dinero(cliente.saldo)}
                  </p>
                  <div className="text-sm text-slate-600 dark:text-slate-300 mt-2 space-y-0.5">
                    {cliente.telefono && <p>Tel: {cliente.telefono}</p>}
                    {cliente.direccion && <p>{cliente.direccion}</p>}
                    {cliente.notas && <p className="italic">{cliente.notas}</p>}
                    {!cliente.archivado && (
                      <p className="text-xs pt-1">
                        Último aviso: {diasUltimoAviso(cliente) == null ? 'nunca' : hace(diasUltimoAviso(cliente))}
                      </p>
                    )}
                  </div>
                 <div className="flex justify-center gap-2 mt-4 flex-wrap">
                    {linkWhatsApp && (
                      <a
                        href={linkWhatsApp}
                        onClick={(e) => { e.preventDefault(); abrirWhatsApp(linkWhatsApp); }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    {!cliente.archivado && (
                      <button
                        onClick={marcarAviso}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                      >
                        Marcar aviso enviado
                      </button>
                    )}
                    <button
                      onClick={empezarEdicionCliente}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                    >
                      Editar cliente
                    </button>
                    {cliente.archivado ? (
                      <>
                        <button
                          onClick={restaurar}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 text-white transition-colors"
                        >
                          Restaurar cliente
                        </button>
                        <button
                          onClick={eliminar}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                        >
                          Eliminar definitivamente
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={archivar}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                      >
                        Archivar cliente
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Botones compra / pago */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => abrir('compra')}
                className={`py-3 rounded-xl font-semibold text-white transition-colors ${modo === 'compra' ? 'bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}
              >
                + Compra
              </button>
              <button
                onClick={() => abrir('pago')}
                className={`py-3 rounded-xl font-semibold text-white transition-colors ${modo === 'pago' ? 'bg-marca-700' : 'bg-marca-600 hover:bg-marca-700'}`}
              >
                + Pago
              </button>
            </div>

           {modo === 'compra' && (
            <div className="tarjeta p-4 space-y-3 min-h-[220px]">
              <SelectorModoCompra valor={compraModo} onCambiar={cambiarModoCompra} />
              {compraModo === 'rapida' ? (
                <form onSubmit={confirmarCompraRapida} className="space-y-3" onKeyDown={flechasEnFormulario}>
                  <label className="block text-sm text-slate-600 dark:text-slate-300">
                    Monto *
                    <input
                      type="number" inputMode="decimal" autoFocus
                      className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                      value={montoRapido}
                      onChange={(e) => setMontoRapido(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm text-slate-600 dark:text-slate-300">
                    Descripción (opcional)
                    <input
                      className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                      value={descRapida}
                      onChange={(e) => setDescRapida(e.target.value)}
                      placeholder="Ej: Mercadería, carne, arreglo..."
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                    Fecha de la compra
                    <input
                      type="date"
                      max={hoy()}
                      value={fechaCompra}
                      onChange={(e) => setFechaCompra(e.target.value)}
                      className="border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2.5 rounded-lg font-semibold transition-colors">
                      Confirmar compra
                    </button>
                    <button
                      type="button"
                      onClick={cancelarCompra}
                      className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
              <>
                <TablaProductos
                  filas={filas}
                  catalogo={catalogo}
                  onEditar={editarFilaNueva}
                  onQuitar={quitarFilaNueva}
                  onEnter={(i, c) => manejarEnter(filas, setFilas, refsProducto, i, c)}
                  onAgregar={() => agregarFila(filas, setFilas, refsProducto)}
                  refsProducto={refsProducto}
                />
                <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                  Fecha de la compra
                  <input
                    type="date"
                    max={hoy()}
                    value={fechaCompra}
                    onChange={(e) => setFechaCompra(e.target.value)}
                    className="border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
                  />
                </label>
                <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 dark:border-slate-600">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Total compra</span>
                  <span className="numero font-bold text-lg text-slate-800 dark:text-slate-100">{dinero(totalCompra)}</span>
                </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmarCompra}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Confirmar compra
                </button>
                <button
                  type="button"
                  onClick={cancelarCompra}
                  className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
              </div>
              </>
              )}
              </div>
            )}

            {modo === 'pago' && (
              <form onSubmit={confirmarPago} onKeyDown={flechasEnFormulario} className="tarjeta p-4 space-y-3 min-h-[220px] flex flex-col justify-center">
                <label className="block text-sm text-slate-600 dark:text-slate-300">
                  Monto pagado *
                  <input
                    type="number" inputMode="decimal" autoFocus
                    className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                  />
                </label>
                <label className="block text-sm text-slate-600 dark:text-slate-300">
                  Descripción (opcional)
                  <input
                    className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                    value={descPago}
                    onChange={(e) => setDescPago(e.target.value)}
                    placeholder="Ej: Efectivo, transferencia..."
                  />
                </label>
                {Number(cliente.saldo) > 0 && (
                  <button
                    type="button"
                    onClick={() => setMontoPago(String(Number(cliente.saldo)))}
                    className="w-full text-sm font-semibold py-2 rounded-lg border border-marca-500 text-marca-600 dark:text-marca-400 hover:bg-marca-50 dark:hover:bg-marca-900 transition-colors"
                  >
                    Pagar todo ({dinero(cliente.saldo)})
                  </button>
                )}
                <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                  Fecha del pago
                  <input
                    type="date"
                    max={hoy()}
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
                  />
                </label>
                <div className="flex gap-2">
                  <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-semibold transition-colors">
                    Guardar pago
                  </button>
                  <button
                    type="button"
                    onClick={cancelarPago}
                    className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Encabezado del historial */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-slate-700 dark:text-slate-200">
                {vista === 'activos' ? 'Historial' : 'Movimientos anulados'}
              </h2>
              {(cantAnulados > 0 || vista === 'anulados') && (
                <button
                  onClick={() => { setVista(vista === 'activos' ? 'anulados' : 'activos'); cancelarSeleccionMovs(); }}
                  className="text-xs px-3 py-1.5 rounded-full border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 transition-colors"
                >
                  {vista === 'activos' ? `Ver anulados (${cantAnulados})` : '← Volver al historial'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {[['todos', 'Todos'], ['venta', 'Compras'], ['pago', 'Pagos']].map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  onClick={() => setFiltroTipo(valor)}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
                    filtroTipo === valor
                      ? 'bg-marca-600 border-marca-600 text-white'
                      : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="text-xs border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
              >
                <option value="recientes">Más recientes</option>
                <option value="antiguos">Más antiguos</option>
                <option value="mayor">Mayor monto</option>
                <option value="menor">Menor monto</option>
              </select>
              <button
                onClick={() => (seleccionandoMovs ? cancelarSeleccionMovs() : setSeleccionandoMovs(true))}
                className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
                  seleccionandoMovs
                    ? 'bg-marca-600 border-marca-600 text-white'
                    : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
                }`}
              >
                {seleccionandoMovs ? 'Cancelar' : 'Seleccionar'}
              </button>
            </div>
          </div>

          {seleccionandoMovs && (
            <div className="flex items-center justify-between gap-2 bg-slate-800 dark:bg-slate-700 text-white p-3 rounded-xl sticky top-2 z-10 shadow-lg">
              <span className="text-sm font-medium">
                {movsSeleccionados.size === 0 ? 'Tocá un movimiento para seleccionarlo' : `${movsSeleccionados.size} seleccionado${movsSeleccionados.size !== 1 ? 's' : ''}`}
              </span>
              <div className="flex gap-2">
                {vista === 'anulados' ? (
                  <>
                    <button
                      onClick={restaurarMovsSeleccionados}
                      disabled={procesandoMovs || movsSeleccionados.size === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={eliminarMovsSeleccionados}
                      disabled={procesandoMovs || movsSeleccionados.size === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Eliminar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={anularMovsSeleccionados}
                    disabled={procesandoMovs || movsSeleccionados.size === 0}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Anular
                  </button>
                )}
              </div>
            </div>
          )}

            {/* Lista */}
            <ul className="space-y-2">
              {movsVisibles.map((m) => {
                const cantidadItems = (m.items || []).length;
                const expandido = expandidos.has(m.id);
                const itemsVisibles = expandido ? m.items : (m.items || []).slice(0, 3);

                return (<li
                  key={claveMov(m)}
                  onClick={() => seleccionandoMovs && editando !== m.id && toggleSeleccionMov(m)}
                  className={`tarjeta-chica p-3 ${
                    seleccionandoMovs ? 'cursor-pointer' : ''
                  } ${
                    seleccionandoMovs && movsSeleccionados.has(claveMov(m))
                      ? 'border-marca-500 ring-2 ring-marca-200 dark:ring-marca-900'
                      : ''
                  }`}
                >
                  {m.tipo === 'venta' && editando === m.id ? (
                    <div className="space-y-3">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Editando compra</p>
                      {editModo === 'rapida' ? (
                        <div className="space-y-3" onKeyDown={flechasEnFormulario}>
                          <label className="block text-sm text-slate-600 dark:text-slate-300">
                            Monto *
                            <input
                              type="number" inputMode="decimal" autoFocus
                              className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                              value={montoEdit}
                              onChange={(e) => setMontoEdit(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarEdicion(); } }}
                            />
                          </label>
                          <label className="block text-sm text-slate-600 dark:text-slate-300">
                            Descripción (opcional)
                            <input
                              className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                              value={descEdit}
                              onChange={(e) => setDescEdit(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarEdicion(); } }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={editarConPlanilla}
                            className="text-xs text-marca-600 dark:text-marca-400 underline"
                          >
                            Editar con la planilla de productos
                          </button>
                        </div>
                      ) : (
                      <TablaProductos
                        filas={filasEdit}
                        catalogo={catalogo}
                        onEditar={editarFilaEdicion}
                        onQuitar={quitarFilaEdicion}
                        onEnter={(i, c) => manejarEnter(filasEdit, setFilasEdit, refsProductoEdit, i, c)}
                        onAgregar={() => agregarFila(filasEdit, setFilasEdit, refsProductoEdit)}
                        refsProducto={refsProductoEdit}
                      />
                      )}
                      <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                        Fecha de la compra
                        <input
                          type="date"
                          max={hoy()}
                          value={fechaEdicion}
                          onChange={(e) => setFechaEdicion(e.target.value)}
                          className="border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
                        />
                      </label>
                      <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 dark:border-slate-600">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Total</span>
                        <span className="numero font-bold text-slate-800 dark:text-slate-100">{dinero(editModo === 'rapida' ? Number(montoEdit) || 0 : totalEdicion)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={guardarEdicion} className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-semibold transition-colors">
                          Guardar cambios
                        </button>
                        <button onClick={cancelarEdicion} className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-2">
                      {seleccionandoMovs && (
                        <input
                          type="checkbox"
                          checked={movsSeleccionados.has(claveMov(m))}
                          onChange={() => toggleSeleccionMov(m)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 accent-marca-600 shrink-0 mt-0.5"
                        />
                      )}
                      <div className={`flex-1 ${m.anulado ? 'opacity-50' : ''}`}>
                        {esRapida(m) ? (
                          <p className={`font-medium text-slate-800 dark:text-slate-100 ${m.anulado ? 'line-through' : ''}`}>
                            {m.items[0].producto}
                          </p>
                        ) : m.tipo === 'venta' ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-medium text-slate-800 dark:text-slate-100 ${m.anulado ? 'line-through' : ''}`}>Compra</p>
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                {cantidadItems} producto{cantidadItems !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <ul className="text-xs text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
                              {itemsVisibles.map((it, idx) => (
                                <li key={idx}>{Number(it.cantidad)} x {it.producto} — {dinero(it.subtotal)}</li>
                              ))}
                            </ul>
                            {cantidadItems > 3 && (
                              <button
                                onClick={() => toggleExpandido(m.id)}
                                className="text-xs text-marca-600 dark:text-marca-400 underline mt-1"
                              >
                                {expandido ? 'Ver menos' : `Ver los ${cantidadItems} productos`}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <p className={`font-medium text-slate-800 dark:text-slate-100 ${m.anulado ? 'line-through' : ''}`}>Pago recibido</p>
                            {m.observacion && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{m.observacion}</p>
                            )}
                          </>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{fecha(m.fecha)}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`numero font-bold ${m.anulado ? 'line-through opacity-50' : ''} ${m.tipo === 'venta' ? 'text-red-500' : 'text-marca-500'}`}>
                          {m.tipo === 'venta' ? '+' : '−'}{dinero(m.monto)}
                        </p>

                        {!seleccionandoMovs && (
                          m.anulado ? (
                            <div className="flex items-center gap-2 justify-end mt-2">
                              <button
                                onClick={() => restaurarMov(m)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 text-white transition-colors"
                              >
                                Restaurar
                              </button>
                              <button
                                onClick={() => eliminarMov(m)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end mt-1">
                              {m.tipo === 'venta' && (
                                <button
                                  onClick={() => empezarEdicion(m)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                onClick={() => anular(m)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                              >
                                Anular
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </li>
                );
              })}
              {movsVisibles.length === 0 && (
                <p className="text-center text-slate-600 dark:text-slate-300 py-6">
                  {vista === 'anulados' ? 'No hay movimientos anulados.' : 'No hay movimientos para mostrar.'}
                </p>
              )}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}