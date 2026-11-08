# PM13 · Punto 5.8 — corrección de lectura directa en RLS

Fecha: 2026-10-17  
Entorno validado: Supabase QA `qjqorixtkilwsndqayyx`  
PR de trabajo: `#150`  

## Problema confirmado

La política anterior de `public.empleados` permitía `SELECT` a una sesión `authenticated` si pertenecía al local como Propietario o Encargado, pero no evaluaba `PM13_PERSONAL_CONSULTAR`. El adaptador de interfaz sí aplicaba el permiso; una consulta directa a la tabla podía saltarse ese límite.

## Corrección

La migración `20261017185011_pm13_p05_empleados_rls_gate.sql` reemplaza la política de lectura por una política `to authenticated` que exige que `public.pm13_resolver_cargo_permiso` devuelva `permitido=true` para `PM13_PERSONAL_CONSULTAR`, acción `CONSULTAR` y alcance `LOCAL`. La evaluación es fail-closed.

## Evidencia QA

- Con el permiso temporalmente revocado dentro de una transacción, el resolver devolvió `permitido=false` y motivo `cargo_revocado`.
- Con la política anterior, la misma sesión podía ver 2 filas de `public.empleados`.
- Tras aplicar la migración, con el permiso temporalmente revocado, la misma consulta devolvió 0 filas.
- La transacción de prueba se abortó con `ROLLBACK`; el permiso quedó persistente como `permitido=true`, versión `7`.
- `anon` no tiene `SELECT`; `authenticated` conserva el privilegio de tabla, pero queda limitado por RLS.
- Los contratos PM13 P18, P19, P22 y P23 pasan.

No se modificó producción ni se usó `db push` o `migration repair`.
