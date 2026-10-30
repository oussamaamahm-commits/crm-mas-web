# Copias de seguridad y recuperación

## Qué hay que proteger

| Elemento | Dónde | Cómo se copia |
|---|---|---|
| Base de datos | `data/webpulsar.db` (+ `-wal`, `-shm`) | Copia diaria automática con `VACUUM INTO` en `data/backups`, manual con `npm run backup` o desde *Configuración → Copias y datos* |
| Archivos subidos | `data/uploads` | Copia externa (rclone/rsync) |
| `MASTER_KEY` | `.env` | **Fuera del servidor** (gestor de contraseñas). Sin ella no se pueden descifrar tokens ni credenciales de una copia |
| Configuración | `.env` | Copia cifrada fuera del servidor |

`VACUUM INTO` genera un archivo SQLite consistente sin detener la aplicación.

## Restaurar la base de datos

```bash
sudo systemctl stop web-pulsar
cd /opt/web-pulsar/app/data
sudo -u webpulsar mv webpulsar.db webpulsar.db.antes-de-restaurar
sudo -u webpulsar rm -f webpulsar.db-wal webpulsar.db-shm
sudo -u webpulsar cp backups/webpulsar-AAAAMMDD-HHMMSS.db webpulsar.db
sudo systemctl start web-pulsar
```

Comprueba después:

1. Inicia sesión y revisa el Overview.
2. *Actividad → Auditoría → Verificar integridad* debe indicar cadena íntegra.
3. *Configuración → Integraciones → Verificar*: confirma que la `MASTER_KEY` es la correcta (si no, los tokens no se podrán descifrar y habrá que volver a introducirlos).

## Restaurar archivos

```bash
rclone sync r2-cifrado:web-pulsar/uploads /opt/web-pulsar/app/data/uploads
sudo chown -R webpulsar:webpulsar /opt/web-pulsar/app/data/uploads
```

## Recuperación ante la pérdida del VPS

1. Crea un VPS nuevo y sigue `DESPLIEGUE.md` hasta el paso 2 (sin `npm run setup` todavía).
2. Restaura `.env` (con la misma `MASTER_KEY`), la última copia de la base de datos como `data/webpulsar.db` y `data/uploads`.
3. `npm run migrate` y continúa con systemd, Nginx y Cloudflare (actualiza la IP del registro DNS).
4. Genera de nuevo los tokens de agente de los servidores monitorizados si cambia la URL.

## Pérdida de la MASTER_KEY

Los datos de negocio no se pierden, pero los tokens de integraciones y las credenciales del almacén quedan ilegibles: genera una clave nueva (`npm run setup` sobre un `.env` sin `MASTER_KEY`), vuelve a introducir los tokens en Integraciones y rota las credenciales almacenadas.

## Ensayo recomendado

Una vez al trimestre, restaura la última copia en un entorno de pruebas y verifica la integridad de la auditoría.
