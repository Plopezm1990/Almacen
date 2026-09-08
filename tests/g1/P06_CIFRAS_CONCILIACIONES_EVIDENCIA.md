# G1 · Núcleo seguro · Punto 6 — cifras y conciliaciones

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Entorno vivo: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: sin cambios

## 1. Objetivo

Revalidar sobre el estado actual del candidato que las cifras económicas principales siguen siendo coherentes entre stock, ventas, devoluciones, Caja, IVA interno y Resultados.

El punto no pretende certificar fiscalidad legal. El Libro IVA sigue siendo una proyección interna de control; la validación fiscal oficial permanece fuera de este gate.

## 2. Evidencia histórica usada como contrato

Se conservaron como referencia, sin sustituir la prueba viva:

- `tests/pm09/P10_CAJA_EVIDENCIA.json`;
- `tests/pm09/P11_IVA_EVIDENCIA.json`;
- `tests/pm09/P12_RESULTADOS_EVIDENCIA.json`;
- `tests/pm09/LA007_RESULTADOS_EVIDENCIA.json`;
- `tests/pm09/LA008_ROTACION_MARGEN_EVIDENCIA.json`.

Los contratos históricos relevantes fijan que:

- Caja deriva las ventas en efectivo desde el ledger de stock y no acepta como autoridad una base declarada por cliente;
- REVERSO y DEVOLUCION_CLIENTE corrigen las cifras sin borrar la operación original;
- Resultados usa ingreso neto y coste histórico;
- margen bruto = ingresos netos - coste de ventas neto;
- el Libro IVA usa el IVA histórico y aplica la corrección en la fecha propia de la operación;
- una devolución sin reembolso tiene tratamiento separado entre gestión, Caja y fiscalidad.

## 3. Prueba viva G1.6 en QA

Se ejecutó una transacción controlada con `ROLLBACK` usando Propietario A, Empresa A, local `QA-A1` y producto `QA-PROD-A-AGUA`.

Escenario:

1. stock inicial: 23 unidades;
2. venta PM09: 2 unidades;
3. ingreso unitario neto histórico: 5,4545454545 €;
4. IVA histórico: 10 %;
5. coste histórico: 3 € por unidad;
6. medio de pago: EFECTIVO;
7. devolución parcial posterior: 1 unidad;
8. reembolso: 6 € en EFECTIVO;
9. arqueo PM09 con base declarada falsa de cliente: 999 €;
10. efectivo contado: 6 €.

Todos los identificadores de prueba usaron prefijo `G1-P06-`.

## 4. Resultado vivo — stock

Después de venta 2 y devolución 1, dentro de la transacción:

- almacén: 18;
- piso: 4;
- total: **22**.

Neto frente al stock inicial 23: **-1 unidad**, exactamente igual a 2 vendidas - 1 devuelta.

Resultado: **PASS**.

## 5. Resultado vivo — Caja

La devolución generó un efecto de Caja de **-6,00 €**.

Al registrar el arqueo se envió deliberadamente `efectivo_base=999` para verificar que el servidor no confía en esa cifra.

Resultado almacenado por el servidor dentro de la transacción:

- efectivo_base: **12,00 €**;
- efectivo_esperado: **6,00 €**;
- efectivo_contado: **6,00 €**;
- diferencia: **0,00 €**.

Interpretación:

- venta efectiva bruta: 12 €;
- reembolso efectivo: -6 €;
- efectivo esperado final: 6 €.

El `999` declarado por cliente no se convirtió en autoridad.

Resultado: **PASS**.

## 6. Resultado vivo — Resultados y margen

La devolución backend no duplica necesariamente todos los campos económicos del movimiento original. La relación `ventaId` permite recuperar el coste histórico desde la venta original, que es precisamente el contrato usado por `costoUnitarioHistoricoVentaPM09(..., movimientos)` en Resultados.

Cálculo vivo sobre los movimientos creados en la transacción:

- ingresos netos: **5,45 €**;
- coste de ventas neto: **3,00 €**;
- margen bruto: **2,45 €**;
- margen: **45,00 %**.

Esto coincide con la evidencia histórica PM09 para una venta de 2 unidades y devolución parcial de 1.

Resultado: **PASS**.

## 7. Resultado vivo — IVA interno

Con IVA histórico del 10 % y devolución con reembolso de 6 €:

- base repercutida neta: **5,45 €**;
- IVA repercutido neto: **0,55 €**.

La prueba usa el IVA almacenado con la operación, no el IVA actual de una ficha de producto.

Resultado: **PASS** como conciliación interna de control.

No se interpreta este resultado como certificación legal de modelo 303 ni de documentación rectificativa.

## 8. Limpieza

Tras el `ROLLBACK` se verificó expresamente:

- `stock_operaciones` con `G1-P06-%`: 0;
- `movimientos_stock` con `G1-P06-%`: 0;
- `devoluciones_venta` con `G1-P06-%`: 0;
- `caja_operaciones` con `G1-P06-%`: 0;
- `arqueos_caja` con `G1-P06-%`: 0.

No se usaron datos reales y no se modificó producción.

## 9. Regresión automática requerida

El workflow G1.6 debe volver a ejecutar sobre el HEAD actual:

- contrato G1.6;
- LA-007 Resultados;
- LA-008 rotación/margen;
- P10 Caja;
- P11 IVA;
- P12 Resultados/margen;
- P15 casos económicos especiales;
- regresión G1 P02, P03, P04 y P05.

## 10. Decisión

**G1.6 CIFRAS Y CONCILIACIONES = PASS**, condicionado a que el workflow permanente del mismo HEAD termine en verde.

La prueba viva demuestra coherencia entre unidades, stock, reembolso, Caja, base de efectivo autoritativa, Resultados, coste histórico, margen e IVA interno.

El gate G1 completo todavía NO está superado.

**G1_P06_CIFRAS_CONCILIACIONES=PASS**  
**G1_ESTADO=PENDIENTE**  
**SIGUIENTE=G1.7_CONCURRENCIA_REPLAY**
