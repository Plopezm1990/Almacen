# Fase 1 — administrador de plataforma y alta, baja y reactivación de empresas: resultado en QA

Fecha: 9/10/2026
Estado: **APLICADA Y VERIFICADA EN QA** (`qjqorixtkilwsndqayyx`). **Producción no se ha tocado.** Nadie ha sido registrado todavía como administrador de plataforma (ni en QA ni en producción).

Autorización de Pedro: «no me interesan ningunos de los datos que hay en producción, son pruebas que he estado haciendo, empieza con la fase 1» y, después, «Sí, aplicar en QA» a la pregunta sobre aplicar la migración en QA. Solo QA.

## Qué se ha construido
Archivo del repositorio: `supabase/migrations/20261009120000_plataforma_f1_administrador_y_empresas.sql` (no se aplica solo a producción).

| Pieza | Para qué |
|---|---|
| `private.plataforma_admins` | Quién es administrador de la plataforma. La API no puede leerla ni escribirla |
| `private.plataforma_bajas` | Qué se desactivó en cada baja (membresías y locales) para que reactivar devuelva exactamente eso. Una baja reactivada **no se borra**: queda con la fecha `reactivada_en` |
| `private.plataforma_auditoria` | Un apunte por operación (quién, qué, cuándo, `operation_id` único). Sin datos de negocio |
| `private.es_admin_plataforma()` | Cuenta registrada **y** perfil Propietario activo |
| `private.plataforma_registrar_admin(uuid, nota)` | Alta manual de un administrador. Ningún rol de la API puede ejecutarla |
| `plataforma_estado()` | «¿Soy administrador?» y recuentos de empresas activas/desactivadas |
| `plataforma_listar_empresas()` | Lista (nombre, estado, locales y usuarios, propietarios con correo, motivo y fecha de baja). Solo administrador |
| `plataforma_crear_empresa(op, nombre, local, cif, propietario)` | Crea empresa + primer local (+ propietario si ya tiene cuenta), todo o nada, idempotente, sin nombres ni CIF duplicados |
| `plataforma_asignar_propietario(op, empresa, usuario)` | Hace Propietario de esa empresa a una cuenta que ya existe |
| `plataforma_desactivar_empresa(op, empresa, motivo)` | Baja reversible: empresa, locales y membresías pasan a inactivos; los datos no se tocan |
| `plataforma_reactivar_empresa(op, empresa)` | Devuelve exactamente lo que desactivó la baja |
| Guarda en `guardar_contexto_instalacion_ui` | En cuanto exista un administrador registrado, solo un administrador puede crear empresas desde la pantalla. Sin administradores, todo sigue como antes |

No se ha tocado `obtener_estado_instalacion` ni `bootstrap_owner_instalacion` (en QA el primero es un sustituto que siempre devuelve «ready»; son distintos de producción). El estado «administrador sin empresas» se resuelve en la fase 3 con `plataforma_estado()`.

## Cómo se probó
1. **Contrato con Postgres 16 real** (`tests/plataforma/db/p01-plataforma-empresas-contract.mjs`, registrado en el manifiesto como contrato activo `postgres`): permisos, creación todo-o-nada, idempotencia, duplicados, propietarios no válidos, baja y reactivación exactas (un local ya inactivo antes de la baja sigue inactivo), segundo ciclo de baja, auditoría, perfil desactivado, guarda de la pantalla antigua con y sin administrador, ACL (anon y authenticated no llegan a lo privado) y contrato estático del archivo (sin identificadores de cuentas, sin correos, sin borrados ni `drop`). **9 mutantes** (se rompe a propósito una pieza cada vez) y los 9 los detecta la prueba.
2. **QA con la seguridad real de filas** (prueba dentro de una transacción que se revierte al final; QA quedó idéntico: 2 empresas, 4 locales, 8 membresías, 0 administradores, 0 apuntes):
   - un Propietario normal: `es_admin = false`; listar y crear → `42501 Administrador de plataforma requerido`; crear por la pantalla antigua → `42501 Solo el administrador de la plataforma puede crear empresas`;
   - el administrador: `es_admin = true`; crea empresa + local + propietario; repetir la misma orden devuelve el mismo resultado;
   - el propietario ve su empresa nueva (`la_tiene_empresa` = verdadero) y **lee las modalidades por defecto del local nuevo** (no hace falta sembrar ajustes);
   - tras **desactivar**, `la_tiene_empresa` pasa a **falso** y la lectura de configuración queda bloqueada (`abc_config_no_autorizado`); tras **reactivar**, vuelve a verdadero;
   - un cajero: `es_admin = false`.
