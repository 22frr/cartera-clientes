import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Avisos chicos que aparecen abajo al centro y se van solos.
// Siempre en el mismo lugar (celular y PC), así nunca se pisan con el panel del catálogo.
//
//   const toast = useToast();
//   toast.ok('Pago guardado');
//   toast.error(e.message);
//   toast.info('Cerraste sesión');
//   toast.deshacer('Compra anulada', () => restaurarVenta(id));

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const MAX_VISIBLES = 3;
const SALIDA_MS = 180;
const DURACION = { ok: 3000, info: 4500, error: 6000, deshacer: 6000 };

const ESTILOS = {
  ok: { caja: 'bg-marca-600 text-white', icono: '✓' },
  error: { caja: 'bg-red-600 text-white', icono: '!' },
  info: { caja: 'bg-slate-800 dark:bg-slate-700 text-white', icono: 'i' },
  deshacer: { caja: 'bg-slate-800 dark:bg-slate-700 text-white', icono: '✓' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const contador = useRef(0);
  const timers = useRef(new Map());

  const quitar = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), SALIDA_MS);
  }, []);

  const mostrar = useCallback((tipo, texto, alDeshacer) => {
    const id = ++contador.current;
    setToasts((prev) =>
      [
        // Si el mismo aviso ya está en pantalla, se reemplaza en vez de apilarse
        ...prev.filter((t) => !(t.tipo === tipo && t.texto === texto && !alDeshacer)),
        { id, tipo, texto, alDeshacer, saliendo: false },
      ].slice(-MAX_VISIBLES)
    );
    timers.current.set(id, setTimeout(() => quitar(id), DURACION[tipo]));
  }, [quitar]);

  const api = useMemo(() => ({
    ok: (texto) => mostrar('ok', texto),
    error: (texto) => mostrar('error', texto || 'Ocurrió un error'),
    info: (texto) => mostrar('info', texto),
    deshacer: (texto, alDeshacer) => mostrar('deshacer', texto, alDeshacer),
  }), [mostrar]);

  function hacerDeshacer(t) {
    quitar(t.id);
    Promise.resolve()
      .then(t.alDeshacer)
      .then(() => mostrar('ok', 'Deshecho'))
      .catch((e) => mostrar('error', e?.message || 'No se pudo deshacer'));
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pt-2 pointer-events-none"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {toasts.map((t) => {
          const est = ESTILOS[t.tipo];
          return (
            <div
              key={t.id}
              role={t.tipo === 'error' ? 'alert' : 'status'}
              className={`toast pointer-events-auto w-full max-w-[380px] flex items-center gap-3 px-3 py-2.5 ${est.caja} ${
                t.saliendo ? 'toast-sale' : 'toast-entra'
              }`}
            >
              <span
                aria-hidden="true"
                className="shrink-0 w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-sm font-extrabold leading-none"
              >
                {est.icono}
              </span>
              <p className="flex-1 min-w-0 text-sm font-semibold leading-snug break-words">{t.texto}</p>
              {t.alDeshacer && (
                <button
                  type="button"
                  onClick={() => hacerDeshacer(t)}
                  className="shrink-0 text-xs font-extrabold px-3 py-1.5 rounded-lg bg-white text-slate-900 border-2 border-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Deshacer
                </button>
              )}
              {t.tipo !== 'ok' && (
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  onClick={() => quitar(t.id)}
                  className="shrink-0 w-7 h-7 rounded-md hover:bg-white/20 text-xl leading-none transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// Mensaje de validación dentro del mismo formulario ("Ingresá un monto mayor a 0")
export function AvisoForm({ texto }) {
  return (
    <div
      role="alert"
      className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-2 border-red-300 dark:border-red-800 p-2.5 rounded-lg text-sm font-semibold"
    >
      {texto}
    </div>
  );
}
