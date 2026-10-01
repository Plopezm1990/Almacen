# F1.5 — vectores monetarios y criterios de aceptación

Fecha: 2026-10-01  
Estado: `PENDIENTE_APROBACION_DE_PARAMETROS`  
Base: F1.1–F1.4 y `origin/release` `7859508`

Los vectores son casos de control, no una decisión fiscal. `MONEDA`, `ESCALA`,
`TASA_A`, `TASA_B` y `DESCUENTO` deben completarse con los valores aprobados
antes de convertirlos en pruebas de aceptación.

## Parámetros

| Parámetro | Valor inicial | Regla |
|---|---|---|
| Moneda | `PENDIENTE` | ISO 4217 del local |
| Escala monetaria | `PENDIENTE` | decimales admitidos por la moneda |
| Redondeo | `PENDIENTE` | una regla estable en servidor |
| Tasa A/B | `PENDIENTE` | asesoría confirma aplicación |
| Descuento | `PENDIENTE` | permiso, límite y motivo |

## Vectores de control

| ID | Caso | Entrada | Resultado exigido | Estado |
|---|---|---|---|---|
| M01 | importe exacto | una línea de `10.00` | subtotal, impuesto y total separados | `PENDIENTE` |
| M02 | dos tasas | líneas con `TASA_A` y `TASA_B` | cada base e impuesto conserva su tasa | `PENDIENTE` |
| M03 | descuento de línea | precio histórico + `DESCUENTO` | descuento trazable sin precio negativo | `PENDIENTE` |
| M04 | descuento de cuenta | varias líneas y motivo | distribución determinista y auditable | `PENDIENTE` |
| M05 | reparto impar | total `10.00` entre tres partes | `3.34 + 3.33 + 3.33 = 10.00` si la escala es 2 | `PENDIENTE` |
| M06 | pago parcial | total `10.00`, pago `6.00` | pendiente `4.00`, sin cerrar cuenta | `PENDIENTE` |
| M07 | pago mixto | efectivo `6.00` + otro medio `4.00` | suma exacta y caja solo con efectivo | `PENDIENTE` |
| M08 | devolución parcial | cobro confirmado y devolución menor | saldo disponible se reduce una vez | `PENDIENTE` |
| M09 | importe manipulado | cliente cambia precio/total | servidor rechaza sin escritura parcial | `PENDIENTE` |
| M10 | reintento idéntico | mismo `operation_id` y cuerpo | devuelve resultado original | `PENDIENTE` |
| M11 | reintento distinto | mismo ID y cuerpo diferente | conflicto sin duplicar efecto | `PENDIENTE` |
| M12 | precio histórico | catálogo cambia después de vender | venta conserva el precio original | `PENDIENTE` |

## Reglas de cálculo

- La fuente del total autorizado es el servidor.
- Las cantidades e importes se calculan con representación exacta adecuada para
  la moneda; no se usa coma flotante como autoridad contable.
- El impuesto se calcula sobre la base y regla aprobadas; no se deduce de un
  total manipulado por el cliente.
- El reparto conserva la suma exacta y registra qué parte absorbe el céntimo.
- Un pago confirmado no se duplica por doble clic, reintento o evento repetido.
- Una devolución respeta pagos confirmados y solicitudes pendientes reservadas.

## Criterios de aceptación F1.5

1. Los 12 vectores reproducen el mismo resultado en servidor y UI.
2. La suma de líneas, impuestos, descuentos, pagos y repartos es explicable.
3. Los casos M09–M11 fallan o reejecutan de forma segura.
4. Cambiar catálogo o tasa después de la venta no modifica su fotografía.
5. Las tasas y la moneda no se consideran aprobadas hasta completar F1.4.

## Resultado de F1.5

Los vectores quedan preparados para revisión y ejecución local. No se fijan
tasas fiscales reales, no requiere secrets, migración remota, merge ni deploy de
Netlify.
