import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const proyecto = process.argv[2];
if (!['frontend', 'backend'].includes(proyecto)) throw new Error('Proyecto desconocido');
const raiz = fileURLToPath(new URL('../', import.meta.url));
const cwd = join(raiz, proyecto);
// Rutas explícitas: también revisa copias en carpetas temporales ignoradas por Git.
const archivos = ['src', 'test'].flatMap((carpeta) =>
  readdirSync(join(cwd, carpeta), { recursive: true })
    .filter((archivo) => /\.(js|jsx|mjs)$/.test(archivo))
    .map((archivo) => join(carpeta, archivo)));
if (!archivos.length) throw new Error('No hay archivos para revisar');
const resultado = spawnSync(process.execPath, [join(raiz, 'frontend/node_modules/oxlint/bin/oxlint'), '--deny-warnings', ...archivos], {
  cwd, stdio: 'inherit',
});
if (resultado.error) throw resultado.error;
process.exit(resultado.status ?? 1);
