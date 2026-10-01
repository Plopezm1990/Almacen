# F4 B12 — Ensayo de pagos

Fecha: 01/10/2026.

## B12.1 cerrado: matriz de ensayos y frontera de evidencia

La matriz separa lo que puede probarse con simuladores locales de lo que solo
puede verificarse contra el sandbox real del proveedor. Ningún ensayo simulado
se presenta como autorización bancaria.

| Caso | Evidencia disponible | Estado |
|---|---|---|
| Rechazo | contratos F4 de cobro y simulador | `SIMULATOR_VALIDATED` |
| Cancelación | contratos F4 y flujo de reembolso | `SIMULATOR_VALIDATED` |
| Doble clic / replay | `operation_id` e idempotencia | `SIMULATOR_VALIDATED` |
| Resultado incierto | estados `DESCONOCIDO` y resolución posterior | `SIMULATOR_VALIDATED` |
| Evento duplicado | deduplicación B07 por cuenta y evento | `SIMULATOR_VALIDATED` |
| Pago parcial | matriz de importes y saldo restante | `SIMULATOR_VALIDATED` |
| Reembolso concurrente | bloqueo de aplicaciones B08 | `SIMULATOR_VALIDATED` |
| Expiración | política del proveedor | `PROVIDER_SANDBOX_PENDING` |
| Firma, timeout y conciliación reales | cuenta y sandbox del proveedor | `PROVIDER_SANDBOX_PENDING` |

## Regla de salida

Un proveedor sin acceso a pruebas queda `BLOCKED_UNVERIFIED`. Para pasar a
`PROVIDER_SANDBOX_VALIDATED` se necesitan proveedor, cuenta de pruebas,
documentación oficial, referencias no sensibles y los estados finales de
proveedor, pedido y caja con el mismo importe.

No se usarán credenciales reales en el repositorio o el chat, ni se ejecutarán
cobros de producción para completar esta matriz.

## Alcance actual

B07 y B08 tienen recorridos de simulador preparados. La validación de sandbox
real queda pendiente de que el usuario aporte proveedor, cuenta, documentación
y secretos del entorno. Hasta entonces el sistema queda preparado pero no
verificado contra un servicio bancario real.

La ejecución local de B12.2 está registrada en
`F4_B12_EVIDENCIA_SIMULADOR_2026-10-01.md`.
