import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Cliente from './Cliente.jsx';
import Login from './Login.jsx';
import Catalogo from './Catalogo.jsx';
import Configuracion from './Configuracion.jsx';
import Layout from './Layout.jsx';
import { CatalogoProvider } from './CatalogoContext.jsx';
import { estaLogueado, cargarConfigNegocio } from './api.js';
import { ToastProvider } from './ToastContext.jsx';
import { ConfirmProvider } from './ConfirmContext.jsx';

// Todo lo que está adentro exige sesión y comparte el catálogo.
// El Provider vive acá arriba, así que no se destruye al navegar entre pantallas.
// Antes de mostrar nada se carga la configuración del negocio (código de área, datos de pago):
// los links de WhatsApp se arman al dibujar la pantalla y la necesitan ya cargada.
function Privada() {
  const logueado = estaLogueado();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!logueado) return;
    cargarConfigNegocio().finally(() => setListo(true));
  }, [logueado]);

  if (!logueado) return <Navigate to="/login" replace />;
  if (!listo) {
    return (
      <div className="min-h-screen fondo-app flex items-center justify-center text-slate-700 dark:text-slate-300">
        Cargando…
      </div>
    );
  }
  return <CatalogoProvider><Outlet /></CatalogoProvider>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
    <ConfirmProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Privada />}>
          {/* Pantallas con el panel de catálogo a la derecha */}
          <Route element={<Layout />}>
            <Route path="/" element={<App />} />
            <Route path="/cliente/:id" element={<Cliente />} />
          </Route>
          {/* Catálogo como página (celu) o como ventana emergente (PC) */}
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ConfirmProvider>
    </ToastProvider>
  </StrictMode>
);