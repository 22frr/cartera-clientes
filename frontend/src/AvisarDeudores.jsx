import { useState } from 'react';
import { registrarAviso, dinero, nombreNegocio } from './api';
import { armarLinkWhatsApp, abrirWhatsApp, mensajeRecordatorio } from './cobranza';
import LineaCobranza from './LineaCobranza';

const tarjetaCls = 'tarjeta';

// Pantalla para mandarle el recordatorio a varios clientes seguidos.
// Flujo: elegir a quiénes -> uno por vez: abrir WhatsApp, enviar, confirmar -> resumen.
// WhatsApp no deja enviar solo desde una página web, así que el "enviar" lo hacés vos;
// acá queda registrado a quién ya se le avisó.
export default function AvisarDeudores({ clientes, onCerrar }) {
  const puedeAvisar = (c) => !!armarLinkWhatsApp(c);

  const [fase, setFase] = useState('elegir'); // 'elegir' | 'enviando' | 'fin'
  const [elegidos, setElegidos] = useState(() => new Set(clientes.filter(puedeAvisar).map((c) => c.id)));
  const [cola, setCola] = useState([]);
  const [indice, setIndice] = useState(0);
  const [abierto, setAbierto] = useState(false); // ya se abrió WhatsApp para el cliente actual
  const [resultados, setResultados] = useState({}); // id -> 'enviado' | 'saltado'
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const elegibles = clientes.filter(puedeAvisar);
  const todosElegidos = elegibles.length > 0 && elegibles.every((c) => elegidos.has(c.id));

  function alternar(id) {
    setElegidos((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  }

  function alternarTodos() {
    setElegidos(todosElegidos ? new Set() : new Set(elegibles.map((c) => c.id)));
  }

  function empezar() {
    const lista = clientes.filter((c) => elegidos.has(c.id));
    if (lista.length === 0) return;
    setCola(lista);
    setIndice(0);
    setAbierto(false);
    setResultados({});
    setError('');
    setFase('enviando');
  }

  const actual = fase === 'enviando' ? cola[indice] : null;

  function pasarAlSiguiente() {
    setAbierto(false);
    setError('');
    if (indice + 1 >= cola.length) setFase('fin');
    else setIndice(indice + 1);
  }

  async function confirmarEnviado() {
    setGuardando(true);
    setError('');
    try {
      await registrarAviso(actual.id, 'recordatorio');
      setResultados((r) => ({ ...r, [actual.id]: 'enviado' }));
      pasarAlSiguiente();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function saltar() {
    setResultados((r) => ({ ...r, [actual.id]: 'saltado' }));
    pasarAlSiguiente();
  }

  function salir() {
    if (fase === 'enviando' && !window.confirm('¿Salir? Los avisos que ya confirmaste quedan registrados.')) return;
    onCerrar();
  }

  const enviados = cola.filter((c) => resultados[c.id] === 'enviado');
  const saltados = cola.filter((c) => resultados[c.id] === 'saltado');
  const sinHacer = cola.filter((c) => !resultados[c.id]);

  return (
    <div className="min-h-screen fondo-app">
      <header className="cabecera p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={salir} className="text-2xl leading-none shrink-0">←</button>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-2xl tracking-tight">Avisar a deudores</h1>
            <p className="text-xs text-marca-100 truncate">{nombreNegocio()}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* ---------- 1) Elegir a quiénes ---------- */}
        {fase === 'elegir' && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Se prepara un mensaje de WhatsApp por cliente. Vos lo enviás desde WhatsApp y acá queda
              registrado a quién ya le avisaste.
            </p>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {elegidos.size} de {clientes.length} seleccionado{elegidos.size !== 1 ? 's' : ''}
              </span>
              <button
                onClick={alternarTodos}
                className="text-xs px-3 py-1.5 rounded-full border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-marca-500 transition-colors"
              >
                {todosElegidos ? 'Quitar a todos' : 'Elegir a todos'}
              </button>
            </div>

            <ul className="space-y-2">
              {clientes.map((c) => {
                const puede = puedeAvisar(c);
                const marcado = elegidos.has(c.id);
                return (
                  <li key={c.id}>
                    <label
                      className={`${tarjetaCls} flex items-center gap-3 p-4 min-h-[84px] transition-colors ${
                        puede ? 'cursor-pointer' : 'opacity-50'
                      } ${marcado ? 'border-marca-500 ring-2 ring-marca-200 dark:ring-marca-900' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={!puede}
                        onChange={() => alternar(c.id)}
                        className="w-5 h-5 accent-marca-600 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-lg text-slate-900 dark:text-white truncate">{c.nombre}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                          {puede ? c.telefono : 'Sin teléfono válido'}
                          <LineaCobranza c={c} conTelefono />
                        </p>
                      </div>
                      <p className="numero font-bold shrink-0 text-red-500">{dinero(c.saldo)}</p>
                    </label>
                  </li>
                );
              })}
              {clientes.length === 0 && (
                <p className="text-center text-slate-600 dark:text-slate-300 py-6">No hay clientes con deuda para avisar.</p>
              )}
            </ul>

            <div className="sticky bottom-0 -mx-4 px-4 py-3 fondo-liso border-t-2 border-slate-300 dark:border-slate-600">
              <button
                onClick={empezar}
                disabled={elegidos.size === 0}
                className="w-full bg-marca-600 hover:bg-marca-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Empezar ({elegidos.size})
              </button>
            </div>
          </>
        )}

        {/* ---------- 2) Uno por uno ---------- */}
        {fase === 'enviando' && actual && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Cliente {indice + 1} de {cola.length}</span>
                <button onClick={() => setFase('fin')} className="underline">Terminar ahora</button>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-marca-600 transition-all"
                  style={{ width: `${(indice / cola.length) * 100}%` }}
                />
              </div>
            </div>

            <div className={`${tarjetaCls} p-5 space-y-4`}>
              <div className="text-center">
                <p className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">{actual.nombre}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{actual.telefono}</p>
                <p className="numero font-display text-3xl font-extrabold text-red-500 mt-2">{dinero(actual.saldo)}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  <LineaCobranza c={actual} />
                </p>
              </div>

              <div className="text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 p-3 text-slate-600 dark:text-slate-300">
                {mensajeRecordatorio(actual)}
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">{error}</div>
              )}

              {!abierto ? (
                <div className="space-y-2">
                  <a
                    href={armarLinkWhatsApp(actual)}
                    onClick={(e) => { e.preventDefault(); abrirWhatsApp(armarLinkWhatsApp(actual)); setAbierto(true); }}
                    className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors"
                  >
                    💬 Abrir WhatsApp
                  </a>
                  <button
                    onClick={saltar}
                    className="w-full py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                  >
                    Saltar este cliente
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-center font-medium text-slate-700 dark:text-slate-200">¿Lo enviaste?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmarEnviado}
                      disabled={guardando}
                      className="flex-1 bg-marca-600 hover:bg-marca-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {guardando ? 'Guardando...' : 'Sí, enviado ✓'}
                    </button>
                    <button
                      onClick={saltar}
                      disabled={guardando}
                      className="px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                    >
                      No, saltar
                    </button>
                  </div>
                  <a
                    href={armarLinkWhatsApp(actual)}
                    onClick={(e) => { e.preventDefault(); abrirWhatsApp(armarLinkWhatsApp(actual)); }}
                    className="block text-center text-xs underline text-slate-600 dark:text-slate-300"
                  >
                    Abrir WhatsApp de nuevo
                  </a>
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- 3) Resumen ---------- */}
        {fase === 'fin' && (
          <div className={`${tarjetaCls} p-5 space-y-4`}>
            <div className="text-center">
              <p className="text-3xl">✅</p>
              <p className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">Listo</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {enviados.length} avisado{enviados.length !== 1 ? 's' : ''}
                {saltados.length > 0 && ` · ${saltados.length} saltado${saltados.length !== 1 ? 's' : ''}`}
                {sinHacer.length > 0 && ` · ${sinHacer.length} sin hacer`}
              </p>
            </div>

            {enviados.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Se les avisó</p>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5">
                  {enviados.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="truncate">{c.nombre}</span>
                      <span className="numero shrink-0 text-slate-600 dark:text-slate-300">{dinero(c.saldo)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {saltados.length + sinHacer.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Sin avisar</p>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                  {[...saltados, ...sinHacer].map((c) => (
                    <li key={c.id} className="truncate">{c.nombre}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onCerrar}
              className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2.5 rounded-lg font-medium transition-colors"
            >
              Volver a la lista
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
