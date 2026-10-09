import { useState } from 'react';
import { useCatalogo } from './CatalogoContext';
import { dinero } from './api';
import ImportarExcel from './ImportarExcel';
import { useConfirmar } from './ConfirmContext';

const formVacio = { nombre: '', categoria: '', precio: '' };

const inputCls =
  'mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500';

// Minúsculas y sin tildes, para que "cafe" encuentre "Café"
function normalizar(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Este componente se usa en tres lugares: el panel fijo (PC ancha),
// la ventana emergente y la pantalla /catalogo del celular.
// El scroll lo maneja quien lo contiene.
export default function CatalogoContenido() {
  const {
    productos, error, crear, editar, cambiarActivo, eliminar,
    puedeAgregar, agregarProducto, refrescar,
  } = useCatalogo();

  const confirmar = useConfirmar();
  const [importando, setImportando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [menuAbierto, setMenuAbierto] = useState(null); // id del producto con acciones desplegadas
  const [agregado, setAgregado] = useState(null);       // id del último producto sumado (para el destello)

  function abrirNuevo() {
    setEditando(null);
    setForm(formVacio);
    setMostrarForm(true);
  }

  function abrirEdicion(p) {
    setEditando(p.id);
    setForm({ nombre: p.nombre, categoria: p.categoria || '', precio: p.precio ?? '' });
    setMenuAbierto(null);
    setMostrarForm(true);
  }

  function cancelar() {
    setMostrarForm(false);
    setEditando(null);
    setForm(formVacio);
  }

  async function guardar(e) {
    e.preventDefault();
    const datos = { nombre: form.nombre, categoria: form.categoria, precio: form.precio || null };
    const ok = await (editando ? editar(editando, datos) : crear(datos));
    if (ok) cancelar();
  }

  async function borrar(p) {
    const ok = await confirmar({
      titulo: `¿Eliminar "${p.nombre}"?`,
      texto: 'Sale del catálogo. No afecta las compras ya cargadas.',
      boton: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    setMenuAbierto(null);
    await eliminar(p.id);
  }

  function sumar(p) {
    agregarProducto(p);
    setAgregado(p.id);
    setTimeout(() => setAgregado((actual) => (actual === p.id ? null : actual)), 700);
  }

  const categorias = ['todas', ...new Set(productos.map((p) => p.categoria || 'Sin categoría'))];

  const q = normalizar(busqueda).trim();
  const palabras = q ? q.split(/\s+/) : [];
  const visibles = productos
    .filter((p) => palabras.every((w) => normalizar(p.nombre).includes(w)))
    .filter((p) => categoriaFiltro === 'todas' || (p.categoria || 'Sin categoría') === categoriaFiltro);

  return (
    <div className="space-y-3">
      {importando && (
        <ImportarExcel tipo="productos" onCerrar={() => setImportando(false)} onListo={refrescar} />
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mt-3">{error}</div>
      )}

      {!mostrarForm && (
        <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 pt-3 space-y-2 fondo-liso">
          <div className="flex gap-2">
            <input
              className="flex-1 min-w-0 border-2 border-slate-400 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-marca-500"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button
              onClick={abrirNuevo}
              className="bg-marca-600 hover:bg-marca-700 text-white px-4 rounded-lg font-semibold transition-colors shrink-0"
            >
              + Producto
            </button>
          </div>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="w-full text-sm border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
          >
            {categorias.map((c) => (
              <option key={c} value={c}>{c === 'todas' ? 'Todas las categorías' : c}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setImportando(true)}
            className="text-xs px-3 py-1.5 rounded-full border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 transition-colors"
          >
            📥 Importar desde Excel
          </button>

          {puedeAgregar && (
            <p className="text-xs rounded-lg px-3 py-2 bg-marca-100 dark:bg-marca-900 text-marca-700 dark:text-marca-300">
              Tocá un producto para sumarlo a la compra que estás armando.
            </p>
          )}
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={guardar} className="mt-3 tarjeta p-4 space-y-3">
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Nombre *
            <input
              className={inputCls}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              autoFocus
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Categoría
            <input
              className={inputCls}
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Ej: Golosinas"
              list="categorias-catalogo"
            />
            <datalist id="categorias-catalogo">
              {categorias.filter((c) => c !== 'todas' && c !== 'Sin categoría').map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Precio
            <input
              type="number" inputMode="decimal"
              className={inputCls}
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-semibold transition-colors">
              {editando ? 'Guardar cambios' : 'Agregar producto'}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!mostrarForm && (
        <ul className="space-y-1.5">
          {visibles.map((p) => {
            const sumable = puedeAgregar && p.activo;
            return (
              <li
                key={p.id}
                className={`border-2 rounded-lg shadow-[1px_1px_0_0_rgb(var(--sombra))] transition-colors ${
                  agregado === p.id
                    ? 'border-marca-500 bg-marca-100 dark:bg-marca-900'
                    : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800'
                } ${!p.activo ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-1 pl-2.5 pr-1 py-1">
                  <button
                    type="button"
                    disabled={!sumable}
                    onClick={() => sumar(p)}
                    className={`flex-1 min-w-0 flex items-center gap-2 text-left ${sumable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold leading-tight break-words text-slate-900 dark:text-white">{p.nombre}</span>
                      <span className="block text-xs font-medium leading-tight text-slate-700 dark:text-slate-300">
                        {p.categoria || 'Sin categoría'}{!p.activo && ' · Inactivo'}
                      </span>
                    </span>
                    {p.precio != null && (
                      <span className="numero shrink-0 text-sm font-bold text-slate-900 dark:text-white">{dinero(p.precio)}</span>
                    )}
                    {sumable && (
                      <span className="shrink-0 w-6 h-6 rounded-full bg-marca-600 text-white flex items-center justify-center text-base leading-none">
                        {agregado === p.id ? '✓' : '+'}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(menuAbierto === p.id ? null : p.id)}
                    className="shrink-0 w-7 h-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Editar, desactivar o eliminar"
                  >
                    ⋯
                  </button>
                </div>

                {menuAbierto === p.id && (
                  <div className="flex gap-2 px-2.5 pb-2">
                    <button
                      onClick={() => abrirEdicion(p)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => { cambiarActivo(p); setMenuAbierto(null); }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => borrar(p)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {visibles.length === 0 && (
            <p className="text-center text-slate-700 dark:text-slate-300 py-6">No hay productos para mostrar.</p>
          )}
        </ul>
      )}
    </div>
  );
}
