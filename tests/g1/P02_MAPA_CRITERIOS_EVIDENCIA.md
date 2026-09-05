# G1 · Núcleo seguro · Punto 2 — inventario de criterios y mapa de evidencia

Fecha: 2026-09-05
Rama: `g1-nucleo-seguro`
Base funcional heredada: PM10 final `94d37cc7a5176e3a44d00f8f8bfb79a630dae314`

## 1. Regla de este inventario

Este documento NO declara G1 superado. Solo identifica qué evidencia histórica existe en el HEAD heredado y qué debe volver a demostrarse en G1. Un cierre histórico no sustituye una revalidación del gate cuando G1 la exige expresamente.

Criterios del gate congelados en P01:

1. 0 hallazgos CRÍTICOS o ALTOS abiertos de Fase 1.
2. Revalidación específica de LA-019.
3. Revalidación específica de LA-023.
4. Permisos y aislamiento coherentes.
5. Cifras/conciliaciones coherentes.
6. Concurrencia/replay cuando aplique.
7. Evidencia identificada por build/commit.

## 2. Fuente de verdad del inventario de hallazgos

`tests/pm04/regression-catalog.json` conserva LA-001…LA-025 y asigna paquete, severidad, fixture y esperado. Para el criterio G1 de severidad, los CRÍTICOS/ALTOS de Fase 1 que ya debieron quedar tratados antes de este gate son:

- CRÍTICOS: LA-001, LA-002, LA-003, LA-004, LA-005, LA-006, LA-007.
- ALTOS: LA-008, LA-009, LA-010, LA-011, LA-012, LA-013, LA-015, LA-017, LA-018.

Total a demostrar sin regresión para G1: **16 hallazgos CRÍTICOS/ALTOS**.

LA-019 es MEDIO y LA-023 es BAJO en el catálogo, pero G1 exige revalidarlos de forma específica además del criterio de severidad.

## 3. Mapa de los 16 CRÍTICOS/ALTOS

| Hallazgo | Sev. | Paquete | Evidencia histórica localizada | Estado para G1 P02 |
|---|---|---|---|---|
| LA-001 Proveedores | CRÍTICO | PM05 | `docs/plan-maestro/PM05_EVIDENCIA.md`, `tests/pm05/backend-results.json`, `tests/pm05/frontend-contract.mjs` | Evidencia histórica fuerte; REVALIDAR en gate |
| LA-002 Clientes | CRÍTICO | PM05 | mismos artefactos PM05 | Evidencia histórica fuerte; REVALIDAR en gate |
| LA-003 Auditoría | CRÍTICO | PM05 | mismos artefactos PM05 | Evidencia histórica fuerte; REVALIDAR en gate |
| LA-004 Factura/identidad financiera | CRÍTICO | PM06 | workflow `.github/workflows/pm06-aplicar-identidad-financiera.yml`; PM07 declara base exacta `PM-06 cerrado 972d1f022659eac21d223929e08805d537872125` | **HUECO DE EVIDENCIA**: no hay documento/test PM06 independiente en el árbol heredado; debe revalidarse directamente antes de aprobar G1 |
| LA-005 Stock/venta/reverso | CRÍTICO | PM07 | `docs/plan-maestro/PM07_EVIDENCIA.md`, `tests/pm07/frontend-contract.mjs`, migraciones PM07 | Evidencia histórica fuerte; REVALIDAR, especialmente concurrencia |
| LA-006 Traslados stock | CRÍTICO | PM07 | mismos artefactos PM07 | Evidencia histórica fuerte; REVALIDAR |
| LA-007 Ventas/resultados | CRÍTICO | PM09 | `docs/plan-maestro/PM09_EVIDENCIA.md`, `tests/pm09/LA007_RESULTADOS_EVIDENCIA.json`, contrato LA007 | Evidencia histórica fuerte; REVALIDAR cifras |
| LA-008 Unidades/rotación/margen | ALTO | PM09 | `PM09_EVIDENCIA.md`, `LA008_ROTACION_MARGEN_EVIDENCIA.json`, contrato LA008 | Evidencia histórica fuerte; REVALIDAR cifras |
| LA-009 Arqueos | ALTO | PM08 | `docs/plan-maestro/PM08_EVIDENCIA.md`, contratos PM08 | Evidencia histórica fuerte; REVALIDAR |
| LA-010 Entrada/Retirada | ALTO | PM08 | mismos artefactos PM08 | Evidencia histórica fuerte; REVALIDAR caja/signos |
| LA-011 Productos | ALTO | PM10 | `docs/plan-maestro/PM10_EVIDENCIA.md`, `P04_LA011_PRODUCTOS_EVIDENCIA.md`, contrato P04 | Evidencia histórica fuerte; REVALIDAR |
| LA-012 Pedidos | ALTO | PM10 | `PM10_EVIDENCIA.md`, `P05_PEDIDOS_EVIDENCIA.json`, contrato P05 | Evidencia histórica fuerte; REVALIDAR |
| LA-013 Recepción | ALTO | PM10 | `PM10_EVIDENCIA.md`, `P06_RECEPCION_EVIDENCIA.json`, contrato P06 | Evidencia histórica fuerte; REVALIDAR atomicidad/replay |
| LA-015 Stock mínimo | ALTO | PM07 | `PM07_EVIDENCIA.md`, contrato PM07 | Evidencia histórica fuerte; REVALIDAR |
| LA-017 Personal | ALTO | PM10 | `PM10_EVIDENCIA.md`, `P07_PERSONAL_EVIDENCIA.json`, contrato P07 | Evidencia histórica fuerte; REVALIDAR |
| LA-018 Encargos | ALTO | PM10 | `PM10_EVIDENCIA.md`, `P08_ENCARGOS_EVIDENCIA.json`, contrato P08 | Evidencia histórica fuerte; REVALIDAR |

