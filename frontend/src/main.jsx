import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Cliente from './Cliente.jsx';
import Login from './Login.jsx';
import { estaLogueado } from './api.js';
import Catalogo from './Catalogo.jsx';

function Privada({ children }) {
  return estaLogueado() ? children : <Navigate to="/login" replace />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Privada><App /></Privada>} />
        <Route path="/cliente/:id" element={<Privada><Cliente /></Privada>} />
        <Route path="/catalogo" element={<Privada><Catalogo /></Privada>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);