// Flechas ↑ ↓ para pasar de un campo al otro en los formularios (además de Tab).
// Uso: <form onKeyDown={flechasEnFormulario}>
export function flechasEnFormulario(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const el = e.target;
  if (el.list) return; // los campos con lista de sugerencias usan las flechas para elegir
  const campos = [
    ...e.currentTarget.querySelectorAll(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([disabled]), textarea:not([disabled])'
    ),
  ];
  const i = campos.indexOf(el);
  if (i < 0) return;
  const j = e.key === 'ArrowDown' ? i + 1 : i - 1;
  if (j < 0 || j >= campos.length) return;
  e.preventDefault();
  campos[j].focus();
  campos[j].select?.();
}
