# Corrección H-22 · tras «Enviar pedido» no aparecía el cobro · 27/11/2026

Estado: **corregida y probada con una prueba de ejecución; sin verificar todavía en el navegador de QA tras la corrección.**
Rama `correccion/ola0-tpv-2026-11-26`. Cliente solamente: no hay migración ni cambios en el servidor.

## Qué pasaba

Tras «Guardar pedido» y «Enviar pedido» el panel de cobro desaparecía y, en su lugar, aparecía «Caja del TPV» (fondo inicial,
«Abrir fondo»). Las mesas de «Sala y mesas» también dejaban de verse. Solo volvía tras recargar la página o tras retomar la
cuenta desde «Buscar cuentas abiertas». En la auditoría se vio dos veces (H-22) y se reprodujo sin buscarlo el 27/11/2026
durante la verificación en el navegador de QA.

## Causa (leída en el código)

- `enviarPedidoA05` devolvía `{ ok, pedidoId, pedidoVersion, pedidoEstado, lineas, lineasEnviadas }` **sin `cuentaId`**.
- «Enviar pedido» del modal (`enviarPedidoGuardadoA05`) guarda ese resultado como pedido operativo de la pantalla:
  `setPedidoOperativoA05(resultado)`, sustituyendo al que sí tenía la cuenta.
- `renderCobroF4` hace `if (!pedidoOperativoA05?.cuentaId) return renderCajaTPV()`. Sin cuenta, no hay cobro.

Las demás acciones sobre el pedido (`accionPedidoA05`) y la recuperación de cuenta devuelven el contexto completo
(`{ ok: true, ...guardado }`); `enviarPedidoA05` era la excepción.

## Corrección

1. `enviarPedidoA05` devuelve ahora el contexto completo (`{ ok: true, ...guardado, lineasEnviadas }`), también en el atajo de
   «el pedido ya estaba enviado» (`{ ok: true, ...contexto }`). Las claves que ya devolvía se conservan.
2. Desde **venta rápida**, «Enviar pedido» lleva a la vista de **Sala**, donde vive el cobro de la cuenta enviada. Antes dejaba
   «Venta rápida en curso» con un único botón, «Continuar en Sala», y sin cobro. Desde Sala no cambia de modo y, si el envío
   falla, tampoco.

`fuente.js` y `source-recovery/fuente-recuperado.js` se mantienen idénticos (`recuperar_candidato.py --check`: paridad exacta).

## Prueba

`tests/rediseno/h22-enviar-pedido-conserva-la-cuenta-contract.mjs` (12 comprobaciones). Extrae `enviarPedidoA05` y
`enviarPedidoGuardadoA05` del código real y las ejecuta con stubs: la cuenta y todo el contexto persistido llegan en el
resultado (envío normal y atajo), venta rápida pasa a Sala, Sala no cambia y un envío fallido no cambia nada. **Con el código
anterior fallan 6 comprobaciones**; con el nuevo pasan las 12.

## Qué NO está verificado

- No se ha repetido el caso en el navegador con la corrección desplegada (hace falta que la vista previa se reconstruya y
  reactivar de nuevo la cuenta de QA del Propietario, como en la verificación anterior).
- El cambio automático a Sala en venta rápida es una decisión de diseño (la auditoría pedía «mostrar el cobro o llevar a él»);
  si se prefiere mostrar el cobro dentro de la propia venta rápida, es otro cambio.
