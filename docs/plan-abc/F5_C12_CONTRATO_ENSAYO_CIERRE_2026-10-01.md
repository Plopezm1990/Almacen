# F5 C12 Contrato de ensayo del cierre

Fecha: 2026-10-01  
Estado: `NUCLEO_C12_VERIFICADO_QA; UI_LOCAL_VERIFICADA; RESILIENCIA_Y_ACEPTACION_PENDIENTES`

## Alcance

C12 añade un ensayo de cierre de sesión de caja. El ensayo toma una fotografía
explicable del estado de la sesión, el efectivo esperado y contado, los
bloqueos de pagos y efectos, y la conciliación documental más reciente de
C11. Su finalidad es anticipar si el cierre está apto, pendiente o bloqueado
sin ejecutar el cierre real.

## Contrato técnico

- `abc_ensayar_cierre_sesion_caja` exige autenticación, capacidad de caja y
  una terminal vinculada a la sesión.
- Lee la sesión sin `FOR UPDATE` y no actualiza `caja_sesiones`,
  `caja_cierres`, `caja_conteos`, pagos, efectos ni documentos.
- Integra los bloqueos operativos de C04, la diferencia de efectivo y el
  último informe C11 por documento. La migración correctiva
  `20261009111255_abc_f7_c12_reconciliation_revision.sql` añade una revisión
  incremental para que «último» tenga un orden total incluso dentro de una
  misma transacción.
- `20261009112332_abc_f7_c12_session_scope.sql` permite ligar la reserva C05 a
  una sesión de caja y hace que C12 solo cuente los documentos de la sesión
  ensayada.
- Devuelve `APTO_CIERRE`, `PENDIENTE` o `BLOQUEADO`, con bloqueos y explicación
  legible.
- Guarda un informe JSON inmutable con huella SHA-256, un evento
  `CIERRE_ENSAYADO` y replay idempotente por `operation_id`.
- La tabla de informes no tiene acceso directo del cliente y está protegida
  contra actualización y borrado.

## Límites explícitos

El ensayo no confirma el conteo, no finaliza el cierre, no reabre la sesión,
no modifica pagos ni efectos, no corrige documentos y no sustituye la revisión
operativa, fiscal o bancaria.

## Evidencia y pendiente

La prueba PostgreSQL 16 cubrió un estado pendiente por falta de conteo y
entrega, un estado `APTO_CIERRE` después de completar el flujo, hash, replay,
inmutabilidad y comprobación de que las tablas de cierre no cambian. La
ejecución validada fue:
https://github.com/Plopezm1990/Almacen/actions/runs/36918524330.

El 9/10 se repitió el flujo completo en QA con `ROLLBACK`. La primera ejecución
quedó `PENDIENTE` por conteo y entrega; después de entregar, reconciliar y
contar quedó `APTO_CIERRE`. Se verificaron replay, inmutabilidad, permisos y
cero residuos. Durante el ensayo se encontró y corrigió el desempate no
determinista de dos conciliaciones C11 con el mismo `created_at`. Véase
`F7_C12_QA_RESULTADO_2026-10-09.md`.

Una segunda prueba aislada creó dos sesiones activas del mismo local. La sesión
con documento entregado y conciliado quedó `APTO_CIERRE`; la otra conservó su
documento pendiente sin bloquear a la primera. También se comprobaron la
inmutabilidad del vínculo, el rechazo de sesiones inexistentes y la
compatibilidad con documentos administrativos sin sesión.

La interfaz local ya llama a C12 desde el cierre provisional y presenta estado,
explicación, efectivo, documentos y bloqueos. El contrato estático confirmó la
paridad de ambas fuentes y el contrato ejecutable pasó 98 casos, incluidos
`APTO_CIERRE` y `PENDIENTE` documental sin cambiar el estado de la sesión.

Producción no se modificó. Siguen pendientes desplegar y recorrer la pantalla
en QA, la prueba con hardware y fallos externos, la sesión nocturna y la
aceptación final.
