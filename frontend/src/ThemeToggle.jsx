import { useEffect, useState } from 'react';

function temaInicial() {
  const guardado = localStorage.getItem('tema');
  if (guardado) return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

// Cambia el tema al instante: apaga las transiciones, aplica la clase y las vuelve a prender
function aplicarTema(tema) {
  const raiz = document.documentElement;
  raiz.classList.add('sin-transiciones');
  raiz.classList.toggle('dark', tema === 'oscuro');
  void raiz.offsetHeight; // fuerza a que el navegador aplique el cambio ya
  requestAnimationFrame(() =>
    requestAnimationFrame(() => raiz.classList.remove('sin-transiciones'))
  );
}

export default function ThemeToggle() {
  const [tema, setTema] = useState(temaInicial);

  // Al montar (cada pantalla): solo asegura la clase, sin efecto visual
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    localStorage.setItem('tema', tema);
  }, [tema]);

  function cambiar() {
    const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(nuevo); // se aplica en el mismo clic, sin esperar al render de React
    setTema(nuevo);
  }

  return (
    <button
      onClick={cambiar}
      className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors"
      title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {tema === 'oscuro' ? '☀️' : '🌙'}
    </button>
  );
}