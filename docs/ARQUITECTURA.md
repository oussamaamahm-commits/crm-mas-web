# Arquitectura de Web Pulsar

## Visión general

```
Navegador (React 19 SPA)
   │  HTTPS · cookie de sesión httpOnly + cabecera X-CSRF-Token
   ▼
Cloudflare (DNS, proxy, WAF, SSL Full strict)
   ▼
Nginx en Hostinger VPS (TLS de origen, límites, cabeceras)
   ▼
API Express 5 (127.0.0.1:4000) ── sirve también web/dist
   ├─ Rutas por módulo  (server/src/routes)
   ├─ Servicios         (server/src/services: finanzas, facturas, monitorización, automatizaciones, copias)
   ├─ Conectores        (server/src/integrations: Hostinger, Cloudflare, almacén de credenciales)
   ├─ Planificador      (monitorización 30 s · automatizaciones 15 min · integraciones y mantenimiento 1 h)
   └─ SQLite (WAL)      data/webpulsar.db · data/uploads · data/backups
                  ▲
Agentes en VPS de clientes ── POST /api/agent/heartbeat (token propio, sin sesión)
```

El frontend nunca accede a la base de datos ni a las APIs de proveedores: todo pasa por la API, que aplica permisos, validación y auditoría.

## Elección de base de datos: SQLite en el VPS (compatible con D1)

Se evaluó Cloudflare D1 como opción principal:

| Criterio | D1 (vía Worker) | SQLite en el VPS |
|---|---|---|
| Transacciones interactivas | No (solo `batch`) | Sí, `BEGIN IMMEDIATE` y savepoints |
| Numeración correlativa de facturas sin huecos | Requiere diseño con `batch` y reintentos | Transacción atómica directa |
| Latencia desde la API (VPS) | Ida y vuelta HTTP a Cloudflare por consulta | En proceso, microsegundos |
| Copias | Time Travel (30 días) + exportación | `VACUUM INTO` diario + copia externa |
| Escala necesaria (2 usuarios, cientos de clientes) | Sobrada | Sobrada |
| Dependencia de credenciales adicionales | Token de cuenta en el VPS | Ninguna |

**Decisión:** SQLite en el propio VPS con el motor integrado de Node (`node:sqlite`, sin compilación nativa), en modo WAL. El esquema usa exclusivamente SQL compatible con D1 (sin extensiones), de modo que la migración a D1 o a otra base relacional es directa si el uso lo requiere. La integración con Cloudflare se mantiene: DNS, proxy, SSL, Workers, D1 y R2 de los clientes se gestionan y monitorizan desde la app.

Alternativa si se necesita concurrencia de escritura alta o varios nodos de API: PostgreSQL en el VPS (el código de acceso a datos está concentrado en `server/src/db` y `server/src/lib/query.js`).

## Modelo de datos

Migraciones versionadas en `server/migrations` (`NNN_nombre.sql`), registradas con checksum en `schema_migrations`.

| Migración | Tablas |
|---|---|
| 001_core | `roles`, `permissions`, `role_permissions`, `users`, `sessions`, `password_resets`, `access_logs`, `settings`, `activity_logs`, `audit_logs`, `notifications` |
| 002_crm | `clients`, `client_contacts`, `client_communications`, `projects`, `project_tasks`, `task_comments`, `services`, `client_services`, `documents`, `testimonials` |
| 003_infrastructure | `providers`, `integrations`, `infrastructure_accounts`, `servers`, `server_metrics`, `domains`, `dns_records`, `databases`, `applications`, `storage_buckets`, `infrastructure_relationships` |
| 004_finance | `invoice_series`, `invoice_series_counters`, `invoices`, `invoice_items`, `recurring_payments`, `payments`, `expenses` |
| 005_operations | `incidents`, `incident_events`, `monitoring_checks`, `monitoring_results`, `monitoring_alerts`, `secrets`, `job_runs` |

Convenciones: importes en **céntimos** (enteros), fechas de negocio `YYYY-MM-DD`, marcas de tiempo ISO 8601 UTC, `is_demo` en entidades de negocio, borrado lógico (`deleted_at`) en clientes, proyectos y documentos.

Reglas garantizadas por la propia base de datos:

- Facturas emitidas inmutables (triggers impiden cambiar importes, cliente, número o fecha, y borrarlas).
- `activity_logs`, `audit_logs` y `access_logs` no admiten `UPDATE` ni `DELETE`.
- Un testimonio no puede ser publicable sin estado autorizado, fecha y texto (`CHECK`).
- Numeración única por serie y año (`UNIQUE (series_id, year, sequence)`).
- Una sola alerta activa por origen (índice único parcial).

## Relaciones entre módulos

- Cliente → proyectos, servicios contratados, facturas, cobros, recurrentes, gastos, documentos, credenciales, comunicaciones, testimonios, servidores, dominios, bases de datos, aplicaciones e incidencias.
- Proyecto → tareas, archivos, facturas y cobros, infraestructura vinculada.
- Servidor → dominios, aplicaciones, bases de datos, métricas, comprobaciones, alertas e incidencias.
- `infrastructure_relationships` añade vínculos explícitos (p. ej. «esta app usa esta base de datos») al mapa.

## Estados de infraestructura

Un recurso solo es **operativo** si una comprobación propia lo ha verificado recientemente (heartbeat del agente, HTTP, TCP, TLS o consulta D1). El estado del proveedor (`running`) se muestra aparte y **no** cuenta como verificación. Para bases de datos, un puerto accesible no basta: se exige una consulta real o un endpoint de salud.

## Facturación

1. Borrador editable (totales recalculados en servidor).
2. Emisión en transacción: comprueba datos fiscales, fecha no anterior a la última de la serie, asigna número correlativo, congela emisor y cliente (`*_snapshot`) y genera un registro con la estructura de VeriFactu (`IDEmisorFactura … FechaHoraHusoGenRegistro`) y su huella SHA-256 encadenada con la anterior.
3. Correcciones mediante factura rectificativa (serie R, líneas en negativo).

El registro **no se envía a la AEAT**; `verifactu_status` queda preparado para una integración futura con un sistema homologado.

## Planificador

`server/src/services/scheduler.js` (desactivable con `SCHEDULER_ENABLED=0`):

- 30 s: comprobaciones vencidas (concurrencia limitada).
- 15 min: vencimientos y avisos, facturas y cobros vencidos, generación de recurrentes, caducidad de dominios, recordatorio de tareas.
- 1 h: sincronización de integraciones (según intervalo configurado), retención de datos, purga de sesiones, copia diaria.
