import { useNavigate, useSearchParams } from 'react-router-dom';
import { nombreNegocio } from './api';
import { useCatalogo, ANCHO_PANEL } from './CatalogoContext';
import CatalogoContenido from './CatalogoContenido';
import ThemeToggle from './ThemeToggle';

// Se usa en dos casos:
//  - Celular: pantalla normal (con flecha para volver).
//  - PC: dentro de la ventana emergente (?ventana=1), con botón para acoplarlo de nuevo.
export default function Catalogo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { acoplar } = useCatalogo();

  const enVentana = params.get('ventana') === '1' || !!window.opener;
  // Solo ofrece "Acoplar" si la pantalla es lo bastante ancha como para mostrar el panel
  const puedeAcoplar = enVentana && window.screen.availWidth >= ANCHO_PANEL;

  return (
    <div className="min-h-screen fondo-app">
      <header className="cabecera py-4">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!enVentana && (
              <button onClick={() => navigate(-1)} className="text-2xl leading-none shrink-0">←</button>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-2xl tracking-tight">Catálogo de productos</h1>
              <p className="text-xs text-marca-100 truncate">{nombreNegocio()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {puedeAcoplar && (
              <button
                onClick={acoplar}
                className="text-sm bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-lg transition-colors"
                title="Volver a mostrarlo al costado de la ventana principal"
              >
                Acoplar
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 pt-0">
        <CatalogoContenido />
      </main>
    </div>
  );
}
