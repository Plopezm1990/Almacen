# PM20 P01 — Checkpoint e inventario real de módulos, evidencias y huecos

Fecha: 2026-09-08
Rama: `claude/pm20-cobertura-modulos`

## Base autoritativa

- Paquete anterior: PM19 · Módulos operativos restantes (P01-P05).
- HEAD remoto final PM19 verificado antes de crear la rama: `bdf25591a1e986a04223b399d11d8fe81d41d82d` (PR #35, squash-merge sobre `main`).
- Identidad de árbol confirmada tras el merge: `git rev-parse origin/main^{tree}` = `git rev-parse d3b1476...^{tree}` = `0a6c6e412d80c3612b8e2c3ea6f31e0e51ef118b`.
- Rama PM20 creada desde `main` en ese HEAD exacto.

## Alcance de PM20 según Plan Maestro

"Cerrar cobertura funcional por módulo": verificar Dashboard, Tesorería, Estacionalidad, Saldo/Mapa, buscador, configuración, etiquetas y demás módulos de la matriz; ejecutar pruebas de extremo a extremo y de no regresión de los paquetes anteriores. Entrega verificable: ficha por módulo con alcance, casos, riesgos y build. NR-07 vinculado (F2 PM-19/20). MEJ-09 aplica transversalmente (regresión automática incremental, fixtures, identificación de build).

No se reabren paquetes cerrados salvo defecto reproducible. Este punto es solo checkpoint + inventario: no declara ningún módulo cerrado.

## 1. Estado real de los 25 hallazgos (`tests/pm04/regression-catalog.json`)

| Hallazgo | Sev. | Paquete catálogo | Estado real verificado |
|---|---|---|---|
| LA-001..003 | CRÍTICO | PM05 | Cerrado — G1 (`tests/g1/P08_CIERRE_PUERTA_G1.md`, 16/16 CRIT/ALTO) |
| LA-004 | CRÍTICO | PM06 | Cerrado — G1 revalidado directo (20/20 PASS) |
| LA-005,006 | CRÍTICO | PM07 | Cerrado — G1 |
| LA-007,008 | CRÍTICO/ALTO | PM09 | Cerrado — G1 |
| LA-009,010 | ALTO | PM08 | Cerrado — G1 |
| LA-011,012,013 | ALTO | PM10 | Cerrado — G1 |
| **LA-014** | MEDIO | PM11 | **Sin ficha propia.** Código ya presente y correcto (`fechaValidaPedidoPM10`, `validarPedidoPM10`, edición sin conversión a `Date` en el circuito de guardado) — confirmado por inspección real en P02 de este paquete. Pendiente solo de **prueba de revalidación**, sin cambio de código. |
| LA-015 | ALTO | PM07 | Cerrado — G1 |
| **LA-016** | MEDIO | PM11 | **Defecto real confirmado por inspección**: `crearLogicaProveedores` (`addProveedor`/`updateProveedor`) no valida formato de email ni rechaza días negativos en `leadTime`/`diasPago`. Los campos del formulario son `type="email"`/`type="number"` sin `required` ni `min`, y el JS de envío (`submit`/`submitEdit`) no comprueba nada más que el nombre. **Pendiente de corrección real en P02.** |
| LA-017,018 | ALTO | PM10 | Cerrado — G1 |
| LA-019 | MEDIO | PM08 | Cerrado — G1 revalidado directo |
| LA-020 | MEDIO | PM12 | Cerrado — PM12 (estados canónicos de conteo) |
| LA-021 | MEDIO | PM18 | Cerrado — PM18 P01 (identidad fiscal; habilitación de facturación sigue bloqueada, alcance aprobado) |
| LA-022 | BAJO | PM15 | Cerrado — PM15 P01 |
| LA-023 | BAJO | PM02 | Cerrado — G1 revalidado directo |
| LA-024 | BAJO | PM17 | Cerrado — PM17 P02 |
| LA-025 | BAJO | PM16 | Cerrado — PM16 P01 |

**Conclusión: 23/25 hallazgos con cierre sustentado. LA-014 necesita solo revalidación (código ya correcto). LA-016 tiene un defecto real pendiente de corrección.** Ninguno de los dos es un hallazgo nuevo: ambos ya estaban en el catálogo PM04 desde el origen de la sesión, asignados a PM11, paquete que nunca llegó a producir una ficha propia con ese nombre (el histórico usa `tests/pm11-compra/`, cuyo alcance real fue pedidos/recepción/albaranes/facturas/pagos — no proveedores).

## 2. Matriz de módulos del Plan Maestro — cobertura real

| Módulo (matriz PM20) | Cobertura histórica (PM/G1) | Módulos de pantalla en `fuente.js` sin ficha propia | Estado |
|---|---|---|---|
| Login, recuperación y sesiones | PM03 (DEC-01..05), G1 permisos/aislamiento | — | Revalidar (acumulada) |
| Empresas, locales y configuración | PM03, PM10, PM19 P05 (`validarContextoEscrituraPM10`) | `GestorEmpresas`/`FichaEmpresaBasica` (PM18) | Revalidar (acumulada) |
| Productos y movimientos | PM07, PM10, PM19 | — | Revalidar (acumulada) |
| Pedidos, albaranes y recepción | PM10, PM11-compra | `Proveedores` (LA-016) | **P02: corregir + revalidar** |
| Inventarios, conteos y traspasos | PM12, PM19 P03/P05 | — | Revalidar (acumulada) |
| Caja, TPV, historial y devoluciones | PM08 | `VentaRapida` (TPV rápido) | Revalidar + ficha TPV |
| Gastos, pagos, facturas e IVA | PM06 (G1 LA-004), PM11-compra P05/P06 | `LibroIva` | Revalidar (acumulada) |
| Dashboard, informes y Resultados | PM09 (cifras/Resultados) | `Dashboard` (pantalla, nunca probada como componente propio) | **Sin ficha — pendiente** |
| Tesorería, Estacionalidad y Saldo/Mapa | Ninguna | `Tesoreria`, `Estacionalidad`, `SaldoAlmacen`, `MapaAlmacen` | **Sin ficha — pendiente** |
| Personal y submódulos | PM13 | — | Revalidar (acumulada) |
| Clientes y encargos | PM14 | — | Revalidar (acumulada) |
| Producción, fichas de coste y mermas | PM19 P01/P04/P05 | — | Revalidar (acumulada) |
| APPCC y aceite de freidoras | PM19 P01/P02/P05 | — | Revalidar (acumulada) |
| Notificaciones y selección neutral | PM17 P01 (push)/P02 (neutralidad) | `Notificaciones` (pantalla completa: permisos/contenido/eventos) | **Parcial — pendiente ampliar** |
| Buscador, etiquetas y catálogo | Ninguna | `BusquedaGlobal`, `EtiquetasCatalogo` | **Sin ficha — pendiente** |
| Respaldos, errores y auditoría | PM16 P01 (fallos de carga) | `Respaldos` (pantalla), `Auditoria` (pantalla), `ErroresSistema` | **Parcial — pendiente ampliar** |
| Navegación, móvil y exportación | PM12 P09, PM14 P08 (historial/informes móvil) | Exportaciones (`exportarExcelGeneral` y afines) | **Parcial — pendiente ampliar** |

## 3. Verificación real ya realizada en este checkpoint (sin cambios de código)

Por inspección directa de `fuente.js` (no asumida):

- `BusquedaGlobal` recibe `productos`/`empleados` ya filtrados por local activo (`productosDelLocalActivo`, `empleadosDelLocalActivo`) y `proveedores`/`clientes`/`fichasCosto` sin filtrar por local — consistente con el modelo ya establecido en `crearLogicaProveedores`/`crearLogicaClientes`, donde proveedores y clientes son entidades de ámbito empresa (compartidas entre locales), no de ámbito local. No es una inconsistencia nueva: es el mismo criterio que ya usan `addProducto`/`addProveedor`.
- `SaldoAlmacen` recibe `productos` filtrados por local pero `proveedores` sin filtrar — mismo criterio.
- `Auditoria` recibe el array `auditoria` completo tal cual se carga desde el estado — su aislamiento por empresa depende de la carga de datos (RLS/consulta), ya cerrado como LA-003 en PM05/G1; no se ha probado hasta ahora el **componente de pantalla** en sí (filtros, orden, formato).
- `crearLogicaProveedores.addProveedor`/`updateProveedor` no llaman a `validarContextoEscrituraPM10` — confirmado intencional (proveedores son de ámbito empresa, no de local), no es el defecto NR-07/"Todos" que se corrigió en PM19 P05 (ese aplicaba a entidades de local). El único defecto real encontrado en este módulo es la ausencia de validación de formato/rango (LA-016).

## 4. Plan de puntos de PM20

- **P01** (este punto): checkpoint + inventario. Sin cambios de código.
- **P02**: Compra — corrige LA-016 (validación de proveedor: email y días) y revalida LA-014 (fecha esperada de pedido) con prueba de comportamiento real.
- **P03**: Dashboard, informes y Resultados — ficha con verificación de fórmulas/filtros contra datos fuente.
- **P04**: Tesorería, Estacionalidad y Saldo/Mapa — ficha con verificación de métricas contra fixture conocido.
- **P05**: Buscador, etiquetas/catálogo y Auditoría — ficha centrada en aislamiento de contexto (nada de otro local inactivo/empresa no autorizada sale en resultados).
- **P06**: Notificaciones, Respaldos, errores y exportación/navegación móvil — ampliación de lo ya cerrado en PM16/PM17 a nivel de pantalla completa.
- **P07**: Revalidación acumulada de los módulos con cobertura histórica fuerte (Login/sesiones, Empresas/locales, Productos/movimientos, Inventarios/conteos/traspasos, Caja/TPV/devoluciones, Gastos/pagos/IVA, Personal, Clientes/encargos, Producción/fichas/mermas, APPCC/aceite) — fichas de regresión, sin tocar código salvo defecto reproducible.
- **P08**: Cierre Puerta G2 — consolidación de fichas, verificación de los 25 hallazgos y de los criterios de la puerta.

## 5. Estado de main/producción

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Sin migraciones ni cambios en `supabase/` en este punto.

**PM20_P01_CHECKPOINT_INVENTARIO=PASS**
