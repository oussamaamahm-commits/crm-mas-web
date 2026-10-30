// Arranca API y frontend en paralelo para desarrollo.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  ['api', ['run', 'dev', '-w', 'server']],
  ['web', ['run', 'dev', '-w', 'web']],
].map(([name, args]) => {
  const child = spawn(npm, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = `[${name}] `;
  child.stdout.on('data', (d) => process.stdout.write(d.toString().replace(/^/gm, prefix)));
  child.stderr.on('data', (d) => process.stderr.write(d.toString().replace(/^/gm, prefix)));
  child.on('exit', (code) => {
    console.log(`${prefix}terminado (${code})`);
    procs.forEach((p) => p.kill());
    process.exit(code ?? 0);
  });
  return child;
});

process.on('SIGINT', () => procs.forEach((p) => p.kill()));
