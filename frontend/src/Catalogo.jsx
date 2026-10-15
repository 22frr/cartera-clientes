import { useNavigate, useSearchParams } from 'react-router-dom';
import { nombreNegocio } from './api';
import { useCatalogo, ANCHO_PANEL } from './CatalogoContext';
import CatalogoContenido from './CatalogoContenido';
import Cabecera from './Cabecera';
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
      <Cabecera
        variante="catalogo"
        onVolver={enVentana ? undefined : () => navigate(-1)}
        titulo="Catálogo de productos"
        subtitulo={nombreNegocio()}
        acciones={
          <>
            {puedeAcoplar && (
              <button
                onClick={acoplar}
                className="h-9 px-3 rounded-full text-sm bg-black/15 hover:bg-black/25 transition-colors"
                title="Volver a mostrarlo al costado de la ventana principal"
              >
                Acoplar
              </button>
            )}
            <ThemeToggle />
          </>
        }
      />

      <main className="max-w-3xl mx-auto p-4 pt-0">
        <CatalogoContenido />
      </main>
    </div>
  );
}
