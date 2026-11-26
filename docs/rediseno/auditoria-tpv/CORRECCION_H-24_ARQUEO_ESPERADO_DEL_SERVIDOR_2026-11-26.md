# Corrección H-24 · «Arqueo de caja» con el esperado del servidor · 26/11/2026

Estado: **implementada y probada con contratos**, sin cambios en el servidor. Rama
`correccion/ola0-tpv-2026-11-26`, sin enviar al remoto. **No verificada en pantalla ni contra el
servidor de QA** (no había ninguna sesión de caja abierta en QA; ver «Qué falta»).

## Qué fallaba

La pantalla «Arqueo de caja» calculaba el efectivo esperado en el cliente con el historial local
(`resumenMediosVentaCajaPM09`) y los movimientos de caja del día. El arqueo que se guarda
(`abc_registrar_arqueo_caja`) usa en el servidor la suma de `efecto_efectivo` de las operaciones de caja
de la sesión (`autoridad: SERVIDOR_C03`). Con el servidor esperando 0,00 €, la pantalla enseñó 1,00 €:
un descuadre falso al cerrar el día.

## Qué se cambió

- No hace falta una función nueva en el servidor: `abc_previsualizar_arqueo_caja` ya existe, es de solo
  lectura, acepta la sesión ABIERTA (el cliente solo la pedía con la sesión EN_CIERRE) y calcula fondo
  inicial + entradas − salidas de la sesión, que es la misma suma que guarda el arqueo.
- Nueva `consultarEsperadoCajaA24` (en `crearLogicaVenta`): usa la sesión y el terminal reales y devuelve
  esperado, fondo, entradas y salidas.
- `ArqueoCaja`, con la cuenta sincronizada: muestra ese esperado y lo explica («Calculado por el servidor
  para la sesión de caja abierta: fondo inicial… entradas… salidas…»), con botón «Actualizar». Mientras
  consulta pone «Calculando…». **Si el servidor no lo da, pone «No disponible» con el motivo y no calcula la
  diferencia: no se enseña ninguna cifra estimada.** En modo local sin servidor se conserva el cálculo local.
- `fuente.js` y `source-recovery` en paridad.

## Pruebas

- Contrato nuevo `tests/rediseno/h24-arqueo-esperado-del-servidor-contract.mjs` (rojo antes, verde después).
- `tests/cfg/cfg6d-ui-contract.mjs`: tres aserciones que contaban la estructura anterior (lecturas directas,
  llamadas a `contextoCierreA10`, argumentos de `ArqueoCaja`) se actualizaron.
- Batería sin base de datos: 338 contratos activos, 0 fallos; manifiesto 396 entradas.

## Qué falta

- Verlo en pantalla con una sesión abierta y un reembolso en efectivo, y comparar con lo que guarda
  «Guardar arqueo». En QA no hay sesión abierta; abrirla y mover caja cambia datos de QA y no lo he hecho.
- **«Otras ventas»** (tarjeta, transferencia, otros) sigue calculándose con el historial local. No afecta al
  efectivo esperado, pero puede discrepar igual que el efectivo.
- La fecha del arqueo se puede cambiar; el esperado del servidor es el de la sesión abierta, y guardar un día
  distinto al operativo ya lo rechaza el servidor (`arqueo_caja_dia_no_operativo`).
