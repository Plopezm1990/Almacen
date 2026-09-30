# F4 B07 Contrato tecnico de notificaciones del proveedor

Fecha: 30/09/2026.

## Estado

Este documento cierra el subpunto de diseño tecnico y el subpunto de entrada
simulada de B07. Queda preparada una Edge Function generica, con firma HMAC o
secreto de simulacion, que normaliza eventos sin aplicar efectos economicos.
B07 no se puede cerrar ni probar contra un sandbox hasta identificar el
proveedor contratado y su mecanismo de firma. No se han aplicado migraciones
remotas ni se ha hecho deploy.

## Alcance oficial

B07 pertenece a F4 y exige recibir notificaciones del proveedor de pagos,
verificar su autenticidad, resolver empresa y local desde la cuenta comercial
guardada en servidor, validar importe, moneda y referencia, registrar el evento
una sola vez y tolerar duplicados o eventos desordenados. Un evento falso o de
otra cuenta no puede modificar caja ni el estado de un cobro.

## Base reutilizable comprobada

- `public.pagos` conserva el cobro y su estado economico.
- `public.pago_intentos` conserva el intento, `provider_code`,
  `provider_reference`, importes y el estado del intento.
- `public.abc_eventos` proporciona la trazabilidad de operaciones ABC.
- `public.abc_cobro_incidencias` de B04 conserva los cobros de resultado
  desconocido y sus referencias del proveedor.
- `public.abc_resolver_intento(...)` ya concentra la transicion controlada de
  un intento y protege el efecto economico mediante las operaciones existentes.
- `private.abc_operacion_iniciar_sistema(...)` permite que la entrada de un
  proveedor se procese como efecto de sistema, sin atribuirla a un usuario de
  la interfaz.

La funcion existente `supabase/functions/enviar-notificacion` no es la entrada
de pagos de B07; sirve para notificaciones push de la aplicacion y no debe
reutilizarse como webhook financiero.

La primera migracion de B07 crea `private.abc_b07_proveedores` y
`private.abc_b07_cuentas_comerciales`. La primera guarda el adaptador, la
configuracion de firma y las rutas de normalizacion; la segunda vincula una
cuenta comercial a empresa y local y solo conserva `secret_ref`, nunca el valor
del secreto.

La segunda migracion crea `public.abc_b07_obtener_configuracion`, una funcion
`security definer` ejecutable solo por `service_role`. La Edge Function
`abc-b07-webhook` usa esa funcion para resolver la cuenta y el ambito comercial
en servidor. El adaptador `abc-b07-adapter.mjs` admite rutas de normalizacion
configurables, rechaza datos de tarjeta y permite validar eventos simulados sin
escribir en pagos, caja, stock ni incidencias.

## Contrato propuesto de entrada

La futura entrada sera un endpoint de servidor para el proveedor elegido. El
nombre definitivo y su adaptador dependeran del proveedor; no se fija una URL
publica en esta fase.

1. Se conserva el cuerpo HTTP crudo para verificar la firma antes de parsear el
   JSON.
2. La entrada no depende de un JWT de usuario. La autenticacion sera la firma
   propia del proveedor con un secreto almacenado solo en el entorno servidor.
3. Tras verificar la firma, el adaptador normaliza como minimo:
   `provider_code`, `provider_account_id`, `provider_event_id`,
   `provider_reference`, `event_type`, `status`, `amount`, `currency`,
   `occurred_at` y el payload original sin datos de tarjeta.
4. `provider_account_id` se resuelve en servidor a una cuenta comercial
   configurada y, desde ella, a `empresa_id` y `local_id`. La peticion no puede
   elegir libremente esos identificadores.
5. El servidor compara importe, moneda y referencia con el intento relacionado.
   Un desacuerdo se registra como evento rechazado o incidencia y no modifica
   `pagos`, caja ni stock.
6. La clave de deduplicacion es el proveedor, la cuenta comercial y el
   identificador de evento. El mismo evento con el mismo contenido devuelve un
   resultado idempotente; la misma clave con contenido distinto produce
   conflicto y no aplica efectos.
7. Los eventos se guardan antes de aplicar el efecto. Los eventos antiguos o
   desordenados quedan trazados y no pueden hacer retroceder una transicion ya
   confirmada.
8. La aplicacion economica delega en la autoridad existente de resolucion de
   intentos. El webhook no inserta movimientos de caja directamente.

## Reglas de seguridad

- No aceptar `empresa_id`, `local_id`, `pago_id` o `intento_id` del proveedor
  como autoridad sin resolver la cuenta comercial en servidor.
- No exponer `service_role`, secretos ni firmas en el frontend.
- No guardar PAN, CVV ni credenciales de tarjeta en eventos, logs o adjuntos.
- Rechazar firma ausente, firma invalida, cuenta desconocida, importe no
  valido, moneda incompatible y referencia no vinculable.
- Mantener RLS y privilegios cerrados en las tablas de entrada; la escritura
  privilegiada debe quedar en una funcion de servidor con entrada validada.

## Pruebas de aceptacion B07

- Evento firmado y coherente: un intento elegible cambia una sola vez y deja
  evento, referencia y trazabilidad.
- Firma falsa o ausente: rechazo sin cambios economicos.
- Evento duplicado: respuesta idempotente, sin segundo movimiento de caja.
- Misma clave con payload distinto: conflicto, sin aplicar el segundo evento.
- Cuenta comercial de otra empresa o local: rechazo sin modificar datos ajenos.
- Importe, moneda o referencia distintos: incidencia o rechazo, sin confirmar
  el pago.
- Evento fuera de orden: se conserva la evidencia y no se degrada un estado
  confirmado.
- Reintento despues de una respuesta desconocida: reutiliza la resolucion de
  B04/B02-B04 y no crea un cargo ni una entrada de caja adicional.

## Decision pendiente que bloquea la implementacion

El repositorio sigue sin contener el nombre del proveedor contratado, su
cuenta comercial, el formato del evento ni un sandbox verificable. Por tanto,
no se ha inventado un adaptador Stripe, Redsys, SumUp u otro proveedor.

El siguiente subpunto sera implementar la entrada de servidor y su adaptador
configurable con validacion de importe, moneda, referencia e idempotencia
contra el intento de pago. Ese subpunto requiere ya el proveedor contratado o
un fixture firmado equivalente; aun no debe desplegarse a produccion.
