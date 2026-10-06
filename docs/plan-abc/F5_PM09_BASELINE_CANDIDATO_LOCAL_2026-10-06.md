# F5 / PM09 · Candidato local de reconciliación

Fecha: 2026-10-06
Estado: `CANDIDATO_LOCAL_PROBADO_SIN_APLICACION_REMOTA`

## Alcance

La migración
`20261006040009_abc_f5_pm09_reconcile_prod_baseline.sql` crea únicamente
las tres RPC ausentes de la foto productiva: la base individual
`revertir_venta_stock` y los wrappers PM09 individuales de venta y reverso.
No reemplaza las funciones PM27 ni los tres wrappers PM09 ya presentes, no
altera tablas y no registra a mano ninguna migración histórica.

El reverso individual exige usuario y capacidad de stock, pertenencia al
local, una venta individual identificable, ausencia de devolución o reverso
previo, y un `operation_id` global sin conflicto. Invierte exactamente los
deltas de stock, conserva los datos económicos históricos con signo inverso
y admite replay solo con el mismo payload. Una venta de carrito debe usar su
RPC de carrito. Los wrappers PM09 exigen fecha económica y la guardan en el
movimiento. Las tres funciones usan `SECURITY DEFINER` con
`search_path = ''` y ejecución limitada a `authenticated`.

La migración es transaccional; sus condiciones previas requieren la ausencia
de las tres RPC objetivo, las huellas de tres dependencias productivas, el
esquema con claves externas de autor y 0 ventas/reversos de stock existentes.
Si cambia cualquiera de esos hechos, aborta. Antes de una ventana real debe
ejecutarse además el preflight completo de solo lectura del plan PM09.

## Prueba local

`node tools/pm09-prod-baseline-reconcile-postgres.mjs` devolvió
`PM09_PROD_BASELINE_POSTGRES=PASS` en PostgreSQL desechable. El fixture usa
`id` de movimiento como identidad y las dos claves externas a
`auth.users`. Toma la función de venta individual de la migración PM27
versionada. Para ejecutar el candidato contra este fixture, la prueba
sustituye **solo en memoria** las tres huellas previas por las del fixture;
el SQL versionado conserva las huellas observadas en producción.

La prueba comprobó:

- preflight fallido y transacción sin funciones nuevas ante una huella distinta;
- creación acotada, `search_path` y permisos de las tres RPC;
- venta individual, fecha económica, replay y rechazo de replay divergente;
- reverso, signo económico, fecha, stock restaurado y replay;
- rechazo de segundo reverso, venta con devolución, otro local, fecha ausente
  y `operation_id` ocupado por caja;
- rechazo de una segunda aplicación de la migración.

El fixture no sustituye una réplica productiva: sus funciones auxiliares de
autorización son simplificadas y no prueba el recorrido completo de la
aplicación. Quedan pendientes una revisión de seguridad, los contratos de CI
en un entorno independiente, la comprobación final de QA y una hoja de
autorización específica antes de cualquier escritura productiva.

## Estado remoto

No se aplicó esta migración en QA ni en producción. No se publicó ni fusionó
esta rama. El PR de arqueo #123 es independiente.
