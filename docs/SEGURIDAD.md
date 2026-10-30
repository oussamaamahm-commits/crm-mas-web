# Seguridad

## Autenticación y sesiones

- Contraseñas con **scrypt** (N=32768, r=8, p=1, sal aleatoria). Política: mínimo 12 caracteres y tres tipos de carácter; no puede contener el email ni el nombre.
- Sesiones en servidor: el navegador solo guarda un token aleatorio de 256 bits en cookie `httpOnly`, `SameSite=Strict`, `Secure` y con prefijo `__Host-` en producción. En la base de datos solo se guarda su SHA-256.
- Caducidad absoluta (12 h) e inactividad (2 h), configurables.
- Bloqueo temporal tras 5 intentos fallidos (15 min) y rate limiting por IP en login, recuperación y operaciones sensibles. Tiempo de respuesta igualado cuando la cuenta no existe.
- Recuperación de contraseña con token de un solo uso (30 min) que cierra todas las sesiones; si no hay SMTP, un administrador genera el enlace.
- Cambio de contraseña cierra el resto de sesiones; cada usuario ve y cierra sus sesiones activas.
- Registro de accesos inmutable (éxitos, fallos, bloqueos, cierres y cambios de contraseña).

## Autorización

- Roles: Administrador, Técnico, Finanzas y Solo lectura, con 31 permisos granulares definidos en `server/src/auth/rbac.js`.
- **Todas** las rutas verifican permisos en el servidor (`can(...)`); el frontend solo oculta lo que el usuario no puede usar.
- El administrador principal no puede ser desactivado ni perder el rol de administrador.
- Reautenticación con contraseña para operaciones críticas: eliminar clientes o servidores, copiar credenciales, generar tokens de agente, acciones de energía en VPS, borrar registros DNS, eliminar datos DEMO.

## Protección de peticiones

- **CSRF:** token por sesión en cabecera `X-CSRF-Token` + verificación de `Origin`.
- **XSS:** React escapa toda salida; no se usa `dangerouslySetInnerHTML`. CSP estricta (`default-src 'self'`, sin scripts en línea, `frame-ancestors 'none'`). Los documentos se descargan como adjunto con `Content-Security-Policy: sandbox` y `nosniff`.
- **SQL injection:** consultas parametrizadas; ordenaciones por lista blanca.
- **Validación:** Zod en todas las entradas (incluida validación de NIF/NIE/CIF).
- Cabeceras de seguridad con Helmet, límite de tamaño de peticiones y subidas (25 MB), bloqueo de ejecutables y HTML en subidas.

## Secretos

- Tokens de Hostinger, Cloudflare y SMTP, y credenciales del almacén, cifrados con **AES-256-GCM** usando `MASTER_KEY` (variable de entorno, nunca en la base de datos).
- Nunca se envían al navegador: los listados no incluyen valores; las credenciales del almacén solo se copian al portapapeles tras confirmar contraseña y cada uso queda auditado.
- Los registros y la auditoría ocultan automáticamente campos sensibles (`password`, `token`, `secret`, `*_hash`, `*_enc`, `iban`).
- Tokens del agente: se muestran una sola vez y se guarda su SHA-256; comparación en tiempo constante.
- Nada se guarda en `localStorage` salvo preferencias de vista (filtros, menú contraído).

## Auditoría

- `activity_logs`: cronología de negocio visible en la app.
- `audit_logs`: antes/después de cada cambio, usuario, IP y navegador, con **cadena de hashes** verificable desde *Actividad → Auditoría → Verificar integridad*.
- Ambos protegidos por triggers contra modificación y borrado.

## Datos financieros

- Las facturas emitidas no se pueden modificar ni borrar (también a nivel de base de datos).
- Un cliente con información financiera no puede eliminarse; solo archivarse.
- Los cobros vinculados a facturas no se editan: se cancelan y se registran de nuevo, con trazabilidad.

## Recomendaciones de despliegue

- Cloudflare con proxy activado, SSL **Full (strict)**, WAF y *Bot Fight Mode*; opcionalmente Cloudflare Access delante de la app.
- Firewall del VPS: solo 22 (restringido) y 443 (idealmente solo desde rangos de Cloudflare).
- `MASTER_KEY` y `.env` con permisos 600, propiedad del usuario de servicio.
- Copias externas cifradas (ver RESTAURACION.md).
