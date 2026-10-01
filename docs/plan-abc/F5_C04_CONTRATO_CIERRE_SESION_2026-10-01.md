# F5 C04 Contrato de cierre provisional y definitivo

Fecha: 2026-10-01  
Estado: `CONTRATO_C04_BLOQUEADO_POR_PROVISIONAL_REAPERTURA`  
Base: Plan ABC C04, F2 caja transaccional, C03 y `origin/release` `7859508`

La revisión de `release` confirma que existe el cierre definitivo de una sesión
de caja y que el servidor calcula el esperado antes de registrar el conteo. C04
no puede declararse cerrado todavía: el plan exige distinguir cierre
provisional y definitivo, bloquear pagos inciertos y permitir reapertura solo con
permiso, causa y trazabilidad; el circuito actual no cubre aún todo ese alcance.

## Estados requeridos

| Estado | Regla de negocio |
|---|---|
| `ABIERTA` | admite operaciones autorizadas de la sesión |
| `EN_CIERRE` | congela nuevas operaciones y prepara la conciliación |
| `CIERRE_PROVISIONAL` | registra resultado parcial y pendientes visibles; no permite tratar la sesión como definitiva |
| `CERRADA_FINAL` | solo después de resolver bloqueos y registrar conteo/resultado final |
| Reapertura | operación separada, permiso explícito, motivo y evento auditable |

Un pago `DESCONOCIDO`, efecto pendiente, documento pendiente o incidencia de
conciliación debe aparecer como bloqueo del cierre definitivo. No se resuelve
modificando el arqueo ni ocultando el pendiente.

## Lo que ya existe

- `caja_sesiones` contempla `EN_CIERRE`, `CIERRE_PROVISIONAL` y
  `CERRADA_FINAL`.
- `abc_cerrar_sesion_caja` valida actor, empresa/local, terminal vinculado,
  sesión `ABIERTA`, moneda y cantidad contada; calcula esperado y diferencia en
  servidor y registra `CAJA_SESION_CERRADA`.
- El cierre usa `operation_id` y recuperación idempotente.

## Falta para cerrar C04

1. RPC/flujo autoritativo para pasar a `EN_CIERRE` y después a
   `CIERRE_PROVISIONAL` con sus pendientes y resultado.
2. Guarda que impida `CERRADA_FINAL` mientras exista un pago incierto o efecto
   incompatible sin resolver.
3. Reapertura segura de una sesión provisional o cerrada según la política
   aprobada, siempre con rol, motivo, operación y evento.
4. Pruebas concurrentes de cierre frente a cobro, devolución y recuperación.
5. Evidencia de que ninguna transición duplica movimientos ni permite operar en
   una sesión definitivamente cerrada.

## Criterios de aceptación pendientes

- cierre provisional visible y conciliable;
- cierre definitivo rechazado mientras haya bloqueos;
- cierre definitivo idempotente cuando no existan bloqueos;
- reapertura restringida y trazable;
- carrera cierre/cobro resuelta por el servidor sin doble movimiento.

## Resultado de C04

C04 queda documentado como pendiente bloqueado por la ausencia del circuito
provisional y de reapertura. No se aplica una migración incompleta, no se
escriben QA/PROD, no se hace merge y no se ejecuta deploy de Netlify.
