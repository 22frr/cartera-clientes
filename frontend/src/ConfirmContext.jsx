import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Ventana de confirmación con el estilo de la app (reemplaza a window.confirm).
//
//   const confirmar = useConfirmar();
//   if (!(await confirmar({
//     titulo: '¿Archivar a Claudia?',
//     texto: 'Conserva su historial y se puede restaurar.',
//     boton: 'Archivar',
//     peligro: false,      // true = botón rojo (acciones irreversibles)
//   }))) return;

const ConfirmContext = createContext(null);

export function useConfirmar() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmar debe usarse dentro de <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null);
  const botonCancelar = useRef(null);
  const botonAceptar = useRef(null);

  const confirmar = useCallback(
    (opciones) =>
      new Promise((resolve) => {
        setEstado((prev) => {
          prev?.resolve(false);
          return { ...opciones, resolve };
        });
      }),
    []
  );

  function cerrar(valor) {
    estado?.resolve(valor);
    setEstado(null);
  }

  // Escape cancela. En acciones irreversibles el foco arranca en "Cancelar" (más seguro).
  useEffect(() => {
    if (!estado) return;
    (estado.peligro ? botonCancelar : botonAceptar).current?.focus();
    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        estado.resolve(false);
        setEstado(null);
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [estado]);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {estado && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60"
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
            className="tarjeta toast-entra w-full max-w-sm p-5 space-y-4"
          >
            <div className="space-y-1.5">
              <h2 id="confirmar-titulo" className="font-display font-extrabold text-xl text-slate-900 dark:text-white break-words">
                {estado.titulo}
              </h2>
              {estado.texto && (
                <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{estado.texto}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                ref={botonAceptar}
                type="button"
                onClick={() => cerrar(true)}
                className={`flex-1 text-white py-2.5 rounded-lg font-semibold transition-colors ${
                  estado.peligro
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700'
                }`}
              >
                {estado.boton || 'Aceptar'}
              </button>
              <button
                ref={botonCancelar}
                type="button"
                onClick={() => cerrar(false)}
                className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
