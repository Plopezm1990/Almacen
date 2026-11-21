# Evidencia de operaciones con escritura · 21/11/2026

Entorno: `QA-EMP-A / QA-A1`, Deploy Preview #225, rama
`rediseno/f0-base-qa`, PR #225 en borrador. El propietario autenticado fue
`pm07.smoke@qa.invalid`. Producción no se tocó y no se utilizó `sis-13`.

## Recorrido ejecutado

Se autorizó expresamente una venta sintética de **1,00 €**, cobro en efectivo
simulado y reembolso simulado. El recorrido se hizo sobre el TPV del terminal
`QA terminal A1 (siembra etapa 1)` y el producto `QA Aceite ensayo 20261115`.

| Paso | Evidencia observada |
| --- | --- |
| Cuenta | `c4dadb89-0b27-4e27-b4ee-d2d348e97ff1` |
| Pedido | `e4f59cf1-26b6-418e-9d75-5d5cd16edf97` |
| Línea | 1 × `QA Aceite ensayo 20261115` · 1,00 € |
| Estados | Guardado → enviado a cocina → en preparación → listo para servir → servido |
| Cobro | Efectivo exacto: recibido 1,00 €, cambio 0,00 €, confirmado por servidor |
| Cuenta tras cobro | Pagada y cerrada |
| Documento fiscal | `TPV-43`, secuencia `37`, `SIMULADOR_C07D`, QR QA preparado; AEAT real desactivada |
| Venta | `V-20261121-65D717` |
| Anulación/reembolso | Venta pasó a `ANULADA`, importe vigente 0,00 €, original 1,00 € |
| Caja | Se observan los movimientos `COBRO_VENTA +1,00 €` y `REEMBOLSO_VENTA −1,00 €`, con motivo `Ensayo autorizado QA 20261121 - reembolso efectivo` |
| Cambio de permisos | Empleado `QA Rediseno Camarero 20261113`: `Camarero/a → Encargado → Camarero/a`; cada guardado se confirmó al reabrir la ficha y el estado final quedó restaurado a `Camarero/a` |

La anulación se hizo desde Historial completo de ventas sobre el ticket recién
creado, no sobre un ticket preexistente. El historial conserva la venta
original y deja visible el estado `ANULADA`, por lo que la operación es
auditable y no borra datos.

## Preparación temporal y restauración

Para que el pedido pudiera avanzar en el entorno sembrado, se desmarcó
temporalmente `Requiere preparación / comanda de cocina` en el producto. Tras
terminar el cobro y el reembolso, se volvió a marcar y se comprobó abriendo de
nuevo la ficha: el campo quedó con valor `1` (requiere preparación). No queda
ningún cambio permanente de configuración del producto por este ensayo.

## Caja y límites de la tanda

La pantalla de Arqueo mostró los movimientos de cobro y reembolso y un
efectivo esperado de 2,00 €. La caja ya tenía una sesión operativa activa antes
de la prueba; no se abrió una segunda sesión ni se cerró la existente. Tampoco
se guardó un arqueo nuevo, porque el cierre de la sesión activa requeriría un
ensayo independiente con fondo y contado autorizados.

El reembolso económico anula el importe y crea el movimiento negativo de caja,
pero no devuelve automáticamente el stock. El producto quedó en 48 litros en
QA; esto es coherente con separar reembolso económico de devolución física de
stock. No se ejecutó una devolución física adicional.

### Cierre y apertura de caja ejercitados

Con la sesión de caja que ya estaba activa se introdujo un contado de `2,00 €`
—el efectivo esperado que mostraba la pantalla antes del cierre— y se guardó el
arqueo. El servidor confirmó el cierre y dejó visible `Día cerrado: contado
€2,00 (−€116,44)`, junto con el cálculo posterior `esperado €118,44, contado
€2,00`; la diferencia procede del libro histórico de QA y queda conservada como
dato de ensayo, no se corrigió a mano.

Después se intentó abrir una nueva sesión con fondo inicial `0,00 €`. El servidor
respondió `La caja o el terminal ya tienen una sesión activa`, por lo que la
apertura duplicada no se confirmó. No se forzó una segunda sesión ni se anuló el
cierre con motivo: la prueba de cierre sí tiene escritura confirmada y la
apertura queda documentada como rechazo correcto por sesión activa. Para aislar
el origen se cambió el navegador al terminal `QA terminal A2 (ensayo punto 2)`
y se repitió el intento; QA devolvió el mismo rechazo. Esto demuestra que hay
otra sesión operativa en A2 —la que estaba abierta en el segundo perfil de
ensayo— y que el servidor aplica la exclusión por terminal, no un fallo del
formulario de apertura.

## Acciones no ejecutadas

- No se hizo ningún cobro, reembolso, apertura/cierre de caja ni cambio de
  configuración fuera de la venta sintética descrita.
