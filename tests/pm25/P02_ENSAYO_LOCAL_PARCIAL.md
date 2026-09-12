# PM25 P02 — Ensayo local parcial de la migración candidata

## Estado

**EVIDENCIA PARCIAL EJECUTADA. NO CIERRA P02.**

`P02_BLOQUEADO_ENTORNO_AISLADO.md` sigue siendo el documento de estado
vigente: PM25 P02 continúa **bloqueado**, no aprobado, no descartado, no
cerrado. Este documento no lo sustituye ni lo reabre — añade la
evidencia parcial que ese mismo documento previó explícitamente como
posible sin entorno aislado: *"PostgreSQL local sin el resto del stack
puede aportar evidencia parcial (lógica SQL pura: tablas, backfill,
triggers, conflictos) pero no puede cerrar P02"*.

No se creó ninguna *branch* ni proyecto Supabase. No se tocó QA
compartido, producción ni TPV. Todo corrió contra dos bases PostgreSQL
temporales, locales y aisladas, creadas y destruidas por el propio
script.

## 1. Qué se probó (y qué no)

Siguiendo el diseño ya acordado en `P02_BLOQUEADO_ENTORNO_AISLADO.md`,
sección "Diseño del ensayo", punto por punto:

| Paso del diseño | ¿Probado aquí? |
|---|---|
| 1. Esquema en el estado anterior a la migración, en dos réplicas | Sí |
| 2. Fixtures idénticas, huellas coincidentes antes de continuar | Sí |
| 3. Captura "antes" (conteos, colisión esperada) | Sí |
| 4. Aplicar la migración candidata tal cual, sin modificarla | Sí |
| 5. Validar conteo global, libro ganador, permisos, integridad de los 5 libros, disparador de conflicto | Sí |
| 6. Reversión sin `DROP` manual del estado previo; comparación contra el punto de recuperación real | Sí |
| 7. Auth, JWT, PostgREST, RLS con sesiones reales | **No** — requiere el stack completo de Supabase |
| 8. Presupuesto de duración (<5 min) | Sí |
| 9. Pausar/eliminar réplicas | No aplica — son bases locales, se destruyen solas |

El punto 7 es exactamente la parte que el documento de bloqueo señaló
como inalcanzable sin entorno aislado real. Sigue sin probarse, y por
eso P02 sigue sin poder cerrarse.

### 1.1 Limitación adicional de este ensayo (más allá de la ya conocida)

Las 5 tablas de libros (`pagos_factura`, `caja_operaciones`,
`stock_operaciones`, `arqueos_caja`, `arqueos_caja_anulaciones`) se
reprodujeron con el mínimo de columnas necesario para ejercitar la
lógica real de la migración (`id`, `operation_id`) — no con el esquema
completo de QA (columnas de negocio, claves foráneas, RLS de esas
tablas). Es una simplificación adicional, explícita, no una carencia
oculta: todo lo que la migración candidata lee o escribe de esas tablas
está cubierto; lo que no toca, no se reprodujo.

## 2. Fixtures usadas

`tests/pm25/p02-ensayo-local/seed-antiguas-sinteticas.sql` — 8 filas
sintéticas (ningún identificador real) repartidas en los 5 libros, con
el mismo `operation_id` (`OP-DUPLICADO00`) repetido a propósito entre
`pagos_factura` y `caja_operaciones` — el escenario de datos antiguos
exigido explícitamente por el diseño.

## 3. Resultado real (ejecutado, no simulado)

```
PM25_P02_ENTORNO_LOCAL=PASS
PM25_P02_ESQUEMA_ANTERIOR_APLICADO=PASS
PM25_P02_HUELLAS_IDENTICAS_ANTES=PASS
PM25_P02_CAPTURA_ANTES=PASS (global esperado=7)
PM25_P02_MIGRACION_APLICADA_SIN_MODIFICAR=PASS
PM25_P02_CONTEO_GLOBAL=PASS (7)
PM25_P02_LIBRO_GANADOR=pagos_factura
PM25_P02_PERMISOS_REVOCADOS=PASS
PM25_P02_INTEGRIDAD_LIBROS_ORIGINALES=PASS
PM25_P02_DISPARADOR_RECHAZA_COLISION=PASS (hallazgo: rechazada con operation_id_conflict)
PM25_P02_BASE_INTACTA_PUNTO_DE_RECUPERACION=PASS
PM25_P02_REVERSION_COINCIDE_CON_BASE=PASS
PM25_P02_AUTH_JWT_POSTGREST_RLS_PROBADO=NO (fuera de alcance de PostgreSQL local suelto)
PM25_P02_DURACION_SEGUNDOS=1
PM25_P02_PRESUPUESTO_TIEMPO=PASS
PM25_P02_ENSAYO_LOCAL_COMPLETO=PASS (evidencia PARCIAL -- no cierra PM25 P02)
```

Reproducido dos veces seguidas con resultado idéntico.

## 4. Hallazgos

1. **De los dos libros con el `operation_id` repetido, `pagos_factura`
   "ganó" el registro global** — coincide con lo que predecía el orden
   `UNION ALL` de la migración (primer libro en la lista, no un
   comportamiento indefinido observado). `caja_operaciones` quedó sin
   ese registro.
2. **El disparador rechaza correctamente la reutilización del
   `operation_id` perdedor dentro de su propio libro**, con el error
   exacto `operation_id_conflict` — el comportamiento de idempotencia
   funciona como está diseñado, al menos a nivel de lógica SQL pura.
3. **Los 5 libros originales no se modificaron** por la migración — se
   comprobó por huella (conteo + hash agregado por tabla) antes y
   después, no solo por inspección visual.
4. **`revoke all` sobre `private.g1_operation_ids_global` y sobre la
   función `private.g1_claim_operation_id()` es efectivo** —
   `authenticated` no tiene `SELECT` sobre la tabla.
5. Duración del ciclo completo: <1 segundo (muy por debajo del
   presupuesto de 5 minutos, aunque ese presupuesto se pensó para un
   entorno Supabase real con latencia de red, no para PostgreSQL local
   puro — la comparación no es equivalente y se documenta como tal, no
   como validación del presupuesto de producción).

Ningún hallazgo indica un defecto en la migración. La lógica de
backfill, el disparador de conflicto y la reversión se comportan como
el diseño esperaba.

## 5. Qué sigue sin resolver

- Auth/JWT/PostgREST/RLS con sesiones reales — condición explícita de
  cierre de P02, inalcanzable sin el stack completo de Supabase.
- La migración sigue **sin aplicarse** en QA ni en ningún otro entorno
  por este documento.

## 6. Marcadores de cierre

```
PM25_P02_ENSAYO_LOCAL_EJECUTADO=SI
PM25_P02_ENSAYO_LOCAL_ES_CIERRE_DE_P02=NO
PM25_P02_AUTH_JWT_POSTGREST_RLS_PENDIENTE=SI
PM25_P02_QA_PRODUCCION_TPV_TOCADOS=NO
PM25_P02_MIGRACION_APLICADA_EN_QA_O_PRODUCCION=NO
PM25_P02_COSTE_GENERADO=NO
```
