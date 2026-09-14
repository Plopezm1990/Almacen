# PM27 — C23: concurrencia, replay y atomicidad transversal

Fecha: 14 de septiembre de 2026

Rama: `claude/pm27-c23-concurrencia-replay-atomicidad`

Base certificada C22: `e047b0ddf8f00bc4cbe0829ea36d07ca9a7127e9`

## Objetivo

Tensionar transversalmente Caja, stock/ventas, traspasos, inventarios/conteos, encargos y pagos/reembolsos frente a doble clic, reintentos, carreras simultáneas, replay y efectos parciales, sin crear un segundo motor de idempotencia y sin aplicar cambios a QA/producción durante la preparación.

## C23-D1 — replay de venta por carrito con metadatos divergentes

### Reproducción

La implementación C18 de `public.registrar_venta_stock_carrito` construía `payload_norm` con las líneas agregadas por `productoId` y `cantidad`, además de `p_datos`. Sin embargo, cada fila insertada en `public.movimientos_stock.datos` conservaba el elemento original de `p_lineas`.

Por tanto, dos peticiones podían reutilizar el mismo `operation_id`, mantener el mismo producto y cantidad, pero cambiar metadatos de línea persistibles. C18 las consideraba el mismo replay aunque el efecto documental solicitado fuese distinto.

El contrato C23 reproduce ese caso con dos líneas que comparten producto/cantidad y difieren en `lote`/`precio`.

### Corrección

`20260914121000_pm27_c23_concurrency_replay_atomicity.sql` mantiene el motor existente:

- `private.pm09_bloquear_operation_id_stock()`;
- advisory lock transaccional PM08;
- `stock_operaciones` / ledger global ya existente.

No crea tablas ni otro ledger. En el replay de carrito compara también una canonicalización de los datos de línea solicitados contra los `movimientos_stock.datos` ya comprometidos. Si divergen, responde `operation_id_conflict`.

## C23-D2 — lost-update multi-tab en clientes y encargos

### Reproducción

Se verificó en el storage real de `index.html` que el guardado histórico obtenía `anterior` desde `LOCAL.get(cacheKey)`, es decir, desde `localStorage`, que es compartido por las pestañas del mismo origen.

Caso reproducible:

1. pestañas A y B parten de la misma colección;
2. A añade un registro y guarda;
3. `localStorage` ya contiene el alta de A;
4. B conserva un estado React anterior y añade otro registro;
5. al guardar B, el algoritmo histórico usa como `antes` el contenido compartido posterior a A;
6. el alta de A, ausente del estado obsoleto de B pero presente en `antes`, puede interpretarse como borrado realizado por B.

En `clientes_empresa` existía además una segunda vía destructiva: `sincronizarColeccionEmpresa()` calculaba como borrables todas las filas remotas ausentes de la lista local. Una pestaña obsoleta podía borrar un cliente recién creado por otra pestaña.

### Corrección

Se añade `pm27-c23-storage-concurrency-v1.js`, cargado universalmente desde `pm11-compra-mobile-loader.js` antes del bundle principal.

La corrección:

- mantiene una base por pestaña en `sessionStorage`, separada de `localStorage` compartido;
- intercepta solo `clientes` y `encargos`, que son el riesgo identificado y reproducido;
- para `encargos`, fusiona la colección remota contra la base propia de la pestaña y preserva altas remotas no vistas;
- para `clientes`, sincroniza por delta: solo inserta/actualiza cambios realizados por la pestaña y solo borra registros que estaban en su propia base y fueron eliminados localmente;
- si la misma entidad cambió de forma incompatible en remoto y local, falla cerrado con `c23_conflicto_concurrente:*` y conserva el cambio como pendiente en vez de sobrescribir silenciosamente;
- el replay de pendientes excluye `clientes`/`encargos` del sincronizador legado para impedir que un conflicto bloqueado vuelva a entrar por una ruta destructiva.

No modifica `fuente.js`, `main`, `release`, PR #38, Netlify ni Supabase remoto.

## Matriz transversal revalidada

El contrato `tests/pm27/c23-concurrencia-replay-atomicidad.mjs` exige que sigan presentes:

- advisory lock transaccional global PM08;
- ledger global `private.g1_operation_ids_global` y `private.g1_claim_operation_id()`;
- guard stock PM09;
- orden determinista de locks en traspasos C19;
- replay exacto de traspasos;
- lock de documento + `operation_id` en inventarios/conteos C20;
- identidad de replay de inventario ligada a intención, plan y bases;
- serialización del documento de encargo y máquina de estados C21;
- unicidad de reverso, FK lógica al original y append-only de pagos C22.

## Pruebas negativas

C23 incluye evidencia reproducible de dos defectos previos:

- `C23-D1`: mismo `operation_id`, mismo producto/cantidad y metadatos de línea distintos;
- `C23-D2`: dos pestañas con estado divergente donde el algoritmo histórico elimina un alta concurrente ajena.

También verifica que dos modificaciones incompatibles del mismo registro producen conflicto explícito en vez de last-write-wins silencioso.

## Regresiones

El gate C23 ejecuta de forma acumulada:

- C17 Caja/conciliación;
- C18 stock/ventas;
- C19 traspasos;
- C20 inventarios/conteos;
- C21 encargos/anticipos/clientes;
- C22 pagos/reembolsos/`operation_id`;
- PM12-P08 fallos/replay/concurrencia.

## Límites y seguridad operativa

Este paquete es preparación de código y pruebas. La migración SQL C23 **no se ha aplicado** a QA ni producción. El parche frontend **no se ha desplegado** en Netlify. No se ha modificado `main` ni `release`.

Un PASS de C23 requiere simultáneamente:

1. reproducción documentada de C23-D1 y C23-D2;
2. contratos C23 en verde;
3. regresión C17-C22 en verde;
4. `main` y `release` exactamente en sus SHAs protegidos;
5. scope exacto contra la base C22;
6. GitHub Actions `completed/success` sobre el SHA exacto de cierre.

Después de C23 corresponde PM27-C24: migraciones, preflight, reaplicación, bloqueos y rollback. No se debe saltar directamente a C25 ni a PM28.
