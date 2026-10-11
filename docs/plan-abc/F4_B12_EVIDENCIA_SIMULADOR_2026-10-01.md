# F4 B12.2 — evidencia de simuladores

Fecha: 01/10/2026.

## Ejecución local

Se ejecutaron los contratos Node disponibles, sin conexión a un proveedor y
sin credenciales:

```text
ABC_F4_B07_WEBHOOK_CONTRACT=PASS
ABC_F4_B07_GENERIC_PROVIDERS=PASS
ABC_F4_B07_SIMULATED_FIXTURE
  status=CONFIRMADO amount=22 currency=EUR
ABC_F4_B08_REFUND_ADAPTER=PASS
ABC_F4_B08_UI=PASS
ABC_F4_B12_PAYMENT_TRIAL_MATRIX=PASS
```

Esto comprueba la normalización genérica, la firma simulada, el rechazo de
datos sensibles, el adaptador de reembolso y la interfaz preparada. No prueba
la autorización bancaria, la liquidación, el sandbox del proveedor ni una
conciliación real.

## Resultado

Los recorridos de simulador quedan disponibles para regresión. Los ensayos
que dependen de PostgreSQL se ejecutarán en CI; los que dependen del sandbox
real permanecen `PROVIDER_SANDBOX_PENDING` hasta aportar proveedor, cuenta y
documentación oficial.
