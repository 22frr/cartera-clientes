import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNegocio, guardarNegocio, cambiarClave, nombreNegocio } from './api';
import { PLANTILLA_POR_DEFECTO } from './cobranza';
import { useToast, AvisoForm } from './ToastContext';
import { flechasEnFormulario } from './teclado';
import Cabecera from './Cabecera';
import ThemeToggle from './ThemeToggle';

const inputCls =
  'mt-1 w-full border-2 border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-marca-500';
const labelCls = 'block text-sm text-slate-600 dark:text-slate-300';
const ayudaCls = 'block text-xs mt-1 text-slate-600 dark:text-slate-300';
const botonPrincipal =
  'flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50';

const claveVacia = { actual: '', nueva: '', repetir: '' };

// Etiqueta al lado de cada casilla: indica con qué palabra aparece ese dato en el mensaje
function Etiqueta({ children }) {
  return (
    <span className="ml-2 align-middle text-xs font-bold px-2 py-0.5 rounded-full bg-marca-100 dark:bg-marca-900 text-marca-800 dark:text-marca-200">
      {children}
    </span>
  );
}

export default function Configuracion() {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ nombre: '', codigo_area: '', datos_pago: '', mensaje: PLANTILLA_POR_DEFECTO });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [clave, setClave] = useState(claveVacia);
  const [errorClave, setErrorClave] = useState('');
  const [cambiando, setCambiando] = useState(false);

  function aplicar(n) {
    setForm({
      nombre: n.nombre ?? '',
      codigo_area: n.codigo_area ?? '',
      datos_pago: n.datos_pago ?? '',
      mensaje: n.mensaje_recordatorio || PLANTILLA_POR_DEFECTO,
    });
  }

  useEffect(() => {
    getNegocio()
      .then(aplicar)
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setErrorForm('Escribí el nombre del negocio');
      return;
    }
    if (form.codigo_area && form.codigo_area.length < 2) {
      setErrorForm('El código de área tiene al menos 2 números (ej: 342)');
      return;
    }
    setErrorForm('');
    setGuardando(true);
    try {
      // Si vaciás el mensaje se guarda vacío y vuelve el mensaje original
      const n = await guardarNegocio({
        nombre: form.nombre,
        codigo_area: form.codigo_area,
        datos_pago: form.datos_pago,
        mensaje_recordatorio: form.mensaje,
      });
      aplicar(n);
      toast.ok('Datos guardados');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarClave(e) {
    e.preventDefault();
    if (!clave.actual || !clave.nueva) {
      setErrorClave('Completá la contraseña actual y la nueva');
      return;
    }
    if (clave.nueva.length < 6) {
      setErrorClave('La contraseña nueva debe tener al menos 6 caracteres');
      return;
    }
    if (clave.nueva !== clave.repetir) {
      setErrorClave('Las contraseñas nuevas no coinciden');
      return;
    }
    setErrorClave('');
    setCambiando(true);
    try {
      await cambiarClave(clave.actual, clave.nueva);
      setClave(claveVacia);
      toast.ok('Contraseña cambiada');
    } catch (err) {
      setErrorClave(err.message);
    } finally {
      setCambiando(false);
    }
  }

  return (
    <div className="min-h-screen fondo-app">
      <Cabecera
        onVolver={() => navigate(-1)}
        titulo="Configuración"
        subtitulo={nombreNegocio()}
        acciones={<ThemeToggle />}
      />

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {errorCarga && (
          <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-3 rounded-lg">{errorCarga}</div>
        )}

        {/* ---------- Datos del negocio ---------- */}
        <section className="space-y-3">
          <h2 className="titulo-seccion text-xl">Datos del negocio</h2>
          <form onSubmit={guardar} onKeyDown={flechasEnFormulario} className="tarjeta p-4 space-y-4">
            {errorForm && <AvisoForm texto={errorForm} />}

            <label className={labelCls}>
              Nombre del negocio * <Etiqueta>{'{negocio}'}</Etiqueta>
              <input
                className={inputCls}
                value={form.nombre}
                disabled={cargando}
                maxLength={100}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </label>

            <label className={labelCls}>
              Código de área
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="Ej: 342"
                value={form.codigo_area}
                disabled={cargando}
                onChange={(e) => setForm({ ...form, codigo_area: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              />
              <span className={ayudaCls}>
                Sin 0 ni 15. Se usa para completar los teléfonos que cargaste sin código (ej: 412-3456).
              </span>
            </label>

            <label className={labelCls}>
              Alias o CBU para que te paguen (opcional) <Etiqueta>{'{pago}'}</Etiqueta>
              <input
                className={inputCls}
                placeholder="Ej: kiosco.paula"
                value={form.datos_pago}
                disabled={cargando}
                maxLength={200}
                onChange={(e) => setForm({ ...form, datos_pago: e.target.value })}
              />
            </label>

            <label className={labelCls}>
              Mensaje del recordatorio
              <textarea
                rows={5}
                maxLength={600}
                className={inputCls}
                value={form.mensaje}
                disabled={cargando}
                onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              />
              <span className={ayudaCls}>
                Personalizá tu mensaje. Las palabras entre llaves se reemplazan al enviar:{' '}
                <strong>{'{cliente}'}</strong> (nombre del cliente), <strong>{'{saldo}'}</strong> (lo que debe),{' '}
                <strong>{'{negocio}'}</strong> y <strong>{'{pago}'}</strong>. Si no cargaste alias, la línea con{' '}
                {'{pago}'} no se envía. Para volver al mensaje original, vaciá este cuadro y guardá.
              </span>
            </label>

            <div className="flex gap-2">
              <button disabled={guardando || cargando} className={botonPrincipal}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>

        {/* ---------- Contraseña ---------- */}
        <section className="space-y-3">
          <h2 className="titulo-seccion text-xl">Cambiar contraseña</h2>
          <form onSubmit={guardarClave} onKeyDown={flechasEnFormulario} className="tarjeta p-4 space-y-4">
            {errorClave && <AvisoForm texto={errorClave} />}

            <label className={labelCls}>
              Contraseña actual
              <input
                type="password"
                autoComplete="current-password"
                className={inputCls}
                value={clave.actual}
                onChange={(e) => setClave({ ...clave, actual: e.target.value })}
              />
            </label>
            <label className={labelCls}>
              Contraseña nueva
              <input
                type="password"
                autoComplete="new-password"
                className={inputCls}
                value={clave.nueva}
                onChange={(e) => setClave({ ...clave, nueva: e.target.value })}
              />
              <span className={ayudaCls}>Mínimo 6 caracteres.</span>
            </label>
            <label className={labelCls}>
              Repetí la contraseña nueva
              <input
                type="password"
                autoComplete="new-password"
                className={inputCls}
                value={clave.repetir}
                onChange={(e) => setClave({ ...clave, repetir: e.target.value })}
              />
            </label>

            <div className="flex gap-2">
              <button disabled={cambiando} className={botonPrincipal}>
                {cambiando ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}