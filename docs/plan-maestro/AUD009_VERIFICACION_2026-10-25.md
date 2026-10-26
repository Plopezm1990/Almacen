# Plan Maestro L&A Suite — Verificación AUD-009 (sincronización de movimientos)

Fecha: 25/10/2026
Entorno: QA `qjqorixtkilwsndqayyx` (análisis de código) + prueba en vivo pendiente de ejecutar.
Motivo: tras cerrar T8 (Etapa 6), Pedro autorizó ("vale haslo") verificar si AUD-009 quedó
resuelto de verdad, ya que en el cierre de la Etapa 4 (23/10) se anotó que el aviso de
sincronización de `movimientos` seguía apareciendo dos días después de fusionar la PR #171.

## 1. Lo que dice el código hoy (`index-storage-bootstrap.js`)

La función `datosFilaParaServidor(valor, "movimientos")` decide, fila por fila, si un
movimiento se intenta subir al servidor. Hay exactamente tres casos en los que devuelve
`null` (nunca se intenta subir esa fila):

1. `tipo === "APERTURA_FIXTURE"`, y solo si además `esPreviewQa()` es cierto (el propio
   fixture de pruebas que instala el preview de QA).
2. `tipo === "MERMA"` sin `empresaId` y con `motivo` que empieza por `Merma · QA-` o
   `Merma · QA_` (patrón explícito de las pruebas AUD), también solo en preview de QA.
3. Filas que ya vienen autoritativamente desde `movimientos_stock` (marcadas
   `_pm07Servidor`) — no se duplican en la tabla heredada `movimientos_registro`.

Los tres casos están comentados en el propio código explicando por qué: son datos de
prueba o datos que ya tienen otra ruta autoritativa, nunca movimientos reales de un
negocio. **Ningún movimiento real (con empresa/local verdaderos, motivo normal) entra en
estos tres filtros** — se intenta subir siempre.

Además, `esRechazoSoloLocal` (la función que decide si un fallo de guardado se queda
«solo en este equipo» sin más aviso) solo hace eso para `movimientos` cuando el error es
de permisos o de cuota — un error de red o un timeout **no** se oculta: queda pendiente,
visible, y con botón de "Reintentar" (así lo explica el propio comentario del código,
línea ~222 de `index-storage-bootstrap.js`).

## 2. La pieza que faltaba: el aviso de `historialRespaldos` es otra cosa

El aviso "Guardado solo en este equipo (historialRespaldos)" que seguía viéndose en el
cierre de la Etapa 3 (23/10) **no es el mismo aviso que AUD-009**. Es una colección
distinta (`historialRespaldos`, copias de seguridad automáticas, no movimientos de stock)
que el propio código marca a propósito como "solo local en preview de QA" de forma
permanente e intencionada (línea 220 de `index-storage-bootstrap.js`), porque esas copias
no son un dato operativo y QA puede rechazar su tamaño. Se puede confundir con AUD-009
porque los dos muestran un aviso similar en pantalla, pero son mecanismos y colecciones
diferentes.

## 3. Conclusión del análisis de código

Los "dos pendientes" que el equipo vio el 23/10 al cerrar la Etapa 4 cuadran, con muchísima
probabilidad, con el fixture de apertura que instala automáticamente el preview de QA más
una merma sintética de las pruebas AUD — exactamente los dos patrones que el código excluye
a propósito desde el caso 1 y el caso 2 de arriba. Eso explicaría por qué seguían "atascados"
sin que fuera un fallo real: nunca se intentó subirlos, por diseño, para no romper la cola con
datos de prueba que el servidor rechazaría de todas formas.

Esto **no es una confirmación con prueba en vivo**, es una lectura del código. Antes de cerrar
AUD-009 del todo hace falta la prueba que el propio Pedro propuso: crear una merma y un
traspaso **de verdad** (motivo normal, sin el patrón `Merma · QA-...`, con empresa/local
reales) en QA y comprobar que no aparece ningún aviso de sincronización para `movimientos`.

## 4. Prueba en vivo (Cowork, QA, 25/10/2026)

Guion ejecutado: una merma y un traspaso **de verdad** (motivo normal, sin el patrón
`QA-`), en una empresa de pruebas con dos locales (Local A1 y Local A2).

- **Merma**: Croissant (QA), 2 unidades, motivo "Rotura" con observación "Rotura en
  almacén al reponer la vitrina". `operation_id` `mvnlx3ricu3i2f`.
- **Traspaso**: Agua 50 cl (QA), 3 unidades, Local A1 → Local A2. `operation_id`
  `mvnlyahy0ge5b0`.

Tras recargar la página completa:

- Ningún aviso de "Guardado solo en este equipo" ni botón "Reintentar" en ninguno de los
  dos movimientos.
- "Configuración → Locales → Diagnóstico de sincronización" confirmó explícitamente:
  "Nada pendiente de subir en este dispositivo ahora mismo."
- El único aviso de sincronización visible en toda la pantalla fue el ya conocido y
  **no relacionado** `almacen:historialRespaldos` ("1 colección solo en este equipo"),
  el mismo caso aparte documentado en la Etapa 3 — copias de seguridad automáticas, no
  movimientos de stock.
- Verificación independiente por SQL de solo lectura en el proyecto Supabase QA
  (`qjqorixtkilwsndqayyx`, nunca en PROD): la merma está en `movimientos_registro` con
  los mismos datos de pantalla; el traspaso está en `movimientos_stock` (sus dos líneas,
  salida en A1 y entrada en A2) y en `stock_operaciones`. Confirma que ambos llegaron de
  verdad al servidor, no solo a este equipo.

## 5. Límites respetados

- No se ha tocado PROD en ningún momento (ni en la prueba en vivo ni en la consulta SQL).
- No se ha hecho ninguna escritura SQL directa ni migración — la consulta SQL fue de
  solo lectura, para verificar, no para corregir nada.

## 6. Conclusión final

**AUD-009 queda cerrado.** El análisis de código (sección 1-3) y la prueba en vivo con
evidencia real en servidor (sección 4) coinciden: un movimiento real (merma o traspaso,
motivo normal) se sincroniza con normalidad, sin quedarse "solo en este equipo" y sin
necesitar reintento. Los "dos pendientes" que se vieron el 23/10 al cerrar la Etapa 4 se
explican por los filtros intencionados de datos de prueba de QA (sección 1), no por un
fallo real de sincronización. El aviso de `historialRespaldos` que sigue viéndose es un
asunto aparte, ya documentado, sin relación con AUD-009.
