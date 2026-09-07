# PM13–P04 — Ausencias — CIERRE

Estado: **CANDIDATO A CIERRE FORMAL**

## Base y aislamiento

- Rama: `pm13-p04-ausencias`.
- Base exacta P03: `a0823b032f85b9c35ff65826d65793d4f2428ac9`.
- `main` permanece congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- Producción queda fuera de alcance de P04.

## Implementación

Commit funcional integrado: `cfb4517f26c72dbf60bdf09501fedb5a0119bb7c`.

P04 reutiliza la entidad canónica `public.empleados` y persiste las ausencias en `datos.ausencias`; no crea una segunda tabla de Personal.

Garantías cerradas:

- empleado activo obligatorio para registrar una nueva ausencia;
- empresa y local concretos y autorizados;
- tipos admitidos: Vacaciones, Baja médica y Otro;
- fechas ISO reales y rango final >= inicial;
- bloqueo de solapamientos entre ausencias activas;
- serialización mediante bloqueo de fila en backend;
- `operationId` para replay/idempotencia;
- alta remota por RPC y actualización local solo tras éxito;
- anulación lógica y trazable, sin borrar el registro histórico;
- la UI no cierra el modal si la operación falla;
- las ausencias anuladas no computan en el contador de vacaciones existente.

La política completa de saldo, devengo y reglas de vacaciones no se adelanta aquí: corresponde a PM13–P05.

## QA

Migración aplicada exclusivamente en QA:

- versión remota: `20260907211858`;
- nombre: `pm13_p04_ausencias_trazables`.

RPC P04 presentes: 2 (`pm13_registrar_ausencia`, `pm13_anular_ausencia`).

Permisos verificados:

- `anon`: sin EXECUTE en las RPC P04;
- `authenticated`: EXECUTE en las RPC P04;
- `authenticated`: sin UPDATE directo sobre `public.empleados`.

Smoke transaccional con rollback:

- alta de ausencia: PASS;
- replay de alta: PASS;
- solapamiento: bloqueado;
- anulación lógica: PASS;
- replay de anulación: PASS;
- nueva ausencia sobre intervalo liberado por una anulación: PASS;
- restos de smoke persistidos: `0`.

Estado de datos después del smoke:

- empleados QA existentes: `1`;
- ausencias persistidas: `0`;
- datos de prueba P04 persistidos: `0`.

## Producción

Validación read-only:

- migraciones P04: `0`;
- RPC P04: `0`.

No se ha aplicado P04 a producción.

## Regresiones

Gate funcional: `34162963864` — **SUCCESS**.

Gate exact-head posterior a integración: `34162984332` — **SUCCESS** y el log confirmó `Fuente ya coincide con P04`.

Incluyeron:

- contrato frontend P04: PASS;
- contrato backend P04: PASS;
- PM13–P01: PASS;
- PM13–P02: PASS;
- PM13–P03 frontend/backend: PASS;
- PM10–P07 Personal: PASS;
- PM12 frontend P02–P10: PASS;
- sintaxis de `fuente.js`: PASS;
- barreras de alcance y no secretos: PASS.

## Gate de cierre

Este documento crea el checkpoint formal final. PM13–P04 solo queda **CERRADO** si la ejecución de `.github/workflows/pm13-p04-ausencias.yml` disparada por este commit termina completamente en `SUCCESS` y el paso de integración vuelve a confirmar `Fuente ya coincide con P04`, sin generar un nuevo commit funcional.
