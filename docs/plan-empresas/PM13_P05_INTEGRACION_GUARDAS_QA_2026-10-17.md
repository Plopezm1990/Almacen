# PM13-P05 — integración de guardas de acciones en QA

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Entorno aplicado: Supabase QA `qjqorixtkilwsndqayyx`  

## Resultado

El resolver `public.pm13_resolver_cargo_permiso` quedó conectado a las RPC de:

- altas, edición, baja y reactivación de empleados;
- fichaje propio, fichaje manual, corrección y anulación;
- registro y anulación de ausencias.

La integración usa `private.pm13_p05_accion_autorizada` como puente de compatibilidad:

1. mantiene el permiso técnico existente cuando el actor no tiene un cargo activo en el local;
2. cuando el actor sí tiene un cargo activo en el contexto, exige la decisión del resolver;
3. conserva el camino de fichaje propio mediante `pm13_fichaje_actor_es_empleado`;
4. no modifica datos de negocio de forma permanente ni borra históricos.

## Evidencia

- Contrato estático local: `node tests/pm13/p19-cargo-action-guard-integration-contract.mjs` — PASS.
- `node --check tests/pm13/p19-cargo-action-guard-integration-contract.mjs` — PASS.
- `git diff --check` — PASS (el único cambio previo no relacionado es `tests/pm13/P01_DIAGNOSTICO_PERSONAL.json`).
- Migración aplicada únicamente en QA con `pm13_p05_integrate_action_guards`; no se usó `db push` ni `migration repair`.
- La definición de las diez RPC de QA confirma referencia a `pm13_p05_accion_autorizada`.
- Smoke transaccional con el propietario: las ocho acciones administrativas resolvieron `true`; la transacción terminó en `ROLLBACK`.
- Smoke transaccional con un Encargado y cargo temporal: permiso explícito resolvió `true` y una denegación explícita resolvió `false`; asignación, pantalla y permisos temporales terminaron en `ROLLBACK`.
- Resolver anónimo: `contexto_no_autorizado`.

## Pendiente

- No se ejecutó todavía una acción de negocio real desde la interfaz ni una prueba visual con una cuenta no propietaria.
- No se configuraron datos persistentes de cargos, pantallas o permisos en QA.
- La migración quedó registrada en QA como `20261017095626 / pm13_p05_integrate_action_guards`.
- La migración, el contrato y este informe están en la rama autorizada del PR; la referencia remota ya contenía la implementación base y se añadirá este cierre mediante avance normal.
- `main`, `release`, PR 38 y producción permanecen intactos.
