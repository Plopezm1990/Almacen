# F5 / PM09 · Actualización del arqueo diario al abrir la pantalla

Fecha: 2026-10-05  
Estado: `CANDIDATO_LOCAL_PROBADO_QA_PENDIENTE`

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

Pendiente: probar el nuevo preview por pantalla con una sesión QA autenticada y
comprobar que al entrar en «Arqueo de caja» aparece el movimiento de 1 € sin
recargar toda la aplicación. También queda pendiente la CI del PR de este
candidato.

Este cambio corrige la lectura caducada observada, no reconcilia por sí mismo
el baseline PM09 de producción con QA ni une el circuito de stock PM09 con el
TPV ABC. Producción no se modifica; este candidato se mantiene separado del
PR #122 de C03.
