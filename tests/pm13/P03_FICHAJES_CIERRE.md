# PM13–P03 — Fichajes — CIERRE

Estado: **CANDIDATO A CIERRE FORMAL**

## Base y aislamiento

- Rama: `pm13-p03-fichajes`.
- Base exacta P02: `5f4c9b8371ed640b1ada58cddf45d1c32072cd28`.
- Commit funcional integrado por el gate: `b3ff8afcd54875844523654e433d80afc56512d5`.
- `main` verificado sin cambios en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- Producción no contiene migraciones ni RPC PM13–P03.

## Diagnóstico cerrado

El motor anterior de fichajes dependía de la UI para filtrar empleados activos y permitía, desde la lógica de dominio, tipos, fechas, horas y secuencias no validadas. La edición no revalidaba la identidad laboral y el borrado era físico. La UI de registro manual se cerraba aunque la mutación fuese rechazada y el cálculo global de jornadas abiertas no distinguía fichajes anulados.

## Solución P03

P03 reutiliza `public.fichajes_registro`; no crea una segunda tabla ni elimina registros históricos.

Backend QA:

- Migración remota: `20260907205007_pm13_p03_fichajes_seguros`.
- RPC `pm13_fichar`.
- RPC `pm13_fichaje_manual`.
- RPC `pm13_corregir_fichaje`.
- RPC `pm13_anular_fichaje`.
- Lock transaccional por empleado y `operationId` para replay/concurrencia.
- Secuencia entrada/salida validada.
- Empleado activo y local concreto obligatorios.
- Fichaje manual con fecha/hora/tipo válidos y sin futuro.
- Corrección con motivo, original e historial conservados.
- Anulación lógica, nunca borrado físico, y rechazo si rompe la secuencia.
- Auditoría PM11 reutilizada.
- RLS de lectura por ámbito; escritura directa cerrada.
- `anon`: sin acceso de tabla y sin `EXECUTE` de RPC P03.
- `authenticated`: `SELECT` sujeto a RLS y mutaciones únicamente por RPC autorizada.
- Funciones `SECURITY DEFINER` con `search_path=''` y validación interna de sesión, empleado, empresa/local y permisos.

Frontend:

- Modo remoto autoritativo mediante las RPC P03.
- Caché local solo se actualiza tras confirmación remota.
- Coalescing de doble clic/reintento en vuelo.
- Fallback local sincrónico para contratos aislados.
- Empleados inactivos y otro local bloqueados en dominio, no solo en UI.
- Fecha, hora, tipo y secuencia validados.
- Corrección conserva identidad y trazabilidad.
- Eliminar se convierte en anulación lógica.
- Historial, exportación, estado del día y alertas de jornadas abiertas ignoran fichajes anulados.
- Registro manual conserva el modal abierto si el backend rechaza la operación.

## Evidencia QA

Smoke transaccional, revertido al finalizar:

- entrada + replay: PASS;
- doble entrada: bloqueada;
- salida + replay: PASS;
- doble salida: bloqueada;
- fichaje manual + replay: PASS;
- corrección + replay, conservando original: PASS;
- anulación conservadora + replay: PASS;
- cruce de local: bloqueado.

Post-smoke:

- registros de prueba persistidos: `0`;
- fichajes históricos existentes: `2`, preservados;
- RPC P03 presentes: `4`.

El advisor de seguridad conserva avisos genéricos para RPC `SECURITY DEFINER` ejecutables por `authenticated`, también presentes en RPC anteriores. Para P03 su exposición es intencional: `anon` no puede ejecutarlas, la tabla no admite CUD directo para `authenticated`, y cada RPC vuelve a validar identidad, empleado, ámbito y rol antes de mutar. No se introdujo una nueva tabla sin RLS.

## Regresiones

Gate funcional previo: `34161422828` — **SUCCESS**.

Incluyó:

- contrato frontend P03: PASS;
- contrato backend P03: PASS;
- PM13–P01: PASS;
- PM13–P02: PASS;
- PM10–P07 Personal: PASS;
- PM12 frontend P02–P10: PASS;
- sintaxis `fuente.js`: PASS;
- barreras de alcance/no secretos: PASS.

## Gate de cierre

Este documento crea el checkpoint final con `fuente.js` ya integrado. El cierre formal exige una nueva ejecución completa de `.github/workflows/pm13-p03-fichajes.yml` sobre este SHA y que el paso de integración confirme **`Fuente ya coincide con P03`**, sin generar otro commit funcional.

PM13–P03 no se considera cerrado hasta que ese gate termine en `SUCCESS`.
