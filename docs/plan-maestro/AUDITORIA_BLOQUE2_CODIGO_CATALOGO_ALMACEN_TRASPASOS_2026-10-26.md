# Auditoría completa L&A Suite — Bloque 2 (código): Catálogo, Almacén, Traspasos

Fecha: 26/10/2026
Entorno: QA, Deploy Preview `#181` (borrador) — `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
Rama: `audit/qa-preview-2026-10-26`

## 0. Alcance de este bloque

Por indicación explícita de Pedro, este bloque es **Catálogo, Almacén y Traspasos**:
`productos` (catálogo), `traspasos` (interno a_piso/a_almacén y entre locales),
`mermas`, `conteo` (inventario ciego y sus ajustes de stock), `resumen_almacen`,
`historial_producto`. Es revisión de **código**; la prueba en vivo está en
`AUDITORIA_COWORK_BLOQUE2_CATALOGO_ALMACEN_2026-10-26.md`.

## 1. Traspasos (`fuente.js:115560-115729`) — revisado a fondo

**Positivo, confirmado:**
- `traspasarStock` (a_piso/a_almacén dentro del mismo local) y
  `traspasarEntreLocales` validan en el cliente ANTES de llamar al servidor:
  cantidad > 0, producto pertenece al local activo, stock disponible suficiente en
  la ubicación de origen, mismas unidades de medida entre producto origen/destino,
  ningún déficit pendiente sin reconciliar, locales activos y de la misma empresa.
- Cuando hay nube, llaman a RPCs dedicadas (`trasladar_stock_interno`,
  `trasladar_stock_entre_locales`) con `operation_id` propio — idempotentes — y
  traducen los códigos de error del servidor (`stock_insuficiente_ubicacion`,
  `local_inactivo`, `unidad_incompatible`) a mensajes en español concretos, no
  genéricos.
- Si el servidor rechaza, el mensaje es explícito: "No se modificó ningún local" —
  no deja al usuario sin saber si el traspaso se aplicó a medias.
- Esto es exactamente lo que se esperaría del hallazgo histórico H7 (traspaso
  Empresa B rechazado) ya cerrado: el camino de validación es simétrico y
  trazable en ambos lados.

## 2. Mermas (`fuente.js:110369-110398`, motor en `fuente.js:109875` y siguientes)

**Observación arquitectónica (no es un defecto confirmado, es una diferencia real
que vale la pena vigilar):** a diferencia de Traspasos/Devoluciones — que ya llaman
a una RPC transaccional dedicada con `operation_id` propio por cada operación —,
`registrarSalida` (la función detrás de Mermas) **no llama a ninguna RPC de
servidor directamente**. Solo actualiza el estado local de React
(`setProductos`/`setMovimientos`) a través del motor de stock local
(`crearMotorStock`/`aplicarLoteMovimientosStock`). La sincronización con el
servidor ocurre más tarde, de forma indirecta, cuando el `useEffect` que vigila
`productos` (`fuente.js:105523-105537`) llama a `saveKey("productos", productos)`,
que a su vez sube la lista completa de productos vía la RPC por lotes
`abc_productos_guardar_lista` (comparando una base anterior para detectar
conflictos, `index-storage-bootstrap.js:1007-1094`).

Esto no es necesariamente un error — es el mecanismo histórico (PM-07/P3c) de
sincronización de catálogo "por lista completa con diff", distinto del patrón más
nuevo "una RPC por operación con `operation_id`" usado en Traspasos y Devoluciones.
Pero es una asimetría real de robustez: una merma registrada en dos pestañas o
dispositivos a la vez depende de que `abc_productos_guardar_lista` resuelva el
conflicto correctamente comparando `p_base`/`p_nuevo`, en vez de una RPC atómica
con bloqueo de fila como las de Traspasos/Devoluciones. No he encontrado un caso
reproducible de pérdida de merma — lo marco como punto a vigilar en la prueba en
vivo (doble pestaña, dos dispositivos) y como candidato a migrar al patrón más
nuevo en algún momento, no como un hallazgo cerrado.

## 3. Conteo / ajuste de stock (`fuente.js:111137-...`, `aplicarAjustes`)

Revisado a nivel alto, no línea por línea completo (es la pieza más compleja de
este bloque): el ajuste de stock tras un inventario ciego sí usa el patrón
idempotente nuevo — `operationId` determinista
(`pm12-ajuste-conteo:<id>:<fecha-de-cierre>`), comparación de la "intención" exacta
del conteo (lista de producto+cantidad contada, serializada y ordenada) antes de
aceptar un reintento como replay, verificación de permisos
(`autorizarMutacionAjustes`) y de que todos los productos del conteo pertenecen al
local activo antes de tocar nada. El reparto almacén↔piso cuando el conteo es
parcial (solo almacén o solo piso) calcula primero el "teórico" a partir de
`stock - deficitPendiente` antes de decidir si hay que trasladar o solo ajustar.
No he verificado la aritmética completa de cada rama de reparto (almacén con
falta, piso con sobra, etc.) con casos de prueba propios — dejo esto como pendiente
explícito, no como revisado al 100%.

## 4. Lo que no se ha revisado todavía en este bloque

- `Productos` (catálogo, alta/edición/baja, reactivación) y `HistorialProducto`:
  solo localizados los componentes, no leída su lógica de validación.
- `resumen_almacen`: no localizado ni leído todavía.
- La aritmética línea a línea de `aplicarAjustes` en sus distintos `ámbito`
  (total/almacén/piso_venta).

## 5. Nada de esto ha tocado producción ni QA

Todo lo anterior es lectura de código. No se ha ejecutado ninguna escritura.
