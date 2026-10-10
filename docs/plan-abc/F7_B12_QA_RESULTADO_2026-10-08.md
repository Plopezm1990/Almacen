# F7 · B12 — ensayo de pagos disponible

Fecha: 2026-10-08  
Entorno: simuladores locales y evidencia previa de QA  
Estado: `SIMULATOR_VALIDATED; PROVIDER_SANDBOX_PENDING`  
Producción: no tocada

## 1. Alcance

B12 no añade una migración ni activa un proveedor. Su objetivo actual es
separar los escenarios que pueden ensayarse con simuladores de los que exigen
la cuenta y el sandbox oficiales del proveedor de pagos.

## 2. Regresión ejecutada

Se ejecutaron de nuevo los contratos Node disponibles:

```text
ABC_F4_B07_WEBHOOK_CONTRACT=PASS
ABC_F4_B07_GENERIC_PROVIDERS=PASS
ABC_F4_B07_SIMULATED_FIXTURE
  signature_encoding=HEX
  status=CONFIRMADO
  amount=22
  currency=EUR
ABC_F4_B08_REFUND_ADAPTER=PASS
ABC_F4_B08_UI=PASS
ABC_F4_B12_PAYMENT_TRIAL_MATRIX=PASS
```

La validación cubre el contrato de webhook, la normalización de proveedores,
una firma simulada, el adaptador de reembolsos, la interfaz y la matriz de
rechazo, cancelación, replay, resultado incierto, evento duplicado, pago
parcial y reembolso concurrente.

Los recorridos de base de datos de B07 y B08 ya fueron verificados en QA y
quedaron registrados en sus evidencias F7 del 8 de octubre de 2026.

## 3. Frontera de la evidencia

Los resultados anteriores son pruebas de simulador. No acreditan una
autorización bancaria, expiración real, timeout del proveedor, liquidación ni
conciliación con un adquirente.

## 4. Bloqueo externo

B12 permanece `BLOCKED_UNVERIFIED` respecto al proveedor hasta disponer de:

1. proveedor elegido;
2. cuenta o merchant de sandbox;
3. documentación oficial de API y webhook;
4. endpoint, firma y escenarios oficiales de prueba;
5. secretos guardados en el entorno autorizado;
6. responsable de conciliación.

Cuando esos datos existan deberá ejecutarse la secuencia de
`F4_B12_ALTA_SANDBOX_2026-10-01.md`. La prueba de sandbox tampoco autorizará
por sí sola la activación en producción.
