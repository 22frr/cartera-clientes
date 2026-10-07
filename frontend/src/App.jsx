import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getClientes, getResumen, crearCliente, archivarCliente, restaurarCliente, eliminarCliente, dinero, logout, nombreNegocio } from './api';
import { useCatalogo } from './CatalogoContext';
import ThemeToggle from './ThemeToggle';
import { flechasEnFormulario } from './teclado';
import { DIAS_ATRASADO, esAtrasado } from './cobranza';
import LineaCobranza from './LineaCobranza';
import AvisarDeudores from './AvisarDeudores';

// Minúsculas y sin tildes, para que "jose" encuentre "José"
function normalizar(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Como useState, pero recuerda el valor mientras la pestaña esté abierta.
// Así, al entrar a un cliente y volver con "←", los filtros siguen como estaban.
function useEstadoPersistido(clave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(clave);
      return guardado !== null ? guardado : valorInicial;
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(clave, valor);
    } catch {
      /* sin sessionStorage: no pasa nada */
    }
  }, [clave, valor]);

  return [valor, setValor];
}

const ESTADOS = [
  ['todos', 'Todos'],
  ['deben', 'Deben'],
  ['atrasados', 'Atrasados'],
  ['aldia', 'Al día'],
];

const ORDENES = [
  ['az', 'Nombre A → Z'],
  ['za', 'Nombre Z → A'],
  ['mayor', 'Mayor deuda'],
  ['menor', 'Menor deuda'],
  ['antiguedad', 'Más tiempo sin pagar'],
  ['recientes', 'Más recientes'],
];

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const verArchivados = searchParams.get('archivados') === '1';
  const { alternarCatalogo } = useCatalogo();

  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useEstadoPersistido('clientes_estado', 'todos');
  const [orden, setOrden] = useEstadoPersistido('clientes_orden', 'az');
  const [avisando, setAvisando] = useState(false);
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

  // ---------- Filtros y orden ----------
  const q = normalizar(busqueda).trim();

  const visibles = useMemo(() => {
    const lista = clientes
      .filter((c) => !q || normalizar(c.nombre).includes(q))
      .filter((c) => {
        const saldo = Number(c.saldo);
        if (estado === 'deben') return saldo > 0;
        if (estado === 'atrasados') return esAtrasado(c);
        if (estado === 'aldia') return saldo <= 0;
        return true;
      });
    const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    return [...lista].sort((a, b) => {
      if (orden === 'za') return porNombre(b, a);
      if (orden === 'mayor') return Number(b.saldo) - Number(a.saldo) || porNombre(a, b);
      if (orden === 'menor') return Number(a.saldo) - Number(b.saldo) || porNombre(a, b);
      if (orden === 'recientes') return Number(b.id) - Number(a.id);
      if (orden === 'antiguedad')
        return (b.dias_sin_pagar ?? -1) - (a.dias_sin_pagar ?? -1) || Number(b.saldo) - Number(a.saldo) || porNombre(a, b);
      return porNombre(a, b); // 'az'
    });
  }, [clientes, q, estado, orden]);

  const hayFiltros = busqueda !== '' || estado !== 'todos' || orden !== 'az';
  const cantAtrasados = clientes.filter(esAtrasado).length;
  // A quiénes se les puede avisar: los que deben y se ven con el filtro actual
  const conDeuda = visibles.filter((c) => Number(c.saldo) > 0);

  function limpiarFiltros() {
    setBusqueda('');
    setEstado('todos');
    setOrden('az');
  }

  if (avisando) {
    return (
      <AvisarDeudores
        clientes={conDeuda}
        onCerrar={() => { setAvisando(false); cargar(); }}
      />
    );
  }

  return (
    <div className="min-h-screen fondo-app">
      <header className="cabecera py-4">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {verArchivados && (
              <button onClick={salirDeArchivados} className="text-2xl leading-none">←</button>
            )}
            <div>
              <h1 className="font-display font-extrabold text-2xl tracking-tight">
                {verArchivados ? 'Clientes archivados' : 'FIADO$'}
              </h1>
              <p className="text-xs text-marca-100">
                {verArchivados ? 'Podés restaurarlos o eliminarlos' : nombreNegocio()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={alternarCatalogo}
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
          <div className="grid grid-cols-[1.7fr_1fr_1fr] sm:grid-cols-3 gap-3">
            <Tarjeta titulo="Te deben" valor={dinero(resumen.total_deuda)} destacado />
            <Tarjeta titulo="Con deuda" valor={resumen.clientes_con_deuda} />
            <Tarjeta titulo="Clientes" valor={resumen.total_clientes} />
          </div>
        )}

        {!verArchivados && !mostrarForm && estado !== 'atrasados' && cantAtrasados > 0 && (
          <button
            type="button"
            onClick={() => { setEstado('atrasados'); setOrden('antiguedad'); }}
            className="w-full text-left text-sm rounded-xl px-4 py-3 bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
          >
            ⚠️ {cantAtrasados === 1 ? '1 cliente lleva' : `${cantAtrasados} clientes llevan`} más de {DIAS_ATRASADO} días sin pagar.{' '}
            <span className="underline font-medium">Ver</span>
          </button>
        )}

        <div className="flex gap-2">
          {!mostrarForm && (
            <input
              className="flex-1 min-w-0 border-2 border-slate-400 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-marca-500"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          )}
          {!verArchivados && !mostrarForm && (
            <button
              className="bg-marca-600 hover:bg-marca-700 text-white px-4 rounded-lg font-semibold transition-colors shrink-0"
              onClick={() => setMostrarForm(true)}
            >
              + Cliente
            </button>
          )}
        </div>

        {!mostrarForm && (
          <div className="space-y-2">
            {/* Estado + orden */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1.5">
                {ESTADOS.map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    onClick={() => setEstado(valor)}
                    className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
                      estado === valor
                        ? 'bg-marca-600 border-marca-600 text-white'
                        : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="text-xs border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-marca-500"
              >
                {ORDENES.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
              </select>
            </div>

            {/* Contador + acciones */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {visibles.length} cliente{visibles.length !== 1 ? 's' : ''}
                </span>
                {hayFiltros && (
                  <button
                    onClick={limpiarFiltros}
                    className="underline text-marca-600 dark:text-marca-400"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!verArchivados && conDeuda.length > 0 && (
                  <button
                    onClick={() => setAvisando(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-marca-600 hover:border-marca-700 bg-marca-600 hover:bg-marca-700 text-white transition-colors"
                  >
                    📣 Avisar ({conDeuda.length})
                  </button>
                )}
                {!verArchivados && (
                  <button
                    onClick={irAArchivados}
                    className="text-xs px-3 py-1.5 rounded-full border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 transition-colors"
                  >
                    Ver archivados
                  </button>
                )}
                <button
                  onClick={() => (seleccionando ? cancelarSeleccion() : setSeleccionando(true))}
                  className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
                    seleccionando
                      ? 'bg-marca-600 border-marca-600 text-white'
                      : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
                  }`}
                >
                  {seleccionando ? 'Cancelar' : 'Seleccionar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {mostrarForm && (
          <form onSubmit={guardar} className="tarjeta p-4 space-y-3" onKeyDown={flechasEnFormulario}>
            <Campo label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
            <Campo label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
            <Campo label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
            <Campo label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />
            <div className="flex gap-2">
              <button className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2 rounded-lg font-semibold transition-colors">
                Guardar cliente
              </button>
              <button
                type="button"
                onClick={() => setMostrarForm(false)}
                className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
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
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-marca-600 hover:bg-marca-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={eliminarSeleccionados}
                    disabled={procesando || seleccionados.size === 0}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <button
                  onClick={archivarSeleccionados}
                  disabled={procesando || seleccionados.size === 0}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                    className={`w-full text-left tarjeta p-4 flex justify-between items-center gap-3 min-h-[104px] transition-colors ${
                      seleccionados.has(c.id)
                        ? 'border-marca-500 ring-2 ring-marca-200 dark:ring-marca-900'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(c.id)}
                        onChange={() => toggleSeleccion(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 accent-marca-600 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-lg text-slate-900 dark:text-white break-words leading-tight">{c.nombre}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
                          {c.telefono}
                          {!verArchivados && <LineaCobranza c={c} conTelefono={!!c.telefono} />}
                        </p>
                      </div>
                    </div>
                    <p className={`numero font-bold shrink-0 ${Number(c.saldo) > 0 ? 'text-red-500' : 'text-marca-500'}`}>
                      {dinero(c.saldo)}
                    </p>
                  </button>
                ) : (
                  <Link
                    to={`/cliente/${c.id}${verArchivados ? '?desde=archivados' : ''}`}
                    className="tarjeta p-4 flex justify-between items-center gap-3 min-h-[104px] hover:-translate-y-0.5 hover:border-marca-600 transition-transform"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-marca-100 dark:bg-marca-900 text-marca-700 dark:text-marca-300 flex items-center justify-center font-display font-bold shrink-0">
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-lg text-slate-900 dark:text-white break-words leading-tight">{c.nombre}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
                          {c.telefono}
                          {!verArchivados && <LineaCobranza c={c} conTelefono={!!c.telefono} />}
                        </p>
                      </div>
                    </div>
                    <p className={`numero font-bold shrink-0 ${Number(c.saldo) > 0 ? 'text-red-500' : 'text-marca-500'}`}>
                      {dinero(c.saldo)}
                    </p>
                  </Link>
                )}
              </li>
            ))}
            {visibles.length === 0 && (
              <p className="text-center text-slate-600 dark:text-slate-300 py-6">No hay clientes para mostrar.</p>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}

function Tarjeta({ titulo, valor, destacado }) {
  // El tamaño baja según el largo del número, para que nunca se corte en el celular
  const largo = String(valor).length;
  const tam = largo > 12 ? 'text-sm' : largo > 9 ? 'text-base' : 'text-xl';
  return (
    <div className={`tarjeta p-3 text-center min-w-0 ${
      destacado
        ? 'bg-red-50 dark:bg-red-950'
        : ''
    }`}>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-tight">{titulo}</p>
      <p className={`numero font-display ${tam} sm:text-2xl font-extrabold whitespace-nowrap ${destacado ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
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
        className="mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
