# F5 / PM09 · Candidato local de reconciliación

Fecha: 2026-10-06
Estado: `PR_BORRADOR_SIN_APLICACION_REMOTA`

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

La CLI aplica la migración y su registro de historia en una transacción;
el archivo no incluye `BEGIN`/`COMMIT` propios. Sus condiciones previas requieren la ausencia
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
sustituye las tres huellas previas **solo en una copia temporal** por las del
fixture; el SQL versionado conserva las huellas observadas en producción.
Además ejecuta `supabase migration up` en un directorio aislado, comprueba
que registre la versión `20261006040009` y que se niegue a avanzar si falta
un archivo local de una versión ya registrada en la base. La CLI usada en el
ensayo fue la 2.39.2.

La prueba comprobó:

- preflight fallido y transacción sin funciones nuevas ante una huella distinta;
- creación acotada, `search_path` y permisos de las tres RPC;
- venta individual, fecha económica, replay y rechazo de replay divergente;
- reverso, signo económico, fecha, stock restaurado y replay;
- rechazo de segundo reverso, replay con otro motivo, venta con devolución,
  otro local, venta de carrito, fecha ausente, usuario no autenticado y
  `operation_id` ocupado por caja;
- ninguna operación residual tras esos rechazos;
- rechazo de una segunda aplicación de la migración.

El fixture no sustituye una réplica productiva: sus funciones auxiliares de
autorización son simplificadas y no prueba el recorrido completo de la
aplicación. La revisión de seguridad y la hoja de preparación de la ventana
constan en `F5_PM09_BASELINE_VENTANA_PREPARACION_2026-10-06.md`. El humo
autenticado de QA terminó con `ROLLBACK` y sin residuos el 6/10/2026. Sigue
pendiente una autorización específica antes de cualquier escritura productiva.

## Estado remoto

El candidato se publicó en el [PR borrador #125](https://github.com/Plopezm1990/Almacen/pull/125),
con base `release`. El 10/10/2026 se integró la base `release` `339ed81` y se
ajustó el contrato F7 para excluir únicamente esta migración PM09 separada,
manteniendo las 51 migraciones del paquete F7. Pasaron localmente el contrato
F7, el validador del manifiesto CI (247 archivos, 230 contratos activos),
`PM09_PROD_BASELINE_POSTGRES=PASS` y `git diff --check`. El plan y su preflight
están en el [PR borrador #124](https://github.com/Plopezm1990/Almacen/pull/124),
también en borrador. No se aplicó esta migración en QA ni en producción y
ninguno de los PR está fusionado.
