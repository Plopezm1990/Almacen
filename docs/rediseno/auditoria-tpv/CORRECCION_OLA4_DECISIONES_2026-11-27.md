# Corrección de la Ola 4 · decisiones de producto · 27/11/2026

Estado: **H-15 (E2) y H-05 (E3) implementadas en la pantalla, con contrato propio; sin migración. Sin verificar todavía con una sesión de QA** (ver «Qué NO está verificado»).
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado. Los dos contratos fallan con el código anterior.

Las dos decisiones aprobadas el 26/11 se escribieron pensando en el modelo de datos que se suponía. Al comprobarlo en el servidor de QA, **ninguna de las dos necesitaba (ni admitía) lo que
decía la recomendación literal**, y se implementó lo que el servidor realmente tiene. Es lo que más conviene que se revise.

## H-15 · venta con stock insuficiente (E2: permitir la venta con aviso)

**Lo que ya hacía el servidor** (leído en la función viva `registrar_venta_stock` de QA): toma **primero del piso y después del almacén**, rechaza solo si piso + almacén no alcanzan
(`stock_insuficiente`) y deja cada venta anotada en `movimientos_stock` con `delta_almacen < 0` (hay 41 así en QA). Es decir, **el «déficit del piso» ya queda registrado**.
Lo que faltaba era decirlo y mostrarlo:

| Qué | Cambio |
|---|---|
| Aviso del ticket | Antes comparaba con el stock **total** (73) y no avisaba. Ahora, por cada producto del servidor: «el piso de venta tiene N y M saldrá del almacén. La venta queda anotada para reponer el piso» (ámbar), y «solo hay T en total y pides P: el servidor no dejará guardar este pedido» (rojo) si ni el almacén alcanza. Los productos locales conservan su aviso de siempre. |
| Tarjeta del producto | «sin piso · sale del almacén» (ámbar) si hay en el almacén; «sin stock» (rojo) si no. |
| Pendiente del Encargado | En el inicio, «Piso por reponer · Agua 50 cl · 2 servida(s) desde el almacén hoy» (el primero de «Pendientes del día», lleva a Traspasos), solo para Propietario y Encargado: lo vendido **hoy** desde el almacén, menos los reversos de esas ventas. Se lee de `movimientos_stock` (la política `la_tiene_local` ya lo permite); no escribe nada. |

**No se hizo y por qué.** No se permite vender por encima del stock **total**: el servidor lo rechaza y E2 hablaba de piso 0 con almacén (el caso auditado). Permitir stock negativo total
sería un cambio de servidor y de inventario que la decisión no pedía. Tampoco hay una tabla de «déficit pendiente» con estado: el pendiente se calcula del libro del día y **no se apaga
solo al reponer** (sigue visible ese día aunque ya se haya hecho el traspaso; al día siguiente desaparece).

Contrato: `tests/rediseno/h15-venta-sin-piso-aviso-y-pendiente-contract.mjs` (ejecuta el reparto, los textos y el cálculo del pendiente con casos, incluidos los reversos).

## H-05 · devolver un anticipo (E3: pantalla en Encargos, solo Encargado y Propietario)

**Lo que se encontró.** La recomendación proponía usar `abc_registrar_movimiento_anticipo`. Esa función opera sobre `abc_cobros_no_venta` con concepto `ANTICIPO`, y en QA esa tabla **solo tiene
propinas**: ninguna función crea anticipos ahí, así que **no hay nada que devolver con ella**. Las señales de los encargos viven en `pagos_encargo` y se anulan con
`revertir_pago_encargo` (SECURITY DEFINER, solo Propietario y Encargado, motivo obligatorio, identificador de operación fijo por pago): es el reverso que ya usan «Cancelar» y «Devolver» encargo.

**Qué se hizo.** En la tarjeta de cada encargo pendiente con señal cobrada, botón **«Devolver anticipo»** (solo con la nube activa y para Propietario o Encargado) → diálogo con la señal que se
devuelve, **motivo obligatorio**, aviso de que el encargo sigue pendiente y solo se devuelve una vez, y una sola confirmación (el botón se deshabilita mientras procesa). Llama al reverso del pago de
la señal, deja la señal de la ficha a 0 (el encargo no se cancela) y lo anota en la auditoría. **Una repetición no duplica**: el identificador es fijo y el servidor repite el resultado; con la ficha ya a 0 el
botón desaparece y la lógica no vuelve a llamar. Un Cajero/a no ve el botón y, si llegara a la función, el servidor lo rechaza (`reverso_pago_encargo_no_autorizado`).

Contrato: `tests/rediseno/h05-devolver-anticipo-encargo-contract.mjs` (ejecuta `devolverAnticipoEncargo` con dependencias falsas: éxito, sin motivo, sin señal, otro local, rechazo del servidor, repetición,
ficha que no se actualiza, segunda pulsación).

**Diferencias con la decisión escrita, a revisar:**

- **Importe máximo.** La decisión decía «importe máximo igual al anticipo disponible». `pagos_encargo` solo permite **anular el pago entero** (el reverso lleva el importe del original): no hay devolución
  **parcial**. Si se quiere devolver solo una parte hay que decidir cómo (reverso + nuevo cobro por la diferencia, o ampliar el servidor).
- **Reflejo en caja.** La decisión decía «reflejo en la caja si se devuelve en efectivo». **Ni el cobro ni la anulación de las señales de encargo entran hoy en el arqueo del servidor** (solo
  `registrar_pago_encargo` y `revertir_pago_encargo` tocan `pagos_encargo`; el arqueo no lo lee). La devolución es **simétrica al cobro** (ninguno de los dos aparece en caja), así que no crea un descuadre
  nuevo, pero la señal en efectivo tampoco cuadra en caja hoy. Es un tema aparte y **no está resuelto**.
- Solo se devuelve la **señal**. El «resto de entrega» se cobra al entregar; si el encargo ya está entregado, se usa «Devolver» encargo (que ya reembolsa los cobros).

## Qué NO está verificado

- **Nada se ha visto en el navegador de QA todavía**: el aviso y la tarjeta (H-15), el pendiente «Piso por reponer» en el inicio, y el botón y el diálogo de «Devolver anticipo» con una señal real.
- El pendiente de H-15 cuenta solo las ventas de **hoy** (por la fecha de creación del movimiento, en la hora del navegador).
- H-05 no se probó contra el servidor real: el reverso es el mismo que ya usan Cancelar y Devolver encargo, y sus pruebas existentes cubren la función; este cambio solo añade un camino de pantalla.
