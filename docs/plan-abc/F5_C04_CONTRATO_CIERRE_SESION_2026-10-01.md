# F5 C04 Contrato de cierre provisional y definitivo

Fecha: 2026-10-01  
Estado: `CANDIDATO_C04_IMPLEMENTADO_NO_APLICADO`
Base: Plan ABC C04, F2 caja transaccional, C03 y `origin/release` `7859508`

La revisión de `release` confirmó que existía el cierre definitivo, pero faltaba
el circuito provisional y la reapertura. Esta rama prepara una migración
aditiva que cubre esas transiciones y deja el cierre definitivo protegido por
una guarda de servidor. El candidato todavía no está aplicado en ningún
entorno.

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

## Implementación candidata C04

- `abc_iniciar_cierre_sesion_caja` pasa `ABIERTA` a `EN_CIERRE` y crea el
  cierre `INICIADO`.
- `abc_confirmar_cierre_provisional` registra conteo, esperado, diferencia y
  bloqueos, y pasa la sesión a `CIERRE_PROVISIONAL`.
- `abc_finalizar_cierre_sesion_caja` solo finaliza si no hay pagos o efectos
  pendientes; la guarda también impide cerrar directamente desde `ABIERTA`.
- `abc_reabrir_cierre_provisional` exige capacidad y motivo, cancela el cierre
  provisional de forma trazable y devuelve la sesión a `ABIERTA`.

La primera versión solo permite reabrir un cierre provisional. Reabrir una
sesión `CERRADA_FINAL` queda fuera hasta aprobar una política específica.

## Falta para cerrar C04

1. Aplicar y verificar la migración en una base PostgreSQL de prueba.
2. Actualizar el adaptador/UI para usar las cuatro RPC nuevas y mostrar los
   bloqueos.
3. Ejecutar pruebas concurrentes de cierre frente a cobro, devolución y
   recuperación.
4. Obtener la revisión de seguridad/advisors y preparar QA.
5. Evidencia de que ninguna transición duplica movimientos ni permite operar en
   una sesión definitivamente cerrada.

## Criterios de aceptación pendientes

- cierre provisional visible y conciliable;
- cierre definitivo rechazado mientras haya bloqueos;
- cierre definitivo idempotente cuando no existan bloqueos;
- reapertura restringida y trazable;
- carrera cierre/cobro resuelta por el servidor sin doble movimiento.

## Resultado de C04

C04 queda implementado como candidato revisable, con la aplicación en entorno,
la adaptación de interfaz y la prueba PostgreSQL todavía pendientes. No se
escriben QA/PROD, no se hace merge y no se ejecuta deploy de Netlify.
