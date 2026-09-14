# PM27 — C19 Traspasos

Estado: **PASS**.

## Alcance

C19 audita traspasos internos e interlocales: origen/destino, empresa/local, atomicidad, idempotencia, replay y ausencia de efectos parciales. La rama parte del cierre certificado C18 `14c3d0a814660877139b7d06c459f0601f48a076`. No modifica `main`, `release`, PR #38, Netlify ni datos de Supabase.

## Inspección viva, solo lectura

En Supabase PROD (`qjqorixtkilwsndqayyx`) se inspeccionaron las definiciones efectivas de `public.trasladar_stock_interno(...)` y `public.trasladar_stock_entre_locales(...)`. Ambas son `SECURITY DEFINER`, ejecutables por `authenticated`, exigen el rol de gestión de stock y validan el contexto de local antes de mutar.

El traslado interlocal ya contenía lock determinista de las dos filas de stock, validación de ambos locales, operabilidad, unidad compatible, cantidad válida en ambos extremos, stock suficiente y dos movimientos opuestos en una única función transaccional. El traslado interno conserva el total entre almacén y piso.

Se confirmaron dos huecos de C19:

1. Las dos RPC de traslado históricas no participaban del lock/namespace global de `operation_id` usado por ventas/reversos PM09 y Caja/arqueos. Como siguen expuestas a `authenticated`, un mismo ID podía existir en un ledger económico ajeno y en `stock_operaciones`.
2. `trasladar_stock_interno` comprobaba y bloqueaba el estado actual de `stock_ubicacion` antes de reconocer un replay idéntico ya comprometido. Un retry legítimo podía depender innecesariamente de que el local/producto continuase operable/configurado exactamente igual, aunque no debiera volver a mutar nada.

En QA (`flqercbgpgmmfaakrwkc`) no aparecen las RPC modernas de traslado; confirma la deriva/baseline ya observada en C18. QA se mantuvo en solo lectura y no se usa como autoridad para validar mutaciones C19.

## Remediación

`supabase/migrations/20260914071000_pm27_c19_transfer_operation_id_hardening.sql` reemplaza únicamente las dos RPC de traslado, conserva sus firmas y ACL, y reutiliza `private.pm09_bloquear_operation_id_stock(...)` en vez de crear otro motor de idempotencia.

En el traslado interno, después de identidad/rol/contexto y forma de origen/destino, el replay se resuelve antes de consultar el estado mutable del stock. Un replay idéntico devuelve el movimiento ya persistido; un payload distinto conserva `operation_id_conflict`. Para una operación nueva sí se ejecutan todos los locks y validaciones actuales antes de escribir.

En el traslado interlocal se conserva el lock determinista de origen/destino y la misma frontera transaccional. La única ampliación intencional es incorporar el guard global y persistir el `operation_id` validado/normalizado.

La migración tiene preflight de dependencia y transacción explícita. **No se ha aplicado en QA ni en producción.** El PASS certifica el candidato de código, no un despliegue vivo.

## Contrato reproducible

`tests/pm27/c19-traspasos.mjs` verifica los huecos históricos, guard global en ambas RPC, replay temprano interno, aislamiento de ambos locales, rechazo de origen/destino inválido, local inactivo, unidades incompatibles y cantidades inválidas, lock determinista, suficiencia antes de escribir, movimientos opuestos, efecto neto empresa cero, conservación total en traslado interno, ACL y uso real desde frontend. Incluye una prueba negativa deliberada que elimina el guard global y debe ser detectada.

Como regresión acumulada ejecuta `tests/pm27/c18-stock-ventas.mjs`, que a su vez mantiene verdes los contratos relevantes PM07/PM08/PM09/PM12.

## Gates y trazabilidad

El primer gate completo C19, run `34816178119`, terminó **SUCCESS** sobre `d9dfa6b86c57a4bce4f0380a10b43cc29c6a0bf5`. Incluyó verificación de SHA exacto, refs protegidas, alcance limitado, sintaxis, contrato C19, negativa deliberada y toda la regresión acumulada de C18.

La actualización de esta evidencia genera el gate de cierre sobre el SHA final. C19 solo queda formalmente cerrado cuando ese run exact-SHA final también concluya **SUCCESS**.

## Resultado

C19 queda **PASS** una vez confirmado el gate exact-SHA del commit final de cierre. `main` y `release` permanecen intactas; PR #38 no se toca; no hubo escrituras en QA/producción ni cambios de Netlify. El siguiente caso permitido es **C20 — Inventarios/conteos**, y no debe iniciarse si el gate final de C19 no está verde.
