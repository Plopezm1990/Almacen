# G1 · Núcleo seguro · Punto 7 — concurrencia, replay e idempotencia

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Entorno vivo: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: sin cambios

## 1. Objetivo

Revalidar el criterio G1 de concurrencia/replay sobre el estado actual después de G1.5 y G1.6:

- un mismo `operationId` + mismo payload no duplica efectos;
- un mismo `operationId` + payload distinto se rechaza;
- cambiar fecha o local con el mismo identificador se rechaza;
- el identificador no puede coexistir entre ledgers de stock y Caja;
- venta, reverso, devolución y Caja conservan replay legítimo;
- el backend mantiene serialización por advisory transaction lock;
- los reintentos tras timeout deben reutilizar exactamente el mismo identificador.

## 2. Serialización vigente en QA

Se inspeccionó directamente en Supabase QA la definición actual de:

`private.pm08_bloquear_operation_id(text)`

La función vigente ejecuta:

`pg_advisory_xact_lock(hashtextextended('la-suite-pm08:' || p_operation_id, 0))`

La capa PM09 conserva `private.pm09_bloquear_operation_id_stock()`, que reutiliza ese mismo lock antes de delegar en las RPC PM07 y comprueba colisiones con:

- `caja_operaciones`;
- `arqueos_caja`;
- `arqueos_caja_anulaciones`.

Las cuatro wrappers PM09 de venta/reverso siguen entrando por ese helper.

## 3. Revalidación viva de replay

Identidad sintética QA: Propietario de `QA-EMP-A`.  
Local: `QA-A1`.  
Producto: `QA-PROD-A-AGUA`.  
Stock inicial: 18 almacén + 5 piso = **23**.

Toda la batería se ejecutó dentro de `BEGIN ... ROLLBACK`.

### Resultado principal

**21/21 PASS**:

1. baseline de stock = 23;
2. primera venta no es replay;
3. replay exacto de venta devuelve `replayed=true`;
4. la venta exacta deja 1 operación, 1 movimiento y un solo descuento;
5. misma venta con cantidad distinta → `operation_id_conflict`;
6. misma venta con fecha distinta → `operation_id_conflict`;
7. Caja crea primero un `operationId` sintético;
8. reutilizar ese id en Venta → `operation_id_conflict`;
9. la colisión Caja→Venta no toca stock;
10. primer reverso no es replay;
11. replay exacto del reverso devuelve `replayed=true`;
12. solo existe una restauración de stock;
13. mismo reverso con fecha distinta → `operation_id_conflict`;
14. primera devolución no es replay;
15. replay exacto de devolución devuelve `replayed=true`;
16. solo existe 1 devolución, 1 movimiento de stock y 1 movimiento de Caja;
17. misma devolución con reembolso distinto → `operation_id_conflict`;
18. primer movimiento manual de Caja no es replay;
19. replay exacto de Caja devuelve `replayed=true`;
20. Caja conserva una única fila;
21. mismo id de Caja con importe distinto → `operation_id_conflict`.

## 4. Bordes de scope y colisión inversa

Se añadieron 3 comprobaciones más, también dentro de transacción con `ROLLBACK`:

- Venta en A1 y reutilización del mismo `operationId` en A2 → `operation_id_conflict`;
- Venta creada primero y reutilización del mismo id en Caja → `operation_id_conflict`;
- solo A1 recibió el efecto temporal; A2 quedó intacto y no apareció fila de Caja.

Resultado adicional: **3/3 PASS**.

### Total G1.7 vivo

**24/24 PASS**.

## 5. Modelo de timeout/reintento

La segunda llamada exacta de cada operación representa el caso de respuesta perdida/timeout: se vuelve a enviar el mismo `operationId` y el servidor devuelve replay sin repetir el efecto.

Esto mantiene DEC-03: operación crítica con identificador estable, backend como autoridad y sin crear una operación independiente como fallback.

## 6. Limpieza

Verificación independiente después de la batería:

- `stock_operaciones`: 0 filas `G1-P07-`;
- `movimientos_stock`: 0 filas `G1-P07-`;
- `devoluciones_venta`: 0 filas `G1-P07-`;
- `caja_operaciones`: 0 filas `G1-P07-`;
- `arqueos_caja`: 0 filas `G1-P07-`;
- stock final: **23**.

No se modificó producción, `main` ni datos operativos reales.

## 7. Alcance de la prueba de concurrencia

El conector SQL utilizado para QA no ofrece dos sesiones persistentes controlables en paralelo desde una misma llamada. Por ello la revalidación combina:

1. inspección directa de la función viva en QA, confirmando `pg_advisory_xact_lock` por `operationId`;
2. replay real repetido sobre venta, reverso, devolución y Caja;
3. conflictos cruzados y de scope que demuestran que el identificador se trata como recurso global serializado.

No se declara una prueba falsa de dos procesos simultáneos. El mecanismo de serialización activo sí queda comprobado sobre la definición instalada y sus efectos de replay/conflicto.

## 8. Decisión

**G1.7 CONCURRENCIA / REPLAY / IDEMPOTENCIA = PASS**.

No fue necesaria migración nueva en G1.7. El hardening PM08/PM09 sigue vigente después de G1.5 y G1.6.

El gate G1 completo todavía NO se declara superado: sigue pendiente la revalidación directa del hueco LA-004 y el cierre/regresión final del conjunto CRITICAL/HIGH.

**G1_P07_CONCURRENCIA_REPLAY=PASS**  
**G1_ESTADO=PENDIENTE**  
**SIGUIENTE=G1.8_LA004_Y_CIERRE_GATE**
