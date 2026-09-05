# G1 · Núcleo seguro · Punto 3 — revalidación LA-019

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Base del punto: `ac41071bc20ff689421dbbb5842c3e9c4641c0e6`  
Backend: Supabase QA `qjqorixtkilwsndqayyx` (`ACTIVE_HEALTHY`)  

## 1. Objetivo

Revalidar que una devolución de cliente es indivisible: una entrada inválida no
puede dejar cambios parciales en stock, movimientos, devolución o caja. También
se revalidan límites acumulados e idempotencia.

## 2. Método

- Usuario sintético QA con rol `Cajero/a` y ámbito `QA-EMP-A / QA-A1`.
- Producto sintético `QA-PROD-A-AGUA`.
- Venta sintética de 2 unidades, precio unitario 6 e IVA 0 para que el oráculo
  económico sea independiente y exacto.
- Llamadas a las RPC vigentes `registrar_venta_stock_pm09` y
  `registrar_devolucion_venta_pm09`.
- Toda la batería se ejecutó dentro de una transacción con `ROLLBACK`.
- Prefijo reservado de operaciones: `G1-P03-`.

No se usó producción, no se aplicaron migraciones y no se modificó el esquema.

## 3. Resultado de los casos

| Caso | Esperado | Obtenido | Estado |
|---|---|---|---|
| Venta fixture | Stock 23 → 21 | Stock 23 → 21 | PASS |
| Reembolso negativo `-5` | Rechazo total; cero efectos | `importe_negativo`; stock 21 → 21; cero filas parciales | PASS |
| Devolución válida | Una devolución, un movimiento y un asiento de caja | Stock 21 → 22; cantidad 1; reembolso 6; tarjeta; efecto efectivo 0 | PASS |
| Replay mismo ID/mismo payload | Respuesta idempotente sin duplicar | `replayed=true`; una fila; stock permanece 22 | PASS |
| Mismo ID/payload distinto | Conflicto sin mutar | `operation_id_conflict`; stock permanece 22 | PASS |
| Exceso de cantidad acumulada | Rechazo sin mutar | `devolucion_supera_cantidad_pendiente`; cero filas nuevas | PASS |
| Exceso de reembolso acumulado | Rechazo sin mutar | `reembolso_supera_importe_pendiente`; cero filas nuevas | PASS |

Resultado: **7/7 PASS**.

## 4. Comprobación de indivisibilidad del negativo

Antes y después de intentar `G1-P03-DEV-NEG-0001` se compararon:

- total de `stock_ubicacion`;
- `stock_operaciones`;
- `movimientos_stock`;
- `devoluciones_venta`;
- `caja_operaciones`.

El error se produjo antes de cualquier mutación. Ninguno de los cinco estados
cambió.

## 5. Limpieza y reconciliación

Una consulta independiente después del `ROLLBACK` confirmó:

- stock total QA-A1 / QA-PROD-A-AGUA: **23**;
- `stock_operaciones` con prefijo G1-P03: **0**;
- `movimientos_stock` con prefijo G1-P03: **0**;
- `devoluciones_venta` con prefijo G1-P03: **0**;
- `caja_operaciones` con prefijo G1-P03: **0**.

## 6. Decisión

**LA-019 REVALIDADA EN G1.3.**

El punto demuestra el contrato funcional y transaccional de LA-019 sobre QA.
La matriz integral de permisos de todos los roles/locales continúa en G1.5 y la
batería ampliada de concurrencia/timeout continúa en G1.7.

**G1_P03_LA019=PASS**  
**G1_ESTADO=PENDIENTE**  
**SIGUIENTE=G1.4_REVALIDAR_LA023**
