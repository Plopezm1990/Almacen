# P2-PM13 — Fichajes post-reset sobre release actual

Estado: **candidato GitHub-only; no aplicado por este candidato a Supabase QA ni PROD**.

## Baseline

- `release@824d51d5fb76039d1d1d33de0ce32fea9c902f77`
- rama: `claude/p2-pm13-release-current`
- histórico PM13: `eba3962b1a20e5d8fef14540f5c08b1f13f14cc9`
- run histórico: `35245786300`
- job histórico: `105285512704` — SUCCESS
- SQL principal histórico: blob `eff1b98b8e027946a5af9d70babaf6151f610a5f`
- self-RLS fix histórico: blob `fa026a63128536f40c2639ea6401a2be959177c1`

## Inventario vivo previo

QA:
- `fichajes_registro` existe, RLS activo y 2 filas agregadas; no se leyó su contenido.
- Las 2 filas tienen `empleadoId/localId`, carecen de `operationId` y no presentan duplicados de operationId.
- Existe PM13 histórico previo, pero no el paquete P2 completo.
- Sigue el índice legado `pm13_fichajes_operation_id_empleado_uq`.
- Falta el índice global `pm13_fichajes_operation_id_uq`.
- Falta `pm13_fichajes_empleado_local_fecha_idx`.
- La policy self-RLS está en la forma antigua.
- Quedan grants directos REFERENCES/TRIGGER/TRUNCATE a authenticated.

PROD:
- `fichajes_registro` conserva las 4 policies legacy y escritura directa INSERT/UPDATE/DELETE.
- No existe todavía `public.empleados` ni los helpers PM11; el preflight PM13 falla cerrado como debe.
- PROD permanece fuera de alcance de este candidato.

## Estrategia

Las dos migraciones P2-PM13 se recuperan **byte a byte** desde el histórico porque su preflight pasa en QA y las filas actuales son compatibles.

Se reconstruyen solo:
- contrato estático;
- harness efímero;
- prueba de concurrencia;
- workflow exact-head;
- documentación.

El harness añade 2 fichajes preexistentes sin operationId y demuestra que ambas migraciones no los modifican ni eliminan.

## Gate esperado

1. Base release exacta y head exacto del PR.
2. Exactamente 7 archivos en alcance.
3. Blobs SQL históricos exactos.
4. Contrato PM13.
5. Regresiones R03A/R03B/R03C/PM11.
6. PostgreSQL 16 efímero.
7. Conservación de filas preexistentes.
8. Self-service RLS corregido.
9. operationId global, replay estricto y ACL de solo lectura directa.
10. Concurrencia real.
11. gate-final general sobre el mismo candidato.

## Fuera de alcance

- No aplicar PM13 en QA todavía.
- No tocar Supabase PROD.
- No tocar main ni PR #38.
- No iniciar P06.
- No usar db push ni migration repair.
