# Punto 13 — Acta GO/NO-GO final del bloque 1–13

**Proyecto:** Proyecto A · L&A Suite  
**Fecha:** 21/09/2026  
**Baseline Git evaluada:** `release@d9d99a7a546283669017b9691b3031f5894d3b43`  
**Alcance de esta acta:** cierre del plan de estabilización y certificación de los **Puntos 1–13**.  
**No autoriza:** fusionar `main`, promover el workstream P2 (Puntos 14–18), contratar Supabase Pro, reconciliar migraciones, ejecutar DDL/DML adicional ni aplicar cambios productivos nuevos.

## 1. Dictamen

### GO — cierre del bloque 1–13

Se emite **GO para cerrar técnicamente el bloque 1–13 y mantener como baseline vigente `release@d9d99a7a546283669017b9691b3031f5894d3b43`**, con los riesgos residuales expresamente registrados en esta acta.

Este GO **no equivale a declarar terminado todo Proyecto A**.

### NO-GO — cierre global del Proyecto A / promoción del workstream P2

Se mantiene **NO-GO para declarar cierre global del Proyecto A**, porque el frente independiente P2 (Puntos 14–18) sigue pendiente de revalidación, certificación e integración por su propio flujo.

Tampoco se autoriza fusionar `main`. `main` permanece fuera de alcance de este cierre.

## 2. Estado vivo al emitir el acta

### GitHub

- `release`: **protegida**.
- SHA vivo: `d9d99a7a546283669017b9691b3031f5894d3b43`.
- Required status check: `gate-final`.
- `main`: `93a570badba1c5375febfbddc1dffdbcef003dcd`; no se ha movido dentro del cierre 1–13.
- PR #38: **OPEN · DRAFT**, base `main`, head `f297be08708d0bbe566c21347123885cb3095a7c`; permanece intocable.

### Netlify PROD

Deploy productivo vigente:

- deploy ID: `6ab16ab87dc63f0008688331`
- estado: `ready`
- contexto: `production`
- branch: `release`
- commit_ref: `d9d99a7a546283669017b9691b3031f5894d3b43`
- publicado: `2026-09-21T17:35:01.621Z`
- 8 reglas de headers procesadas sin error
- 0 secretos detectados
- sin Netlify Functions nuevas
- sin Edge Functions nuevas

### Supabase PROD

Última migración remota:

- `20260921164843 · punto9_indices_performance_minimos`

No se ha reconciliado el historial remoto con `supabase/migrations`, ni se ha usado `db push` o `migration repair`.

### Supabase QA

Última migración remota:

- `20260921174705 · p12_qa_pm29_res_proteccion_rls`

La tabla `public.pm29_res` conserva sus filas, tiene RLS activo, 0 policies y ningún privilegio de cliente para `anon` o `authenticated`.

## 3. Cierre de Puntos 1–12

| Punto | Estado final | Evidencia de cierre |
|---|---|---|
| 1 · PM33/R10 aislamiento | CERRADO | Cambio productivo aplicado; rechazo anónimo y aislamiento cubiertos. |
| 2 · Batería | CERRADO | 133 contratos activos PASS, 0 FAIL; fallo histórico separado. |
| 3 · Puerta CI | CERRADO | `gate-final` activo y obligatorio en `release`. |
| 4 · Source recovery | CERRADO | recuperación y manifiesto documentados/certificados. |
| 5 · Procedencia de migraciones | CERRADO COMO AUDITORÍA | matriz repo/QA/PROD inventariada; reconciliación deliberadamente no ejecutada. |
| 6 · Netlify publicación/recuperación | CERRADO | ruta de publicación y forward recovery certificadas. |
| 7 · Frontend hardening | CERRADO | Tailwind compilado, CSP/headers, regresión verde. |
| Incidente prefiltro asociado | CERRADO | release actual contiene bypass específico de ruta pública y regresión; panel privado conserva barreras. |
| 8 · xlsx + Actions SHA | CERRADO | Actions fijadas por SHA; xlsx 0.18.5 mantenido al no demostrarse flujo de parseo de subida que justificara migración funcional. |
| 9 · Índices | CERRADO | creados `idx_locales_empresa_id` e `idx_movimientos_stock_operation_id`; advisor 4→2 FKs sin índice. |
| 10 · Leaked password protection | CERRADO COMO RIESGO ACEPTADO | organización sigue en Free por decisión del propietario; protección permanece desactivada. |
| 11 · PM25-P02 integral | CERRADO | Auth + JWT + PostgREST + RLS + restore + reversión PASS en Supabase local representativo. |
| 12 · QA `pm29_res` | CERRADO | RLS habilitado y privilegios de cliente revocados sin leer ni borrar filas. |

## 4. Evidencia CI relevante

Último candidato funcional antes de esta acta:

- PR #46 head: `0ddfdf2ca741480445f5075879acc31023a91a2f`
- workflow general: run `35632263423`
- `ACTIVE_PASS=133`
- `ACTIVE_FAIL=0`
- `CALCULO_TOTAL_ACTIVOS=133`
- `gate-final = SUCCESS`
- PM25-P02: run `35632263496`
- `gate-pm25-p02 = SUCCESS`

**Precisión:** el workflow general no se dispara por push directo a `release`; por tanto no se afirma que un `gate-final` haya corrido sobre el merge commit `d9d99a7a546283669017b9691b3031f5894d3b43`. La certificación funcional corresponde al árbol candidato que fue autorizado y fusionado.