Conclusión P02 de severidad: **15/16 tienen evidencia de cierre histórica directa/localizada; LA-004 tiene cadena histórica de cierre pero no un artefacto de evidencia autónomo equivalente a los demás en el árbol actual. Por tanto G1 todavía NO puede afirmar 0 críticos/altos abiertos sin una prueba actual de LA-004 y regresión actual de los otros 15.**

## 4. LA-019 y LA-023, controles específicos de G1

### LA-019 · Devolución con reembolso inválido

Catálogo PM04:
- paquete asignado: PM08;
- severidad: MEDIO;
- fixture: devolución con reembolso -5;
- esperado: reembolso negativo rechaza toda la operación; cantidad/reembolso no superan pendiente; no hay mitad persistida.

PM08 documenta devolución de cliente indivisible, límite acumulado, rechazo de negativos, idempotencia y aislamiento. Existe evidencia histórica suficiente para saber dónde probar, pero G1 exige una **revalidación específica nueva**. Estado P02: **PENDIENTE P03**.

### LA-023 · Texto honesto local/nube

`docs/plan-maestro/PM02_LA023_EVIDENCIA.txt` conserva `PM02_LA023_OK=1`, `MODO_LOCAL_TEXTO_HONESTO=1` y `MODO_NUBE_SIN_PROMESA_DE_CONFIRMACION=1`. DEC-03 refuerza que la interfaz no puede afirmar sincronización/nube antes de confirmación real del backend.

Existe evidencia histórica, pero G1 exige **revalidación específica nueva**. Estado P02: **PENDIENTE P04**.

## 5. Permisos y aislamiento

Evidencias existentes:

- PM03/DEC-01 fija empresa/local, `Todos los locales` solo lectura y local inactivo sin nuevas operaciones.
- PM04 monta fixtures A1/A2/A-cerrado/B1 y cinco identidades QA.
- PM05 transforma los cinco negativos de autorización del baseline en 18/18 PASS en QA para su alcance.
- PM07 prueba roles, empresa/local, usuario inactivo y local cerrado en stock.
- PM08 prueba aislamiento de caja/devoluciones y rutas de replay.
- PM09 revalida aislamiento de contexto y `Todos los locales` solo lectura.
- PM10 revalida A1/A2/B1/Todos/local inactivo en los dominios de altas.

Estado P02: **COBERTURA HISTÓRICA AMPLIA, NO AÚN APROBADA POR G1**. Debe probarse sobre el HEAD G1 actual en el punto de permisos/aislamiento.

## 6. Cifras y conciliaciones

Evidencias existentes:

