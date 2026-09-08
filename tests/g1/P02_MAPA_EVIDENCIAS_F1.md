# G1 · Punto 2 — Inventario de criterios de salida y mapa de evidencias F1

Fecha: 2026-09-05
Rama: `g1-nucleo-seguro`
Base funcional heredada: PM10 final `94d37cc7a5176e3a44d00f8f8bfb79a630dae314`
Estado de este punto: **INVENTARIO VERIFICABLE — NO CERTIFICA G1**

## 1. Criterio exacto de la puerta G1

La puerta G1 exige, antes de avanzar a Fase 2:

1. **0 críticos/altos documentados abiertos** dentro del alcance F1.
2. **LA-019 y LA-023 validados**.
3. **Permisos del núcleo** probados con usuarios reales de QA.
4. **Movimientos y cifras conciliados**.
5. **Concurrencia/reintento del núcleo** aprobados.
6. **Evidencia por build / candidato exacto**.
7. **Backend QA disponible y separado**.
8. **Ninguna interacción productiva** durante la validación del gate.

Este documento solo inventaría y enlaza evidencia existente. Cada criterio que depende del candidato G1 debe volver a validarse sobre el SHA G1 correspondiente antes de aprobar la puerta.

## 2. Mapa de los 16 hallazgos CRÍTICOS/ALTOS de Fase 1

La auditoría de origen tenía 7 CRÍTICOS y 9 ALTOS. El mapa de cierre documental acumulado queda así:

