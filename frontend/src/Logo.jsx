// Logo provisorio: un "$" sobre una ficha con la misma tinta y sombra dura que las tarjetas.
// Cuando haya logo propio, se reemplaza el contenido de este componente y se actualiza en todas las pantallas.
//   fondo="claro": ficha blanca (sobre el verde de la cabecera)
//   fondo="marca": ficha verde (sobre una tarjeta blanca, ej. el login)
export default function Logo({ fondo = 'claro', grande = false }) {
  const tam = grande
    ? 'w-12 h-12 text-3xl rounded-xl shadow-[3px_3px_0_0_#0f172a]'
    : 'w-9 h-9 text-xl rounded-lg shadow-[2px_2px_0_0_#0f172a]';
  const colores = fondo === 'marca' ? 'bg-marca-600 text-white' : 'bg-white text-marca-700';
  return (
    <span
      aria-hidden="true"
      className={`${tam} ${colores} shrink-0 flex items-center justify-center font-display font-extrabold leading-none border-2 border-slate-900`}
    >
      $
    </span>
  );
}