- PM04 fija fixture económico 2×6=12 €, IVA 10 %, base 10,91 €, IVA 1,09 €, coste 6 € y saldos stock A1/A2/B1.
- PM07 valida stock por ubicación, reversos y traslados con neto exacto.
- PM08 valida libro de caja, arqueos, entradas/retiradas/reembolsos y devoluciones indivisibles.
- PM09 concilia ventas, anulaciones, devoluciones, Caja, IVA interno, Resultados, margen, unidades y rotación.
- PM10 conserva `cantidadRecibida`, limita sobre-recepción y valida integridad de altas.

Estado P02: **COBERTURA HISTÓRICA SUFICIENTE PARA DISEÑAR LA PRUEBA G1, PERO NO CERRADA EN EL HEAD ACTUAL**.

## 7. Concurrencia, replay y reintento

Evidencias existentes:

- DEC-03 exige `operationId` estable, backend autoritativo y mismo ID tras timeout.
- PM07: `SELECT ... FOR UPDATE`, replay idempotente, conflicto de payload y prueba determinista de última unidad. Limitación histórica: no se hizo stress real con dos sesiones cliente simultáneas.
- PM08: doble pulsación/reintento/respuesta incierta, replay y alcance endurecido.
- PM09: hardening global de `operationId` y regresión de robustez.
- PM10: identidad estable de recepción y guardas contra doble submit.

Estado P02: **HISTÓRICAMENTE CUBIERTO CON LIMITACIÓN DE CONCURRENCIA REAL; debe revalidarse en G1 y no puede darse por aprobado desde este inventario.**

## 8. Evidencia por build/commit

### PM01

`source-recovery/PM01_CIERRE.md` demuestra que en PM01 existía una fuente recuperada con paridad exacta y build determinista (`PM01_BUILD_REPRODUCIBLE=1`) para el candidato de aquel momento.

### Estado posterior

PM09 documenta que el mecanismo histórico `source-recovery/recuperar_candidato.py` dejó de estar alineado con el bundle posterior porque esperaba `// fuente.jsx` y el bundle ya no contiene ese marcador. PM09 y PM10, por tanto, no afirman falsamente rebuild source→bundle: usan artefacto Git exacto, SHA, sintaxis y contratos.

Estado P02: **el requisito G1 de evidencia por build/commit todavía está PENDIENTE**. La evidencia histórica de PM01 no basta para declarar reproducibilidad source→bundle del HEAD G1 actual. G1 deberá definir y ejecutar la evidencia válida sobre un único SHA sin ocultar esta deuda.

## 9. Inventario por paquete PM01–PM10

- PM01: cierre y evidencia de fuente recuperada presentes; mecanismo histórico de rebuild actualmente desalineado.
- PM02: aislamiento QA/LA-023 y evidencias presentes.
- PM03: DEC-01…DEC-05 aprobados y presentes.
- PM04: fixtures, catálogo LA-001…LA-025, baseline y contratos presentes.
- PM05: evidencia y pruebas de aislamiento presentes.
- PM06: workflow de identidad financiera presente y PM07 referencia su SHA de cierre; **falta artefacto independiente de cierre/test PM06 en el árbol actual**.
- PM07: evidencia, contrato y migraciones presentes.
- PM08: evidencia, contratos y migraciones presentes.
- PM09: evidencia y contratos/evidencias detalladas presentes.
- PM10: evidencia final, contratos P04–P13 y evidencias P02–P15 presentes.

## 10. Decisión del Punto 2

P02 queda CERRADO como inventario, no como aprobación del gate.

Estado de entrada a los siguientes puntos:

- LA-019: pendiente de revalidación específica.
- LA-023: pendiente de revalidación específica.
- LA-004: requiere prueba actual por hueco de evidencia autónoma PM06.
- Otros 15 CRÍTICOS/ALTOS: cierre histórico localizado, pendiente de regresión G1 actual.
- Permisos/aislamiento: pendiente de prueba G1 actual.
- Cifras: pendiente de prueba G1 actual.
- Concurrencia/replay: pendiente de prueba G1 actual.
- Build/commit: pendiente de evidencia G1 actual.

**G1_ESTADO=PENDIENTE**
**G1_P02_INVENTARIO=CERRADO**
