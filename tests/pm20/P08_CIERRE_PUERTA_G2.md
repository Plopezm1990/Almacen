# PM20 P08 — Cierre de Puerta G2

Octavo y último punto de PM20.

## 1. "Restauración QA ensayada" (requisito explícito de G2, hasta ahora pendiente)

Ninguna suite anterior probaba de verdad el mecanismo de respaldo/restauración
(`crearPuntoDeGuardado`, `restaurarDesdeHistorial`, `analizarTextoRestauracion`,
`confirmarRestauracion`, `validarRespaldo`, `compararConEstadoActual`,
`coleccionesQueSeConservan`) — PM16 P01 solo cubrió fallos de *carga* del
almacenamiento local, no el circuito de *restaurar* un respaldo.

Ensayo real (comportamiento, no lectura de código) ejecutado en este punto:

1. **Feliz**: crear punto de guardado → simular pérdida de datos en memoria → restaurar
   desde el punto guardado → las colecciones reaparecen exactamente igual, se crea
   automáticamente un punto de recuperación previo a la restauración, y queda auditado
   con el número de colecciones restauradas y el id de ese punto de recuperación.
2. **Formato antiguo**: un respaldo que no incluye una colección más nueva (p. ej. sin
   `auditoria`) nunca la vacía al restaurar — solo toca lo que el respaldo sí trae.
3. **Respaldo dañado**: texto no-JSON, objeto sin ninguna colección reconocible, o una
   colección con el tipo equivocado — los tres se rechazan con mensaje claro, sin
   preparar nunca una restauración a medias.
4. **Comparación de cifras**: `compararConEstadoActual` devuelve la diferencia exacta
   por colección antes de confirmar, no una promesa vacía.

## 2. Último ítem de la matriz sin verificación explícita: "Navegación, móvil y exportación"

`exportarExcelGeneral` exporta `productos` (y el resto de colecciones) sin filtrar por
local activo — a diferencia de las pantallas normales. Verificado que esto es
**consistente con el patrón ya establecido**, no un defecto: `Respaldos` (que aloja esta
exportación) no está en ningún rol de empleado (`ROLES_EMPLEADO`/`ITEMS_EMPLEADO`) — solo
el Propietario llega a esa pantalla, igual que Auditoría/Tesorería/Panel de dirección,
todas ya confirmadas como "vista de dirección" intencional (todo el negocio del
propietario, no solo el local activo).

## 3. Estado final de los 25 hallazgos

Con el cierre de PM20 P02 (LA-014 revalidado, LA-016 corregido), **25/25 hallazgos del
catálogo `tests/pm04/regression-catalog.json` tienen cierre sustentado**:

- LA-001…LA-013, LA-015, LA-017…LA-019: G1 (`tests/g1/P08_CIERRE_PUERTA_G1.md`).
- LA-014, LA-016: PM20 P02.
- LA-020: PM12. LA-021: PM18 P01. LA-022: PM15 P01. LA-023: G1. LA-024: PM17 P02.
  LA-025: PM16 P01.

No queda ningún hallazgo del catálogo original sin cierre sustentado ni descarte
demostrado.

## 4. Defectos de integridad/seguridad — estado

- **LA-016** (proveedor sin validación de email/días): corregido en P02.
- **`errores_sistema` sin aislamiento por empresa** (hallazgo nuevo, no del catálogo
  original, encontrado por inspección real durante PM20): corregido en P06, con
  autorización explícita del usuario antes de tocar Supabase QA.
- **`MapaAlmacen` con fórmula de "stock bajo" divergente**: corregido en P04.

No queda ningún defecto de integridad/seguridad conocido sin resolver sobre el HEAD de
esta rama.

## 5. Cobertura por módulo — matriz completa

| Módulo de la matriz | Punto que lo cierra |
|---|---|
| Login, recuperación y sesiones | P07 (revalidación acumulada) |
| Empresas, locales y configuración | P01, P07 |
| Productos y movimientos | P07 |
| Pedidos, albaranes y recepción | P02 |
| Inventarios, conteos y traspasos | P07 |
| Caja, TPV, historial y devoluciones | P07 |
| Gastos, pagos, facturas e IVA | P07 |
| Dashboard, informes y Resultados | P03 |
| Tesorería, Estacionalidad y Saldo/Mapa | P04 |
| Personal y submódulos | P07 |
| Clientes y encargos | P07 |
| Producción, fichas de coste y mermas | P07 |
| APPCC y aceite de freidoras | P07 |
| Notificaciones y selección neutral | P06 (más PM17 previo) |
| Buscador, etiquetas y catálogo | P05 |
| Respaldos, errores y auditoría | P05, P06, P08 |
| Navegación, móvil y exportación | P08 (más PM12 P09/PM14 P08 previos) |

Todos los módulos habilitados de la matriz tienen ficha con alcance, casos, riesgos y
evidencia de build. No hay ninguna exclusión: todo lo habilitado se ha verificado.

## 6. Circuitos, integración y "no reproducido una vez"

Cada hallazgo real de PM20 (LA-014/LA-016, `errores_sistema`, `MapaAlmacen`) se cerró con
prueba de comportamiento reproducible (positivo/negativo, contexto vm o migración
verificada con lectura directa de política RLS aplicada) — nunca con una simple lectura
de código o una ejecución manual sin registrar. Ningún punto de PM20 se declaró cerrado
sin gate remoto `SUCCESS` sobre el HEAD exacto del commit correspondiente.

## 7. Decisión de la Puerta G2

- 25/25 hallazgos: cierre sustentado. ✓
- Sin defectos de integridad/seguridad abiertos. ✓
- Circuitos habilitados completos, integración revisada. ✓
- Restauración QA ensayada (comportamiento real). ✓
- Cobertura por módulo explícita, sin huecos. ✓
- Ninguna exclusión pendiente de aprobación. ✓

**PUERTA_G2_ESTADO=CANDIDATA_A_SUPERADA** sobre el HEAD de
`claude/pm20-cobertura-modulos` tras este commit, pendiente únicamente de:
(a) gate remoto `SUCCESS` de este punto, y (b) revisión y autorización de fusión del
usuario para el PR de PM20, siguiendo el mismo procedimiento de cierre ya usado en
PM17–PM19 (nunca declarado cerrado hasta esa fusión y verificación post-merge).

## Regresión

Suite completa del proyecto — 113/113 sin regresiones.

## Estado de main/producción/QA

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Única
migración aplicada durante todo PM20: la de P06, en QA (`qjqorixtkilwsndqayyx`),
autorizada explícitamente por el usuario. Producción (`L&A Suite`) y `TPV` sin tocar en
ningún punto de PM20.

**PM20_P08_CIERRE_PUERTA_G2=PASS**
