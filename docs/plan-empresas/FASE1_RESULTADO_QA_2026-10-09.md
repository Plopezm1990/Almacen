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

## Cifras
Ver el apartado final de este documento (se rellena al cerrar la batería).

## Lo que falta de la Fase 1
1. **Registrar la cuenta de Pedro como administradora** (en QA para probar; en producción con autorización escrita): `select private.plataforma_registrar_admin('<id de la cuenta>')`. Aún no hecho.
2. **Alta de la cuenta del dueño de una empresa cliente** (Auth): función de servidor con clave de servicio, estilo `crear-cuenta-empleado`. Pendiente de la decisión: invitación por correo o contraseña inicial que da Pedro.
3. Documento de autorización para producción (fase 5) con el archivo único y sus huellas.

## Fase 2 (siguiente)
Borrado definitivo: función de purga en orden correcto, modo excepcional para las tablas inmutables, exportación previa, acta de borrado y prueba de cobertura (que falle si se añade una tabla con `empresa_id` sin incluirla). Plazo de gracia pendiente de confirmar por Pedro (propuesta: 30 días). Los datos actuales de producción no hace falta exportarlos (decisión de Pedro: son pruebas).
