# PM24 P02 — Duplicación (IA y push)

## Alcance

El texto literal del Plan Maestro para PM-24 pide probar, para cada
integración, **"acceso, límites y duplicación"**. P01 ya cubrió acceso
(rechazo sin sesión) y límites (5xx, desconexión, timeout, JSON inválido)
para correo, WhatsApp, IA y push. Este punto cubre específicamente
**duplicación**: qué pasa si la misma acción se dispara dos veces seguidas
antes de que la primera termine.

Mismas garantías que P01: redirección a QA solo dentro del arnés de
Playwright, host de producción bloqueado salvo las funciones autorizadas,
identidades y datos exclusivamente sintéticos, sin `service_role`, sin
Netlify Deploy Preview real.

## Metodología

### IA (`entrevista-personal`)

Se dispararon dos clics nativos en el mismo tick de JavaScript (sin ida y
vuelta de Playwright entre uno y otro, para no dar tiempo a que React
volviera a renderizar entre medias) sobre:

1. El botón "Empezar entrevista".
2. El botón de respuesta "Sí" (con `tipo_respuesta: "si_no"` en la respuesta
   simulada de la IA, para tener un botón de un solo clic en vez de un
   campo de texto).

La primera llamada a la función respondía rápido y con éxito; a partir de
la segunda, la respuesta se dejaba "colgada" a propósito — así el estado de
carga permanece activo el tiempo suficiente para que un segundo envío,
si existiera, pudiera colarse antes de que llegara la primera respuesta.

### Push (`enviar-notificacion`, aviso de caducidad)

El mecanismo real de-duplicador (`yaAvisados`, guardado en
`localStorage["almacen__caducidades_avisadas"]`) solo se activa con
`window.__nubeActiva === true`, y generar un lote de caducidad real en este
entorno exigiría dar de alta un albarán completo con fecha de caducidad a
través de todo el flujo de Recepción — sin ganancia real sobre verificar el
algoritmo tal cual es. Por eso se extrajo el bloque real de `fuente.js`
(delimitado por marcadores de código ya existentes, no reescrito a mano) y
se ejecutó con un `localStorage`/`fetch` simulados mínimos, para comprobar
el algoritmo real con tres rondas: un lote nuevo, el mismo lote repetido, y
el mismo lote repetido junto a uno genuinamente nuevo.

## Resultado

**Defecto real encontrado y corregido**: un doble clic rápido en "Empezar
entrevista" no tenía ninguna protección — creaba **dos entrevistas
distintas** y disparaba **dos llamadas a la IA** para el mismo candidato.
Como la segunda llamada machaca `activaId`, la entrevista visible en
pantalla terminaba siendo la asociada a la petición "equivocada"; si esa
petición tardaba o fallaba, la interfaz se quedaba mostrando "La IA está
pensando…" indefinidamente mientras la otra entrevista (con su respuesta ya
recibida) quedaba huérfana, sin mostrarse. Se confirmó el mismo hueco en el
envío de una respuesta durante la entrevista.

Se corrigió con el mismo patrón que ya usa la creación de pedidos
(`submitBloqueadoPedidoPM10`): un bloqueo síncrono por `useRef` que se
comprueba y activa en la primera línea de cada función que llama a la IA
(`empezar`, `enviarRespuesta`, `finalizarAhora`) y se libera solo tras
750ms. Al ser síncrono, corta el problema aunque los dos clics lleguen en
el mismo tick de JavaScript, antes de que React tenga ocasión de
re-renderizar.

Tras la corrección: el doble clic en "Empezar entrevista" genera
exactamente 1 llamada real (antes generaba 2), y el doble clic al responder
tampoco duplica la llamada. Sin excepciones JS no controladas.

El de-duplicador de push, verificado ejecutando su código real extraído tal
cual: un lote nuevo se envía una vez; repetir el mismo lote no genera un
segundo envío; un lote nuevo junto al repetido sí se envía (no bloquea de
más).

## Evidencia

- `p02-resultado.json`: 9 casos, 0 fallos, tras aplicar la corrección.
- Una petición a `prefiltros_candidatos` en producción quedó bloqueada por
  el arnés durante la navegación a la pantalla de Personal — mismo hallazgo
  ya documentado en P01 (fuga de red en modo local), no algo nuevo de este
  punto.
- Ningún dato real, ninguna identidad real. No se usó `service_role`.

```
PM24_P02_DUPLICACION_EJECUTADO=PASS
```