- Sí se ejercitó un cambio de permisos reversible sobre `QA Rediseno Camarero
  20261113`: se elevó temporalmente de `Camarero/a` a `Encargado`, se verificó
  el guardado y después se restauró a `Camarero/a`. No queda una elevación de
  privilegios abierta.
- No se ejecutó una acción de Plataforma. La sesión era de Propietario de
  empresa, no de administrador de Plataforma; no se utilizó una cuenta
  `plataforma_admin` ni se concedió ese privilegio.
- No se tocó producción, no se fusionó el PR #225 y no se reinició QA.

## Estado para el siguiente agente

La operación de escritura autorizada queda demostrada en QA: venta,
preparación/servicio, cobro efectivo, cierre de cuenta, documento fiscal QA y
anulación/reembolso con movimientos de caja. Queda como dato sintético
auditable la venta `V-20261121-65D717` anulada y el pedido cerrado; no borrar
ninguno de los dos.

## Cierre formal de terminales · comprobación posterior

La verificación de dos navegadores/terminales ya estaba realizada antes de
esta anotación: Chrome quedó en `QA terminal A1` y Firefox en `QA terminal A2`.
No se repitió ese recorrido.

En la sesión A2 se ejecutó el flujo completo de cierre provisional y cierre
definitivo del servidor; el cierre fue aceptado. Después se abrió de nuevo una
sesión A2 con fondo inicial `0,00 €` para conservar la cobertura Q08 de dos
terminales.

En A1 el cierre provisional se registró con contado `0,00 €` frente a un
esperado de `118,44 €`, con motivo y aprobación del Propietario. El intento de
cierre definitivo fue rechazado por el servidor con los bloqueos
`EFECTOS_PENDIENTES` y `PAGOS_PENDIENTES`; el ensayo C12 los reproduce y además
señala la diferencia de efectivo. No es un fallo del navegador ni de la capa
Órbita.

Consulta de solo lectura realizada contra QA-EMP-A:

- `efectos_pendientes`: QA-A1 tiene 55 filas `PENDIENTE` (37 `COMPLETADO`, 7
  `ABANDONADO`). Entre las pendientes hay comandas de ensayos anteriores y
  comandas antiguas sin ruta de preparación.
- `pagos`: QA-A1 tiene 4 filas `PENDIENTE`, todas intentos de tarjeta antiguos
  (0,60 €, 1,32 €, 0,32 € y 7,27 €; fechas 01–13/11/2026).

La pantalla Cocina confirma que existen comandas `BLOQUEADA · Sin estación` y
advierte que asignar una ruta no reenvía automáticamente la comanda existente.
Por seguridad no se cambiaron estados ni se cancelaron pagos directamente en
la base de datos: habría que resolverlos mediante el flujo operativo de
servidor o preparar una limpieza de fixtures QA explícitamente autorizada.
Hasta entonces, A1 no puede pasar de `CIERRE_PROVISIONAL` a `CERRADA_FINAL`.

## Limpieza auditada de fixtures QA · 21/11/2026

Con autorización expresa para operar únicamente en QA, se resolvieron los
bloqueos de dominio mediante las funciones de servidor existentes; no se hizo
ningún `UPDATE` directo ni se tocó producción:

- Los cuatro intentos de tarjeta antiguos de QA-A1 se resolvieron mediante
  `public.abc_resolver_intento(..., 'CANCELADO', ...)`, con el proveedor
  `QA_FIXTURE_CLEANUP` y una referencia `QA-CANCEL-*` por intento. El resultado
  fue `CANCELADO`, con reservas liberadas y evento de auditoría para cada uno.
- Los efectos pendientes de QA-A1 se procesaron con el flujo oficial
  `abc_reclamar_efectos` → `abc_abandonar_efecto`. La referencia común fue
  `qa.cleanup.pending-effects.20261121` y cada fila conserva el motivo,
  `tipo`, fecha original y autorización del propietario en `last_error`.
- Verificación posterior independiente: `pagos_bloqueantes = 0` y
  `efectos_bloqueantes = 0`. Los cuatro pagos figuran cancelados; los efectos
  de cocina/reimpresión de fixtures antiguos figuran abandonados o, si ya
  habían sido resueltos por el sistema, completados. El historial no se borró.

El cierre definitivo de A1 sigue sin ejecutarse porque queda un descuadre
histórico de efectivo (`2,00 €` contados frente a `118,44 €` esperados,
`-116,44 €`). No se inventó un contado ni se alteró el libro. A2 permanece
cerrado definitivamente y reabierto para conservar la cobertura Q08 de dos
terminales. Por tanto, el bloqueo de pagos/efectos está resuelto; el único
pendiente operativo es decidir cómo tratar ese dato sintético de caja antes de
convertir A1 de `CIERRE_PROVISIONAL` a `CERRADA_FINAL`.

