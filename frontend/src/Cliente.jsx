import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCliente, getMovimientos, crearVenta, crearPago, editarVenta,
  anularVenta, anularPago, eliminarVenta, eliminarPago,
  restaurarVenta, restaurarPago,
  editarCliente, eliminarCliente, dinero, fecha, 
} from './api';
import { abrirCatalogo } from './abrirCatalogo';

const filaVacia = { producto: '', cantidad: '1', precio_unitario: '', total: '' };

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

function TablaProductos({ filas, onEditar, onQuitar, onEnter, onAgregar, refsProducto }) {
  const inputCls =
    'w-full min-w-0 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-marca-500';
  const labelCls = 'block text-[11px] font-semibold text-slate-400 sm:hidden mb-0.5';

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
      }
    },
  });

  const botonQuitar = (i, extra) => (
    <button
      type="button"
      onClick={() => onQuitar(i)}
      className={`text-slate-400 hover:text-red-500 text-xl leading-none transition-colors ${extra}`}
      title="Quitar producto"
    >
      ×
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_70px_100px_100px_28px] gap-2 text-xs font-semibold text-slate-400 px-1">
        <span>Producto</span>
        <span>Cant.</span>
        <span>P. unit.</span>
        <span>Total</span>
        <span></span>
      </div>

      {filas.map((f, i) => (
        <div
          key={i}
          className="grid grid-cols-3 gap-2 items-end border border-slate-200 dark:border-slate-700 rounded-lg p-2 sm:border-0 sm:p-0 sm:grid-cols-[minmax(0,1fr)_70px_100px_100px_28px] sm:items-center"
        >
          <div className="col-span-3 sm:col-span-1 flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <span className={labelCls}>Producto</span>
              <input {...campo(i, 0, 'producto')} />
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
        className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-marca-500 hover:text-marca-600 transition-colors"
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
  const refsProductoEdit = useRef([]);

  const [montoPago, setMontoPago] = useState('');
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
    setMontoPago('');
    cancelarEdicion();
  }

  function cancelarCompra() {
  setModo(null);
  setFilas([{ ...filaVacia }]);
  }

  function cancelarPago() {
    setModo(null);
    setMontoPago('');
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
      await crearVenta({ cliente_id: Number(id), items });
      setModo(null);
      setFilas([{ ...filaVacia }]);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function empezarEdicion(m) {
    setModo(null);
    setEditando(m.id);
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
  }

  function editarFilaEdicion(i, campo, valor) {
    setFilasEdit((prev) => actualizarFila(prev, i, campo, valor));
  }

  function quitarFilaEdicion(i) {
    setFilasEdit((prev) => (prev.length === 1 ? [{ ...filaVacia }] : prev.filter((_, idx) => idx !== i)));
  }

  const totalEdicion = filasEdit.reduce((acc, f) => acc + (Number(f.total) || 0), 0);

  async function guardarEdicion() {
    const items = filasEdit.filter(filaCompleta).map((f) => ({
      producto: f.producto.trim(),
      cantidad: Number(f.cantidad),
      precio_unitario: Number(f.precio_unitario),
    }));
    if (items.length === 0) {
      setError('Cargá al menos un producto completo (nombre, cantidad y precio)');
      return;
    }
    try {
      await editarVenta(editando, { items });
      cancelarEdicion();
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarPago(e) {
    e.preventDefault();
    try {
      await crearPago({ cliente_id: Number(id), monto: Number(montoPago) });
      setModo(null);
      setMontoPago('');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-marca-700 text-white p-4 shadow-md">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate(-1)} className="text-2xl leading-none shrink-0">←</button>
              <h1 className="font-display font-bold text-xl truncate">{cliente ? cliente.nombre : 'Cliente'}</h1>
            </div>
            <button
              onClick={() => abrirCatalogo(navigate)}
              className="text-sm bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              📦 Catálogo
            </button>
          </div>
        </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg">{error}</div>
        )}

        {cliente && (
          <>
            {/* Tarjeta del cliente */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm">
              {editandoCliente ? (
                <form onSubmit={guardarCliente} className="space-y-3">
                  {[
                    ['nombre', 'Nombre *'],
                    ['telefono', 'Teléfono'],
                    ['direccion', 'Dirección'],
                    ['notas', 'Notas'],
                  ].map(([campo, etiqueta]) => (
                    <label key={campo} className="block text-sm text-slate-600 dark:text-slate-300">
                      {etiqueta}
                      <input
                        className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                        value={formCliente[campo]}
                        onChange={(e) => setFormCliente({ ...formCliente, [campo]: e.target.value })}
                      />
                    </label>
                  ))}
                  <div className="flex gap-2">
                    <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-medium transition-colors">
                      Guardar cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoCliente(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
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
                  <p className="text-sm text-slate-400">Saldo pendiente</p>
                  <p className={`numero font-display text-3xl font-extrabold ${Number(cliente.saldo) > 0 ? 'text-red-500' : 'text-marca-500'}`}>
                    {dinero(cliente.saldo)}
                  </p>
                  <div className="text-sm text-slate-400 mt-2 space-y-0.5">
                    {cliente.telefono && <p>Tel: {cliente.telefono}</p>}
                    {cliente.direccion && <p>{cliente.direccion}</p>}
                    {cliente.notas && <p className="italic">{cliente.notas}</p>}
                  </div>
                 <div className="flex justify-center gap-2 mt-4 flex-wrap">
                    <button
                      onClick={empezarEdicionCliente}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                    >
                      Editar cliente
                    </button>
                    {cliente.archivado ? (
                      <>
                        <button
                          onClick={restaurar}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 text-white transition-colors"
                        >
                          Restaurar cliente
                        </button>
                        <button
                          onClick={eliminar}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                        >
                          Eliminar definitivamente
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={archivar}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
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
                className={`py-3 rounded-xl font-medium text-white transition-colors ${modo === 'compra' ? 'bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}
              >
                + Compra
              </button>
              <button
                onClick={() => abrir('pago')}
                className={`py-3 rounded-xl font-medium text-white transition-colors ${modo === 'pago' ? 'bg-marca-700' : 'bg-marca-600 hover:bg-marca-700'}`}
              >
                + Pago
              </button>
            </div>

           {modo === 'compra' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm space-y-3 min-h-[220px]">
                <TablaProductos
                  filas={filas}
                  onEditar={editarFilaNueva}
                  onQuitar={quitarFilaNueva}
                  onEnter={(i, c) => manejarEnter(filas, setFilas, refsProducto, i, c)}
                  onAgregar={() => agregarFila(filas, setFilas, refsProducto)}
                  refsProducto={refsProducto}
                />
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Total compra</span>
                  <span className="numero font-bold text-lg text-slate-800 dark:text-slate-100">{dinero(totalCompra)}</span>
                </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmarCompra}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                >
                  Confirmar compra
                </button>
                <button
                  type="button"
                  onClick={cancelarCompra}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
              </div>
              </div>
            )}

            {modo === 'pago' && (
              <form onSubmit={confirmarPago} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm space-y-3 min-h-[220px] flex flex-col justify-center">
                <label className="block text-sm text-slate-600 dark:text-slate-300">
                  Monto pagado *
                  <input
                    type="number" inputMode="decimal" autoFocus
                    className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-medium transition-colors">
                    Guardar pago
                  </button>
                  <button
                    type="button"
                    onClick={cancelarPago}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
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
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-marca-500 transition-colors"
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
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    filtroTipo === valor
                      ? 'bg-marca-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
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
                className="text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
              >
                <option value="recientes">Más recientes</option>
                <option value="antiguos">Más antiguos</option>
                <option value="mayor">Mayor monto</option>
                <option value="menor">Menor monto</option>
              </select>
              <button
                onClick={() => (seleccionandoMovs ? cancelarSeleccionMovs() : setSeleccionandoMovs(true))}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  seleccionandoMovs
                    ? 'bg-marca-600 border-marca-600 text-white'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-marca-500'
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
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={eliminarMovsSeleccionados}
                      disabled={procesandoMovs || movsSeleccionados.size === 0}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Eliminar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={anularMovsSeleccionados}
                    disabled={procesandoMovs || movsSeleccionados.size === 0}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  className={`bg-white dark:bg-slate-800 border p-3 rounded-xl shadow-sm ${
                    seleccionandoMovs ? 'cursor-pointer' : ''
                  } ${
                    seleccionandoMovs && movsSeleccionados.has(claveMov(m))
                      ? 'border-marca-500 ring-2 ring-marca-200 dark:ring-marca-900'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {m.tipo === 'venta' && editando === m.id ? (
                    <div className="space-y-3">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Editando compra</p>
                      <TablaProductos
                        filas={filasEdit}
                        onEditar={editarFilaEdicion}
                        onQuitar={quitarFilaEdicion}
                        onEnter={(i, c) => manejarEnter(filasEdit, setFilasEdit, refsProductoEdit, i, c)}
                        onAgregar={() => agregarFila(filasEdit, setFilasEdit, refsProductoEdit)}
                        refsProducto={refsProductoEdit}
                      />
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Total</span>
                        <span className="numero font-bold text-slate-800 dark:text-slate-100">{dinero(totalEdicion)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={guardarEdicion} className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-medium transition-colors">
                          Guardar cambios
                        </button>
                        <button onClick={cancelarEdicion} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
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
                        {m.tipo === 'venta' ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-medium text-slate-800 dark:text-slate-100 ${m.anulado ? 'line-through' : ''}`}>Compra</p>
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                {cantidadItems} producto{cantidadItems !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <ul className="text-xs text-slate-400 mt-1 space-y-0.5">
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
                          <p className={`font-medium text-slate-800 dark:text-slate-100 ${m.anulado ? 'line-through' : ''}`}>Pago recibido</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{fecha(m.fecha)}</p>
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
                                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 text-white transition-colors"
                              >
                                Restaurar
                              </button>
                              <button
                                onClick={() => eliminarMov(m)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end mt-1">
                              {m.tipo === 'venta' && (
                                <button
                                  onClick={() => empezarEdicion(m)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                onClick={() => anular(m)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
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
                <p className="text-center text-slate-400 py-6">
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