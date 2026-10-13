// Avisa cuando cambian los datos (compras, pagos, clientes...) para que las pantallas
// abiertas se recarguen solas. Funciona en dos niveles:
//  - misma pestaña: evento de window (ej. "Deshacer" tocado desde otra pantalla)
//  - otras pestañas/ventanas: BroadcastChannel
const ORIGEN = Math.random().toString(36).slice(2); // identifica a ESTA pestaña
const EVENTO_LOCAL = 'datos-cambiaron';

let canalEnvio = null;
try {
  canalEnvio = new BroadcastChannel('cartera-datos');
} catch {
  /* navegador sin BroadcastChannel: queda el recargado al volver a la pestaña */
}

export function avisarCambio() {
  canalEnvio?.postMessage({ origen: ORIGEN });
  window.dispatchEvent(new Event(EVENTO_LOCAL));
}

// Ejecuta fn cuando cambiaron datos (en esta u otra pestaña), o cuando se vuelve a esta pestaña.
// Devuelve la función para limpiar (usar directo como retorno de useEffect).
export function alCambiarDatos(fn) {
  let timer;
  const disparar = () => {
    clearTimeout(timer);
    timer = setTimeout(fn, 150); // junta varios eventos seguidos en una sola recarga
  };

  let canal = null;
  try {
    canal = new BroadcastChannel('cartera-datos');
    canal.onmessage = (e) => {
      if (e.data?.origen !== ORIGEN) disparar(); // los de esta pestaña llegan por el evento local
    };
  } catch {
    /* sin BroadcastChannel */
  }

  const alVolver = () => {
    if (document.visibilityState === 'visible') disparar();
  };
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('focus', disparar);
  window.addEventListener(EVENTO_LOCAL, disparar);

  return () => {
    clearTimeout(timer);
    canal?.close();
    document.removeEventListener('visibilitychange', alVolver);
    window.removeEventListener('focus', disparar);
    window.removeEventListener(EVENTO_LOCAL, disparar);
  };
}