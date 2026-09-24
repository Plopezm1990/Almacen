# Plan ABC — postflight A08 en PROD y smoke autorizado

Fecha: 24/09/2026. Repositorio: `Plopezm1990/Almacen`.

## Estado vivo comprobado

- `main`: `93a570badba1c5375febfbddc1dffdbcef003dcd`; `release`: `89a163906d2b7c3c7c082e0c0d7a65c334e3871e`. PR #71 fusionada; PR #38 abierta y en borrador.
- Supabase PROD `flqercbgpgmmfaakrwkc`: migración `20260924082637_abc_f3_a08_account_split_merge` en historial. QA `qjqorixtkilwsndqayyx`: `20260924071318_abc_f3_a08_account_split_merge`.
- En ambos proyectos existen `cuenta_linea_repartos`, `cuenta_relaciones` y `cuenta_cuotas_importe`. Las tres tienen RLS activo, una política SELECT para `authenticated` filtrada por `private.la_tiene_local(empresa_id,local_id)`, y SELECT como único privilegio efectivo para `authenticated`; `anon` y `service_role` no tienen privilegios efectivos de tabla.
- Las columnas, restricciones, índices, políticas y ACL de esas tres tablas son idénticos en QA y PROD. También son idénticos los cuerpos (`md5(pg_get_functiondef)`), firmas, configuración `search_path`, modo `SECURITY DEFINER` y ACL de las cinco RPC A08, cuatro helpers privados, el guard de cancelación y las dos RPC A06 extendidas. El trigger `a08_guard_cancelacion_reparto` existe y está habilitado en ambos.
- Las cinco RPC A08 permiten EXECUTE solo a `authenticated`; no a `anon` ni `service_role`. Los helpers privados revisados no permiten EXECUTE a esos roles. Las cinco RPC tienen dueño `postgres`, `SECURITY DEFINER` y `search_path` fijado. El helper de capacidades contiene las tres capacidades A08; A06 referencia el snapshot y total comercial de A08.
- Las tres tablas A08 tienen 0 filas tanto en QA como en PROD. El tenant ficticio `emp-f` y sus localidades no existen en PROD.

## Evidencia de comportamiento disponible

- El contrato A08 y regresiones A03–A07 pasaron en PostgreSQL desechable en el [run 35967987131](https://github.com/Plopezm1990/Almacen/actions/runs/35967987131) del HEAD `4485b1d5a7ab71fb4c1825c65ce5112799e9d770`. La [puerta general 35967987126](https://github.com/Plopezm1990/Almacen/actions/runs/35967987126) también concluyó con éxito. Son pruebas de CI, no una ejecución funcional en PROD.
- La descripción de la [PR #71](https://github.com/Plopezm1990/Almacen/pull/71) afirma un smoke QA con ROLLBACK. No se encontró una salida primaria independiente de ese smoke en los logs consultados.
- Los logs PostgreSQL de PROD registran el SQL de aplicación A08 y autoactivación de RLS para las tres tablas a las 08:26:37 UTC. A las 08:27:55 UTC registran un intento de ejecutar el fixture completo de CI en PROD; terminó con `permission denied for schema auth` al intentar `create table auth.users`. No acredita un smoke funcional ni un PASS posterior.

## Dictamen

Instalación estructural y paridad relevante QA/PROD: **acreditadas**. Tras la autorización específica del usuario, el smoke funcional transaccional descrito abajo pasó en PROD. **A08 queda técnicamente cerrada en PROD.** Esto no constituye validación operativa real del piloto de San Ginés: las pruebas emplean datos y cobros simulados. No se repitió la migración A08.

## Smoke autorizado y ejecutado

Se ejecutó una sola transacción SQL en PROD, con `BEGIN` y `ROLLBACK` obligatorios. La plantilla revisada fue `A08_PROD_SMOKE_PENDIENTE.sql`, generada por `PREPARAR_A08_PROD_SMOKE.ps1` a partir de `tests/f3/a08/a08-contract.sql` (blob Git `5e5f5cb0ac75920c960e29400dc0cc0d16abab50`, SHA-256 `2B26361355086C8EF22BE59ADF714902D6A4E921B404EBA09A0A06637168751F`). Los dos marcadores de usuario se sustituyeron por UUID existentes tras un nuevo preflight; el SQL con esos UUID se revisó antes de ejecutarse. Transformaciones exactas:

1. Retirar únicamente la línea `\\set ON_ERROR_STOP on` y el `INSERT INTO auth.users` de tres identidades de fixture, que no es admisible en PROD.
2. Sustituir los tres UUID ficticios del contrato por dos UUID ya existentes de `auth.users`: el primer usuario para el rol Propietario y el segundo para los roles Camarero/a (local ficticio 1) y Encargado (local ficticio 2). Confirmar antes que son distintos y que la pertenencia existente no se usa como autoridad para el tenant de fixture. Justo antes del test de aislamiento cross-local, desactivar **solo la membresía ficticia** del segundo usuario en `emp-f` / `loc-f1`; así queda únicamente su pertenencia ficticia a `loc-f2` durante ese test.
3. Encapsular el SQL transformado entre `BEGIN;` y `ROLLBACK;` en la misma llamada. Mantener intactas las demás inserciones de `emp-f` / `loc-f1` / `loc-f2`, llamadas RPC y aserciones del contrato.
4. Preflight inmediatamente anterior: historial A08 presente; los tres objetos y RPC presentes; IDs ficticios libres; dos usuarios existentes y distintos; 0 filas A08 y 0 operaciones de `emp-f`. Abortar sin ejecutar si alguna condición cambia. La transacción incorpora la segunda comprobación de estos datos.
5. Verificar el resultado `ABC_F3_A08_CONTRACT=PASS` antes del ROLLBACK, y después confirmar 0 filas de `emp-f` en tablas de fixture, operaciones, eventos, reparto y cobros, además de las tres tablas A08 sin cambio de recuento. Registrar la salida y cualquier error.

Impacto esperado: escrituras de datos simulados y locks transaccionales de corta duración solo en PROD; ningún cobro externo ni despliegue. Las escrituras y eventos SQL se revierten al hacer `ROLLBACK`. Riesgo residual: error del fixture por diferencias de esquema o bloqueo breve; si falla la ejecución, la transacción debe abortarse y se verificará que no haya residuos. Si aparecieran residuos, no se haría limpieza automática: se presentaría un plan preciso y se pediría nueva autorización.

Autorización específica recibida en esta tarea. Preflight inmediatamente anterior: migración y cinco RPC presentes, dos usuarios existentes y distintos, IDs de fixture libres, tres tablas A08 y operaciones ficticias con cero filas. Se ejecutó la plantilla SHA-256 `D0422A2D58FB7F6BB51DA2BEE376176BC6CF694ECE391AC264B6053B9D366366` con los UUID existentes sustituidos en memoria, sin guardarlos en el repositorio. Resultado final: `ABC_F3_A08_PROD_SMOKE=PASS` y todos los contadores residuales a cero. Una consulta independiente posterior confirmó de nuevo cero empresas, locales, membresías, operaciones, eventos, repartos, relaciones, cuotas, pagos y checkouts de fixture; `auth.users` permaneció con dos usuarios.
