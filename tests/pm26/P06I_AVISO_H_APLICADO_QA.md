# PM26 P06i — Aviso H aplicado y verificado en QA

## Estado

**Cerrado.** El usuario autorizó desde el chat aplicar únicamente el
aviso H en el proyecto **L&A Suite QA**. La migración se aplicó una sola
vez y se verificó después mediante catálogo, historial de migraciones y
asesores de rendimiento. No se aplicó el aviso F ni se corrigieron los
defectos K o L.

## 1. Versión exacta validada antes de aplicar

Antes de escribir en QA se endureció el artefacto para:

- usar `SET LOCAL lock_timeout = '5s'` y
  `SET LOCAL statement_timeout = '30s'` inmediatamente después de
  `BEGIN`, de modo que protejan también el preflight y no sobrevivan a
  la transacción;
- retirar `IF NOT EXISTS` de los cuatro `CREATE INDEX`, para que una
  carrera o divergencia posterior al preflight aborte y revierta todo;
- exigir ambas propiedades desde `tests/pm26/p06f-contract.mjs`.

Archivo aplicado:
`supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql`

SHA-256 exacto:
`c4dc61a38cfc58ee588917988e81e3946cb79376e635464e37c5435fe435189d`

La versión endurecida se publicó en la rama técnica en el commit
`a2f6f2c474b67eeb93079a99bdd6455c868375c0`. Antes de aplicar, los
cuatro workflows activados por ese commit terminaron en `success`:

- P06f, incluida la prueba PostgreSQL de bloqueo concurrente real;
- P06e, exclusión de la cadena de migraciones ordinaria;
- P06b, validación aislada acumulativa;
- P01, protección de `main` y alcance de Supabase.

## 2. Checklist inmediatamente anterior

La identidad se obtuvo de nuevo mediante `list_projects`, sin reutilizar
un identificador copiado de documentos históricos. El proyecto elegido
por nombre fue **L&A Suite QA**, en estado `ACTIVE_HEALTHY`.

`get_advisors(type=performance)` devolvió exactamente los ocho avisos
objetivo previstos:

- 4 `unindexed_foreign_keys` sobre
  `auditoria_registro.actor_user_id`,
  `movimientos_stock.operation_id`,
  `pagos_encargo.revierte_pago_id` y
  `suscripciones_push.user_id`;
- 4 `auth_rls_initplan` sobre
  `qa_perfil_propio_select`, `qa_perfil_propio_update`,
  `qa_push_propio` y `membresia_propia_select`.

El preflight independiente se ejecutó contra ese mismo proyecto y
terminó sin excepción. El historial de migraciones no contenía ninguna
entrada previa con el nombre elegido.

Referencias de los avisos del asesor:

- [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Auth RLS Initialization Plan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

## 3. Aplicación

Se hizo una única llamada a `apply_migration`, con el proyecto QA
seleccionado explícitamente y con el contenido íntegro del archivo cuyo
hash figura arriba. Resultado devuelto: `success: true`.

Entrada registrada por Supabase:

- versión: `20260910063716`;
- nombre: `pm26_p06i_aviso_h_rendimiento_qa`.

## 4. Verificación posterior real

El catálogo de QA contiene exactamente los cuatro índices esperados,
todos B-tree sobre la columna prevista:

- `idx_auditoria_registro_actor_user_id`;
- `idx_movimientos_stock_operation_id`;
- `idx_pagos_encargo_revierte_pago_id`;
- `idx_suscripciones_push_user_id`.

Las cuatro políticas conservan tabla, rol y comando originales. Su única
variación es la optimización de `auth.uid()` mediante un subquery de
inicialización:

- `qa_perfil_propio_select`: `authenticated`, `SELECT`;
- `qa_perfil_propio_update`: `authenticated`, `UPDATE`, con `USING` y
  `WITH CHECK` optimizados;
- `qa_push_propio`: `authenticated`, `ALL`, con `USING` y
  `WITH CHECK` optimizados;
- `membresia_propia_select`: `authenticated`, `SELECT`, conservando
  además `activo = true` y `private.la_usuario_activo()`.

Al repetir los asesores inmediatamente después:

- `unindexed_foreign_keys`: **0**;
- `auth_rls_initplan`: **0**;
- `unused_index`: **12** (`INFO`): los 8 ya conocidos más los 4 índices
  recién creados, que todavía no podían registrar uso. No se eliminó
  ninguno; este aviso inmediato no contradice la finalidad de cobertura
  de claves foráneas.

El preflight independiente se repitió después de aplicar y fue rechazado
con `PREFLIGHT_FALLO` al detectar las políticas ya optimizadas. Esto
confirma que una reaplicación no se acepta como éxito silencioso.

## 5. Alcance preservado

- No se aplicó la migración del aviso F.
- No se modificó `fuente.js`; K y la Fase B de F siguen pendientes.
- No se escribió en Supabase producción ni TPV.
- No se tocó `main`, `release`, Netlify ni el Defecto E.
- El Defecto L sigue sin corregirse en producción.
- PM25 P02 continúa `PARCIAL/BLOQUEADO`.

El gate de este cierre vuelve a ejecutar el contrato P06f y valida la
coherencia del archivo, hash y registro documental. No vuelve a escribir
en QA ni pretende sustituir la verificación remota ya realizada desde el
chat.

```text
PM26_P06I_ESTADO=CERRADO
PM26_P06I_PROYECTO=L&A_SUITE_QA
PM26_P06I_PREFLIGHT_ANTES=PASS
PM26_P06I_APPLY_MIGRATION=SUCCESS
PM26_P06I_MIGRACION_REGISTRADA=SI
PM26_P06I_INDICES_CREADOS=4
PM26_P06I_POLITICAS_OPTIMIZADAS=4
PM26_P06I_UNINDEXED_FOREIGN_KEYS_DESPUES=0
PM26_P06I_AUTH_RLS_INITPLAN_DESPUES=0
PM26_P06I_PREFLIGHT_DESPUES=RECHAZADO_COMO_ESPERADO
PM26_P06I_AVISO_F_APLICADO=NO
PM26_P06I_PRODUCCION_ESCRITURA=NO
PM26_P06I_TPV_TOCADO=NO
PM26_P06I_MAIN_RELEASE_NETLIFY_TOCADOS=NO
```
