# F5 C09 Contrato de impresión sin duplicar la venta

Fecha: 2026-10-01  
Estado: `CANDIDATO_C09_PENDIENTE_VALIDACION_PG`

## Alcance

C09 registra la impresión original y las reimpresiones de un documento C05 ya
emitido y conservado por C08. Cada copia tiene su propia operación auditable,
canal y motivo, pero siempre apunta al mismo documento y a la misma versión
conservada.

La reimpresión no reserva otro número, no crea otro documento, no crea otra
venta y no cambia el estado del documento emitido. El contador `numero_copia`
permite distinguir la copia original de las posteriores.

## Contrato técnico

- `abc_registrar_impresion_documental` exige autenticación y capacidad de
  emisor.
- El documento debe estar `EMITIDO` y la versión C08 debe pertenecer al mismo
  documento, empresa y local.
- Solo puede existir una impresión `ORIGINAL` por documento y versión.
- Una `REIMPRESION` exige un motivo distinto de `EMISION`.
- Los reintentos con el mismo `operation_id` devuelven la misma impresión.
- El contador de copias se calcula bajo bloqueo del documento para no repetir
  el número en impresiones concurrentes.
- El registro de impresión es inmutable y la tabla queda sin acceso directo
  del cliente.

## Límites explícitos

Este candidato registra la intención/resultado operativo de impresión, pero no
genera un PDF firmado, no certifica una factura fiscal, no conecta impresoras
ni proveedores y no sustituye la revisión de asesoría. No se modifica el
documento histórico y no se aplica ninguna migración remota.

## Evidencia y pendiente

La prueba PostgreSQL 16 cubrirá impresión original, replay, reimpresión,
motivo obligatorio, inmutabilidad y comprobación de que C05 conserva un solo
documento. Falta ejecutar el workflow y registrar su run. Después quedan C10,
advisors, revisión de asesoría/proveedor y decisión de aplicación en QA. No se
ejecuta deploy de Netlify.
