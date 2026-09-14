# PM27-C22 — Pagos, reembolsos y ledger global `operation_id`

Fecha de auditoría/preparación: 2026-09-14  
Rama aislada: `claude/pm27-c22-pagos-reembolsos-ledger`  
Base certificada C21: `0dcb7207d2b3a802ab7923cdf6e5a16e99e31053`

## Objetivo

C22 reaudita la integridad de `public.pagos_encargo`, los reembolsos creados por
`public.revertir_pago_encargo` y su integración con el ledger global de
`operation_id`. C22 no crea un segundo motor de idempotencia: conserva
`private.g1_operation_ids_global`, `private.g1_claim_operation_id()` y el trigger
`g1_operation_id_global` introducidos/certificados anteriormente.

## Evidencia remota de solo lectura

En el proyecto Supabase `qjqorixtkilwsndqayyx` se inspeccionaron metadatos,
funciones y datos sin realizar escrituras.

Estado observado de `public.pagos_encargo`:

- `operation_id` ya es `UNIQUE` y la tabla ya tiene el trigger
  `g1_operation_id_global BEFORE INSERT -> private.g1_claim_operation_id()`.
- `revierte_pago_id` tiene FK autorreferente a `pagos_encargo(id)`, pero no tenía
  unicidad ni una restricción que ligara el estado de la fila al enlace de reverso.
- Las políticas RLS observadas son de lectura. `anon` y `authenticated` conservaban
  grants de tabla amplios de creación histórica. Esto no se clasifica como bypass RLS:
  la ausencia de políticas de escritura ya bloquea DML ordinario. C22 sí reduce esos
  grants por mínimo privilegio, incluido `TRUNCATE`.
- `registrar_pago_encargo` y `revertir_pago_encargo` tienen `EXECUTE` para
  `authenticated`, no para `anon`/`PUBLIC` en la inspección realizada.
- `revertir_pago_encargo` bloquea el pago original `FOR UPDATE`, comprueba un reverso
  previo y copia empresa, local, encargo, concepto, importe y medio de pago del original.
  Por tanto, el camino RPC normal ya era coherente y serializado.

Diagnóstico de datos observado antes de preparar la migración:

- filas de `pagos_encargo`: 0;
- reversos duplicados por `revierte_pago_id`: 0;
- `REVERSO` sin origen: 0;
- `CONFIRMADO` con origen: 0;
- referencias huérfanas: 0;
- reverso/original con empresa, local, encargo o importe distintos: 0;
- pagos sin claim global: 0;
- claims de pagos con ledger incorrecto: 0;
- claims `pagos_encargo` sin fila de pago: 0.

En `flqercbgpgmmfaakrwkc` la inspección previa confirmó que los objetos funcionales
PM14 de encargos/pagos no están presentes, mientras el ledger global sí existe. C22
no infiere nombres de entorno a partir de estos IDs y no intenta aplicar allí una
migración cuyo preflight no puede cumplirse.

## Defectos confirmados

### C22-D1 — un pago original no tenía unicidad estructural de reverso

El RPC evita normalmente un segundo reverso mediante bloqueo y consulta previa, pero
la tabla solo tenía una FK no única en `revierte_pago_id`. Un escritor privilegiado o
un futuro camino de código podía crear dos filas `REVERSO` contra el mismo original.

**Corrección:** índice único parcial sobre `revierte_pago_id` cuando no es nulo. La
concurrencia queda protegida también a nivel de índice, no solo por la lógica RPC.

### C22-D2 — estado y enlace de reverso podían divergir

La tabla permitía estructuralmente `REVERSO` con `revierte_pago_id IS NULL` o
`CONFIRMADO` con un `revierte_pago_id` no nulo.

**Corrección:** `CHECK` validado que exige exactamente:

- `CONFIRMADO` -> `revierte_pago_id IS NULL`;
- `REVERSO` -> `revierte_pago_id IS NOT NULL`.

### C22-D3 — la relación económica dependía exclusivamente del RPC

La FK demostraba que el original existía, pero no que el reverso perteneciera a la
misma empresa/local/encargo ni que conservara importe, concepto y medio de pago.

**Corrección:** trigger de integridad `BEFORE INSERT` que, para `REVERSO`, bloquea/lee
el original y exige:

- original `CONFIRMADO`;
- original no autorreferente;
- misma empresa, local y encargo;
- mismo importe, concepto y medio de pago.

Además, `pagos_encargo` queda explícitamente append-only: `UPDATE`, `DELETE` y
`TRUNCATE` se rechazan por trigger. Un reembolso continúa representándose como una
fila económica nueva, que es el patrón ya usado por `revertir_pago_encargo`.

## Preflight y seguridad de aplicación

La migración `20260914103000_pm27_c22_pagos_reembolsos_operation_id_hardening.sql`
usa transacción explícita, `lock_timeout=5s` y `statement_timeout=30s`. Antes de DDL
rechaza una instalación incompleta o datos históricos incompatibles: estados/enlaces
inválidos, autorreferencias, múltiples reversos, diferencias de contexto/importe,
claims globales ausentes o inconsistentes y claims huérfanos.

No se sanea ni reescribe silenciosamente ningún asiento económico. Si aparece una
inconsistencia histórica, la migración debe fallar y la causa debe auditarse antes de
continuar.

## Ledger global e idempotencia

C22 reutiliza el mecanismo existente. La migración no crea tablas de ledger, no crea
otro índice de `operation_id`, no redefine `private.g1_claim_operation_id()` y no
modifica los RPC de cobro/reverso. Sus postcondiciones exigen que
`g1_operation_id_global` siga existiendo exactamente una vez y siga apuntando al helper
global existente.

La serialización del RPC de reverso y la unicidad parcial son defensas complementarias:
el RPC mantiene el comportamiento funcional/idempotente; la constraint de tabla evita
que un camino alternativo viole la cardinalidad económica.

## Mínimo privilegio

C22 retira a `anon` y `authenticated` los grants directos `INSERT`, `UPDATE`, `DELETE`,
`TRUNCATE`, `REFERENCES` y `TRIGGER` de `pagos_encargo`. Esto es hardening de ACL, no
una afirmación de que RLS estuviera previamente siendo sorteado. El flujo de escritura
previsto sigue siendo los RPC `SECURITY DEFINER`; la migración verifica que
`authenticated` conserve `EXECUTE` en `registrar_pago_encargo` y
`revertir_pago_encargo`.

## Límites del checkpoint

C22 no absorbe el alcance transversal de C23. Multi-tab/blob, doble clic general,
reintentos y efectos parciales fuera del ledger de pagos se reservan para C23. C22 se
limita a pagos/reembolsos, invariantes económicas de `pagos_encargo`, mínimo privilegio
y reutilización del ledger global de `operation_id`.

## Estado de despliegue

La migración C22 no se ha aplicado en ningún proyecto Supabase. No se ha modificado
Netlify, `main`, `release`, datos remotos ni PR #38. El checkpoint solo podrá cerrarse
cuando el diff de la rama quede limitado a los cuatro artefactos C22 y GitHub Actions
termine `SUCCESS` sobre el SHA exacto final.
