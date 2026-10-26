# L&A Suite — Etapa QR fiscal 01: contrato y mapa técnico

Fecha: 2026-10-26  
Ámbito: QA primero; producción bloqueada  
Estado: TERMINADA

## 1. Decisión funcional recibida

El usuario ha aclarado que cada venta del TPV que genere un ticket debe emitir
una factura simplificada fiscal con un QR fiscal auténtico. El resultado no debe
ser un `TICKET / RECIBO INTERNO` sin QR.

La modalidad recomendada para la primera implementación es **VERI*FACTU**:

- el registro de facturación se remite a la AEAT en el momento exigido por el
  flujo;
- el cliente puede cotejar la factura mediante el QR;
- la representación impresa incluye el QR y la mención correspondiente.

La modalidad definitiva y su activación productiva requieren la configuración
fiscal del obligado tributario y la validación del asesor o responsable fiscal.
QA utilizará una modalidad simulada y nunca se presentará como emisión real.

## 2. Qué exige el QR fiscal

El QR no es un adorno ni una imagen genérica. Debe contener la URL oficial de
cotejo y los datos de la factura que forman parte de ella:

- NIF del obligado a expedir la factura;
- serie y número de factura;
- fecha de expedición;
- importe total.

La representación gráfica debe respetar las especificaciones técnicas de la
AEAT, incluyendo tamaño, formato ISO/IEC 18004 y corrección de errores.

## 3. Flujo actual localizado en L&A Suite

El flujo actual está dividido correctamente por responsabilidades, pero aún no
completa la emisión fiscal:

1. A02 abre la cuenta y persiste el pedido y sus líneas.
2. A05 confirma y envía las líneas operativas.
3. F4 prepara el checkout y crea una fila en `ventas_fiscales`.
4. La venta fiscal se crea con el snapshot `sin_documento_fiscal=true`.
5. F4 registra el cobro y sus efectos de caja o proveedor.
6. El renderer de ticket usa la referencia interna y no tiene datos de QR.

Conclusión: existe la base comercial/fiscal y de cobro, pero falta el puente
entre `ventas_fiscales` pagada y el documento fiscal numerado, registrado y
representable con QR.

## 4. Contrato objetivo

Una venta no podrá mostrarse como factura simplificada ni imprimirse con QR
hasta que el servidor haya confirmado, de forma idempotente:

1. identidad fiscal activa para empresa y local;
2. modalidad fiscal permitida para ese entorno;
3. serie documental activa;
4. número fiscal reservado de forma correlativa;
5. snapshot inmutable de líneas, bases, impuestos y total;
6. registro de facturación y huella/encadenamiento correspondientes;
7. URL de cotejo calculada con los datos definitivos;
8. estado de emisión compatible con la modalidad configurada.

Si uno de esos pasos falla, la venta debe quedar trazable y el sistema no debe
imprimir un QR que parezca fiscal. Debe mostrar el estado pendiente o bloqueado
y permitir recuperación idempotente, nunca fabricar un número ni reutilizarlo.

## 5. Trabajo que queda para las siguientes etapas

### Etapa 02 — emisión fiscal servidor

- ampliar o crear el RPC de emisión fiscal de la venta;
- reservar serie y número al servidor;
- relacionar documento, `venta_fiscal`, checkout y pago;
- guardar el payload fiscal y la huella;
- dejar una operación idempotente y recuperable.

### Etapa 03 — URL y renderer QR

- generar la URL oficial con el formato AEAT vigente;
- integrar un generador QR local y reproducible;
- mostrar `FACTURA SIMPLIFICADA`, número fiscal y QR;
- añadir `VERI*FACTU` solo cuando la modalidad lo permita;
- mantener el ticket por correo y la impresión apuntando al mismo documento.

### Etapa 04 — aceptación QA

- aplicar únicamente en Supabase QA;
- emitir una factura simplificada simulada;
- escanear el QR y comprobar que los datos reconstruidos coinciden;
- comprobar reintento, duplicidad, anulación y fallo de conexión;
- documentar que el QR QA no tiene trascendencia tributaria.

### Etapa 05 — activación productiva

Solo después de superar QA y recibir la configuración fiscal real se podrá
plantear activar producción. Esta etapa requiere autorización expresa aparte y
no forma parte de este cierre.

## 6. Alcance de este cierre

- No se ha emitido ninguna factura real.
- No se ha enviado ningún registro a la AEAT.
- No se ha modificado Supabase producción.
- No se ha añadido un QR falso al ticket.
- La protección anterior que bloqueaba el QR se retiró tras la aclaración del
  usuario; el siguiente cambio será la implementación fiscal completa, no una
  simple imagen.

## 7. Criterio de aceptación de la etapa

La etapa queda cerrada cuando el contrato anterior está documentado y el flujo
real actual está localizado. El resultado no se presenta todavía como emisión
fiscal terminada: el siguiente paso técnico es el RPC servidor que convierte la
`venta_fiscal` pagada en documento fiscal numerado y recuperable.
