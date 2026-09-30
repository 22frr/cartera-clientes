import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getClientes, getResumen, crearCliente, archivarCliente, restaurarCliente, eliminarCliente, dinero, logout, nombreNegocio } from './api';
import { useNavigate } from 'react-router-dom';
import { abrirCatalogo } from './abrirCatalogo';
import ThemeToggle from './ThemeToggle';


export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const verArchivados = searchParams.get('archivados') === '1';
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloDeuda, setSoloDeuda] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '', notas: '' });
  const [error, setError] = useState('');
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [procesando, setProcesando] = useState(false);

  async function cargar() {
    try {
      const [c, r] = await Promise.all([getClientes(verArchivados), getResumen()]);
      setClientes(c);
      setResumen(r);
      setError('');
    } catch (e) {
      setError('No se pudo conectar con el servidor: ' + e.message);
    }
  }

  useEffect(() => { cargar(); }, [verArchivados]);

  function cancelarSeleccion() {
    setSeleccionando(false);
    setSeleccionados(new Set());
  }

  function irAArchivados() {
    cancelarSeleccion();
    setMostrarForm(false);
    setSearchParams({ archivados: '1' });
  }

  function salirDeArchivados() {
    cancelarSeleccion();
    setMostrarForm(false);
    setSearchParams({});
  }

  async function guardar(e) {
    e.preventDefault();
    try {
      await crearCliente(form);
      setForm({ nombre: '', telefono: '', direccion: '', notas: '' });
      setMostrarForm(false);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleSeleccion(idCliente) {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(idCliente) ? nuevo.delete(idCliente) : nuevo.add(idCliente);
      return nuevo;
    });
  }

  async function archivarSeleccionados() {
    if (!window.confirm(`¿Archivar ${seleccionados.size} cliente(s)? Conservan su historial y se pueden restaurar.`)) return;
    setProcesando(true);
    try {
      await Promise.all([...seleccionados].map((id) => archivarCliente(id)));
      cancelarSeleccion();
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function restaurarSeleccionados() {
    setProcesando(true);
    try {
      await Promise.all([...seleccionados].map((id) => restaurarCliente(id)));
      cancelarSeleccion();
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarSeleccionados() {
    if (!window.confirm(`¿Eliminar definitivamente ${seleccionados.size} cliente(s)? Esto no se puede deshacer.`)) return;
    setProcesando(true);
    try {
      await Promise.all([...seleccionados].map((id) => eliminarCliente(id)));
      cancelarSeleccion();
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  const visibles = clientes
    .filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .filter((c) => !soloDeuda || Number(c.saldo) > 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-marca-700 text-white p-4 shadow-md">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {verArchivados && (
              <button onClick={salirDeArchivados} className="text-2xl leading-none">←</button>
            )}
            <div>
              <h1 className="font-display font-bold text-xl">
                {verArchivados ? 'Clientes archivados' : 'Cartera de clientes'}
              </h1>
              <p className="text-xs text-marca-100">
                {verArchivados ? 'Podés restaurarlos o eliminarlos' : nombreNegocio()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => abrirCatalogo(navigate)}
              className="text-sm bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-lg transition-colors"
            >
              📦 Catálogo
            </button>
            <button
              onClick={() => { logout(); window.location.href = '/login'; }}
              className="text-sm bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-lg transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg">{error}</div>
        )}

        {resumen && !verArchivados && (
          <div className="grid grid-cols-3 gap-3">
            <Tarjeta titulo="Te deben" valor={dinero(resumen.total_deuda)} destacado />
            <Tarjeta titulo="Con deuda" valor={resumen.clientes_con_deuda} />
            <Tarjeta titulo="Clientes" valor={resumen.total_clientes} />
          </div>
        )}

        <div className="flex gap-2">
          {!mostrarForm && (
            <input
              className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-marca-500"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          )}
          {!verArchivados && !mostrarForm && (
            <button
              className="bg-marca-600 hover:bg-marca-700 text-white px-4 rounded-lg font-medium transition-colors"
              onClick={() => setMostrarForm(true)}
            >
              + Cliente
            </button>
          )}
        </div>

        {!mostrarForm && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={soloDeuda} onChange={(e) => setSoloDeuda(e.target.checked)} />
              Mostrar solo los que deben
            </label>
            <div className="flex items-center gap-2">
              {!verArchivados && (
                <button
                  onClick={irAArchivados}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-marca-500 transition-colors"
                >
                  Ver archivados
                </button>
              )}
              <button
                onClick={() => (seleccionando ? cancelarSeleccion() : setSeleccionando(true))}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  seleccionando
                    ? 'bg-marca-600 border-marca-600 text-white'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-marca-500'
                }`}
              >
                {seleccionando ? 'Cancelar' : 'Seleccionar'}
              </button>
            </div>
          </div>
        )}

        {mostrarForm && (
          <form onSubmit={guardar} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm space-y-3">
            <Campo label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
            <Campo label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
            <Campo label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
            <Campo label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />
              <div className="flex gap-2">
                <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-medium transition-colors">
                  Guardar cliente
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
              </div>
          </form>
        )}

        {!mostrarForm && seleccionando && (
          <div className="flex items-center justify-between gap-2 bg-slate-800 dark:bg-slate-700 text-white p-3 rounded-xl sticky top-2 z-10 shadow-lg">
            <span className="text-sm font-medium">
              {seleccionados.size === 0 ? 'Selecciona uno o más clientes' : `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
            </span>
            <div className="flex gap-2">
              {verArchivados ? (
                <>
                  <button
                    onClick={restaurarSeleccionados}
                    disabled={procesando || seleccionados.size === 0}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={eliminarSeleccionados}
                    disabled={procesando || seleccionados.size === 0}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <button
                  onClick={archivarSeleccionados}
                  disabled={procesando || seleccionados.size === 0}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Archivar
                </button>
              )}
            </div>
          </div>
        )}

        {!mostrarForm && (
          <ul className="space-y-2">
            {visibles.map((c) => (
              <li key={c.id}>
                {seleccionando ? (
                  <button
                    onClick={() => toggleSeleccion(c.id)}
                    className={`w-full text-left bg-white dark:bg-slate-800 border p-4 rounded-xl shadow-sm flex justify-between items-center transition-colors ${
                      seleccionados.has(c.id)
                        ? 'border-marca-500 ring-2 ring-marca-200 dark:ring-marca-900'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(c.id)}
                        onChange={() => toggleSeleccion(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 accent-marca-600 shrink-0"
                      />
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{c.nombre}</p>
                        {c.telefono && <p className="text-sm text-slate-400">{c.telefono}</p>}
                      </div>
                    </div>
                    <p className={`numero font-bold ${Number(c.saldo) > 0 ? 'text-red-500' : 'text-marca-500'}`}>
                      {dinero(c.saldo)}
                    </p>
                  </button>
                ) : (
                  <Link
                    to={`/cliente/${c.id}${verArchivados ? '?desde=archivados' : ''}`}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm flex justify-between items-center hover:border-marca-400 dark:hover:border-marca-500 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-marca-100 dark:bg-marca-900 text-marca-700 dark:text-marca-300 flex items-center justify-center font-display font-bold shrink-0">
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{c.nombre}</p>
                        {c.telefono && <p className="text-sm text-slate-400">{c.telefono}</p>}
                      </div>
                    </div>
                    <p className={`numero font-bold ${Number(c.saldo) > 0 ? 'text-red-500' : 'text-marca-500'}`}>
                      {dinero(c.saldo)}
                    </p>
                  </Link>
                )}
              </li>
            ))}
            {visibles.length === 0 && (
              <p className="text-center text-slate-400 py-6">No hay clientes para mostrar.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}

function Tarjeta({ titulo, valor, destacado }) {
  return (
    <div className={`p-3 rounded-xl shadow-sm text-center border ${
      destacado
        ? 'bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    }`}>
      <p className="text-xs text-slate-400">{titulo}</p>
      <p className={`numero text-lg font-bold ${destacado ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
        {valor}
      </p>
    </div>
  );
}

function Campo({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-600 dark:text-slate-300">
      {label}
      <input
        className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}