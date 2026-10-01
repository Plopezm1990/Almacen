# F5 C10 Contrato de entrega y copias

Fecha: 2026-10-01  
Estado: `CANDIDATO_C10_VALIDADO_PG_NO_APLICADO`

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

Este candidato no envía correos, no conecta una impresora, no confirma la
recepción del destinatario, no firma documentos, no acredita entrega legal y
no sustituye la revisión de asesoría. No se aplican migraciones remotas y no se
ejecuta deploy de Netlify.

## Evidencia y pendiente

La prueba PostgreSQL 16 cubrió entrega original digital, replay, copia en
papel vinculada a C09, rechazo de papel sin impresión, rechazo de impresión de
otro documento, inmutabilidad y comprobación de que C05 conserva un solo
documento. El run corregido pasó en 37 segundos:
https://github.com/Plopezm1990/Almacen/actions/runs/36915965158. Después queda
C11, advisors, revisión de asesoría/proveedor y decisión de aplicación en QA.
