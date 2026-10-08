import { NIVELES, nivelDeuda, diasUltimoAviso, hace } from './cobranza';

// Va debajo del teléfono: hace cuánto no paga y cuándo fue el último aviso.
// Se muestra completo en todas las pantallas (si no entra en una línea, baja a la siguiente):
// ningún dato importante se corta con "...".
export default function LineaCobranza({ c, conTelefono }) {
  // En pantallas anchas va en la misma línea que el teléfono; en el celular, debajo.
  const sep = conTelefono ? <span className="hidden sm:inline">{' · '}</span> : null;
  const caja = 'block sm:inline text-xs mt-0.5 sm:mt-0';

  // Sin deuda: igual se muestra una línea, para que todas las tarjetas tengan el mismo alto
  if (!(Number(c.saldo) > 0)) {
    return (
      <>
        {sep}
        <span className={`${caja} ${NIVELES.aldia.texto}`}>Al día</span>
      </>
    );
  }

  const ultimoAviso = diasUltimoAviso(c);
  const avisoTxt = ultimoAviso === null ? 'Sin avisos aún' : `Último aviso: ${hace(ultimoAviso)}`;

  if (c.dias_sin_pagar == null) {
    return (
      <>
        {sep}
        <span className={caja}>
          <span className="font-medium">Sin pagos registrados</span>
          {' · '}{avisoTxt}
        </span>
      </>
    );
  }

  const sinPagar =
    c.dias_sin_pagar <= 1 ? `Sin pagar desde ${hace(c.dias_sin_pagar)}` : `Sin pagar ${hace(c.dias_sin_pagar)}`;

  return (
    <>
      {sep}
      <span className={caja}>
        <span className={NIVELES[nivelDeuda(c)].texto}>{sinPagar}</span>
        {' · '}{avisoTxt}
      </span>
    </>
  );
}
