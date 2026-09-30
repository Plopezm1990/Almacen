# F4 B08 Devoluciones economicas

Fecha: 30/09/2026.

## Estado

B08 queda preparado como un contrato F4 sobre la autoridad transaccional de
reembolsos que ya existe en F2. Este paso no activa un proveedor real, no
aplica migraciones remotas y no hace deploy de produccion. La evidencia se
ejecuta en PostgreSQL aislado con datos ficticios.

## Alcance oficial

B08 exige relacionar cada reembolso total o parcial con el pago original, el
importe disponible, un motivo y un permiso. El importe reservado se bloquea
antes de crear la solicitud para que dos llamadas concurrentes no puedan
devolver mas de lo cobrado. La solicitud, la confirmacion, el rechazo, la
cancelacion y el resultado desconocido son estados distintos.

La devolucion economica no devuelve automaticamente comida consumida al
stock. La rectificacion documental, la merma y el retorno fisico se mantienen
como decisiones independientes y no se mezclan dentro de la operacion de
reembolso.

## Reutilizacion comprobada

- `public.abc_solicitar_reembolso` valida permiso, pago confirmado, moneda,
  motivo e importe disponible; bloquea las aplicaciones del pago y crea la
  solicitud pendiente con sus aplicaciones.
- `public.abc_confirmar_reembolso_efectivo` confirma el efectivo y crea un
  unico movimiento negativo de caja en una sesion abierta y vinculada al
  terminal.
- `public.abc_resolver_reembolso` recibe el resultado del proveedor como
  operacion de sistema y admite `CONFIRMADO`, `RECHAZADO`, `CANCELADO` y
  `DESCONOCIDO`, conservando la evidencia del proveedor.
- `public.abc_cancelar_reembolso` libera la reserva solo cuando la solicitud
  aun no se ha enviado a un proveedor.
- Las aplicaciones del pago se bloquean en orden estable, de forma que el
  segundo reembolso concurrente espera o falla por timeout y no sobrepasa el
  saldo disponible.

## Frontera con la devolucion fisica

`registrar_devolucion_venta` conserva el flujo historico que devuelve unidades
fisicas y, cuando corresponde, registra una operacion de caja. B08 no lo usa
como sustituto de un reembolso economico: un reembolso de pago se procesa por
las funciones `abc_*_reembolso` y no escribe `stock_ubicacion`,
`movimientos_stock` ni `devoluciones_venta`.

## Criterios de aceptacion

- Una devolucion parcial reduce la capacidad disponible sin marcar el pago
  como totalmente reembolsado.
- Una segunda devolucion completa el saldo y deja el pago como reembolsado,
  sin capacidad restante.
- Un estado desconocido mantiene la reserva y puede resolverse despues sin
  crear un segundo reembolso.
- Una devolucion cancelada libera la capacidad reservada.
- Un reembolso en efectivo crea un solo movimiento de caja negativo y no
  afecta al stock.
- Una solicitud sin permiso, con importe superior al disponible o con motivo
  vacio es rechazada.
- Dos solicitudes concurrentes sobre la misma aplicacion no superan el
  importe cobrado.

## Fuera de este subpunto

Quedan para una autorizacion posterior la pantalla de devoluciones, la
rectificacion fiscal, la merma y retorno fisico guiados por interfaz, la
conexion con el API real de cada proveedor y el ensayo de sandbox. Esas
decisiones no se simulan con un proveedor inventado.

## Evidencia

El contrato `tests/f4/b08/b08-contract.sql` reutiliza la bateria transaccional
aislada de reembolsos y la ejecuta bajo el identificador F4 B08. El workflow
`.github/workflows/abc-f4-b08-contract.yml` comprueba ademas que la migracion
de reembolsos no acopla el reembolso economico al stock legacy.
