# F5 C04 Contrato de cierre provisional y definitivo

Fecha: 2026-10-01  
Estado: `CANDIDATO_C04_VALIDADO_PG_NO_APLICADO`
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

## Pendiente para el cierre operativo de C04

1. Obtener la revisión de seguridad/advisors desde una base conectada.
2. Decidir y autorizar la aplicación en QA; esta rama no la aplica.
3. Mantener la autorización separada para cualquier aplicación en PROD.

El adaptador/UI de TPV ya queda conectado en esta rama candidata: separa
iniciar, confirmar provisional, finalizar y reabrir con motivo; muestra los
bloqueos devueltos por el servidor y mantiene `operation_id` por operación.
También queda añadido un contrato estático de concurrencia que verifica los
bloqueos `FOR UPDATE`, la guarda de transición final y que cobros/reembolsos
solo entren con sesión `ABIERTA`. El workflow PostgreSQL 16 ejecutó la carrera
real con dos conexiones independientes y pasó.
La revisión estática de seguridad confirma autenticación y capacidad por RPC,
`search_path` cerrado y ausencia de ejecución para `anon`/`service_role`; el
resultado de `supabase db advisors` queda pendiente de una base conectada.
Queda preparado además el workflow PostgreSQL 16 efímero
`.github/workflows/abc-f5-c04-postgres.yml`, que ejecuta el contrato funcional
real con dos conexiones independientes.

## Criterios de aceptación pendientes

- cierre provisional visible y conciliable;
- cierre definitivo rechazado mientras haya bloqueos;
- cierre definitivo idempotente cuando no existan bloqueos;
- reapertura restringida y trazable;
- carrera cierre/cobro resuelta por el servidor sin doble movimiento.

## Resultado de C04

C04 queda validado en PostgreSQL 16 desechable, incluida la carrera concurrente,
el bloqueo por pendientes, la finalización, la reapertura y la guarda contra
cierre directo. Sigue sin aplicarse en QA/PROD; tampoco se hace merge ni se
ejecuta deploy de Netlify. Solo queda la revisión `db advisors` con una base
conectada y la decisión separada de promoción.
