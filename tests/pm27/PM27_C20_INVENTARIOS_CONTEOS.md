# PM27 — C20 Inventarios/conteos

Estado: **CANDIDATO — pendiente de gate remoto exact-SHA**.

## Alcance

C20 audita la ruta real de inventarios/conteos PM12: aplicación de ajustes, replay, cancelación, reversos, identidad de operación, aislamiento empresa/local y compatibilidad con conteos históricos. Parte del cierre certificado C19 `37607abc445cd606649195320b69a8e384b6d96e`.

No modifica `main`, `release`, PR #38, Netlify ni datos de Supabase. La inspección de Supabase es exclusivamente de lectura.

## Precondición C19

El gate final exact-SHA de C19, run `34816268394`, terminó **SUCCESS** sobre `37607abc445cd606649195320b69a8e384b6d96e`. Por tanto C20 puede iniciarse sin reabrir C19.

## Inspección viva, solo lectura

En Supabase PROD (`qjqorixtkilwsndqayyx`) y QA (`flqercbgpgmmfaakrwkc`) se confirmaron las RPC públicas y privadas `pm12_confirmar_ajuste_stock(...)` y `pm12_cancelar_conteo_stock(...)`. Las privadas son `SECURITY DEFINER`; `anon` no tiene EXECUTE y `authenticated` sí. La ruta de aplicación reserva los ajustes de stock a Propietario/Encargado, exige empresa/local concreto y conserva el lock global de `operation_id`. La cancelación permite a roles operativos cancelar un conteo sin efecto de stock, pero exige permiso elevado si existen movimientos que revertir, tal como fijó PM12–P07.

También se confirmó el índice único `pm12_un_ajuste_por_conteo`, que impide dos operaciones `INVENTARIO_PM12` para el mismo conteo dentro de una empresa/local.

## Hallazgos reales C20

La implementación persistente PM12 ya protegía atomicidad, concurrencia, stock base, permisos y aislamiento, pero mantenía tres huecos de identidad/replay:

1. **Replay de ajuste incompleto.** `pm12_confirmar_ajuste_stock` reconocía un `operation_id` existente comparando tipo, empresa/local e intención, pero no comprobaba que el `plan` reenviado fuese el mismo. Por tanto, un retry con la misma identidad documental pero plan diferente se etiquetaba como replay válido en vez de conflicto. Además, las bases usadas para el preflight no quedaban persistidas en el ledger.
2. **Replay de cancelación incompleto.** `pm12_cancelar_conteo_stock` aceptaba como replay una cancelación existente por tipo, empresa/local y `conteoId`, sin exigir que `motivo` y `responsable` coincidiesen con la cancelación ya comprometida.
3. **Corte de cancelación no canónico.** La identidad `pm12-cancelar-conteo:<id>:<corte>` se calculaba a partir del documento aportado por el cliente antes de cargar el ledger persistido del conteo. Si el conteo ya tenía una operación de inventario, su corte persistido debía ser la autoridad de identidad.

Estos huecos no implican una segunda mutación de stock en un replay ya comprometido, pero sí permiten reinterpretar una identidad existente con un payload distinto y degradan la trazabilidad que PM12–P05/P08 exige.

## Remediación candidata

`supabase/migrations/20260914080000_pm27_c20_inventory_count_replay_hardening.sql` reemplaza únicamente las dos funciones privadas PM12, conserva firmas, wrappers públicos y ACL, y mantiene las mismas fronteras de permiso/empresa/local.

Para confirmar ajustes:

- un replay exige la misma `intencion` **y el mismo `plan`**;
- las nuevas operaciones C20 guardan también `bases` y un replay nuevo exige que coincidan;
- las operaciones PM12 históricas sin `bases` siguen siendo compatibles, pero no pueden cambiar el plan;
- se conservan el lock por documento, el namespace global PM09, el lock estable de productos, la comprobación de stock base y el rollback transaccional.

Para cancelar conteos:

- primero se serializa por conteo y se carga, si existe, la operación `INVENTARIO_PM12` persistida;
- cuando existe ledger, el corte guardado en `payload.intencion` pasa a ser la identidad canónica y el corte remitido debe coincidir;
- un replay exige el mismo motivo y responsable ya comprometidos;
- las nuevas cancelaciones persisten la solicitud de cancelación en el payload del ledger;
- se conserva la regla PM12–P07: solo hace falta permiso de gestión de stock cuando realmente hay movimientos que revertir.

La migración incluye preflight de dependencias y `BEGIN/COMMIT` explícito. **No se ha aplicado en QA ni en producción.**

## Contrato reproducible

`tests/pm27/c20-inventarios-conteos.mjs` reproduce los tres huecos sobre la migración PM12 histórica y verifica la remediación candidata: conflicto ante plan distinto, persistencia/comparación de bases C20, corte de cancelación canónico, conflicto ante motivo/responsable distintos, permisos, aislamiento, locks, stock base, preflight de reverso y ACL. La existencia, firmas y permisos de las dos RPC PM12 se contrastaron además mediante inspección viva de Supabase en modo solo lectura; el contrato de repositorio no presupone que una copia concreta del frontend recuperado contenga sus nombres literales.

Incluye negativas deliberadas para demostrar que el contrato detecta un bypass de la comparación de plan y otro de la identidad de cancelación. Como regresión ejecuta PM12 P05–P08 y después C19; C19 arrastra a su vez la regresión acumulada C18/PM07/PM08/PM09/PM12.

## Criterio de cierre

C20 solo puede declararse **PASS** si el workflow `PM27 C20 - Inventarios conteos` termina `SUCCESS` sobre el SHA exacto que contenga únicamente estos cuatro archivos C20:

- `supabase/migrations/20260914080000_pm27_c20_inventory_count_replay_hardening.sql`
- `tests/pm27/c20-inventarios-conteos.mjs`
- `tests/pm27/PM27_C20_INVENTARIOS_CONTEOS.md`
- `.github/workflows/pm27-c20-inventarios-conteos.yml`

Hasta entonces el estado correcto es **CANDIDATO**. `main` y `release` deben permanecer en `93a570badba1c5375febfbddc1dffdbcef003dcd` y `a97740987be57aa9646f6a06e69b2230f140ec5f`, respectivamente.
