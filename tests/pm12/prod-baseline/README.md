# PM12 · P08 · Preparación de despliegue productivo seguro

Estado: **EN VALIDACIÓN AISLADA**. No declarar desplegado hasta gate remoto SUCCESS y comprobación posterior del entorno objetivo.

## Inventario verificado

- `main` permanece congelado en el checkpoint acordado.
- La rama parte del cierre remoto de PM12-P08 y no modifica P02-P07.
- Producción conserva `public.perfiles`, `public.almacen_kv` y `public.movimientos_registro` y no contiene todavía la frontera PM07/P08/P09 necesaria para P08.
- Producción conserva cuentas Auth; la baseline no crea, borra ni reasigna usuarios.
- `almacen_kv` y `movimientos_registro` no contienen datos operativos históricos que reconciliar.
- QA contiene una cadena mayor y fixtures/base propios; no se usa como baseline de producción.

## Baseline candidata

`pm12-produccion-baseline-candidate.sql` crea únicamente:

1. `membresias_usuario` y helpers privados de usuario/empresa/local/rol;
2. `stock_ubicacion`, `stock_operaciones` y `movimientos_stock` con RLS y escritura directa denegada;
3. validación de cantidades PM07;
4. bloqueo `operation_id` PM08, registro global G1 y bloqueo stock PM09 sin crear ledgers financieros.

No crea caja, arqueos, devoluciones, empleados, compras ni fixtures. No inserta membresías ni stock. El acceso nuevo queda cerrado hasta que exista una membresía explícita; un perfil productivo explícitamente inactivo continúa bloqueando.

Después de esta baseline, el gate aplica **sin modificar** `supabase/migrations/20260907155028_pm12_p08_stock_atomico.sql`.

## Gate aislado

El preparador elimina las migraciones del fixture QA y reconstruye la pila efímera con solo:

1. un fixture mínimo de objetos productivos ya existentes;
2. la baseline candidata;
3. la migración P08 real.

Se valida con PostgreSQL + Supabase Auth + JWT + PostgREST + RLS, replay concurrente, cancelación concurrente, aislamiento, denegación de PATCH directo, grants, constraints, índice único y ausencia de módulos/objetos QA. Después ejecuta regresión PM12 P02-P07.

## Regla de promoción

No aplicar nada a producción si el gate no termina `SUCCESS`, si `main` cambió, si aparecen datos históricos inesperados o si el diff previo muestra objetos destructivos. La promoción productiva, si procede, debe constar como migración de baseline separada y luego P08; después se ejecutarán únicamente comprobaciones de metadatos/lectura y advisors, sin fixtures ni smoke mutante.
