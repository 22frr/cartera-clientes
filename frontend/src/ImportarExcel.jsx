import { useState } from 'react';
import { createPortal } from 'react-dom';
import { dinero, importarProductos, importarClientes } from './api';
import { useToast, AvisoForm } from './ToastContext';
import { leerArchivo, descargarPlantilla } from './excel';

// Ventana para importar productos o clientes desde un Excel.
// Flujo: elegir archivo -> vista previa (el servidor simula, no guarda nada) -> confirmar.
// Usa un portal porque el panel del catálogo tiene transform y atraparía a un "fixed".

const CONFIG = {
  productos: {
    titulo: 'Importar productos',
    plural: 'productos',
    ayuda: 'Columnas: Categoría, Nombre (obligatorio), Precio y Código de barras.',
    enviar: importarProductos,
  },
  clientes: {
    titulo: 'Importar clientes',
    plural: 'clientes',
    ayuda: 'Columnas: Nombre (obligatorio), Teléfono, Dirección, Notas, Saldo inicial y Deuda desde.',
    enviar: importarClientes,
  },
};

function Linea({ etiqueta, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{etiqueta}</span>
      <span className="numero font-bold shrink-0">{valor}</span>
    </div>
  );
}

export default function ImportarExcel({ tipo, onCerrar, onListo }) {
  const cfg = CONFIG[tipo];
  const toast = useToast();

  const [fase, setFase] = useState('elegir'); // 'elegir' | 'revisar'
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [prueba, setPrueba] = useState(null);

  async function bajarPlantilla() {
    try {
      await descargarPlantilla(tipo);
    } catch (e) {
      toast.error(e.message || 'No se pudo generar la plantilla');
    }
  }

  async function elegirArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOcupado(true);
    setError('');
    try {
      const r = await leerArchivo(file, tipo);
      if (r.filas.length === 0) {
        setError(
          r.errores.length > 0
            ? `Ninguna fila es válida. Ej: fila ${r.errores[0].fila}: ${r.errores[0].error}`
            : 'No encontré filas con datos en el archivo.'
        );
        return;
      }
      const simulacion = await cfg.enviar(r.filas, true); // probar = true: no guarda nada
      setArchivo(file.name);
      setFilas(r.filas);
      setErrores(r.errores);
      setPrueba(simulacion);
      setFase('revisar');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    setOcupado(true);
    setError('');
    try {
      const r = await cfg.enviar(filas, false);
      await onListo?.();
      if (tipo === 'productos') {
        toast.ok(`${r.insertados} producto${r.insertados !== 1 ? 's' : ''} importado${r.insertados !== 1 ? 's' : ''}`);
      } else {
        toast.ok(
          `${r.creados} cliente${r.creados !== 1 ? 's' : ''} importado${r.creados !== 1 ? 's' : ''}` +
            (r.con_saldo > 0 ? ` · deuda inicial ${dinero(r.total_saldo)}` : '')
        );
      }
      onCerrar();
    } catch (err) {
      setError(err.message);
      setOcupado(false);
    }
  }

  function volverAElegir() {
    setFase('elegir');
    setError('');
    setPrueba(null);
  }

  const hayNuevos = (prueba?.nuevos ?? 0) > 0;

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-slate-900/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="importar-titulo"
        className="tarjeta toast-entra w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="importar-titulo" className="font-display font-extrabold text-xl text-slate-900 dark:text-white">
            {cfg.titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
            className="shrink-0 w-8 h-8 rounded-md text-2xl leading-none text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            ×
          </button>
        </div>

        {error && <AvisoForm texto={error} />}

        {/* ---------- 1) Elegir archivo ---------- */}
        {fase === 'elegir' && (
          <>
            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
              <p>{cfg.ayuda}</p>
              {tipo === 'clientes' && (
                <p>
                  Si ponés un <strong>saldo inicial</strong>, el cliente queda debiendo ese monto desde el primer día
                  (se carga como una compra llamada «Saldo inicial»). En <strong>Deuda desde</strong> podés poner la
                  fecha aproximada, así el sistema sabe hace cuánto no paga.
                </p>
              )}
              <p>Antes de guardar vas a ver un resumen para confirmar.</p>
            </div>

            <button
              type="button"
              onClick={bajarPlantilla}
              className="w-full py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 hover:border-marca-500 transition-colors"
            >
              📄 Descargar plantilla de ejemplo
            </button>

            <label
              className={`block w-full text-center bg-marca-600 hover:bg-marca-700 text-white py-3 rounded-xl font-semibold transition-colors focus-within:ring-2 focus-within:ring-marca-500 focus-within:ring-offset-2 ${
                ocupado ? 'opacity-60 cursor-wait' : 'cursor-pointer'
              }`}
            >
              {ocupado ? 'Leyendo archivo...' : 'Elegir archivo Excel (.xlsx)'}
              <input type="file" accept=".xlsx" className="sr-only" disabled={ocupado} onChange={elegirArchivo} />
            </label>
          </>
        )}

        {/* ---------- 2) Revisar y confirmar ---------- */}
        {fase === 'revisar' && prueba && (
          <>
            <div className="rounded-lg border-2 border-slate-400 dark:border-slate-600 p-3 space-y-1.5 text-sm text-slate-800 dark:text-slate-100">
              <p className="text-xs text-slate-700 dark:text-slate-300 break-all">{archivo}</p>
              <Linea etiqueta={`${tipo === 'productos' ? 'Productos' : 'Clientes'} nuevos`} valor={prueba.nuevos} />
              {prueba.ya_existian > 0 && <Linea etiqueta="Ya existían (se omiten)" valor={prueba.ya_existian} />}
              {tipo === 'productos' && prueba.codigo_repetido > 0 && (
                <Linea etiqueta="Código de barras repetido (se omiten)" valor={prueba.codigo_repetido} />
              )}
              {tipo === 'clientes' && prueba.con_saldo > 0 && (
                <>
                  <Linea etiqueta="Con deuda inicial" valor={prueba.con_saldo} />
                  <Linea etiqueta="Deuda inicial total" valor={dinero(prueba.total_saldo)} />
                </>
              )}
            </div>

            {errores.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">
                  {errores.length} fila{errores.length !== 1 ? 's' : ''} con problemas (no se importan):
                </p>
                <ul className="space-y-0.5 text-xs">
                  {errores.slice(0, 5).map((x) => (
                    <li key={x.fila}>Fila {x.fila}: {x.error}</li>
                  ))}
                  {errores.length > 5 && <li>… y {errores.length - 5} más</li>}
                </ul>
              </div>
            )}

            {!hayNuevos && (
              <p className="text-sm text-slate-700 dark:text-slate-300">No hay nada nuevo para importar.</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={importar}
                disabled={!hayNuevos || ocupado}
                className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-marca-600 dark:hover:bg-marca-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ocupado ? 'Importando...' : `Importar ${prueba.nuevos} ${cfg.plural}`}
              </button>
              <button
                type="button"
                onClick={volverAElegir}
                disabled={ocupado}
                className="px-4 py-2 rounded-lg border-2 border-slate-500 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                Cambiar archivo
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
