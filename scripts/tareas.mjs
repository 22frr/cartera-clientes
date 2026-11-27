import { spawnSync } from 'node:child_process';

const tareas = {
  setup: [['ci', '--prefix', 'backend'], ['ci', '--prefix', 'frontend']],
  test: [['test', '--prefix', 'frontend'], ['test', '--prefix', 'backend']],
  lint: [['run', 'lint', '--prefix', 'frontend'], ['run', 'lint:backend', '--prefix', 'frontend']],
  verify: [['run', 'lint'], ['run', 'build'], ['test']],
};
const pasos = tareas[process.argv[2]];
if (!pasos) throw new Error('Tarea desconocida');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Ejecutá estas tareas con npm run');
for (const args of pasos) {
  const resultado = spawnSync(process.execPath, [npmCli, ...args], {
    stdio: 'inherit',
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}
