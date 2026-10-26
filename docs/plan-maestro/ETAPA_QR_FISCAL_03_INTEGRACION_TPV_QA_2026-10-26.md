# L&A Suite · Etapa 03 · Integración del QR fiscal en el TPV QA

Fecha: 26 de octubre de 2026  
Ámbito: Supabase QA `qjqorixtkilwsndqayyx`, empresa `QA-EMP-A`, local `QA-A1`  
Producción: fuera de alcance y no modificada

## Objetivo

Conectar un cobro completado del TPV con el documento fiscal QR simulado de la Etapa 02 y presentar ese QR en la interfaz del ticket. La pantalla no debe presentar una venta cobrada como ticket fiscal si el documento QR todavía no está preparado.

## Trabajo realizado

1. Se añadió `fiscal-qr.js`, un renderer local de QR Model 2 en modo byte, nivel de corrección M y versiones 1–10. El renderer genera un SVG con módulos QR reales a partir de la URL devuelta por el servidor; no descarga una imagen externa ni dibuja un marcador visual.
2. `index.html` carga el renderer antes de `fuente.js` y expone `window.LA_FISCAL_QR.svgForUrl`.
3. `leerEstadoCobroF4` consulta en QA la asociación `checkout_ventas` y los documentos `abc_fiscal_qr_documentos`. El alcance está condicionado a `QA-EMP-A` para no alterar el camino de producción.
4. Después de cada camino de pago que deja la cuenta en `PAGADO` —efectivo, tarjeta simulada, recuperación de cobro y vale regalo— el TPV llama a `abc_preparar_ticket_fiscal_qa` con un `operation_id` estable. La RPC sigue siendo la autoridad para numeración, clasificación, puerta fiscal y URL AEAT de pruebas.
5. Si la RPC es idempotente o ya existe el documento, el estado vuelve a leerse y el ticket recibe `ticketFiscalQrReady` junto con sus datos fiscales. Si falla la preparación, el cobro no se deshace: se muestra el bloqueo explícito y se impide imprimirlo como factura simplificada.
6. El panel de cobro pagado muestra el QR, serie/número, fecha, importe y la leyenda `simulador QA; no presentado a AEAT`.
7. La impresión del ticket en QA queda bloqueada hasta que existe un `qr_url` preparado. Cuando está disponible, el payload del Puente L&A incluye la URL y los metadatos del QR para la siguiente etapa de impresión térmica.

## Pruebas ejecutadas

- `node --check fuente.js`: correcto.
- `node --check fiscal-qr.js`: correcto.
- Render de URL AEAT de pruebas en Node: correcto; SVG con `viewBox`, `path` y más de 100 módulos oscuros.
- `node tests/pm18/p03-qr-fiscal-qa-contract.mjs`: correcto (`PASS: contrato QR fiscal QA P18`).
- `node tests/pm18/p04-qr-renderer-contract.mjs`: correcto (`PASS: renderer e integración QR fiscal TPV QA P18`).
- `git diff --check`: correcto en la validación inicial.
- Prueba e2e en navegador QA: correcta en el preview de PR 175. Se creó una venta de `Agua 50 cl (QA)` por 1,00 €, se confirmó el cobro en efectivo y el TPV mostró `QR tributario preparado`, el QR visible, serie `TPV`, número `000001`, fecha `2026-10-26` e importe `€ 1.00`. El botón de impresión permaneció condicionado a la selección de una impresora.
- Verificación read-only en Supabase QA: correcta. La fila quedó en `PREPARADO_SIMULADOR`, con `modo=SIMULADOR`, importe `1.00000000` y `qr_url` del endpoint AEAT de pruebas. La operación idempotente quedó asociada al checkout y a la venta fiscal.

## Límites fiscales

La URL usa el endpoint AEAT de pruebas externas definido en el contrato de la Etapa 01. El sistema sigue en modo `SIMULADOR`, `aeat_presentacion=false` y no acredita una presentación real ante la AEAT. La activación productiva requiere su propio contrato, revisión fiscal y configuración de emisor.

## Estado

**ETAPA 03 TERMINADA EN QA.**

El flujo queda cerrado para el entorno de pruebas: el servidor prepara el documento y la URL; el navegador genera un QR real a partir de esa URL; el ticket lo muestra; y la impresión no se habilita mientras falte el documento QR o una impresora seleccionada. Producción no fue consultada ni modificada.

## Siguiente etapa

Etapa 04: integrar el payload fiscal con el ticket térmico/puente, validar la impresión visual y cerrar los reintentos de impresión sin duplicar numeración ni emitir un segundo documento fiscal.
