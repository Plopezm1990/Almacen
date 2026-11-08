# PM13 · Punto 5 — Implementación del resolver de acciones en QA

Fecha: 2026-10-17
Rama: `codex/fix-product-bootstrap-context-20261015`
Commit: `8f516ec1e4edeed3ac9937ac75e803fa4de74563`
Proyecto QA: `qjqorixtkilwsndqayyx` (`L&A Suite QA`)

## Cambio realizado

Se añadió y aplicó únicamente en QA la migración `pm13_p05_cargo_action_resolver`, cuyo código fuente está en:

`supabase/migrations/20261017193000_pm13_p05_cargo_action_resolver.sql`

La migración crea:

- Catálogo privado de 11 acciones PM13 con clave estable, acción, alcance máximo, módulo, dependencia de consulta y rol mínimo.
- `public.abc_cargo_permisos`, con RLS activado y acceso directo revocado.
- `public.pm13_configurar_cargo_permiso`, solo para configuración autorizada por propietario.
- `public.pm13_listar_cargo_permisos`, para consultar el estado del cargo en contexto autorizado.
- `public.pm13_resolver_cargo_permiso`, que aplica contexto, membresía, techo técnico, cargo, consulta, alcance y revocación.

La migración quedó registrada en QA como `pm13_p05_cargo_action_resolver` (versión de Supabase `20261017095304`). No se aplicó en producción.

## Comprobaciones realizadas

1. Contrato local `tests/pm13/p18-cargo-action-resolver-contract.mjs`: **PASS**.
2. Contratos PM13 P08–P17: **PASS**; P13 mantiene su aviso de que la separación efectiva por empresa requiere completar la implementación.
3. QA: la tabla `public.abc_cargo_permisos` existe con RLS activado.
4. QA: el catálogo privado contiene 11 acciones.
5. QA: existen las tres RPC nuevas con sus firmas previstas.
6. QA sin sesión: el resolver devolvió `permitido=false` y `motivo=contexto_no_autorizado`.
7. Smoke transaccional QA con propietario simulado: configuración, listado y resolución funcionaron dentro de una transacción; se ejecutó `ROLLBACK` y la comprobación posterior devolvió `0` filas de prueba.

## Límites actuales

- No se crearon empleados, cargos, asignaciones ni permisos persistentes de prueba.
- La aplicación todavía no llama automáticamente al resolver desde cada RPC de Personal, Fichajes o Ausencias; esa integración es el siguiente trabajo de código.
- Falta la prueba visual autenticada con un empleado no propietario y una asignación de cargo real, porque no había una asignación activa disponible y no se autorizó crear datos de prueba en QA en este paso.
- No se ha desplegado Netlify ni se ha tocado `main`, `release`, PR 38 o producción.

## Estado

**Resolver de acciones preparado y aplicado en QA.** El backend de decisión está operativo y probado de forma transaccional; la integración de cada acción de negocio y la prueba visual con datos autorizados quedan pendientes.
