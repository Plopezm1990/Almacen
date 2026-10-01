# F3.3 — contrato de cuentas abiertas, recuperación y concurrencia

Fecha: 2026-10-01  
Estado: `CONTRATO_CONCURRENCIA_PREPARADO_NO_APLICADO`  
Base: F3.1–F3.2 y `origin/release` `7859508`

Este contrato define cómo se recupera una cuenta confirmada y cómo se evita que
dos sesiones sobrescriban o cobren el mismo saldo.

## Identidad y versiones

| Elemento | Regla |
|---|---|
| Cuenta | identificador estable por empresa/local |
| Línea | identidad propia, variante y versión |
| Edición | incluye `expected_version` |
| Operación | incluye `operation_id` y cuerpo idempotente |
| Sesión | usuario, dispositivo, local y última actividad |
| Estado local | visible como borrador no confirmado y con caducidad |

Un reinicio del navegador no puede borrar una cuenta confirmada ni crear una
copia. Un borrador local nunca se presenta como venta, pago o stock confirmado.

## Escenarios de concurrencia

| Caso | Resultado esperado |
|---|---|
| Dos sesiones editan la misma cuenta | un ganador; el otro recibe conflicto explícito |
| Dos sesiones añaden líneas distintas | merge solo si el servidor lo autoriza y conserva versiones |
| Dos sesiones editan la misma línea | no hay sobrescritura silenciosa |
| Una sesión cobra mientras otra edita | se reserva el saldo afectado |
| Una sesión cancela mientras otra prepara | estado y merma requieren decisión trazable |
| Cliente antiguo actualiza cuenta nueva | compatibilidad o bloqueo comprensible |
| Corte después de confirmar | recuperación por identificador, sin duplicar |
| Reintento con cuerpo diferente | conflicto sin efecto parcial |

## Recuperación

1. Cargar la cuenta por identificador y contexto autorizado.
2. Comparar versión, estado y operaciones pendientes.
3. Mostrar cambios del servidor antes de permitir una nueva mutación.
4. Reaplicar solo una operación con el mismo `operation_id` y cuerpo.
5. Resolver incidencias de cobro mediante consulta, nunca con cargo ciego.
6. Registrar actor, dispositivo, causa y resolución.

## Caducidad de borradores

Los borradores locales deben indicar origen, hora, dispositivo, cuenta objetivo y
política de caducidad. Al caducar se conservan como borrador no operativo o se
descartan de forma explícita; jamás se suben automáticamente como venta o cobro.

## Criterios de aceptación F3.3

1. Dos conexiones no pueden confirmar dos veces el mismo saldo.
2. Un conflicto se muestra y se conserva sin perder el estado del servidor.
3. Recargar o reiniciar recupera cuentas confirmadas.
4. Los borradores locales no mutan pagos, caja, fiscalidad ni stock.
5. Replay idéntico es idempotente y replay distinto produce conflicto.

## Resultado de F3.3

El contrato de recuperación y concurrencia queda preparado para implementar A06
y reforzar A05/A08. No requiere migración remota, merge ni deploy de Netlify.
