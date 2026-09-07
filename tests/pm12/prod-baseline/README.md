# PM12 · P08 · Preparación de despliegue productivo seguro

Estado: **BASELINE PRODUCTIVA APLICADA · P08 PENDIENTE POR STOP DE DDL DESTRUCTIVO**.

## Inventario verificado

- `main` permanece congelado en el checkpoint acordado.
- La rama parte del cierre remoto de PM12-P08 y no modifica P02-P07.
- Producción conserva `public.perfiles`, `public.almacen_kv` y `public.movimientos_registro`.
- Producción conserva cuentas Auth; la baseline no crea, borra ni reasigna usuarios.
- `almacen_kv` y `movimientos_registro` no contienen datos operativos históricos que reconciliar.
- QA contiene una cadena mayor y fixtures/base propios; no se usa como baseline de producción.

## Baseline productiva mínima

`pm12-produccion-baseline-candidate.sql` crea únicamente:

1. `membresias_usuario` y helpers privados de usuario/empresa/local/rol;
2. `stock_ubicacion`, `stock_operaciones` y `movimientos_stock` con RLS y escritura directa denegada;
3. validación de cantidades PM07;
4. bloqueo `operation_id` PM08, registro global G1 y bloqueo stock PM09 sin crear ledgers financieros.

No crea caja, arqueos, devoluciones, empleados, compras ni fixtures. No inserta membresías ni stock. El acceso nuevo queda cerrado hasta que exista una membresía explícita; un perfil productivo explícitamente inactivo continúa bloqueando.

## Gate aislado

La baseline fue validada en PostgreSQL + Supabase Auth + JWT + PostgREST + RLS junto con la migración P08 real, incluyendo replay concurrente, cancelación concurrente, aislamiento, denegación de PATCH directo, grants, constraints, índice único, ausencia de módulos/objetos QA y regresión PM12 P02-P07.

Gate de promoción: `34152579612` — **SUCCESS**.

## Promoción realizada

La baseline aditiva fue aplicada en producción como migración separada `pm12_produccion_baseline_p08`.

Validación posterior de solo lectura:

- 0 filas en `membresias_usuario`;
- 0 filas en `stock_ubicacion`;
- 0 filas en `stock_operaciones`;
- 0 filas en `movimientos_stock`;
- 0 filas en `almacen_kv` y `movimientos_registro`, sin cambio respecto al preflight;
- `anon` sin lectura del ledger;
- `authenticated` con SELECT de ledger, sin INSERT directo;
- helper RLS de local ejecutable por `authenticated`.

## Stop obligatorio antes de P08

La migración P08 real necesita sustituir los CHECK `stock_operaciones_tipo_check` y `movimientos_stock_tipo_check`: técnicamente ejecuta `DROP CONSTRAINT` y recrea ambos checks ampliados con `INVENTARIO_PM12`.

Aunque no implica borrado de filas y el gate aislado demuestra el resultado esperado, esta operación entra en la regla de parada previa a DDL destructivo. Por tanto, **P08 no se declara desplegado ni se continúa a P09** hasta recibir autorización explícita para reemplazar esos dos constraints y completar después las validaciones remotas de P08.
