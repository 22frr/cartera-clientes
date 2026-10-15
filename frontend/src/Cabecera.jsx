import { useEffect, useRef, useState } from 'react';
import { logout, nombreNegocio } from './api';
import { useCatalogo } from './CatalogoContext';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

// Cabecera única de la app. Todas las pantallas la usan, así el diseño se cambia en un solo lugar.
//
//   <Cabecera
//     titulo="Clientes archivados"
//     etiqueta="Cliente"            (opcional: línea chica arriba del título)
//     subtitulo="Podés restaurarlos"  (opcional)
//     onVolver={() => navigate(-1)}   (si falta, muestra el logo)
//     variante="archivados"           (principal | archivados | avisar | catalogo)
//     acciones={<AccionesCabecera menu />}
//   />
//
// La variante cambia el color para que se note en qué modo estás.
const FONDOS = {
  principal: 'bg-marca-700',
  catalogo: 'bg-marca-800',
  archivados: 'bg-slate-700',
  avisar: 'bg-sky-700',
};

const circulo =
  'w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors';

function BotonVolver({ onClick }) {
  return (
    <button onClick={onClick} className={`${circulo} shrink-0`} aria-label="Volver" title="Volver">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}

export default function Cabecera({ titulo, etiqueta, subtitulo, onVolver, variante = 'principal', acciones }) {
  return (
    <header className={`cabecera py-3 ${FONDOS[variante] ?? FONDOS.principal}`}>
      <div className="max-w-3xl mx-auto px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onVolver ? <BotonVolver onClick={onVolver} /> : <Logo />}
          <div className="min-w-0">
            {etiqueta && <p className="text-xs font-semibold text-white/80 leading-none mb-1">{etiqueta}</p>}
            <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight leading-tight break-words">
              {titulo}
            </h1>
            {subtitulo && <p className="text-xs text-white/80 leading-tight break-words">{subtitulo}</p>}
          </div>
        </div>
        {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
      </div>
    </header>
  );
}

// Botón del catálogo: en el celular solo el ícono, en pantallas más anchas con texto
export function BotonCatalogo() {
  const { alternarCatalogo } = useCatalogo();
  return (
    <button
      onClick={alternarCatalogo}
      aria-label="Catálogo"
      title="Catálogo de productos"
      className="h-9 w-9 sm:w-auto sm:px-3 rounded-full flex items-center justify-center gap-1.5 bg-black/15 hover:bg-black/25 text-sm transition-colors"
    >
      <span aria-hidden="true">📦</span>
      <span className="hidden sm:inline">Catálogo</span>
    </button>
  );
}

// Círculo con la inicial del negocio: abre un menú con el nombre y "Cerrar sesión"
export function MenuNegocio() {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const negocio = nombreNegocio();

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
        aria-label="Menú del negocio"
        title={negocio}
        onClick={() => setAbierto((a) => !a)}
        className={`${circulo} font-display font-extrabold text-base`}
      >
        {(negocio.trim().charAt(0) || '?').toUpperCase()}
      </button>

      {abierto && (
        <div
          role="menu"
          className="tarjeta toast-entra absolute right-0 top-full mt-2 z-50 w-60 p-1.5 text-slate-900 dark:text-white"
        >
          <p className="px-3 py-2 font-display font-bold break-words border-b-2 border-slate-200 dark:border-slate-600 mb-1">
            {negocio}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

// Acciones estándar de la derecha: tema + catálogo (+ menú del negocio en la pantalla principal)
export function AccionesCabecera({ menu = false }) {
  return (
    <>
      <ThemeToggle />
      <BotonCatalogo />
      {menu && <MenuNegocio />}
    </>
  );
}
