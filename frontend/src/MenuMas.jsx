import { useEffect, useRef, useState } from 'react';

// Botón "⋯ Más" que abre un menú chico con acciones que se usan de vez en cuando.
// items: [{ icono, titulo, detalle, onClick, deshabilitado }]  (los valores falsos se ignoran)
// Se cierra al elegir una opción, al tocar afuera o con Escape.
export default function MenuMas({ items, etiqueta = '⋯ Más' }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const alTocarAfuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('pointerdown', alTocarAfuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alTocarAfuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
          abierto
            ? 'bg-marca-600 border-marca-600 text-white'
            : 'border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-marca-500'
        }`}
      >
        {etiqueta}
      </button>

      {abierto && (
        <div
          role="menu"
          className="tarjeta toast-entra absolute right-0 top-full mt-2 z-30 w-64 p-1.5 space-y-0.5"
        >
          {items.filter(Boolean).map((it) => (
            <button
              key={it.titulo}
              type="button"
              role="menuitem"
              disabled={it.deshabilitado}
              onClick={() => {
                setAbierto(false);
                it.onClick();
              }}
              className="w-full text-left flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            >
              <span aria-hidden="true" className="text-lg leading-tight">{it.icono}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{it.titulo}</span>
                <span className="block text-xs font-normal text-slate-700 dark:text-slate-300">{it.detalle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