3. Las huellas md5 de las 12 funciones en QA coinciden con las de la base local donde se ejecutó el archivo real.
4. Batería Node completa del repositorio y validador del manifiesto (ver «Cifras»).

## Cómo se aplicó en QA (trazabilidad)
La herramienta de la base de datos canceló las llamadas grandes y la que llevaba un `delete`. Se decidió con Pedro **no borrar** la baja al reactivar (se marca `reactivada_en`) y se aplicó en trozos pequeños. En el registro de migraciones de QA aparecen por tanto 10 entradas `plataforma_f1_*` (a, b, c, d, e, f—cancelada y sustituida—, g, h, i, j) en lugar de una; el contenido final equivale al archivo del repositorio (mismas huellas de función). En producción se aplicará el archivo único del repositorio, con autorización escrita de Pedro.

## Cambios en pruebas existentes
- `tests/cfg/f7-preflight-static-contract.mjs`: la foto previa de F7 se acota a sus 46 migraciones (`PRIMERA`…`ULTIMA = 20261003130000`); las posteriores tienen su propio paquete.
- CI: manifiesto 245 archivos / 228 contratos activos / 20 Postgres; `tests/ci/preparar_postgres_local.sh`, validador y flujo `puerta-ci-release.yml` actualizados.

## Cifras (9/10/2026, en local con Postgres 16, sobre el commit `a982c7b`)
- Batería Node: **204 de 204** contratos activos en verde, 0 fallos de infraestructura, árbol limpio tras la ejecución.
- Batería Postgres 16 (mismo arnés que la integración, con el cliente `pg` de los contratos F5 preparado como hace el flujo): **20 de 20** activos en verde (19 anteriores + el nuevo `tests/plataforma/db/p01-plataforma-empresas-contract.mjs`) y **1** histórico esperado en rojo, como antes.
- Validador del manifiesto: 245 archivos, 228 contratos activos (204 Node + 20 Postgres + 1 PGlite + 3 pila completa).
- Pruebas de ejecución de interfaz (9 de ellas) necesitan la carpeta de dependencias de interfaz (`CFG6_UI_DEPS`); sin ella salen con código 2 en un entorno limpio, igual que antes de este cambio.

## Fase 1b — cuenta del dueño de una empresa cliente (en el repositorio, sin desplegar)
Decisión de Pedro (9/10/2026): **contraseña inicial que le da él**.
- `supabase/functions/plataforma-crear-propietario/index.ts` (verify_jwt = true): comprueba la sesión, comprueba **en el servidor** que quien llama es administrador de la plataforma (`plataforma_estado`, con el JWT de quien llama), valida la petición (`supabase/functions/_shared/plataforma-propietario.js`), comprueba que la empresa existe y está activa, crea la cuenta en Auth (`email_confirm`, `user_metadata.debe_cambiar_contrasena = true`), llama a `plataforma_asignar_propietario` con el JWT del administrador (la base de datos vuelve a comprobar el permiso y es quien crea perfil y membresía) y, si algo falla, borra la cuenta (o la bloquea) para no dejar un acceso a medias.
- Contraseña inicial: mínimo 10 caracteres, letras y números, sin contener el correo. La clave de servicio solo vive en el entorno del servidor.
- **Límite conocido:** el indicador `debe_cambiar_contrasena` aún no lo exige ninguna pantalla; se implementa en la fase 3. Hasta entonces, el dueño debe cambiar la contraseña por el procedimiento normal.
- Prueba: `tests/plataforma/p02-crear-propietario-contract.mjs` (contrato Node, registrado: 205 Node + 20 Postgres + 1 PGlite + 3 pila completa = 229 activos, 246 archivos). Validación pura probada caso a caso y orden de comprobaciones de la función (sesión → administrador → validación → empresa → crear → asignar → deshacer); 5 mutantes, los 5 detectados. Batería Node completa: 205 de 205.
- `supabase/functions/edge-security-manifest.json` **no** se modifica: está atado al candidato P2 (`base_release e8de01f…`) y su contrato exige exactamente 3 funciones.
- **Desplegada solo en QA** (Pedro lo autorizó el 9/10/2026): función `plataforma-crear-propietario` versión 1 (`verify_jwt` = true, `ezbr_sha256` `f2c36071…`); su contenido vivo coincide con los dos archivos del repositorio (`index.ts` `6d1eb5ea…` y `_shared/plataforma-propietario.js` `5fb98611…`). Pruebas sin sesión: sin cabecera de autorización → 401; origen ajeno → 403; origen de la vista previa → 200; GET → 401 de la pasarela.
- **Administrador registrado solo en QA:** `owner.a@qa.invalid` (cuenta ficticia «QA Propietario A», nota «pruebas de plataforma»). Efecto en QA: ahora solo un administrador puede crear empresas desde la pantalla antigua. En producción no hay ningún administrador registrado.
- Prueba de punta a punta con la sesión real: `docs/plan-empresas/PRUEBA_COWORK_FASE1_QA.md` (la ejecuta Cowork; queda una empresa de prueba para ensayar el borrado de la Fase 2).

