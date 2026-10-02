import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Cliente from './Cliente.jsx';
import Login from './Login.jsx';
import Catalogo from './Catalogo.jsx';
import Layout from './Layout.jsx';
import { CatalogoProvider } from './CatalogoContext.jsx';
import { estaLogueado } from './api.js';

// Todo lo que está adentro exige sesión y comparte el catálogo.
// El Provider vive acá arriba, así que no se destruye al navegar entre pantallas.
function Privada() {
  return estaLogueado()
    ? <CatalogoProvider><Outlet /></CatalogoProvider>
    : <Navigate to="/login" replace />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
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
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
