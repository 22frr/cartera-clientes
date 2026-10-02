import { Outlet } from 'react-router-dom';
import { useCatalogo } from './CatalogoContext';
import CatalogoContenido from './CatalogoContenido';
import { nombreNegocio } from './api';

// Envuelve las pantallas con sesión (lista de clientes y ficha).
// El panel es position: fixed, así que NO mueve ni achica el contenido:
// simplemente se apoya sobre el borde derecho de la pantalla.
// Siempre está montado (aunque cerrado) para conservar buscador y scroll.
export default function Layout() {
  const { panelAbierto, anchoSuficiente, cerrarPanel, abrirEnVentana } = useCatalogo();
  const visible = anchoSuficiente && panelAbierto;

  return (
    <>
      <Outlet />

      {anchoSuficiente && (
        <aside
          inert={!visible}
          aria-hidden={!visible}
          className={`fixed top-0 right-0 z-40 h-screen w-[360px] flex flex-col fondo-liso border-l-4 border-slate-900 dark:border-slate-500 shadow-xl transition-transform duration-300 ease-out ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-marca-700 text-white">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg leading-tight">Catálogo</h2>
              <p className="text-xs text-marca-100 truncate">{nombreNegocio()}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={abrirEnVentana}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors"
                title="Abrir en ventana aparte"
              >
                ↗
              </button>
              <button
                onClick={cerrarPanel}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-xl leading-none"
                title="Cerrar catálogo"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-0">
            <CatalogoContenido />
          </div>
        </aside>
      )}
    </>
  );
}