## Prueba de punta a punta con la sesión real (Cowork, 9/10/2026)
Cowork revisó el código línea por línea antes de ejecutarlo (sin claves ni tokens incrustados; solo la sesión de `owner.a@qa.invalid` y la clave pública del proyecto), inició sesión en la vista previa de QA (`deploy-preview-118--…`) y ejecutó los 19 pasos de `PRUEBA_COWORK_FASE1_QA.md`. **Los 19 dieron exactamente el resultado esperado**, sin diferencias:
- 01 `es_admin: true` (1 empresa activa y 1 desactivada antes de la prueba); 02 alta de empresa y local; 03 contraseña débil → 400; 04 cuenta del dueño → 200; 05 mismo correo → 409; 06 empresa inexistente → 404; 07 el listado muestra la empresa con su dueño (1 usuario activo, 1 local activo).
- 08 el dueño inicia sesión; 09 no es administrador; 10 y 11 no puede listar ni crear empresas (`42501 Administrador de plataforma requerido`); 12 la función de crear dueños le responde 403.
- 13 lee la configuración de su local (modalidades por defecto: BARRA, MESA, TERRAZA, TAKEAWAY, OTRO); 14 no puede leer la de otra empresa (`abc_config_no_autorizado`).
- 15 baja (1 local y 1 membresía desactivados); 16 tras la baja el dueño ya no lee su local; 17 reactivación (1 local y 1 membresía); 18 el dueño vuelve a leer su local; 19 listado final sin baja.
- Red: todas las peticiones fueron solo al proyecto de QA (`qjqorixtkilwsndqayyx.supabase.co`) más la propia vista previa y fuentes; ninguna a producción. Sin avisos en pantalla; en consola solo los errores HTTP provocados a propósito (400, 409, 404, 403) y el ruido ya conocido (`seleccion-neutral-patch.js`, `auth-ux-patch.js`, avisos de CSP).

**Restos en QA para ensayar el borrado de la Fase 2** (no se borran a mano): empresa `empresa-5ed41d21a3b3b7f8` («QA Cliente Prueba F1 mv0vwsww»), local `local-90c09d1e2f3f2243`, cuenta de acceso `duena.f1.mv0vwsww@qa.invalid` (usuario `7f3f3ed6-…`) y sus apuntes de auditoría de plataforma.

## Lo que falta de la Fase 1
1. ~~Alta de la cuenta del dueño de una empresa cliente~~ HECHO en QA (fase 1b, probada de punta a punta).
2. **Registrar la cuenta real de Pedro como administradora en producción**: `select private.plataforma_registrar_admin('<id de la cuenta>')`, con autorización escrita de Pedro (fase 5). Aún no hecho; en producción no hay ningún administrador.
3. Documento de autorización para producción (fase 5) con el archivo único y sus huellas (migración + función de servidor).
4. La pantalla que exija cambiar la contraseña inicial del dueño (`debe_cambiar_contrasena`) y el panel «Plataforma»: fase 3.

## Fase 2 (siguiente)
Borrado definitivo: función de purga en orden correcto, modo excepcional para las tablas inmutables, exportación previa, acta de borrado y prueba de cobertura (que falle si se añade una tabla con `empresa_id` sin incluirla). Plazo de gracia pendiente de confirmar por Pedro (propuesta: 30 días). Los datos actuales de producción no hace falta exportarlos (decisión de Pedro: son pruebas).
