# C07-D.2.7 — Matriz de validación visual del ticket y hardware

Fecha: 27/10/2026  
Ámbito: QA técnico de L&A Suite; ticket TPV, salida imprimible/PDF y preparación de hardware.  
Estado: **TERMINADA — validación estática y de fixture QA PASS; hardware físico PENDIENTE**.

## 1. Alcance y límites

Esta entrega valida el comportamiento implementado en el código y en la fixture de
preview QA. No activa emisión fiscal, no llama a la AEAT, no usa certificados y no
escribe en producción. La fixture utiliza un snapshot en memoria y no crea una venta
real ni ejecuta un cobro.

La palabra «fiscal» en esta fixture describe únicamente la forma del payload que se
previsualiza. El ticket lo rotula expresamente como `QA · EMISIÓN REAL DESACTIVADA`.
No debe presentarse como una factura fiscal emitida hasta que exista una empresa real
con expediente de activación aprobado, adaptador sandbox probado y autorización de
producción.

## 2. Matriz de aceptación

| ID | Comprobación | Resultado | Evidencia |
| --- | --- | --- | --- |
| V01 | El ticket se puede abrir en pantalla desde la venta/historial | PASS | `renderTicketVenta`, modal `Ticket ...` |
| V02 | La zona de ticket es única y está marcada para impresión/PDF | PASS | `className: ... zona-impresion` |
| V03 | El QR se muestra solo si el snapshot contiene `qrFiscal` | PASS | `ticketQrFiscalVista` |
| V04 | El payload debe llevar `production:false` | PASS | guardia de presentación y contrato del ticket |
| V05 | La URL del payload debe ser HTTPS | PASS | validación `/^https:\/\//u` |
| V06 | La matriz se genera localmente en SVG, sin dependencia remota | PASS | `renderQrSvg`, `data-qr-fiscal-matrix="local-svg"` |
| V07 | La matriz usa quiet zone y corrección M conforme al contrato QR | PASS | `qr-matrix.mjs` y pruebas QR existentes |
| V08 | La pantalla muestra etiqueta, modalidad, URL y aviso de QA | PASS | `data-qr-fiscal-preview="qa"` |
| V09 | Un albarán, nota de entrega u otro documento no fiscal no hereda el bloque QR del ticket | PASS — alcance estático | el bloque QR está dentro de `renderTicketVenta`; no hay render de QR en módulos de albaranes |
| V10 | Un payload de producción, no HTTPS o inválido no se imprime | PASS | `ticketQrFiscalVista` devuelve `null` |
| V11 | El móvil puede escanear una matriz de fixture QA | PENDIENTE FÍSICO | requiere cámara/dispositivo delante de preview |
| V12 | Impresora térmica conserva contraste, tamaño y zona de silencio | PENDIENTE FÍSICO | requiere modelo y rollo reales |
| V13 | Exportación/impresión PDF conserva la matriz completa en primera página | PASS — contrato de UI; prueba visual física PENDIENTE | zona imprimible y SVG inline |
| V14 | Lector de sobremesa acepta el QR impreso | PENDIENTE FÍSICO | requiere lector real y ticket impreso |

## 3. Criterios técnicos de QR

- Payload de fixture: `production:false`, URL AEAT de cotejo en HTTPS y datos de una
  venta QA aislada.
- Matriz: SVG local, byte mode, nivel de corrección M y zona de silencio de cuatro
  módulos.
- La representación visual no hace una petición a AEAT. La consulta manual de una
  URL QA, si se decide hacerla, solo sirve para comprobar el formato y puede devolver
  «No encontrada» porque la venta no existe en los sistemas de la AEAT.
- El bloque aparece una sola vez en el ticket y dentro de la zona que se presenta en
  pantalla y puede destinarse a impresión/PDF.
- Un ticket interno sin payload fiscal válido permanece sin matriz QR.

## 4. Ejecución reproducible

Prueba nueva de matriz:

```text
node tests/f5/c07/c07d-d2-7-visual-hardware-matrix-contract.mjs
```

Pruebas que deben acompañarla:

```text
node tests/fiscal/aeat-qr-contract.mjs
node tests/fiscal/qr-matrix-contract.mjs
node tests/fiscal/qr-ticket-preview-contract.mjs
node tests/fiscal/qr-ticket-ui-static-contract.mjs
node --check fuente.js
git diff --check
```

La prueba nueva no abre el navegador ni ejecuta cobros: inspecciona los contratos y
la integración estática. La comprobación visual de pantalla sigue disponible en la
preview QA con `?qa=qr-fiscal-ticket`.

## 5. Cierre y siguiente puerta

Queda cerrado el bloque de QA técnico de pantalla/ticket/PDF. Queda abierto únicamente
el ensayo físico, porque todavía no hay una empresa real, impresora térmica ni lector
que deban certificarse.

La siguiente puerta es **C07-D.3 — piloto de una empresa real en sandbox**:

1. completar el expediente C07-D.2.6 de esa empresa;
2. aportar identidad fiscal, serie, asesoría y autorización/representación;
3. conectar el adaptador sandbox sin secretos en frontend;
4. emitir una prueba controlada en sandbox;
5. escanear pantalla y papel, y guardar evidencias;
6. solo después decidir si se solicita activación de producción.

Hasta superar esa puerta no se debe cambiar `production:false`, ni activar una empresa,
ni tocar Supabase de producción.
