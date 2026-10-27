# Evidencia QA — contrato del QR fiscal AEAT

Fecha: 27/10/2026  
Ámbito: núcleo determinista del QR para L&A Suite.  
Estado: **PASS — QA local; emisión real deshabilitada**.

## Archivos

- Implementación: `fiscal/qr/aeat-qr.mjs`.
- Pruebas: `tests/fiscal/aeat-qr-contract.mjs`.
- Especificación: `docs/plan-maestro/QR_FISCAL_REAL_AEAT_ESPECIFICACION_2026-10-27.md`.
- Contrato de vista del ticket: `fiscal/qr/ticket-visual.mjs`.
- Renderizador local: `fiscal/qr/qr-matrix.mjs`.
- Integración en ticket/PDF: `fuente.js`, función `renderTicketVenta`.

## Qué se validó

1. URL estable con `nif`, `numserie`, `fecha` e `importe` en orden fijo.
2. Endpoint HTTPS de cotejo AEAT controlado por código, no editable desde la UI.
3. Codificación UTF-8/URL-encoding de serie, espacios, ampersand y barra.
4. NIF de nueve caracteres alfanuméricos y normalización a mayúsculas.
5. Fecha real en formato `DD-MM-YYYY`.
6. Importe no negativo con punto decimal, dos decimales y hasta doce cifras enteras.
7. Serie de hasta 60 caracteres ASCII imprimibles.
8. Rechazo de campos adicionales para impedir que la UI altere el contrato fiscal.
9. Payload visual con `QR tributario:`, `VERI*FACTU`, ISO/IEC 18004:2015, nivel M y primera página.
10. Aislamiento por snapshot: dos NIF diferentes generan dos URL diferentes y nunca se sustituyen.
11. `production=false` en el payload y ausencia de cualquier llamada a AEAT.
12. El historial conserva `qrFiscal` únicamente como dato asociado a la venta; no se reconstruye desde una configuración editable.
13. El ticket imprime el bloque de payload únicamente para URLs HTTPS marcadas con `production=false`.
14. La pantalla y la salida de impresión/PDF rotulan el bloque como QA, dejan explícita la emisión real desactivada y dibujan la matriz con un SVG local.
15. La fixture visual `?qa=qr-fiscal-ticket` abre el mismo modal real de ticket sólo en `deploy-preview-*` o localhost; no existe en el dominio productivo y no escribe en Supabase.

## Ejecución

Comando:

```text
node --test tests/fiscal/aeat-qr-contract.mjs tests/fiscal/qr-ticket-preview-contract.mjs tests/fiscal/qr-ticket-ui-static-contract.mjs tests/fiscal/qr-matrix-contract.mjs
```

Resultado:

```text
17 tests passed, 0 failed
```

Además, la matriz del payload QA largo se decodificó localmente con un lector QR independiente y devolvió exactamente la URL AEAT esperada. La comprobación cubrió la versión 8, los patrones de alineación y los bits BCH de versión.

## Límite de esta entrega

Esta entrega ya conecta el payload opcional al ticket del TPV y a su zona de impresión/PDF. La matriz QR visual se genera localmente en SVG a partir de exactamente `payload.url`, con byte mode, corrección M y zona de silencio. No se ha añadido una librería remota ni se ha llamado a AEAT.

Queda como comprobación física opcional apuntar la cámara de un dispositivo móvil al ticket en la preview QA. La matriz sigue siendo exclusivamente de previsualización QA y no equivale a un QR fiscal emitido mientras la empresa no tenga activada y validada su configuración fiscal.

No se ha creado ningún registro fiscal en producción, no se ha usado ningún certificado, no se ha llamado a AEAT y no se ha activado una empresa.
