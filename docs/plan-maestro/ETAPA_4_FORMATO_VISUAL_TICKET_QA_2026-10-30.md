# Etapa 4 — formato visual del ticket en QA

Fecha de cierre: 30/10/2026  
Entorno: QA, preview `deploy-preview-192--chic-entremet-9107cf.netlify.app`  
Producción: no modificada.

## Objetivo

Verificar que el ticket pueda verse completo en pantalla y que la opción
`Imprimir / Guardar PDF` conserve todo el documento: cabecera, líneas,
desglose de IVA, total, pago, cambio, QR simulado de QA y pie.

## Resultado

**Etapa 4 terminada en QA.**

La venta cobrada de la prueba E2E conserva:

- el importe total de `1,00 €`;
- el medio de pago efectivo, entregado `1,00 €` y cambio `0,00 €`;
- el número de TPV `TPV-000020`;
- el QR tributario simulado de QA;
- la URL HTTPS de validación con fecha e importe coherentes;
- la indicación expresa `VERI*FACTU · QA · EMISIÓN REAL DESACTIVADA`;
- el aviso de que no se está emitiendo contra la AEAT real.

La vista del ticket se revisó en el navegador y el contenido queda dentro de
la zona imprimible. El código actual:

- separa la zona del ticket de los botones y del resto de la aplicación al
  imprimir;
- calcula la altura real del ticket antes de abrir el diálogo de impresión;
- evita el recorte vertical del modal;
- mantiene el QR dentro de la zona imprimible;
- usa colores de impresión legibles sobre fondo claro;
- deja el ticket recuperable tras recargar la aplicación.

## Aclaración sobre el historial

También se abrió un registro antiguo del historial (`V-20261030-03F511`).
Ese registro es una salida interna de inventario (`abc.stock.consume...`) sin
checkout, pago ni documento C07-D asociado. Por eso muestra `Cobrado en —`, no
presenta QR y se etiqueta como `TICKET / RECIBO INTERNO`. No debe confundirse
con el ticket cobrado de la prueba E2E, que sí tiene pago y QR QA.

El importe sí aparece en la tarjeta del historial y en el ticket interno
(`1,00 €`). El QR solo se muestra cuando existe un payload C07-D QA válido y
HTTPS; no se fabrica para movimientos internos sin fiscalización asociada.

## Evidencia automática

Todos los contratos relevantes han pasado:

```text
QR_TICKET_UI_STATIC: 5/5 PASS
QR_TICKET_PREVIEW: 2/2 PASS
C07D_HISTORICAL_TICKET_CONTRACT=PASS
A02_QUICK_SALE_TICKET_CONTRACT=PASS
QA_RECEPCION_TPV_CAJA=PASS
git diff --check: PASS
```

No fue necesario introducir código nuevo en esta etapa: las correcciones de
impresión y de recuperación histórica ya estaban en la rama y han quedado
validadas mediante la prueba visual y los contratos automáticos.

## Siguiente paso

**Etapa 5 — validar el QR simulado en QA.** Se debe escanear la matriz del
ticket cobrado y comprobar que los datos leídos coinciden con el payload
visible (`TPV-000020`, fecha `30-10-2026`, importe `1.00`), manteniendo la
emisión real de AEAT desactivada.
