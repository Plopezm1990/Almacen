# L&A Suite · Etapa 04 · QR fiscal en ticket térmico y Puente L&A

Fecha: 26 de octubre de 2026  
Ámbito: QA y código local del Puente L&A  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción: fuera de alcance y no modificada

## Objetivo

Cerrar el recorrido que faltaba después de la Etapa 03: llevar al Puente L&A la
URL y los metadatos del documento QR fiscal ya preparado por el servidor, generar
el QR en formato compatible con una impresora térmica ESC/POS y hacer que los
reintentos de la misma impresión no creen otro documento fiscal ni vuelvan a
enviar dos veces el mismo trabajo al transporte local.

## Trabajo realizado

1. `puente-la/formato-ticket.js` acepta `qrFiscal` y genera los comandos nativos
   ESC/POS `GS ( k` para QR Model 2, módulo 6 y corrección M. La URL recibida se
   mantiene exactamente; no se genera una numeración ni una URL nuevas en el
   puente.
2. El ticket térmico incorpora la serie/número, fecha, importe y leyenda del
   documento. También imprime la URL como texto de respaldo para impresoras que
   no implementen el comando QR nativo.
3. `fuente.js` construye una clave estable
   `t7.ticket.print.<checkout>.<documento QR>.<equipo>` y la envía tanto al
   registro de impresión simulada como al Puente L&A.
4. `puente-la/servidor.js` mantiene operaciones de impresión en curso o ya
   completadas por `operationId`. Dos solicitudes simultáneas con la misma clave
   comparten el trabajo; la segunda responde como `duplicate: true` sin volver a
   llamar al transporte. Si el primer envío falla, la clave se libera para poder
   reintentarlo.
5. El puente responde a CORS solo para los orígenes exactos de
   `origenesPermitidos`, incluyendo `OPTIONS` y `X-Puente-Token`. El token sigue
   siendo obligatorio para imprimir o abrir el cajón; `/estado` no lo expone.
6. `/estado` publica las capacidades `qrFiscalEscPos` e
   `idempotenciaImpresion`, para que la conexión del TPV pueda comprobar qué
   versión de puente está disponible.
7. El TPV incorpora la opción **Ver ticket en pantalla** después de confirmar
   el cobro. La vista reutiliza las mismas líneas, total, estado de pago y
   `qrFiscalSvg` del ticket ya preparado; no crea una venta, una numeración ni
   un documento fiscal adicional. Incluye la leyenda visible de que es una
   vista informativa y, en QA, mantiene la advertencia `Simulador QA; no
   presentado a AEAT`.

## Pruebas ejecutadas

- `node --check fuente.js`: correcto.
- `node --check puente-la/formato-ticket.js`: correcto.
- `node --check puente-la/servidor.js`: correcto.
- `node tests/plan-maestro/etapa4-qr-fiscal-puente-contract.mjs`: correcto
  (`PLAN_MAESTRO_ETAPA4_QR_FISCAL_PUENTE=PASS`). Incluye QR nativo, URL de
  respaldo, CORS, autenticación, dos solicitudes concurrentes y un único envío
  al transporte simulado.
- `node tests/plan-maestro/etapa5-t7-puente-la-pieza1-contract.mjs`: correcto.
- `node tests/plan-maestro/etapa5-t7-puente-la-pieza2-contract.mjs`: correcto.
- `node tests/plan-maestro/etapa6-puente-scope-contract.mjs`: correcto.
- `node tests/pm18/p05-ticket-screen-contract.mjs`: correcto
  (`PASS: vista de ticket en pantalla TPV QA P18`). Comprueba que el botón,
  el contenedor de la vista, las líneas, el total, el estado y el QR proceden
  del mismo flujo de ticket.
- `node .github/scripts/build-netlify-publish.mjs`: correcto; el bundle QA y la
  carpeta `puente-la/` se copian al directorio de publicación.
- Preview QA de PR 175: actualizado al commit `685b6a7`; comprobación directa del
  `fuente.js` servido confirmó la clave estable `t7.ticket.print.*`, el payload
  `operationId` del puente, el objeto `qrFiscal` y el botón de vista en pantalla.
- Prueba funcional en el preview QA: se guardó una venta de `Agua 50 cl (QA)`
  por `€1,00`, se envió, se cobró en efectivo y se abrió la vista. El ticket
  mostró `PAGADO`, el documento `TPV-000002`, el mismo QR fiscal renderizado y
  la leyenda de simulador; el DOM confirmó un único
  `[data-tpv-ticket-screen="true"]`.
- `git diff --check`: correcto.

## Límites y decisión de hardware

El contrato de bytes está probado con transportes simulados. Todavía no se ha
conectado una impresora física, por lo que quedan pendientes el tamaño real del
papel, la compatibilidad del modelo concreto con `GS ( k`, la página de
caracteres, el corte y el pulso del cajón. La URL sigue siendo la del endpoint
AEAT de pruebas y el documento sigue en `SIMULADOR`; esta etapa no autoriza un
paso fiscal productivo.

## Estado

**ETAPA 04 TERMINADA EN QA Y EN EL PUENTE LOCAL.**

La integración software queda preparada para una prueba física posterior. No se
ha desplegado ni ejecutado el puente contra una impresora real y no se ha tocado
Producción.

## Siguiente etapa

Etapa 05: prueba controlada con el hardware disponible —primero impresora y
después cajón—, ajuste de ancho/codificación/corte si el modelo lo requiere y
validación visual del ticket completo. Hasta disponer del hardware, no se debe
activar un origen productivo ni presentar el QR como emisión fiscal real.
