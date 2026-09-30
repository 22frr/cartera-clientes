import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProductos, crearProducto, editarProducto, activarProducto, eliminarProducto,
  dinero, nombreNegocio,
} from './api';
import ThemeToggle from './ThemeToggle';

const formVacio = { nombre: '', categoria: '', precio: '' };

export default function Catalogo() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null); // id del producto en edición, o null
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');

  async function cargar() {
    try {
      const p = await getProductos();
      setProductos(p);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm(formVacio);
    setMostrarForm(true);
  }

  function abrirEdicion(p) {
    setEditando(p.id);
    setForm({ nombre: p.nombre, categoria: p.categoria || '', precio: p.precio ?? '' });
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
    try {
      if (editando) await editarProducto(editando, datos);
      else await crearProducto(datos);
      cancelar();
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActivo(p) {
    try {
      await activarProducto(p.id, !p.activo);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}" del catálogo? No afecta las compras ya cargadas.`)) return;
    try {
      await eliminarProducto(p.id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const categorias = ['todas', ...new Set(productos.map((p) => p.categoria || 'Sin categoría'))];

  const visibles = productos
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .filter((p) => categoriaFiltro === 'todas' || (p.categoria || 'Sin categoría') === categoriaFiltro);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-marca-700 text-white p-4 shadow-md">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => (window.opener ? window.close() : navigate(-1))} className="text-2xl leading-none">←</button>
            <div>
              <h1 className="font-display font-bold text-xl">Catálogo de productos</h1>
              <p className="text-xs text-marca-100">{nombreNegocio()}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg">{error}</div>
        )}

        {!mostrarForm && (
          <>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-marca-500"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <button
                onClick={abrirNuevo}
                className="bg-marca-600 hover:bg-marca-700 text-white px-4 rounded-lg font-medium transition-colors"
              >
                + Producto
              </button>
            </div>

            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
            >
              {categorias.map((c) => (
                <option key={c} value={c}>{c === 'todas' ? 'Todas las categorías' : c}</option>
              ))}
            </select>
          </>
        )}

        {mostrarForm && (
          <form onSubmit={guardar} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm space-y-3">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Nombre *
              <input
                className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                autoFocus
              />
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Categoría
              <input
                className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ej: Golosinas"
              />
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Precio
              <input
                type="number" inputMode="decimal"
                className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
              />
            </label>
            <div className="flex gap-2">
              <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-medium transition-colors">
                {editando ? 'Guardar cambios' : 'Agregar producto'}
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!mostrarForm && (
          <ul className="space-y-2">
            {visibles.map((p) => (
              <li
                key={p.id}
                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-sm flex justify-between items-center ${!p.activo ? 'opacity-50' : ''}`}
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{p.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {p.categoria || 'Sin categoría'}{p.precio != null ? ` · ${dinero(p.precio)}` : ''}
                    {!p.activo && ' · Inactivo'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => abrirEdicion(p)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-marca-500 hover:text-marca-600 dark:hover:text-marca-400 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(p)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => eliminar(p)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
            {visibles.length === 0 && (
              <p className="text-center text-slate-400 py-6">No hay productos para mostrar.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}