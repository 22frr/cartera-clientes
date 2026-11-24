import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getClientes, getResumen, crearCliente, archivarCliente, restaurarCliente, eliminarCliente, dinero, nombreNegocio } from './api';
import Cabecera, { AccionesCabecera } from './Cabecera';
import { useToast, AvisoForm } from './ToastContext';
import { useConfirmar } from './ConfirmContext';
import { flechasEnFormulario } from './teclado';
import { DIAS_ATRASADO, esAtrasado, NIVELES, nivelDeuda } from './cobranza';
import LineaCobranza from './LineaCobranza';
import AvisarDeudores from './AvisarDeudores';
import ImportarExcel from './ImportarExcel';
import { exportarClientes } from './excel';
import MenuMas from './MenuMas';
import { alCambiarDatos } from './sync';
import { LOGO_MERCADO_PAGO } from './logoMercadoPago';

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

// De lo más urgente a lo menos
const ESTADOS = [
  ['todos', 'Todos'],
  ['atrasados', 'Atrasados'],
  ['deben', 'Deben'],
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
  const toast = useToast();
  const confirmar = useConfirmar();

  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useEstadoPersistido('clientes_estado', 'todos');
  const [orden, setOrden] = useEstadoPersistido('clientes_orden', 'az');
  const [avisando, setAvisando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '', notas: '' });
  const [error, setError] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [importando, setImportando] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [procesando, setProcesando] = useState(false);
  const [cargando, setCargando] = useState(true);


  const cargar = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([getClientes(verArchivados), getResumen()]);
      setClientes(c);
      setResumen(r);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [verArchivados]);

  // oxlint-disable-next-line react/set-state-in-effect -- Al cambiar de lista se descartan datos de la consulta anterior.
  useEffect(() => { setClientes([]); setCargando(true); cargar(); }, [cargar]);
  // Si otra pestaña cambió algo (pago, compra, anulación...), se recarga la lista
  useEffect(() => alCambiarDatos(cargar), [cargar]);
  // Otras pantallas avisan cuando algo cambia (ej. "Deshacer" de un archivado hecho en la ficha)
  useEffect(() => {
    const alCambiar = () => cargar();
    window.addEventListener('clientes-cambiaron', alCambiar);
    return () => window.removeEventListener('clientes-cambiaron', alCambiar);
  }, [cargar]);

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
    if (!form.nombre.trim()) {
      setErrorForm('Escribí el nombre del cliente');
      return;
    }
    setErrorForm('');
    try {
      await crearCliente(form);
      toast.ok(`${form.nombre.trim()} agregado`);
      setForm({ nombre: '', telefono: '', direccion: '', notas: '' });
      setMostrarForm(false);
      cargar();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function toggleSeleccion(idCliente) {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(idCliente)) nuevo.delete(idCliente);
      else nuevo.add(idCliente);
      return nuevo;
    });
  }

  async function archivarSeleccionados() {
    const n = seleccionados.size;
    const ok = await confirmar({
      titulo: n === 1 ? '¿Archivar 1 cliente?' : `¿Archivar ${n} clientes?`,
      texto: 'Conservan su historial y se pueden restaurar cuando quieras.',
      boton: 'Archivar',
    });
    if (!ok) return;
    setProcesando(true);
    try {
      const ids = [...seleccionados];
      await Promise.all(ids.map((id) => archivarCliente(id)));
      cancelarSeleccion();
      toast.deshacer(
        ids.length === 1 ? 'Cliente archivado' : `${ids.length} clientes archivados`,
        async () => {
          await Promise.all(ids.map((id) => restaurarCliente(id)));
          cargar();
        }
      );
      cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function restaurarSeleccionados() {
    setProcesando(true);
    try {
      const n = seleccionados.size;
      await Promise.all([...seleccionados].map((id) => restaurarCliente(id)));
      cancelarSeleccion();
      toast.ok(n === 1 ? 'Cliente restaurado' : `${n} clientes restaurados`);
      cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarSeleccionados() {
    const cant = seleccionados.size;
    const ok = await confirmar({
      titulo: cant === 1 ? '¿Eliminar 1 cliente?' : `¿Eliminar ${cant} clientes?`,
      texto: 'Se borran también todas sus compras y pagos. Esto no se puede deshacer.',
      boton: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    setProcesando(true);
    try {
      const n = seleccionados.size;
      await Promise.all([...seleccionados].map((id) => eliminarCliente(id)));
      cancelarSeleccion();
      toast.ok(n === 1 ? 'Cliente eliminado' : `${n} clientes eliminados`);
      cargar();
    } catch (e) {
      toast.error(e.message);
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
  const todosSeleccionados = visibles.length > 0 && visibles.every((c) => seleccionados.has(c.id));
  const nombreOrden = ORDENES.find(([v]) => v === orden)?.[1] ?? '';

  function alternarTodos() {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(visibles.map((c) => c.id)));
  }

  async function exportar() {
    try {
      await exportarClientes(visibles, { archivados: verArchivados });
      toast.ok(`Excel generado con ${visibles.length} cliente${visibles.length !== 1 ? 's' : ''}`);
    } catch (e) {
      toast.error(e.message || 'No se pudo generar el Excel');
    }
  }

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
      <Cabecera
        variante={verArchivados ? 'archivados' : 'principal'}
        onVolver={verArchivados ? salirDeArchivados : undefined}
        titulo={verArchivados ? 'Clientes archivados' : 'Tus clientes'}
        subtitulo={verArchivados ? 'Podés restaurarlos o eliminarlos' : nombreNegocio()}
        acciones={<AccionesCabecera menu />}
      />

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {importando && (
          <ImportarExcel tipo="clientes" onCerrar={() => setImportando(false)} onListo={cargar} />
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg">{error}</div>
        )}

        {resumen && !verArchivados && <ResumenCard resumen={resumen} />}

        {/* Buscador + orden + nuevo cliente */}
        {!mostrarForm && (
          <div className="flex gap-2">
            <input
              className="flex-1 min-w-0 border-2 border-slate-400 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-marca-500"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {/* El select real va encima (invisible): abre el selector nativo del celular */}
            <label
              title={`Orden: ${nombreOrden}`}
              className={`relative shrink-0 w-11 rounded-lg border-2 flex items-center justify-center focus-within:ring-2 focus-within:ring-marca-500 ${
                orden !== 'az'
                  ? 'border-marca-600 bg-marca-100 dark:bg-marca-900 text-marca-700 dark:text-marca-300'
                  : 'border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />
              </svg>
              <select
                aria-label="Ordenar clientes"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {ORDENES.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
              </select>
            </label>
            {!verArchivados && (
              <button
                className="bg-marca-600 hover:bg-marca-700 text-white px-4 rounded-lg font-semibold transition-colors shrink-0"
                onClick={() => setMostrarForm(true)}
              >
                + Cliente
              </button>
            )}
          </div>
        )}

        {/* Filtros: un solo botón dividido en partes */}
        {!mostrarForm && (
          <div className="flex rounded-full border-2 border-slate-500 dark:border-slate-600 overflow-hidden">
            {ESTADOS.map(([valor, etiqueta], i) => {
              const alerta = valor === 'atrasados' && cantAtrasados > 0;
              return (
                <button
                  key={valor}
                  onClick={() => setEstado(valor)}
                  aria-pressed={estado === valor}
                  title={alerta ? `Más de ${DIAS_ATRASADO} días sin pagar` : undefined}
                  className={`flex-1 whitespace-nowrap text-xs px-2 py-2 transition-colors ${
                    i > 0 ? 'border-l-2 border-slate-500 dark:border-slate-600' : ''
                  } ${
                    estado === valor
                      ? 'bg-marca-600 text-white'
                      : alerta
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {etiqueta}{alerta ? ` (${cantAtrasados})` : ''}
                </button>
              );
            })}
          </div>
        )}




        {!mostrarForm && (
          <div className="flex items-center justify-end gap-2">
            {hayFiltros && (
              <div className="mr-auto min-w-0 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <span className="whitespace-nowrap">{visibles.length} de {clientes.length} clientes.</span>
                <button onClick={limpiarFiltros} className="underline text-marca-600 dark:text-marca-400 whitespace-nowrap">
                  Limpiar
                </button>
              </div>
            )}
            <button
              onClick={() => (seleccionando ? cancelarSeleccion() : setSeleccionando(true))}
              className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
                seleccionando
                  ? 'bg-amber-400 border-amber-500 text-slate-900'
                  : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
              }`}
            >
              {seleccionando ? 'Cancelar' : 'Seleccionar'}
            </button>
            <MenuMas
              items={[

                !verArchivados && conDeuda.length > 0 && {
                  icono: '📣',
                  titulo: `Avisar a deudores (${conDeuda.length})`,
                  detalle: 'Mandar recordatorios por WhatsApp',
                  onClick: () => setAvisando(true),
                },
                !verArchivados && {
                  icono: '📥',
                  titulo: 'Importar desde Excel',
                  detalle: 'Cargar clientes, con su saldo inicial',
                  onClick: () => setImportando(true),
                },
                {
                  icono: '📤',
                  titulo: 'Exportar a Excel',
                  detalle: visibles.length > 0 ? 'Descargar la lista que estás viendo' : 'No hay clientes para exportar',
                  deshabilitado: visibles.length === 0,
                  onClick: exportar,
                },
                !verArchivados && {
                  icono: '🗂️',
                  titulo: 'Ver archivados',
                  detalle: 'Clientes que ocultaste de la lista',
                  onClick: irAArchivados,
                },
              ]}
            />
          </div>
        )}

        {mostrarForm && (
          <form onSubmit={guardar} className="tarjeta p-4 space-y-3" onKeyDown={flechasEnFormulario}>
            {errorForm && <AvisoForm texto={errorForm} />}
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
                onClick={() => { setMostrarForm(false); setErrorForm(''); }}
                className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!mostrarForm && seleccionando && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-800 dark:bg-slate-700 text-white p-3 rounded-xl sticky top-2 z-10 shadow-lg">
            <span className="text-sm font-medium">
              {seleccionados.size === 0 ? 'Elegí clientes' : `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
            </span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={alternarTodos}
                disabled={visibles.length === 0}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-white/40 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {todosSeleccionados ? 'Ninguno' : 'Todos'}
              </button>
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
                    className={`w-full text-left tarjeta px-4 py-3 flex justify-between items-center gap-3 min-h-[92px] sm:min-h-[76px] transition-colors ${
                      seleccionados.has(c.id)
                        ? 'border-amber-500 ring-2 ring-amber-300 bg-amber-100 dark:bg-amber-900/40 dark:ring-amber-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(c.id)}
                        onChange={() => toggleSeleccion(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 accent-amber-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-lg text-slate-900 dark:text-white break-words leading-tight">{c.nombre}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
                          {c.telefono}
                          {!verArchivados && <LineaCobranza c={c} conTelefono={!!c.telefono} />}
                        </p>
                      </div>
                    </div>
                    <p className={`numero font-bold shrink-0 ${NIVELES[nivelDeuda(c)].monto}`}>
                      {dinero(c.saldo)}
                    </p>
                  </button>
                ) : (
                  <Link
                    to={`/cliente/${c.id}${verArchivados ? '?desde=archivados' : ''}`}
                    className="tarjeta px-4 py-3 flex justify-between items-center gap-3 min-h-[92px] sm:min-h-[76px] hover:-translate-y-0.5 hover:border-marca-600 transition-transform"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <InsigniaDias c={c} archivado={verArchivados} />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-lg text-slate-900 dark:text-white break-words leading-tight">{c.nombre}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
                          {c.telefono}
                          {!verArchivados && <LineaCobranza c={c} conTelefono={!!c.telefono} />}
                        </p>
                      </div>
                    </div>
                    <p className={`numero font-bold shrink-0 ${NIVELES[nivelDeuda(c)].monto}`}>
                      {dinero(c.saldo)}
                    </p>
                  </Link>
                )}
              </li>
            ))}
            {cargando && [0, 1, 2].map((i) => (
              <li key={i} aria-hidden="true" className="tarjeta px-4 py-3 flex justify-between items-center gap-3 min-h-[92px] sm:min-h-[76px] animate-pulse">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
              </li>
            ))}

            {!cargando && !error && clientes.length === 0 && (
              verArchivados ? (
                <li className="tarjeta p-6 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl" aria-hidden="true">🗂️</div>
                  <p className="font-display font-extrabold text-xl text-slate-900 dark:text-white">No hay clientes archivados</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Los clientes que archives aparecen acá. Podés restaurarlos cuando quieras.
                  </p>
                </li>
              ) : (
                <li className="tarjeta p-6 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-marca-100 dark:bg-marca-900 flex items-center justify-center text-2xl" aria-hidden="true">👥</div>
                  <p className="font-display font-extrabold text-xl text-slate-900 dark:text-white">Cargá tu primer cliente</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Acá vas a ver quién te debe, hace cuánto no paga y a quién avisarle.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <button
                      onClick={() => setMostrarForm(true)}
                      className="bg-marca-600 hover:bg-marca-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      + Agregar cliente
                    </button>
                    <button
                      onClick={() => setImportando(true)}
                      className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 transition-colors"
                    >
                      📥 Importar desde Excel
                    </button>
                  </div>
                </li>
              )
            )}

            {!cargando && clientes.length > 0 && visibles.length === 0 && (
              <li className="tarjeta p-6 text-center space-y-3">
                <p className="font-display font-extrabold text-xl text-slate-900 dark:text-white">Ningún cliente coincide</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">Probá con otro nombre o cambiá el filtro.</p>
                <button
                  onClick={limpiarFiltros}
                  className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500 transition-colors"
                >
                  Limpiar filtros
                </button>
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}

// Círculo a la izquierda de cada cliente: días sin pagar (con el color del nivel de deuda),
// ✓ si está al día. En archivados no hay seguimiento de cobranza, así que muestra la inicial.
function InsigniaDias({ c, archivado }) {
  const base = `w-12 h-12 rounded-full flex flex-col items-center justify-center leading-none shrink-0 ${NIVELES[nivelDeuda(c)].avatar}`;

  if (archivado) {
    return <div className={`${base} font-display font-bold text-lg`}>{c.nombre.charAt(0).toUpperCase()}</div>;
  }
  if (!(Number(c.saldo) > 0)) {
    return <div className={`${base} text-2xl font-bold`} title="Al día">✓</div>;
  }
  if (c.dias_sin_pagar == null) {
    return <div className={`${base} text-xl font-bold`} title="Sin pagos registrados">—</div>;
  }
  const d = c.dias_sin_pagar;
  return (
    <div className={base} title={`Sin pagar ${d === 1 ? 'hace 1 día' : `hace ${d} días`}`}>
      <span className={`numero font-display font-extrabold ${String(d).length > 3 ? 'text-sm' : 'text-lg'}`}>{d}</span>
      <span className="text-[11px] font-semibold mt-0.5">{d === 1 ? 'día' : 'días'}</span>
    </div>
  );
}

const NOMBRES_MEDIO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
  sin_medio: 'Sin especificar',
};

const EMOJIS_MEDIO = { efectivo: '💵', transferencia: '🏦', tarjeta: '💳' };

// Mercado Pago usa el logo (imagen); los demás, emoji. Caja de ancho fijo para que todo quede alineado.
function IconoMedio({ medio }) {
  return (
    <span aria-hidden="true" className="w-6 shrink-0 flex items-center justify-center leading-none">
      {medio === 'mercadopago'
        ? <img src={LOGO_MERCADO_PAGO} alt="" className="w-6 h-4 object-contain" />
        : EMOJIS_MEDIO[medio]}
    </span>
  );
}
// Una sola tarjeta: lo que te deben + (abajo) cobrado y fiado de hoy.
// Al tocar la parte de abajo se despliega el cobrado por medio de pago.
function ResumenCard({ resumen }) {
  const [abierto, setAbierto] = useState(false);
  const hoy = resumen.hoy;
  const medios = hoy ? Object.entries(hoy.por_medio) : [];
  const n = Number(resumen.total_clientes);

  return (
    <div className="tarjeta overflow-hidden">
      <div className="p-3 text-center bg-red-50 dark:bg-red-950">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-tight">Te deben</p>
        <p className="numero font-display text-2xl font-extrabold whitespace-nowrap text-red-500">
          {dinero(resumen.total_deuda)}
        </p>
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {Number(resumen.clientes_con_deuda)} con deuda · {n} cliente{n !== 1 ? 's' : ''}
        </p>
      </div>

      {hoy && (
        <div className="border-t-2 border-slate-900 dark:border-slate-500">
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            className="w-full flex items-center gap-3 px-3 py-2 text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">Cobrado hoy</p>
              <p className="numero font-display text-base font-extrabold whitespace-nowrap text-marca-600 dark:text-marca-400">
                {dinero(hoy.cobrado)}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">Fiado hoy</p>
              <p className="numero font-display text-base font-extrabold whitespace-nowrap text-red-500">
                {dinero(hoy.fiado)}
              </p>
            </div>
            <span aria-hidden="true" className={`shrink-0 text-slate-700 dark:text-slate-300 transition-transform ${abierto ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {abierto && (
            <ul className="px-3 pb-2 pt-2 border-t-2 border-slate-300 dark:border-slate-600 space-y-1 text-sm text-slate-800 dark:text-slate-100">
              {medios.length === 0 && (
                <li className="text-slate-700 dark:text-slate-300">Todavía no cobraste nada hoy.</li>
              )}
              {medios.map(([medio, total]) => (
                <li key={medio} className="flex justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <IconoMedio medio={medio} />
                    {NOMBRES_MEDIO[medio] ?? medio}
                  </span>
                  <span className="numero font-bold whitespace-nowrap">{dinero(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
