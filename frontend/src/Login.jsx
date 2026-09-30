import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from './api';
import ThemeToggle from './ThemeToggle';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(usuario, password);
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <form
        onSubmit={enviar}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-lg w-full max-w-sm space-y-4"
      >
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-xl bg-marca-600 flex items-center justify-center text-2xl">🧾</div>
          <h1 className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">Cartera de clientes</h1>
          <p className="text-sm text-slate-400">Ingresá para administrar tu negocio</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-2.5 rounded-lg text-sm">
            {error}
          </div>
        )}

        <label className="block text-sm text-slate-600 dark:text-slate-300">
          Usuario
          <input
            className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-marca-500"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
          />
        </label>

        <label className="block text-sm text-slate-600 dark:text-slate-300">
          Contraseña
          <input
            type="password"
            className="mt-1 w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-marca-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button
          disabled={cargando}
          className="w-full bg-marca-600 hover:bg-marca-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}