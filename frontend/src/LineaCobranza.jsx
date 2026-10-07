import { DIAS_ATRASADO, diasUltimoAviso, hace } from './cobranza';

// Va debajo del teléfono: hace cuánto no paga y cuándo fue el último aviso.
// Se muestra completo en todas las pantallas (si no entra en una línea, baja a la siguiente):
// ningún dato importante se corta con "...".
export default function LineaCobranza({ c }) {
  // Sin deuda: igual se muestra una línea, para que todas las tarjetas tengan el mismo alto
  if (!(Number(c.saldo) > 0)) {
    return <span className="block text-xs mt-0.5 font-semibold text-marca-700 dark:text-marca-400">Al día</span>;
  }

  const ultimoAviso = diasUltimoAviso(c);
  const avisoTxt = ultimoAviso === null ? 'Sin avisos aún' : `Último aviso: ${hace(ultimoAviso)}`;

  if (c.dias_sin_pagar == null) {
    return (
      <span className="block text-xs mt-0.5">
        <span className="font-medium">Sin pagos registrados</span>
        {' · '}{avisoTxt}
      </span>
    );
  }

  const atrasado = c.dias_sin_pagar > DIAS_ATRASADO;
  const sinPagar =
    c.dias_sin_pagar <= 1 ? `Sin pagar desde ${hace(c.dias_sin_pagar)}` : `Sin pagar ${hace(c.dias_sin_pagar)}`;

  return (
    <span className="block text-xs mt-0.5">
      <span className={atrasado ? 'font-bold text-red-600 dark:text-red-400' : 'font-medium'}>{sinPagar}</span>
      {' · '}{avisoTxt}
    </span>
  );
}
