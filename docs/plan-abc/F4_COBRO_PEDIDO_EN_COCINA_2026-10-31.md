# F4 · Cobrar una cuenta mientras cocina trabaja

Fecha: 2026-10-31 · Ventana de promoción propia, separada de la foto F7 del 3/10.

## El problema, tal y como se vio en producción

Una cuenta deja de poder cobrarse en cuanto cocina toca el primer plato. El
camarero ve «Envía el pedido antes de cobrar» sobre un pedido que ya está
enviado, y no puede cobrar hasta que todas las líneas estén servidas.

## Por qué pasaba

El estado del pedido no se escribe a mano: lo deriva
`private.abc_estado_agregado_pedido` a partir del estado de sus líneas
(`20260924030000`, máquina de estados A05):

| Líneas | Estado derivado del pedido |
|---|---|
| alguna enviada | `ENVIADO` |
| alguna en preparación | `EN_PREPARACION` |
| alguna preparada o servida | `PARCIALMENTE_PREPARADO` |
| todas preparadas o servidas, alguna preparada | `PREPARADO` |
| todas servidas | `SERVIDO` |

Y `public.abc_preparar_checkout_cuenta` (`20260929040000`, línea 226) solo
admitía `ENVIADO`, `SERVIDO` y `CERRADO`. El resultado en sala:

```
ENVIADO                 -> se podía cobrar
EN_PREPARACION          -> NO          <- cocina trabajando
PARCIALMENTE_PREPARADO  -> NO
PREPARADO               -> NO          <- listo para servir
SERVIDO                 -> se podía cobrar
```

Se podía cobrar **antes** de que cocina empezara y **después** de servir, pero no
mientras cocinaban. Ninguna regla de negocio dice eso: cobrar en barra mientras
se prepara la comanda es lo normal.

Era un descuido, no una política. Se nota al comparar con la comprobación de la
línea de al lado, en la misma consulta, que sí está completa: admite
`CONFIRMADA`, `ENVIADA`, `EN_PREPARACION`, `PREPARADA`, `SERVIDA`, o sea todos
los estados de línea menos `BORRADOR` y `CANCELADA`. La lista del pedido se
escribió pensando en estados de línea y se quedó sin los tres derivados.

## El arreglo

`20261031170000_abc_f4_cobro_pedido_en_cocina.sql` hace un `create or replace`
de la función con la lista completada: todos los estados menos los tres que de
verdad deben impedir el cobro.

| Estado | Cobrable | Por qué |
|---|---|---|
| `BORRADOR` | no | la comanda no se ha confirmado |
| `ABIERTO` | no | no hay ninguna línea activa |
| `ENVIADO` | sí | |
| `EN_PREPARACION` | **sí** (nuevo) | |
| `PARCIALMENTE_PREPARADO` | **sí** (nuevo) | |
| `PREPARADO` | **sí** (nuevo) | |
| `SERVIDO` | sí | |
| `CERRADO` | sí | |
| `CANCELADO` | no | el pedido ya no existe a efectos de cobro |

No se relaja nada más. Siguen intactos el permiso `ABC_COBRO_INICIAR`, la
idempotencia por `operation_id`, el bloqueo optimista por versión de cuenta, la
comprobación de día operativo, el corte por cuotas de importe pendientes (B05),
y las validaciones de moneda e importes.

**Fichero nuevo y no editar `20260929040000`** porque esa migración ya está
aplicada en QA y en producción: editarla no cambiaría ninguna de las dos bases.

### En el navegador

Las dos puertas que la pantalla tenía por su cuenta se unifican en una sola
lista, `ESTADOS_PEDIDO_COBRABLE_F4`, idéntica a la del servidor:

- `iniciarCobroCuentaF4`, que lanzaba `pago_pedido_no_listo`.
- `renderCobroF4`, que apagaba el panel con «Envía el pedido antes de cobrar».

Los mensajes se dejan como estaban: ahora son ciertos, porque los únicos estados
que siguen bloqueando (`BORRADOR`, `ABIERTO`) sí significan «todavía no lo has
enviado».

## Cómo se ha verificado

`tests/f4/b02-b03/cobro-pedido-en-cocina-contract.sql` fija las dos mitades de
la regla: los seis estados que deben poder cobrarse y los tres que no. Lo
segundo importa tanto como lo primero, para que nadie «arregle» esto abriendo la
puerta de más.

El workflow `abc-f4-b02-b03-contract.yml` lo ejecuta **tres veces**, sobre bases
desechables distintas:

1. Sin la migración, donde tiene que **fallar** nombrando `EN_PREPARACION`. Si
   pasara, la puerta ya estaría abierta y este arreglo no haría nada.
2. Con la migración, donde tiene que pasar.
3. Junto al contrato B02/B03 de siempre sobre una base con la migración, para
   dejar claro que abrir los estados de cocina no rompe el cobro que ya
   funcionaba.

Comprobado en Postgres 16.15 local con la misma cadena de 19 migraciones que usa
el workflow. El barrido de los 274 contratos de entorno `node` da 257 pasan y 16
fallan, exactamente los mismos 16 que fallan en `release` limpio (necesitan
navegador o `.netlify-dist`, que no existen fuera de CI): ninguna regresión.

## Promoción

La migración es determinista y el mismo fichero sirve para las dos bases. Orden:
QA primero, comprobar en sala que una cuenta con cocina en marcha se cobra, y
después producción. No hay datos que migrar.
