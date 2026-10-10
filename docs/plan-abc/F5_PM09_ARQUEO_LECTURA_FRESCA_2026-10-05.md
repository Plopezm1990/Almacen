# F5 / PM09 · Actualización del arqueo diario al abrir la pantalla

Fecha: 2026-10-05  
Estado: `QA_VISUAL_VALIDADO_PRODUCCION_PENDIENTE`

## Hallazgo reproducido en QA

En el preview del PR #122, el TPV de A1 confirmó una venta de prueba de 1 €
en efectivo y el cierre por sesión ABC mostró fondo 0 € + entrada 1 € =
esperado 1 €. Sin recargar la aplicación, la pantalla histórica «Arqueo de caja»
mostró esperado 0 € y ningún movimiento del día. Tras recargarla y seleccionar
A1, la misma pantalla mostró esperado 1 € y la entrada «Cobro ABC en efectivo».
Por tanto, el 0 € observado se debió al estado de pantalla anterior al cobro;
no demuestra una diferencia en el cálculo del servidor.

## Cambio de cliente

La pantalla vuelve a consultar `caja_operaciones`, arqueos y devoluciones al
abrirse. Mientras espera la lectura no muestra un importe antiguo ni permite
guardar un arqueo. Si falla, muestra el error y un botón para reintentar; al
completarla, ofrece también «Actualizar datos de caja». El resto del contrato
PM08/PM09 y la función de servidor `registrar_arqueo_caja` no cambian.

## Comprobación y límites

La paridad exacta entre fuente recuperada y bundle, la sintaxis de ambos
archivos y el contrato `p10-caja-contract.mjs` pasan localmente. El contrato
ejecuta el componente con una lectura simulada: bloquea el arqueo mientras
carga, muestra el efecto de 1 € tras la respuesta y mantiene el bloqueo con
opción de reintento si la lectura falla.

## QA visual del PR #123 · 2026-10-06

En `deploy-preview-123`, con sesión Propietario QA y Local A1 seleccionado,
entrar en «Arqueo de caja» mostró primero «Actualizando los movimientos de
caja del servidor…» sin importe ni acción de guardar. Al terminar, apareció
«Actualizar datos de caja». Al elegir 2026-10-05 mediante el selector de fecha,
la pantalla mostró esperado 1 €, ajuste de caja 1 € y la entrada «Cobro ABC en
efectivo» de +1 €, sin recargar toda la aplicación. La actualización manual
volvió a mostrar el estado de carga y, al completarse, conservó la fecha y el
importe de 1 €.

La consulta de lectura a `caja_operaciones` de QA confirmó la misma fila:
fecha 2026-10-05, local `QA-A1`, tipo `ENTRADA`, importe y efecto en efectivo
1 €. No se creó ni modificó ningún registro durante esta comprobación.

La primera asignación automatizada del campo de fecha cambió el valor visible
sin disparar el estado del formulario; la selección por teclado sí lo hizo.
Por eso la evidencia funcional se basa en la selección real por teclado y en
la actualización posterior, no en aquella primera asignación.

La CI del commit `8e8c08c` confirmó `validar` y el deploy preview, pero varios
jobs (incluido `gate-final`) quedaron cancelados porque GitHub no consiguió
asignarles un runner alojado tras varios intentos. La siguiente ejecución,
tras el commit de evidencia `a1cb65d`, completó sus 25 checks sin fallos y el
deploy preview quedó listo. Sigue pendiente conciliar por separado el baseline
PM09 de producción con QA. Este PR permanece sin fusionar.

Este cambio corrige la lectura caducada observada, no reconcilia por sí mismo
el baseline PM09 de producción con QA ni une el circuito de stock PM09 con el
TPV ABC. Producción no se modifica; este candidato se mantiene separado del
PR #122 de C03.
