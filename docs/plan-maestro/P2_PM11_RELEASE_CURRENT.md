# P2-PM11 — Personal post-reset sobre release actual

Estado: **candidato GitHub-only; no aplicado por este candidato a Supabase QA ni PROD**.

Baseline:
- `release@6b26b391e0d248a6f6d4f8271bc08938b5eee118`
- rama: `claude/p2-pm11-release-current`
- histórico PM11: `2fd691d5dc86b4f11c4b47b7fc3c59263b8aac97`
- run histórico: `35229377181`
- job histórico: `105229147037` — SUCCESS
- migración histórica: `20260917143000_p2_pm11_personal_post_reset.sql`
- blob histórico original: `01281c9d10f5386852ef01097b88654095cba109`

## Inventario vivo

QA ya contiene `public.empleados`, RLS, lifecycle RPCs PM11 y lógica PM13 posterior. El inventario agregado detectó 2 filas, sin leer su contenido. PROD todavía no tiene `public.empleados` ni RPCs PM11.

El preflight PM11 histórico pasa en QA y falla cerrado en PROD porque PROD aún no tiene el contrato tenant de R03B en `auditoria_registro`.

## Reconciliación necesaria

La migración PM11 histórica no se reutiliza byte a byte porque degradaría `pm11_alta_empleado`: QA y el repo actual ya incorporan PM13-P01 mediante `20260907195207_pm13_p01_alta_concurrency_lock.sql`.

Este candidato conserva:
- advisory lock con prefijo `pm13:empleado:alta:`;
- `pm13AltaOperationId`;
- rechazo de pseudo-locales `TODOS` / `TODOS LOS LOCALES`;
- replay idempotente de alta.

Y restaura desde PM11:
- autoridad relacional de locales mediante `public.locales`, sin dependencia runtime de `almacen_kv`;
- helpers privados de alcance;
- RLS de `empleados`;
- escritura exclusivamente por RPC;
- auditoría tenant-aware;
- `search_path` endurecido donde corresponde.

## Gate

El gate exige:
1. head exacto del PR y base exacta;
2. exactamente cinco archivos PM11;
3. contrato estático;
4. regresiones R03A/R03B/R03C;
5. preservación explícita de PM13-P01;
6. PostgreSQL 16 efímero;
7. reaplicación sobre estado con filas existentes sin modificar dichas filas;
8. autoridad de local relacional y helpers endurecidos;
9. árbol limpio.

## Fuera de alcance

- No aplicar PM11 en QA todavía.
- No tocar Supabase PROD.
- No usar db push ni migration repair.
- No tocar main ni PR #38.
- No iniciar PM13/P06 en este candidato.
