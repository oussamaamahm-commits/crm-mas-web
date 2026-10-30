// Carga datos de demostración marcados como DEMO (se eliminan desde Configuración → Datos DEMO).
import { migrate } from '../src/db/migrate.js';
import { syncRbac } from '../src/auth/rbac.js';
import { db } from '../src/db/index.js';
import { getSetting } from '../src/lib/settings.js';
import { loadDemoData } from '../src/seed/demo.js';

migrate({ log: () => {} });
syncRbac();
if (getSetting('demo').loaded) {
  console.log('• Los datos DEMO ya están cargados.');
  process.exit(0);
}
const owner = db.get('SELECT id, name FROM users WHERE is_owner = 1');
const result = loadDemoData(owner ? { user: owner } : { system: true });
console.log('✓ Datos DEMO cargados:', result.counts);
