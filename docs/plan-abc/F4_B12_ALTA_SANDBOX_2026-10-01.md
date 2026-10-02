# F4 B12.3 — alta de sandbox del proveedor

Estado: plantilla preparada; proveedor bloqueado hasta disponer de pruebas.

## Datos necesarios

| Dato | Estado |
|---|---|
| Proveedor | `PENDIENTE` |
| Cuenta o merchant de sandbox | `PENDIENTE` |
| Documentación oficial de API | `PENDIENTE` |
| Endpoint de sandbox | `PENDIENTE` |
| Formato de firma y webhook | `PENDIENTE` |
| Moneda y país de prueba | `PENDIENTE` |
| Nombre lógico de secretos | `PENDIENTE` |
| Tarjetas/escenarios de prueba oficiales | `PENDIENTE` |
| Persona responsable de conciliación | `PENDIENTE` |

Los valores secretos se introducirán únicamente en el almacén de secretos del
entorno autorizado. En el repositorio y en el chat solo se conservarán nombres
lógicos, referencias no sensibles y resultados resumidos.

## Secuencia de ensayo

1. Validar firma y cuenta comercial.
2. Ejecutar autorización aprobada y rechazo.
3. Probar cancelación, timeout y resultado desconocido.
4. Repetir el mismo evento para comprobar deduplicación.
5. Probar pago parcial y confirmar saldo restante.
6. Ejecutar reembolso parcial y dos reembolsos concurrentes.
7. Verificar expiración, conciliación y estados finales de proveedor, pedido y
   caja con el mismo importe.
8. Guardar solo referencias de transacción, importes, monedas y estados.

## Puerta de activación

Hasta completar la ficha, el estado es `BLOCKED_UNVERIFIED`. La prueba de
sandbox no autoriza producción: después aún serían necesarios revisión del
adquirente, aprobación PCI y autorización independiente para cualquier deploy
o migración remota.
