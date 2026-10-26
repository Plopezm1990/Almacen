# Plan Maestro L&A Suite — Etapa 5, T6: ticket por correo

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-6 (Pedro, 24/10/2026, chat).

## 1. Lo pedido

«Ticket por correo»: enviar por email una copia informativa de la venta
cuando el cliente lo pide, sin ser un documento fiscal (eso es la Hoja
QA-5, factura a empresa, que no se toca aquí) ni sustituir el ticket
impreso.

## 2. Qué se construyó

### 2.1 Resend (proveedor de correo)

Cuenta creada por Pedro en Resend. La clave de API se guardó directamente
como secreto de Edge Function en Supabase (`RESEND_API_KEY`), escrita por
Pedro en el panel de Supabase — nunca pasó por este chat ni por ningún
archivo del repositorio. La primera clave que Pedro pegó por error en el
chat se dio por comprometida y se sustituyó por una nueva, restringida a
"Sending access" (nunca acceso completo).

### 2.2 Base de datos (migración nueva)

`supabase/migrations/20261024100000_t6_ticket_correo.sql`:

- `abc_datos_ticket_correo(p_empresa_id, p_local_id, p_checkout_id,
  p_email)`: de solo lectura. Devuelve el importe y la forma de pago
  **auténticos** (sumados de `pagos` con `estado='CONFIRMADO'`), nunca un
  dato que pudiera llegar manipulado desde el navegador. Exige el mismo
  permiso que iniciar un cobro (`ABC_COBRO_INICIAR`).
- `abc_registrar_ticket_correo_enviado(...)`: deja constancia en
  `abc_eventos` de que se envió un ticket a tal correo, una vez Resend
  confirma el envío.

### 2.3 Edge Function nueva: `enviar-ticket-correo`

Única pieza que toca `RESEND_API_KEY` — nunca llega al navegador. Usa la
sesión del propio usuario (no `service role`) para que las RPC apliquen
el mismo control de permisos que el resto del cobro. Construye el correo
con los datos auténticos del servidor más las líneas del pedido que ya
tiene en pantalla el cliente (escapadas antes de insertarlas en el HTML).
El envío a Resend lleva `Idempotency-Key` (el mismo `operationId`) para
no duplicar el correo si hay un reintento de red.

### 2.4 Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

Sección **"Ticket por correo"** en Cobro·F4, junto a "Factura a empresa",
visible solo con la cuenta PAGADO: un campo de correo y el botón "Enviar
ticket por correo".

## 3. Tres fallos encontrados y corregidos en las pruebas en vivo (Cowork)

1. **Botón sin conectar al componente real.** Mismo tipo de fallo que la
   Hoja QA-5: `enviarTicketCorreoF4` se escribió dentro de
   `crearLogicaVenta()` pero nunca se conectó a `VentaRapida` (el
   componente que de verdad dibuja el botón) — faltaba en su `return`,
   en las props de `<VentaRapida>` y en sus parámetros. Esta vez se
   conectaron los 4 puntos desde el principio, antes de la primera
   prueba, y el test de contrato los comprueba expresamente.
2. **Referencia a estado de otro componente.** Aun con los 4 puntos
   conectados, `enviarTicketCorreoF4` leía `pedidoOperativoA05`
   directamente — pero esa variable es estado local (`useState`) de
   `VentaRapida`, no existe dentro de `crearLogicaVenta`. Provocaba un
   `ReferenceError` crudo visible en pantalla al pulsar el botón.
   Corregido pasando las líneas ya calculadas como parámetro desde
   `enviarTicketCorreoF4UI` (que sí vive en `VentaRapida`).
3. **Registro de auditoría roto por una clave foránea.**
   `abc_eventos.operation_id` exige una fila ya existente en
   `abc_operaciones` (vía `private.abc_operacion_iniciar`). La función
   de registro insertaba directamente en `abc_eventos` sin ese paso, así
   que fallaba siempre con `409` — el correo salía bien por Resend
   (confirmado con un correo real recibido), pero nunca quedaba
   constancia en el histórico. El fallo no se veía en pantalla porque el
   código, a propósito, no deshace un correo que ya se envió de verdad
   por un fallo del registro — pero el histórico quedaba vacío en
   silencio. Corregido con el mismo patrón idempotente
   (`abc_operacion_iniciar`/`completar`/`fallar`) que usa el resto del
   proyecto.

Un cuarto hallazgo, aparte del código: Resend solo deja enviar correos de
prueba **a la dirección con la que se creó la cuenta de Resend**
mientras no haya un dominio propio verificado. El primer intento de
Pedro falló por probar con una dirección distinta
(`pedroroger1990@gmail.com`) a la de la cuenta de Resend
(`chocoloyosangines@gmail.com`) — no era un fallo del programa. Al
probar con la dirección correcta, funcionó a la primera.

## 4. Verificación

- `node --check` en ambos archivos tras cada corrección: OK.
- Prueba de contrato (`tests/plan-maestro/etapa5-t6-ticket-correo-
  contract.mjs`): comprueba la sección de pantalla, que el importe sale
  siempre del servidor (nunca de un parámetro del cliente), los 4 puntos
  de conexión con `VentaRapida`, que `enviarTicketCorreoF4` no referencia
  `pedidoOperativoA05`, que la Edge Function usa la sesión del usuario y
  la `Idempotency-Key`, y que la migración de corrección registra la
  operación antes de insertar en `abc_eventos`. Todo en verde.
- Todos los contratos existentes de `tests/plan-maestro/`: sin cambios
  de resultado.
- Manifiesto de CI actualizado (312→313 archivos, 295→296 contratos
  activos, Node 265→266).
- Verificado en QA, con dato real: correo recibido en
  `chocoloyosangines@gmail.com` con el asunto, el nombre de la empresa,
  la línea del producto y el total correctos; fila en `abc_eventos`
  (`TICKET_CORREO_ENVIADO`) con el correo y el `resend_id` real de
  Resend.

## 5. Límites respetados

- No se ha tocado PROD.
- No es un documento fiscal ni sustituye el ticket impreso.
- El importe y la forma de pago del correo siempre vienen de los pagos
  confirmados reales, nunca de un dato que pudiera manipular el cliente.
- La clave de Resend nunca ha pasado por el código de cliente, por el
  repositorio, ni ha quedado almacenada en ningún archivo.
- No se guarda el correo del cliente en ningún perfil ni lista — solo
  queda su registro puntual de auditoría, igual que cualquier otro
  evento del cobro.

## 6. Pendiente

- Dominio propio verificado en Resend, para poder enviar a cualquier
  cliente real (de momento solo funciona hacia
  `chocoloyosangines@gmail.com`, la dirección de la propia cuenta de
  Resend).

**T6, punto 4 (ticket por correo): cerrado.**
