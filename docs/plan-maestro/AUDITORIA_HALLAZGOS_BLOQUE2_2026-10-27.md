# Auditoría completa L&A Suite — Hallazgos verificados, Bloque 2 (Catálogo/Almacén/Traspasos)

Fecha: 27/10/2026
Entorno: QA, Deploy Preview `#181` (borrador) — `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
Rama: `audit/qa-preview-2026-10-26`
Fuente de las pruebas en vivo: Cowork, siguiendo
`AUDITORIA_COWORK_BLOQUE2_CATALOGO_ALMACEN_2026-10-26.md`. Este documento añade,
para el hallazgo crítico, la causa real en código (Cowork la dejó explícitamente
como hipótesis sin confirmar en código — aquí se confirma o se corrige).

---

## H-CRIT-B2-01 — Mermas bloqueada permanentemente por "almacén congelado"

- **Prioridad:** Crítica.
- **Pantalla:** Mermas (y, por el mismo candado, Recepción de pedidos y
  confirmación de facturas con albaranes pendientes de recepcionar).
- **Resultado observado por Cowork:** el aviso "El almacén está congelado por un
  conteo en curso" aparece siempre, con el botón "Registrar" inhabilitado. No
  cede al recargar la página, ni al finalizar y cerrar un conteo de prueba, ni al
  cancelarlo. Cowork comprobó en servidor que las 460 filas históricas de
  `conteos` tienen `estado = 'COMPLETADO'` y que hay 0 conteos abiertos — y dejó
  como **hipótesis sin confirmar en código** que la causa fuera el error base
  PGRST116 al cargar `conteos`.
- **Causa — CONFIRMADA en código, distinta de la hipótesis de Cowork:**
  - `fuente.js:105847`: `const conteoAbierto = conteosDelLocalActivo.find((c) =>
    !c.completado) || null;` — y `fuente.js:105848`: `const almacenCongelado =
    !!conteoAbierto;`. Es decir, el candado depende exclusivamente del campo
    booleano **`completado`**, no del campo `estado` (`BORRADOR`/`PARCIAL`/
    `COMPLETADO`/`CANCELADO`) que es el que de verdad gobierna el ciclo de vida
    de un conteo en el resto del código (p. ej. `aplicarAjustes`, que ya usa
    `conteo.estado || (conteo.completado === true ? "COMPLETADO" : "BORRADOR")`
    como compatibilidad).
  - Comprobé en vivo (solo lectura, QA Empresa A) cuántos de los 461 registros de
    `conteos` (460 históricos + el de prueba de Cowork) tienen `completado`
    distinto de `true`: **460 de 461**. Es decir, casi todo el historial de
    conteos — con `estado = 'COMPLETADO'` real y correcto — nunca tuvo escrito el
    campo legado `completado`. `Array.find` devuelve el primero que encuentra, así
    que basta con que **uno solo** de esos 460 exista en la lista para que
    `conteoAbierto` no sea nunca `null`. El almacén queda congelado de forma
    permanente no por un conteo real abierto, sino por un campo obsoleto que
    nunca se rellenó en esos registros.
  - Esto también explica, sin necesidad de invocar el PGRST116, por qué ni
    recargar ni cerrar ni cancelar el conteo de prueba de Cowork liberó el
    candado: quedan otros 459 registros con el mismo defecto en la lista,
    cualquiera de ellos sigue "abriendo" el almacén.
  - El propio conteo de prueba de Cowork, una vez cancelado, conservó
    `completado: true` (heredado de cuando se finalizó como PARCIAL, un paso
    antes de cancelarlo) — confirmado por SQL. Es decir, la cancelación en sí
    **no** rompe nada nuevo en este caso concreto, pero tampoco habría ayudado:
    `eliminarConteo`/cancelación (`fuente.js:111073-111084`) fija `estado:
    "CANCELADO"` y `cancelado: true`, pero nunca fija `completado: true` — así
    que un conteo cancelado ANTES de haber sido finalizado alguna vez SÍ se
    quedaría con `completado` en falso para siempre, y también congelaría el
    almacén permanentemente él solo.
  - El PGRST116 de `conteos` (ver `AUDITORIA_HALLAZGOS_BLOQUE1_2026-10-26.md`,
    H-MEDIA-01) es un problema real y aparte, pero no es la causa de este
    candado: `conteoAbierto` se calcula sobre el array de conteos ya cargado en
    el estado de React (`conteosDelLocalActivo`), con independencia de si esa
    carga vino de una respuesta de red exitosa o de un *fallback* tras el error.
- **Impacto:** bloquea por completo el registro de mermas en cualquier
  instalación cuyo historial de conteos incluya aunque sea un solo registro
  antiguo sin el campo `completado` — lo cual, dado que es el campo legado y no
  el usado por el resto del sistema, es casi seguro que ocurra en cualquier
  cuenta con algo de antigüedad, no solo en QA.
- **Corrección recomendada:** cambiar `fuente.js:105847` para derivar
  "¿hay un conteo realmente abierto?" del campo `estado` (con el mismo patrón de
  compatibilidad que ya usa `aplicarAjustes`), por ejemplo:
  `conteosDelLocalActivo.find((c) => { const e = c.estado || (c.completado ===
  true ? "COMPLETADO" : "BORRADOR"); return e !== "COMPLETADO" && e !==
  "CANCELADO"; })`. No tocar el campo `completado` en sí (dejarlo como está
  evita migrar datos), solo dejar de usarlo como única fuente de verdad.
- **Cómo validarlo:** repetir en QA tras el cambio: iniciar un conteo nuevo
  (debe congelar el almacén mientras esté en BORRADOR/PARCIAL sin cerrar),
  finalizarlo o cancelarlo (debe descongelarse de inmediato), y confirmar que
  Mermas vuelve a aceptar registros con el historial de 461 conteos intacto.

---

## H-ALTA-B2-01 — Alta de producto con stock inicial no sincroniza el movimiento de entrada

- **Prioridad:** Alta.
- **Pantalla:** Productos, alta de producto nuevo con stock inicial > 0.
- **Resultado observado:** el producto aparece correctamente en el cliente con el
  stock introducido, pero el movimiento de entrada **no llega** a
  `movimientos_stock` en el servidor (comprobado por Cowork con una consulta
  directa a Supabase inmediatamente después, vacía), y el registro del producto
  en `almacen_kv` carece de los flags `_pm07Servidor`/`_pm07BajoMinimo` que sí
  tiene el resto del catálogo — señal de que la reconciliación con el servidor
  quedó a medias. El fallo es silencioso: no hay banner ni error visible en el
  momento del alta.
- **Causa:** NO CONFIRMADA en código por mi parte en esta vuelta. Coincide en el
  tiempo con el mismo patrón de "guardado pendiente atascado" que se describe
  abajo en el hallazgo técnico de la cola de reintentos — es razonable sospechar
  que es la misma familia de fallo (la subida de `productos`/`movimientos` falla
  con 400 y queda en bucle), pero no he verificado que sea exactamente la misma
  causa. Queda pendiente de trazar con el código de `abc_productos_guardar_lista`
  y el payload exacto que se envía al dar de alta con stock inicial.
- **Cómo validarlo:** repetir el alta con stock inicial tras cualquier corrección
  de la cola de reintentos (ver hallazgo técnico abajo) y confirmar que el
  movimiento de entrada aparece en `movimientos_stock` sin necesidad de recargar.

---

## H-ALTA-B2-02 — Ajustes de conteo: el stock cambia en cliente pero no en servidor

- **Prioridad:** Alta.
- **Pantalla:** Inventario ciego → "Aplicar ajustes al stock".
- **Resultado observado:** tras aplicar los ajustes de un conteo parcial (3
  productos), la app confirma "3 producto(s) ajustado(s)" y el stock cambia
  correctamente en `localStorage`/pantalla, pero una consulta a Supabase
  inmediatamente después muestra los 3 productos todavía en sus valores
  originales. En ese momento el banner superior pasa a "Un cambio no se ha
  podido guardar (movimientos)".
- **Causa:** mismo patrón que H-ALTA-B2-01 — no confirmada en código esta vuelta,
  pero con la misma correlación temporal con el hallazgo técnico de la cola de
  reintentos de abajo.
- **Riesgo real:** mientras el stock del cliente y del servidor estén
  desincronizados, cualquier otro dispositivo o sesión seguirá viendo el stock
  antiguo, y una recarga de esta misma sesión podría revertir visualmente el
  ajuste que el usuario cree ya aplicado.

---

## Hallazgo técnico — cola de reintentos sin control, ~5000 peticiones fallidas

Durante las pruebas de Mermas y Conteo, Cowork observó el banner "Un cambio no se
ha podido guardar (productos)" con una insignia "Subiendo 2…" persistente, y en
consola decenas de errores `Failed to load resource: the server responded with a
status of 400 ()` repetidos en bucle — más de 5000 peticiones acumuladas según el
buffer del navegador. `localStorage['almacen__pendientes']` confirmó 2 claves
atascadas en reintento: `movimientos` y `productos`. Esto es, en sí mismo, un
problema de resiliencia independiente de la causa concreta de H-ALTA-B2-01/02:
reintentar sin límite ni back-off una subida que falla con 400 (un error que por
definición no se arregla solo reintentando, a diferencia de un timeout de red)
agota recursos del navegador y no informa al usuario de nada más específico que
"inténtalo de nuevo". Recomendación aparte de la causa raíz: limitar reintentos
de un 400 (error de validación, no transitorio) y mostrar el motivo exacto en
vez de reintentar indefinidamente.

---

## H-BAJA-B2-01 — Traspaso entre locales: ~50 s de retraso en el snapshot del destino

- **Prioridad:** Baja (consistencia eventual, no pérdida de datos).
- **Resultado observado:** tras un traspaso A1→A2, el ledger `movimientos_stock`
  registra la operación de forma instantánea y correcta en ambos locales con el
  mismo `operation_id`, pero el snapshot cacheado de stock en `almacen_kv` del
  local destino tardó ≈50 segundos en reflejar el cambio al consultarlo
  directamente en Supabase. Cambiar el local activo en la UI y recargar mostró
  el valor correcto de inmediato.
- **Causa:** no investigada — es coherente con algún retraso de sincronización en
  segundo plano del snapshot cacheado, no con el ledger transaccional (que es la
  fuente de verdad y ya estaba correcto). No se considera urgente.

---

## Resuelto / sin hallazgo

- Baja de producto (soft delete) y edición de precio/stock mínimo: correctos.
- Traspaso por encima del stock disponible: bloqueado con mensaje exacto.
- Reaplicar ajustes de un conteo ya aplicado: bloqueado correctamente ("Ajustes
  ya aplicados… no se pueden volver a aplicar, para no duplicar la corrección"),
  con opción explícita de revertir en su lugar.

## Lo que no se pudo completar

- **Doble pestaña de Mermas:** no se pudo ejecutar porque el registro de mermas
  está bloqueado de raíz por H-CRIT-B2-01 — no había ninguna merma que enviar.
- **Traspaso a empresa distinta / con unidades distintas:** la interfaz impide
  estructuralmente llegar a ese estado (QA Empresa B nunca aparece como destino;
  el selector de producto destino se autofiltra a unidades compatibles). No se
  verificó un mensaje de error real porque nunca se llegó a intentar la
  operación inválida — se documenta como "no ejecutable desde la UI", no como
  "correcto verificado".
