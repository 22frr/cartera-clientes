import { useEffect, useState } from 'react';

function temaInicial() {
  const guardado = localStorage.getItem('tema');
  if (guardado) return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export default function ThemeToggle() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    localStorage.setItem('tema', tema);
  }, [tema]);

  return (
    <button
      onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')}
      className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors"
      title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {tema === 'oscuro' ? '☀️' : '🌙'}
    </button>
  );
}