La PR de esta acta debe volver a ejecutar `gate-final` antes de poder fusionarse.

## 5. Riesgos residuales registrados

### R1 — Leaked password protection desactivada

- Estado: **ACEPTADO TEMPORALMENTE**.
- Motivo: Supabase Organization permanece en plan `free`.
- Security Advisor PROD: `auth_leaked_password_protection` = WARN.
- Acción futura: reabrir si se decide pasar a Pro o superior.

### R2 — 2 foreign keys sin índice de cobertura

Performance Advisor PROD mantiene como INFO:

- `movimientos_stock_actor_user_id_fkey`
- `stock_operaciones_actor_user_id_fkey`

Se difirieron porque no se observó filtrado/join real por `actor_user_id` y las tablas estaban sin carga representativa al analizarse.

Acción: reevaluar con carga real y estadísticas suficientes.

### R3 — 7 índices marcados como unused

Se conservan los 5 índices históricos y los 2 recién creados. Que los 2 nuevos aparezcan inicialmente como unused es esperable hasta registrar lecturas suficientes.

No se autoriza borrar índices basándose únicamente en `idx_scan=0`.

### R4 — Security Advisor: SECURITY DEFINER callable por authenticated

PROD reporta 17 WARN de `authenticated_security_definer_function_executable`.

La introspección de Punto 13 confirma para esas 17 funciones:

- `anon` no tiene EXECUTE;
- `PUBLIC` no tiene EXECUTE;
- todas contienen referencia a `auth.uid()`;
- todas fijan `search_path`.

El linter es una señal para revisión, no por sí solo prueba de explotación. Esta acta **no convierte el WARN en PASS absoluto de seguridad**. La auditoría transversal de seguridad del workstream P2 sigue pendiente y debe tratar cualquier hallazgo funcional por separado.

### R5 — RLS activo sin policies en tablas deliberadamente cerradas

Security Advisor PROD muestra 6 INFO `rls_enabled_no_policy`. En este diseño, varias de esas superficies están deliberadamente cerradas a clientes y se operan por RPC/roles controlados.

No se crean policies solo para silenciar el Advisor.

### R6 — Restauración PM25-P02 no es PITR de PROD

PM25-P02 demostró backup/pérdida/restauración y revalidación Auth/JWT/PostgREST/RLS en un stack Supabase local representativo y desechable.

No demuestra:

- PITR de PROD;
- restore físico del proyecto gestionado;
- equivalencia completa QA↔PROD.

### R7 — Historial de migraciones no reconciliado

Repo, QA y PROD tienen procedencias distintas. Punto 5 cerró la auditoría, **no la reconciliación**.

Sigue prohibido usar `db push` o `migration repair` para “alinear” historiales sin un plan específico y autorización separada.

## 6. Estado del incidente de prefiltro

El release vigente contiene las defensas específicas necesarias:

- `owner-bootstrap-post-reset.js` detecta `#/prefiltro/` y no ejecuta el bootstrap privado sobre esa ruta.
- `reset-pruebas-preview.js` permite únicamente la mutación pública hacia `/functions/v1/prefiltro-candidato` en la ruta de prefiltro.
- la barrera `POST_RESET_BARRIER_BLOCKED` permanece para rutas privadas/no autorizadas.
- `tests/hotfix-barrera-reset-local.mjs` contiene regresiones específicas del prefiltro.

Por tanto el incidente histórico no queda abierto como bloqueo del Punto 13.

## 7. Workstream P2 — fuera de este GO

Los Puntos 14–18 siguen separados. Pendientes conocidos:

- P2-R03A caja/devoluciones: gate histórico `5a040c8`.
- P2-R03B/C auditoría/errores empresa-local: gates históricos `46d880f` / `50b36da`.
- PM11/PM13 post-reset: gates históricos `2fd691d` / `eba3962`.
- P06 persistencia servidor: gate histórico `fe6276b`, anterior al HEAD completo; falta certificar HEAD completo.
- auditoría transversal de seguridad: Edge Functions, `enviar-notificacion`, `crear-cuenta-empleado` y cualquier otra deficiencia funcional que se confirme.

Ningún gate histórico se considera automáticamente vigente para promoción. Cada subfrente debe revalidarse contra el estado vivo antes de integrar o desplegar.

## 8. Condiciones después del cierre

1. `release@d9d99a7a546283669017b9691b3031f5894d3b43` es la baseline de referencia hasta que exista otro PR autorizado.
2. No tocar `main` ni PR #38 por inferencia de esta acta.
3. No promover P2 sin preflight, rama aislada, pruebas, PR, gate, autorización y postflight.
4. No alterar Supabase PROD/QA sin autorización explícita separada.
5. Mantener la separación entre rollback frontend por Git y rollback DB.
6. Reabrir un punto cerrado solo si aparece evidencia viva que contradiga su cierre.

## 9. Conclusión formal

**GO:** cerrar el plan de estabilización/certificación **Puntos 1–13** sobre `release`, con R1–R7 registrados.

**NO-GO:** considerar **Proyecto A completo** o promover automáticamente el workstream **P2 / Puntos 14–18**.

La siguiente fase correcta, después de integrar esta acta, es iniciar el workstream P2 desde inventario vivo y no desde sus SHAs históricos.
