import { config, assertRuntimeConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { syncRbac } from './auth/rbac.js';
import { createApp } from './app.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { closeConnection, db } from './db/index.js';

const problems = assertRuntimeConfig();
for (const p of problems) console.warn(`⚠ ${p}. Ejecuta "npm run setup" para generar la configuración.`);

migrate({ log: () => {} });
syncRbac();

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`Web Pulsar API escuchando en http://${config.host}:${config.port}`);
  if (!db.value('SELECT COUNT(*) FROM users')) console.log('ℹ No hay usuarios. Crea el administrador principal con: npm run user:create');
  startScheduler();
});

function shutdown(signal) {
  console.log(`${signal} recibido, cerrando…`);
  stopScheduler();
  server.close(() => {
    closeConnection();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
