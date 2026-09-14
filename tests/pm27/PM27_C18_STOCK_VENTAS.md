# PM27 — C18 Stock y ventas

Estado: **CANDIDATO EN VALIDACIÓN — no declarar PASS hasta gate exact-SHA SUCCESS**.

## Alcance

C18 audita descuento/restauración de stock, venta/anulación, idempotencia, integridad, aislamiento empresa/local y ausencia de efectos parciales. Parte del cierre certificado de C17 (`f611ecaf1a67c74423457a9b0ace41e98eef800f`) y no modifica `main`, `release`, PR #38, Netlify ni datos de Supabase.

## Preflight vivo, solo lectura

Se verificó que `main` continúa en `93a570badba1c5375febfbddc1dffdbcef003dcd`, `release` en `a97740987be57aa9646f6a06e69b2230f140ec5f` y PR #38 sigue OPEN+DRAFT / NO MERGE. C17 está cerrado en `f611ecaf1a67c74423457a9b0ace41e98eef800f` con run `34814066666` SUCCESS.

En Supabase PROD (`qjqorixtkilwsndqayyx`) se inspeccionaron exclusivamente catálogo/definiciones, sin escrituras. Las RPC BASE `public.registrar_venta_stock(...)` y `public.registrar_venta_stock_carrito(...)` son `SECURITY DEFINER`, siguen ejecutables por `authenticated` y, a diferencia de los wrappers PM09 y de las RPC BASE de reverso, no llamaban al guard global `private.pm09_bloquear_operation_id_stock(...)` ni verificaban colisiones de `operation_id` contra Caja/arqueos.

Esto permitía que un cliente autenticado que invocara directamente la API BASE de venta intentara reutilizar un `operation_id` ya ocupado en otro ledger. Las restricciones únicas son por tabla, de modo que el hardening global de PM09 podía ser evitado por esa superficie legacy aún expuesta. El flujo UI vigente usa las RPC PM09, pero la API BASE seguía siendo una vía lateral ejecutable y por eso C18 lo trata como defecto real de integridad/idempotencia.

Las RPC BASE de reverso observadas en PROD ya usan `private.pm08_bloquear_operation_id(...)`, comprueban colisiones con `caja_operaciones`, `arqueos_caja` y `arqueos_caja_anulaciones`, y bloquean reversar una venta que ya tenga devoluciones. Esa asimetría reforzó el diagnóstico.

Supabase QA (`flqercbgpgmmfaakrwkc`) presenta deriva/baseline respecto al esquema moderno de PM07–PM09: conserva RPC legacy y no es una réplica fiable para validar por escritura el comportamiento C18. Se mantuvo estrictamente en solo lectura y no se usó como prueba positiva de mutación.

## Remediación candidata

La migración `supabase/migrations/20260914064500_pm27_c18_stock_sale_operation_id_hardening.sql` reemplaza únicamente las dos RPC BASE de venta y conserva sus firmas, roles, aislamiento tenant/local, validación de cantidades, preflight de carrito y semántica de replay. La diferencia funcional deliberada es que ambas normalizan/serializan el ID mediante `private.pm09_bloquear_operation_id_stock(p_operation_id)` antes de cualquier escritura.

El mismo helper ya usado por los wrappers PM09 valida el identificador, toma el advisory transaction lock compartido y rechaza colisiones contra Caja/arqueos. Se conserva la ejecución para `authenticated`, se mantiene cerrada para `public/anon` y no se introduce un segundo motor de idempotencia.

La migración contiene preflight de dependencia y una transacción explícita. **No se ha aplicado en QA ni en producción.** Su existencia en esta rama no equivale a despliegue.

## Contrato reproducible

`tests/pm27/c18-stock-ventas.mjs` comprueba, entre otros puntos:

- reproducción del hueco histórico en las dos RPC BASE;
- guard global en venta unitaria y carrito;
- autorización y tenant antes del guard;
- uso del ID normalizado en las escrituras;
- roles de venta existentes y validación semántica de cantidades;
- preflight completo del carrito antes de mutar;
- replay idéntico y conflicto de payload;
- reversos ya protegidos, restauración y bloqueo con devoluciones;
- UI vigente sobre RPC PM09;
- prueba negativa en memoria que elimina el guard y debe ser detectada.

Además ejecuta regresiones PM07, PM08, PM09 y PM12 relacionadas con TPV, stock, Caja, replay, aislamiento y concurrencia.

## Criterio de cierre

C18 solo podrá cambiar a **PASS** cuando el workflow dedicado finalice `SUCCESS` sobre el SHA exacto que contenga migración, contrato, workflow y esta evidencia, con `main`/`release` intactas y árbol limpio. Si el gate falla, C18 permanece EN CURSO y no se inicia C19.
