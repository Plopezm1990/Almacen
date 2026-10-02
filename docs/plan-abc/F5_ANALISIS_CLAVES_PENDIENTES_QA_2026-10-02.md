# F5 — análisis de las cinco colecciones que no se guardan en la nube (QA)

Fecha: 2026-10-02
Alcance: lectura de código y de la base de datos de QA. Sin cambios de código, de
datos ni de producción. No se consultó producción (no autorizado).
SHA de código: `a5a4321`
Estado: `ANALISIS_COMPLETADO_PROPUESTA_PENDIENTE_DE_DECISION`

Las cinco claves atascadas en `almacen__pendientes` del navegador del Propietario
A+B son `productos`, `movimientos`, `conteos`, `historialRespaldos` y `temaOscuro`.

## Mecanismo común

1. `fuente.js` carga cada clave con `loadKey` y la guarda con `saveKey` en un
   efecto de autoguardado (`if (ready && !skipSaveRef.current) saveKey(clave, estado)`).
2. `saveKey` → `window.storage.set` (`index-storage-bootstrap.js`) guarda en el
   navegador y sube a `almacen_kv` con `upsert` (`resolution=merge-duplicates`).
3. La política RLS de `almacen_kv` exige `empresa_id IS NOT NULL`, que el trigger
   `pm05_scope_almacen_kv` deduce de `value->>'empresaId'`. Una lista o un booleano
   no tienen `empresaId` en la raíz, así que la fila propuesta se rechaza
   (`403`, `42501`) incluso si la fila ya existiera.
4. Si la subida falla, el error se traga (`catch → marcarPendiente`): la clave
   queda en `almacen__pendientes`, se muestra «Subiendo N…» y se reintenta en cada
   carga. Además `almacen_kv` tiene como clave primaria solo `key`: una fila por
   clave para todas las empresas.
5. `movimientos` va por otra ruta (`movimientos_registro`), que **solo tiene
   política de lectura**: ningún cliente puede escribir ahí por diseño.

## Qué es cada clave y dónde está la verdad

| Clave | Qué guarda | Verdad en el servidor | Consecuencia hoy | Propuesta |
|---|---|---|---|---|
| `productos` | Maestro de productos de la pantalla | No hay ruta autoritativa. `catalogo_tpv_productos` se proyectó **una sola vez** desde esta clave (migración PM10) y un trigger crea filas de `stock_ubicacion` al escribirla | Los productos editados en pantalla no llegan al servidor. En QA no hay clave `productos` en `almacen_kv` y `catalogo_tpv_productos` tiene 0 filas | Ruta autoritativa propia (RPC transaccional); decisión de diseño |
| `movimientos` | Lista heredada de movimientos de stock | `movimientos_stock` (libro PM07, por RPC), que la app ya lee en `sincronizarStockPm07` | Subida que no puede funcionar (política) y de gran tamaño en cada carga. Sin pérdida de datos si el estado se rehidrata del libro | Dejar de subirla |
| `conteos` | Documentos de conteo de inventario | Los conteos confirmados están en `stock_operaciones` (`INVENTARIO_PM12`, RPC `pm12_*`) y la app los lee | Solo los borradores quedan solo en el navegador | No subir por `almacen_kv`; borradores locales |
| `historialRespaldos` | Copia de seguridad **diaria automática de todas las colecciones**, hasta 30 instantáneas | Ninguna | El respaldo no llega a la nube: no protege de perder el navegador. Crece en `localStorage` (riesgo de cuota) | Decidir: respaldo en la nube por una vía específica, o solo local con aviso claro |
| `temaOscuro` | Preferencia visual (booleano) | Ninguna | Sin impacto crítico | Solo local (o preferencia por usuario más adelante) |

## Consecuencia para la aceptación

La cadena `productos` rechazado → ninguna clave `productos` en la nube → trigger
sin efecto → catálogo TPV sin proyectar explica, como causa probable, que QA no
tenga productos vendibles (hallazgo de A12). No se ha probado desde la interfaz.
Es el verdadero bloqueo para ensayar el TPV por pantalla y depende de la
dependencia H (catálogo) del Plan ABC.

## Alcance más amplio (no clasificado)

La pantalla carga 37 claves. 16 tienen un camino propio (tablas, RPC o el puente
de contexto; no se ha verificado que todos funcionen). Las otras 21, entre ellas
estas cinco, usan el almacén genérico. Las restantes (por ejemplo `pedidos`,
`fichasCosto`, `registrosAppcc`, `turnos`, `nominas`) fallarán igual en cuanto el
usuario las modifique. No se han analizado.

## Propuesta por paquetes (nada se ha hecho)

- **P1 — «solo local» y error visible.** Para `temaOscuro`, `movimientos` y los
  borradores de `conteos`: guardar en el navegador, no subir, no encolar y purgar
  sus entradas de `almacen__pendientes`. Cambio acotado en
  `index-storage-bootstrap.js` (archivo propio, no el bundle `fuente.js`). Hay que
  actualizar y ejecutar los contratos `pm05`, `pm08`, `p1-empty-kv-first-run` y
  `p2-p06`. Requiere un deploy para llegar al navegador; agruparlo con otros
  cambios web.
- **P2 — `historialRespaldos`.** Decisión de producto: respaldo en la nube o solo
  local con aviso.
- **P3 — `productos`.** RPC autoritativa que escriba `catalogo_tpv_productos` y
  `stock_ubicacion` en una transacción, con `operation_id` y permisos. Es una
  funcionalidad del Plan ABC (H01–H05), no un arreglo.
- **P0 opcional en QA.** Sembrar datos ficticios de catálogo por SQL para poder
  ensayar el TPV por pantalla. Requiere autorización.
- **Comprobación en producción, solo lectura** (filas por clave en `almacen_kv` y
  política vigente): no realizada. Decide la urgencia.
- **No recomendado:** relajar la RLS de `almacen_kv` (es un control de aislamiento
  entre empresas) y vaciar la cola solo para ocultar el contador.

## Límites y correcciones

- No se ha comprobado en pantalla qué hace cada clave ni su contenido real.
- Por tamaño solo se puede asociar con seguridad `temaOscuro` (33 bytes exactos,
  `{"key":"temaOscuro","value":true}`) a una de las cargas rechazadas del registro
  de QA. **Se retira la inferencia anterior** que asociaba la carga de 255 KB a
  `productos`: `historialRespaldos` contiene una copia de todas las colecciones, y
  el resto de tamaños no se puede asignar a una clave concreta.
- «Subiendo N» muestra la cantidad de claves pendientes: 5 en el navegador
  probado, frente a 4 en el traspaso.
