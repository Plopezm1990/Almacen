# L&A Suite — Ticket interno sin QR fiscal

Fecha: 2026-10-26  
Ámbito: QA / fuente compartida  
Estado: TERMINADA

## Decisión funcional

Una venta ordinaria del TPV genera un ticket interno. Ese ticket no debe crear,
transportar ni mostrar un código QR que pueda interpretarse como validación o
identificación fiscal.

La factura simplificada o cualquier otro documento fiscal es un flujo separado.
Solo puede identificarse como fiscal cuando existen los datos fiscales que el
flujo ya valida; no se reutiliza el ticket interno para simular un documento
fiscal.

## Resultado de la auditoría

- `renderTicketVenta()` ya mostraba `TICKET / RECIBO INTERNO` cuando no había
  número fiscal.
- El pie ya indicaba `Documento interno del TPV · pendiente de numeración fiscal`.
- No existía ningún componente QR en el render del ticket.
- Las referencias `qr_code` encontradas en el bundle pertenecen a TOTP de
  autenticación o a formatos de entrada del escáner, no a la impresión de
  tickets.

## Protección aplicada

En `fuente.js` y `source-recovery/fuente-recuperado.js`, los tickets sin número
fiscal neutralizan cualquier campo QR que pudiera llegar desde datos antiguos o
de una integración incorrecta antes de renderizarse. Se añadieron los campos
de defensa `qr`, `qrCode`, `codigoQr`, `codigoQR`, `fiscalQr`, `verifactuQr` y
`codigoVerificacion`.

También se añadió el contrato `tests/pm18/p02-ticket-interno-sin-qr-contract.mjs`,
que comprueba la barrera en las dos fuentes y bloquea la aparición accidental
de un componente o payload QR dentro del ticket.

## Límite de esta decisión

Esto no implementa facturación electrónica ni un QR fiscal oficial. Si en el
futuro se incorpora ese requisito, deberá existir un renderer fiscal separado,
con numeración, identidad fiscal, persistencia y validación legal propias; no
se añadirá al ticket ordinario por conveniencia visual.
