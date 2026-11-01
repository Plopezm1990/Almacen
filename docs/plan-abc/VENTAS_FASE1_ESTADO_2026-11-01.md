# Ventas — estado de fase 1

Fecha: 2026-11-01
Rama: `codex/ventas-mejoras`
Base: `f8cf300bd86054ef376519823ec787dc99b3807`

## Alcance ejecutado

- Se eliminó la lectura directa de `pago_intentos` desde la UI de cobro.
- La UI consume los intentos desde `abc_estado_pago_mixto_cuenta`, que es la superficie autorizada para el rol autenticado.
- El importe del siguiente pago se sincroniza con el saldo autoritativo del servidor después de actualizar, cobrar, recuperar un intento o cambiar de cuenta.
- Si la cuenta no está disponible o el estado del cobro no se puede leer, se limpian el importe y el efectivo introducidos para no reutilizar datos de otra cuenta o un saldo no verificado.
- La etiqueta operativa pasó a ser `Exacto para este pago (€)`.
- Las comandas `BLOQUEADA` sin estación (`SIN_RUTA`) ahora muestran un bloqueo explícito: no se imprimen, no ofrecen reimpresión operativa y la UI indica que asignar una ruta no reenvía automáticamente la comanda existente.
- La confirmación de una ruta de producto informa de que se aplicará a nuevas comandas; la configuración sigue pasando por RPC y no hace DML directo desde el cliente.
- No se modificaron migraciones ni datos remotos.

## Evidencia QA

- La cuenta de prueba autenticó correctamente contra QA.
- La RPC de estado mixto devolvió una cuenta de 1,32 €, 1,00 € confirmado, 0,32 € pendiente y un intento de tarjeta `PENDIENTE`.
- La lectura directa de `pago_intentos` respondió `42501` para `authenticated`, confirmando que la UI no debe consultar esa tabla directamente.

## Pruebas ejecutadas

- `node --check source-recovery/fuente-recuperado.js`: PASS
- `node --check fuente.js`: PASS
- `python source-recovery/recuperar_candidato.py --check`: PASS
- `node tests/f4/b05/b05-phase1-regression.mjs`: PASS
- `node tests/f4/b05/b05-ui-contract.mjs`: PASS
- `node tests/f3/a10/a10-ui.test.mjs`: PASS, incluidos los controles de seguridad visual para `SIN_RUTA`
- Contratos B04, B07, B08 y B09: PASS
- Contratos de permisos/aislamiento y replay/concurrencia G1: PASS
- Contratos A02 y A05: PASS

## Pendiente de certificación

Los contratos SQL económicos de cobro, reembolso y concurrencia no se han ejecutado en esta fase porque requieren una base PostgreSQL/PGlite con el esquema de pruebas. No se ha levantado una base ni se han aplicado migraciones para suplir esa dependencia.

La fase 1 no debe marcarse como aprobada hasta ejecutar esos contratos en un entorno efímero autorizado y comprobar los criterios VEN-003, VEN-010 y VEN-011 con resultados económicos reales del entorno de pruebas.

## Comprobación de entorno para la certificación

Se revisó el repositorio y el equipo de trabajo: no hay un dump/base preparada ni una imagen Docker local reutilizable para estos contratos; solo están disponibles fixtures y migraciones. Tampoco están instalados `psql` ni `pg_isready`. El runner local de PGlite existente prepara únicamente el alcance A08 y aplica migraciones propias, por lo que no se ejecutó para evitar incumplir la restricción de no aplicar migraciones.
