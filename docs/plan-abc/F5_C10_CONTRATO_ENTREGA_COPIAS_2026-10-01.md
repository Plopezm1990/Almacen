# F5 C10 Contrato de entrega y copias

Fecha: 2026-10-01  
Estado: `NUCLEO_VERIFICADO_EN_QA; CICLO_PROVEEDOR_ACCESO_Y_UI_PENDIENTES`

## Alcance

C10 registra la entrega original o una copia de un documento C05 ya emitido y
conservado por C08. La entrega queda ligada a la misma versión, destinatario,
canal, motivo y referencia operativa. Las entregas digitales se registran como
evidencia local de preparación/registro, no como confirmación de un proveedor.

Una entrega en papel exige una impresión C09 perteneciente al mismo documento
y versión. Las copias no generan otro número, otra venta ni otro documento.

## Contrato técnico

- `abc_registrar_entrega_documental` exige autenticación y capacidad de emisor.
- El documento debe estar `EMITIDO` y la versión C08 debe corresponder al mismo
  documento, empresa y local.
- Los canales admitidos son `PAPEL`, `EMAIL`, `DESCARGA` y `API`.
- La entrega en papel exige `impresion_id` de C09 y se verifica su alcance.
- `ORIGINAL` y `COPIA` se registran con `operation_id` idempotente.
- El registro es inmutable y la tabla queda sin acceso directo del cliente.
- Cada entrega deja evento `DOCUMENTO_ENTREGADO` con estado inicial
  `REGISTRADA`.

## Límites explícitos

Esta implementación no envía correos, no conecta una impresora, no confirma la
recepción del destinatario, no firma documentos, no acredita entrega legal y
no sustituye la revisión de asesoría. Los estados `CONFIRMADA` y `FALLIDA`
existen en el esquema, pero todavía no hay una RPC que registre esas
transiciones. Tampoco hay token de descarga, autorización del destinatario ni
caducidad de enlace.

## Evidencia y pendiente

La prueba PostgreSQL 16 cubrió entrega original digital, replay, copia en
papel vinculada a C09, rechazo de papel sin impresión, rechazo de impresión de
otro documento, inmutabilidad y comprobación de que C05 conserva un solo
documento. El run corregido pasó en 37 segundos:
https://github.com/Plopezm1990/Almacen/actions/runs/36915965158. Después queda
C11, revisión de asesoría/proveedor y la integración visible.

El ensayo conectado en QA del 9/10/2026 cubrió entrega original por email,
replay, copia en papel vinculada, descarga registrada, inmutabilidad y permisos.
Terminó con `ROLLBACK` y cero residuos. Producción no se ha modificado.

Para cerrar C10 faltan el ciclo real `REGISTRADA → CONFIRMADA/FALLIDA`, el
reintento de una entrega fallida, autorización y caducidad de descargas, envío
real, pantalla y aceptación. Evidencia consolidada:
`F7_C10_QA_RESULTADO_2026-10-09.md`.
