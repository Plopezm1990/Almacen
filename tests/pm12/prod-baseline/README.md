# PM12 · P08 · Despliegue productivo seguro

Estado: **P08 DESPLEGADO Y VALIDADO EN PRODUCCIÓN**.

## Inventario y límites respetados

- `main` permanece congelado en el checkpoint acordado.
- No se rehizo PM12 P02-P07.
- QA no se utilizó como baseline de producción y no se importaron fixtures.
- Producción conservó sus usuarios Auth y perfiles existentes.
- No existían conteos, operaciones ni movimientos históricos de inventario que reconciliar.
- No se ejecutó smoke mutante en producción.

## Baseline productiva mínima

La baseline específica de producción crea únicamente la frontera necesaria para P08:

1. `membresias_usuario` y helpers privados de usuario/empresa/local/rol;
2. `stock_ubicacion`, `stock_operaciones` y `movimientos_stock` con RLS;
3. validación de cantidades PM07;
4. bloqueo `operation_id` PM08, registro global G1 y bloqueo stock PM09.

No crea caja, arqueos, devoluciones, empleados, compras ni fixtures y no inserta membresías, stock, operaciones o movimientos.

La baseline fue aplicada como migración separada `pm12_produccion_baseline_p08`.

## Validación aislada previa

La cadena baseline + migración P08 real fue validada en PostgreSQL y Supabase desechable con Auth, JWT, PostgREST y RLS. Incluyó replay concurrente, cancelación concurrente, aislamiento de scope, denegación de escritura directa, grants, constraints, índice único y regresión acumulada P02-P07.

Gate funcional de promoción: `34152579612` — **SUCCESS**.

Un gate documental posterior falló inicialmente antes de cargar migraciones por conflicto efímero del puerto local del runner. Se reejecutó el job fallido sin cambios funcionales y terminó en **SUCCESS**: `34152947306`, intento 2.

## P08 productivo

Con autorización explícita se reemplazaron los dos CHECK de tipo y se aplicó la migración P08 real como `pm12_p08_stock_atomico_produccion`.

Validación remota de solo lectura posterior:

- `stock_operaciones_tipo_check` admite `INVENTARIO_PM12`;
- `movimientos_stock_tipo_check` admite `INVENTARIO_PM12`;
- índice único `pm12_un_ajuste_por_conteo` presente;
- RPC `pm12_confirmar_ajuste_stock` presente;
- RPC `pm12_cancelar_conteo_stock` presente;
- `anon` sin EXECUTE sobre ambos RPC;
- `authenticated` con EXECUTE sobre ambos RPC;
- RLS activo en `stock_ubicacion`, `stock_operaciones` y `movimientos_stock`;
- escritura INSERT directa denegada a `authenticated` en las tres tablas;
- 0 filas en `membresias_usuario`;
- 0 filas en `stock_ubicacion`;
- 0 filas en `stock_operaciones`;
- 0 filas en `movimientos_stock`.

El despliegue no creó efectos de negocio.

## Advisors

No apareció un hallazgo nuevo que invalide P08. `membresias_usuario` figura con RLS y sin políticas directas de cliente de forma deliberada porque la tabla permanece cerrada; los demás avisos visibles corresponden a superficies heredadas fuera del alcance de este despliegue.

## Cierre

PM12-P08 queda **CERRADO EN PRODUCCIÓN** con baseline mínima, migración registrada, permisos/RLS verificados, cero efectos secundarios y gate remoto verde.

Siguiente punto documental: **PM12-P09 — historial, informes y móvil**. Se reutiliza el diagnóstico P09 ya existente y no se rehacen P02-P08.
