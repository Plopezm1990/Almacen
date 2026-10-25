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

## 4. Prueba en vivo pendiente (guion para Cowork)

1. Entrar en QA con un usuario normal (Propietario o Encargado) de una empresa real de
   pruebas.
2. Registrar una **merma** de un producto cualquiera, con un motivo normal (por ejemplo
   "Rotura en almacén", sin el prefijo "QA-").
3. Registrar un **traspaso** entre dos locales (si la empresa de pruebas tiene más de uno)
   o, si no, otra merma de otro producto.
4. Recargar la página (F5) y comprobar en la pantalla de movimientos / almacén si aparece
   el aviso "Guardado solo en este equipo (movimientos)" o el botón "Reintentar" para esos
   dos movimientos nuevos.
5. Esperado si AUD-009 está resuelto: ningún aviso para estos dos movimientos nuevos — se
   sincronizan con normalidad.
6. Si aparece el aviso para alguno de los dos: AUD-009 sigue abierto de verdad y haría
   falta investigar más (no sería explicable por los filtros de arriba).

## 5. Límites respetados

- No se ha tocado PROD.
- No se ha hecho ninguna escritura SQL directa ni migración.
- No se ha afirmado que AUD-009 está cerrado sin prueba en vivo — se deja explícitamente
  pendiente el paso 4 hasta que Pedro (o Cowork) lo ejecute y lo confirme.

**Estado: análisis de código hecho, con una explicación consistente para lo que se vio el
23/10. Falta la prueba en vivo (sección 4) para cerrar AUD-009 con evidencia real.**