| ID | Sev. | Dominio | Paquete que lo cerró | Evidencia viva en la rama G1 | Estado para G1 P02 |
|---|---|---|---|---|---|
| LA-001 | CRÍTICO | Proveedores | PM05 | `docs/plan-maestro/PM05_EVIDENCIA.md` + `tests/pm05/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-002 | CRÍTICO | Clientes | PM05 | `docs/plan-maestro/PM05_EVIDENCIA.md` + `tests/pm05/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-003 | CRÍTICO | Auditoría | PM05 | `docs/plan-maestro/PM05_EVIDENCIA.md` + `tests/pm05/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-004 | CRÍTICO | Factura/pago/gasto | PM06 | `.github/workflows/pm06-aplicar-identidad-financiera.yml`; PM07 declara como base PM06 cerrado `972d1f022659eac21d223929e08805d537872125` | Cierre transmitido, pero evidencia autocontenida menor; cubrir expresamente en G1 |
| LA-005 | CRÍTICO | TPV/stock/anulación | PM07 | `docs/plan-maestro/PM07_EVIDENCIA.md` + `tests/pm07/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-006 | CRÍTICO | Traslado/Kardex | PM07 | `docs/plan-maestro/PM07_EVIDENCIA.md` + `tests/pm07/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-007 | CRÍTICO | Resultados/ventas | PM09 | `docs/plan-maestro/PM09_EVIDENCIA.md` + `tests/pm09/` | Cerrado históricamente; revalidar cifras en G1 |
| LA-008 | ALTO | Reportes/rotación | PM09 | `docs/plan-maestro/PM09_EVIDENCIA.md` + `tests/pm09/` | Cerrado históricamente; revalidar cifras en G1 |
| LA-009 | ALTO | Arqueo | PM08 | `docs/plan-maestro/PM08_EVIDENCIA.md` + `tests/pm08/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-010 | ALTO | Entrada/Retirada | PM08 | `docs/plan-maestro/PM08_EVIDENCIA.md` + `tests/pm08/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-011 | ALTO | Productos | PM10 | `docs/plan-maestro/PM10_EVIDENCIA.md` + `tests/pm10/P04_LA011_PRODUCTOS_EVIDENCIA.md` | Cerrado históricamente; revalidar regresión G1 |
| LA-012 | ALTO | Pedidos | PM10 | `docs/plan-maestro/PM10_EVIDENCIA.md` + `tests/pm10/P05_PEDIDOS_EVIDENCIA.json` | Cerrado históricamente; revalidar regresión G1 |
| LA-013 | ALTO | Recepción | PM10 | `docs/plan-maestro/PM10_EVIDENCIA.md` + `tests/pm10/P06_RECEPCION_EVIDENCIA.json` | Cerrado históricamente; revalidar regresión G1 |
| LA-015 | ALTO | Stock mínimo | PM07 | `docs/plan-maestro/PM07_EVIDENCIA.md` + `tests/pm07/` | Cerrado históricamente; revalidar núcleo en G1 |
| LA-017 | ALTO | Personal | PM10 | `docs/plan-maestro/PM10_EVIDENCIA.md` + `tests/pm10/P07_PERSONAL_EVIDENCIA.json` | Cerrado históricamente; revalidar regresión G1 |
| LA-018 | ALTO | Encargos | PM10 | `docs/plan-maestro/PM10_EVIDENCIA.md` + `tests/pm10/P08_ENCARGOS_EVIDENCIA.json` | Cerrado históricamente; revalidar regresión G1 |

**Cobertura documental:** 16/16 CRÍTICOS/ALTOS tienen un paquete de cierre asignado. Esto no equivale todavía a demostrar 0 abiertos sobre el HEAD G1; esa conclusión requiere las revalidaciones del gate.

## 3. Hallazgos expresamente exigidos por G1

### LA-019 · Devolución/reembolso indivisible

PM08 documenta operación transaccional de devolución, stock y caja, límite acumulado, idempotencia, replay y aislamiento. Evidencia: `docs/plan-maestro/PM08_EVIDENCIA.md`, `tests/pm08/frontend-contract.mjs`, `tests/pm08/migration-contract.mjs`, `tests/pm08/replay-scope-contract.mjs`.

**P02:** evidencia histórica suficiente para localizar el cierre; **pendiente revalidación específica sobre G1 en P03**.

### LA-023 · Destino/estado de guardado honesto

PM02 documenta backend QA separado y corrige el mensaje de guardado: local no promete sincronización y nube no presenta la escritura como confirmada antes de saberlo. Evidencia: `docs/plan-maestro/PM-02-aislamiento-qa-2026-09-04.md`, `docs/plan-maestro/PM02_LA023_EVIDENCIA.txt`.

**P02:** evidencia histórica suficiente para localizar el cierre; **pendiente revalidación específica sobre G1 en P04**.

## 4. Criterios transversales de G1 y evidencia existente

### Permisos del núcleo

Base QA real: PM04 creó cinco identidades Auth QA (`owner A`, `operator A1`, `operator A2`, `owner B`, `inactive`) y los contextos A1/A2/A-CERRADO/B1. PM05 convirtió los cinco negativos del baseline en verde con pruebas backend y RLS para el alcance modificado. PM07/08/09/10 ampliaron el aislamiento en stock, caja, analítica y validaciones.

**Pendiente G1 P05:** ejecutar la matriz mínima del núcleo sobre el candidato G1 actual. La matriz exhaustiva NR-02 de todos los módulos sigue correctamente diferida a PM21; G1 no debe fingir que PM21 ya está hecho.

### Movimientos y cifras

- PM07: stock por ubicación, saldo total, venta/reverso y traslados netos.
- PM08: Caja, arqueos, devoluciones y efectos físicos/económicos indivisibles.
- PM09: Historial, Caja, IVA, Resultados, margen, rotación, signos y periodos.
- PM10: recepción acumulada y validación antes de persistir.

**Pendiente G1 P06:** ejecutar un escenario común de conciliación sobre el mismo SHA G1 y comprobar que los consumidores cruzados siguen dando los mismos números.

### Concurrencia / reintento

- PM07: `operation_id`, replay/conflicto y bloqueo `SELECT ... FOR UPDATE`; limitación explícita: no hubo stress real desde dos sesiones cliente simultáneas.
- PM08: doble pulsación, concurrencia, reintento y replay probados en QA.
- PM09: `operationId` global, replay/timeout/robustez y aislamiento.
- PM10 P11: doble submit y recepción con identidad estable/replay.

**Pendiente G1 P07:** revalidar reintento/concurrencia del núcleo sobre G1 y tratar expresamente la limitación PM07 sin sobreafirmar stress que no se haya ejecutado.

### Evidencia por build / SHA exacto

PM01 demostró reconstrucción determinista sobre su candidato histórico. PM09 y PM10 documentaron el artefacto Git exacto y regresiones sobre SHA identificado. Sin embargo, la ruta histórica `source-recovery` quedó desalineada con cambios posteriores; PM09/PM10 no afirmaron falsamente un rebuild fuente→bundle actual.

**Pendiente G1 P08:** generar evidencia del candidato G1 exacto (regresiones + artefacto/hash + Deploy Preview/commit servido) y resolver/documentar correctamente la deuda del build histórico. La puerta no se aprueba usando únicamente un build de PM01.

### Backend QA separado

PM02 identifica `L&A Suite QA` (`qjqorixtkilwsndqayyx`) como backend remoto separado, con Auth/Storage propios y barrera frente al host productivo. PM04–PM09 lo usaron para pruebas reales.

**Pendiente antes del cierre G1:** comprobar que el backend QA sigue disponible y que ninguna prueba de G1 ha tocado producción.

### Ninguna interacción productiva

Todos los paquetes F1 documentan trabajo en ramas/QA y no merge. `main` debe volver a comprobarse al cerrar G1.

**P02:** no se realiza ninguna operación de producción ni escritura de datos; este punto es documental/estático.

## 5. Brechas de evidencia detectadas en el inventario

1. **LA-004 / PM06:** el repo actual conserva el workflow de aplicación PM06 y PM07 identifica su SHA de cierre como base, pero no existe `docs/plan-maestro/PM06_EVIDENCIA.md` ni `tests/pm06/` autocontenidos. Esto es una brecha de empaquetado de evidencia, no demostración de que LA-004 haya regresado. G1 debe cubrir LA-004 de forma explícita en permisos/cifras/regresión.
2. **Build actual:** PM01 fue reproducible sobre un candidato histórico, pero el mecanismo `source-recovery` no está alineado con el bundle actual. G1 necesita evidencia del artefacto actual, no una afirmación heredada.
3. **Concurrencia PM07:** hay bloqueo transaccional y pruebas deterministas, pero el propio cierre PM07 declara que no ejecutó stress real desde dos clientes. G1 debe probar lo exigible al núcleo y dejar PM23 como ampliación, sin confundir ambas coberturas.
4. **Smoke autenticado non-production:** PM08–PM10 documentan bloqueo por SSO de Netlify. Un Deploy Preview verde no equivale a smoke autenticado. No se relajará SSO en G1 sin autorización específica.

## 6. Decisión del Punto 2

- Mapa de CRÍTICOS/ALTOS F1: **16/16 localizados y asociados a evidencia/paquete**.
- LA-019: **localizado; pendiente revalidación G1 P03**.
- LA-023: **localizado; pendiente revalidación G1 P04**.
- Permisos del núcleo: **evidencia previa disponible; pendiente G1 P05**.
- Cifras/movimientos: **evidencia previa disponible; pendiente G1 P06**.
- Concurrencia/reintento: **evidencia previa disponible con limitación conocida; pendiente G1 P07**.
- Build/artefacto/Preview del candidato G1: **pendiente G1 P08**.
- Cierre 0 CRÍTICOS/ALTOS y producción intacta: **pendiente G1 P09**.

**G1 NO ESTÁ SUPERADA EN P02.** El inventario permite continuar de forma ordenada, empezando por LA-019.
