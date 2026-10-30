import { migrate } from '../src/db/migrate.js';
import { syncRbac } from '../src/auth/rbac.js';

const applied = migrate();
syncRbac();
console.log(applied.length ? `✓ ${applied.length} migraciones aplicadas` : '✓ La base de datos ya está al día');
