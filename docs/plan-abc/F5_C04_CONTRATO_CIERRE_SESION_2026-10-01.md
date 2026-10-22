# F5 C04 Contrato de cierre provisional y definitivo

Fecha: 2026-10-01  
Estado: `IMPLEMENTADO_Y_VERIFICADO_EN_QA; UI_VALIDADA; DESPLIEGUE_CONSOLIDADO_PENDIENTE`
Base: Plan ABC C04, F2 caja transaccional, C03 y capa de diferencias de caja

La revisión inicial confirmó que existía el cierre definitivo, pero faltaba el
circuito provisional y la reapertura. La migración aditiva que cubre esas
transiciones está aplicada en QA. El cierre definitivo queda protegido por una
guarda del servidor y por el tratamiento obligatorio de las diferencias.

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

## Implementación C04

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

## Pendiente para el cierre operativo de C04

1. Desplegar en QA la interfaz consolidada que incluye la vista previa C03.
2. Repetir el recorrido visual con esa versión y obtener aceptación funcional.
3. Mantener la autorización separada para cualquier aplicación en PROD.

El adaptador/UI de TPV ya queda conectado en esta rama candidata: separa
iniciar, confirmar provisional, finalizar y reabrir con motivo; muestra los
bloqueos devueltos por el servidor y mantiene `operation_id` por operación.
También queda añadido un contrato estático de concurrencia que verifica los
bloqueos `FOR UPDATE`, la guarda de transición final y que cobros/reembolsos
solo entren con sesión `ABIERTA`. El workflow PostgreSQL 16 ejecutó la carrera
real con dos conexiones independientes y pasó.
La revisión estática de seguridad confirma autenticación y capacidad por RPC,
`search_path` cerrado y ausencia de ejecución para `anon`/`service_role`. La
revisión conectada de permisos confirma ejecución para `authenticated`, sin
ejecución para `anon` ni `service_role`; los avisos generales de advisors ya
inventariados no añaden una incidencia específica de C04.
Queda preparado además el workflow PostgreSQL 16 efímero
`.github/workflows/abc-f5-c04-postgres.yml`, que ejecuta el contrato funcional
real con dos conexiones independientes.

## Criterios de aceptación verificados

- cierre provisional visible y conciliable;
- cierre definitivo rechazado mientras haya bloqueos;
- cierre definitivo idempotente cuando no existan bloqueos;
- reapertura restringida y trazable;
- carrera cierre/cobro resuelta por el servidor sin doble movimiento.

## Resultado de C04

C04 queda validado en PostgreSQL 16 desechable y en QA. La verificación cubre
la carrera concurrente, el bloqueo por pendientes, la diferencia sin tratar,
la aprobación, la finalización, la reapertura, la guarda contra cierre directo
y los reintentos idempotentes. El ensayo QA del 9/10/2026 terminó con
`ROLLBACK` y cero residuos. Producción no se ha modificado.

La evidencia consolidada está en `F7_C04_QA_RESULTADO_2026-10-09.md`.
