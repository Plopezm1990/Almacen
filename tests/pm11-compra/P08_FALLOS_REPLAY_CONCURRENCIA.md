# PM11 · Compra, recepción y pago E2E · P08 — Fallos, replay y concurrencia

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P07: aislamiento y permisos E2E cerrado  
Producción/main: **NO TOCAR**

## Objetivo

Someter el circuito de compra a los bordes reservados desde P01/P02:

- doble clic/repetición inmediata;
- replay tras rerender/recarga;
- intento nuevo sobre un snapshot obsoleto;
- mismo identificador físico con contenido distinto;
- fallo del procesador antes de confirmar;
- concurrencia/replay del ledger financiero heredado;
- sin afirmar atomicidad ACID donde el dominio sigue sobre `almacen_kv`.

## Hallazgo real detectado en P08

La revisión conjunta de P03 y del hardening PM10-P11 encontró una regresión de integración.

PM10-P11 había hecho que `procesarRecepcion` recibiera un `operationId` físico estable para una recepción de pedido. P03 reemplazó después `recibirPedido` para añadir su propia identidad de intento y el registro `recepcionesPM11`, pero dejó de pasar una identidad al procesador físico.

El fallback de `procesarRecepcion` era entonces:

`pm10-recepcion:pedido:<pedidoId>`

Eso significa que una segunda **recepción real** del mismo pedido podía llegar al procesador con la misma clave física que la primera. La caché de replay podía devolver el resultado de la primera recepción como si la segunda fuese un replay. Como P03 distinguía correctamente el nuevo `operationId` del intento, podía terminar aplicando al pedido las líneas del replay anterior.

Los tests P03 no detectaban este hueco porque su `procesarRecepcion` era un stub que no modelaba la caché física PM10.

## Corrección P08

Se separan dos identidades que no deben confundirse:

1. **operationId de intento/documento**: conserva la semántica P03/P04 y permite reconocer el replay exacto del usuario/documento.
2. **concurrencyKey física/versionada**: se deriva de `pedido.id` + snapshot de `cantidadRecibida` de sus líneas.

Reglas nuevas:

- mismo snapshot del pedido produce la misma `concurrencyKey`;
- después de una recepción confirmada, el nuevo snapshot produce otra clave y una recepción posterior real no se confunde con la anterior;
- `procesarRecepcion` guarda una firma canónica del efecto junto a la clave física;
- misma clave + misma firma = replay;
- misma clave + contenido distinto = `operation_id_conflict`;
- los IDs locales de movimiento/alta automática se deduplican por la clave física;
- en `recibirPedido`, si el attemptId P03 no era un replay conocido pero la capa física responde replay, el snapshot está obsoleto: se falla cerrado y se exige recargar;
- un resultado `{ok:false}` del procesador no crea `recepcionesPM11` ni incrementa `cantidadRecibida`;
- un albarán ligado mantiene `operationId = pm10-recepcion-albaran:<id>` para su identidad documental, pero añade `concurrencyKey` del pedido enlazado;
- si un albarán nuevo alcanza un replay físico que no fue reconocido previamente por la barrera documental P04, se trata como conflicto de snapshot y no se confirma el segundo documento.

## Casos P08 automatizados

`tests/pm11-compra/p08-fallos-replay-concurrencia-contract.mjs` demuestra:

1. mismo snapshot → misma clave física;
2. snapshot con recepción acumulada distinta → clave física nueva;
3. payload distinto → firma física distinta;
4. primera recepción real desde versión 0 → éxito;
5. segundo attemptId sobre el mismo closure/snapshot obsoleto → fallo cerrado y cero segunda mutación;
6. después de reconstruir la lógica desde el pedido actualizado → segunda recepción real válida;
7. fallo del procesador/nube antes de confirmar → pedido y eventos sin cambios;
8. `procesarRecepcion` compara firma antes de aceptar replay;
9. mismo key físico + contenido distinto → conflicto;
10. albarán ligado usa la versión del pedido como barrera de concurrencia;
11. replay físico no documental de albarán → conflicto, no segundo avance;
12. se conservan las regresiones P03–P07 y los contratos G1 de replay/idempotencia.

## Backend financiero heredado

Donde sí existe backend transaccional dedicado, P08 conserva la garantía más fuerte ya demostrada por G1:

- `pg_advisory_xact_lock` por `operationId`;
- replay exacto idempotente;
- contenido distinto → conflicto;
- colisiones cruzadas entre ledgers críticos → conflicto;
- G1.7 vivo documentado como 24/24 PASS.

No se añadió una migración de Supabase en P08.

## Límite honesto del modelo actual

Pedidos y parte de la trazabilidad logística continúan en `almacen_kv`, una persistencia JSONB genérica sin una RPC transaccional dedicada que actualice en una sola transacción pedido + recepción + stock + albarán.

Por tanto P08 **no declara** una transacción ACID multientidad ni una prueba falsa de dos procesos remotos simultáneos para Compra. El hardening corrige el replay obsoleto y falla cerrado cuando la misma versión física es reutilizada dentro del modelo actual. El backend financiero sí mantiene su serialización transaccional ya probada.

Este límite es exactamente el previsto por P01: endurecer la frontera necesaria y documentar la garantía real, no inventar una garantía inexistente.

## Automatización y ejecuciones

Fixer:

`tools/corregir_pm11_compra_p08_fallos_concurrencia.py`

Contrato:

`tests/pm11-compra/p08-fallos-replay-concurrencia-contract.mjs`

Workflow:

`.github/workflows/pm11-compra-p08-fallos-replay-concurrencia.yml`

- Run `34092689523`: **SUCCESS**. Aplicó el fixer, pasó P08 y todas las regresiones del gate y generó el commit funcional.
- Commit funcional: `6ae4501229929dafa7ec8f6bf235367d4e6d096c` — `PM11 compra P08: cerrar replay obsoleto de recepciones`.
- Run `34092777101`: **SUCCESS** sobre el source ya persistido. El fixer quedó idempotente (sin cambio funcional pendiente) y volvieron a pasar P08, P07, P06, P05, P04, P03, PM10 autoridad de persistencia, G1 concurrencia/replay, G1 finanzas y P02.

## Estado

**PM11_COMPRA_P08_FALLOS_REPLAY_CONCURRENCIA=PASS**
