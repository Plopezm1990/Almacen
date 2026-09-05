# PM09 · Conciliar ventas y analítica · Evidencia de cierre

Fecha: 2026-09-05

Estado de cierre: **VALIDADO CON LIMITACIONES DOCUMENTADAS**.

## Alcance validado

PM09 concilia la semántica de ventas brutas/activas/anuladas/devueltas/netas, signos económicos, periodos, histórico económico, Historial de ventas, Caja, Libro IVA como proyección interna, Resultados/margen, unidades/rotación, aislamiento multiempresa/multilocal e idempotencia/replay.

- LA-007: VALIDADO.
- LA-008: VALIDADO.
- Venta original y correcciones permanecen trazables; no hay borrado silencioso del hecho histórico.
- Anulación y devolución no se combinan sobre la misma venta.
- Resultados, unidades y rotación aplican signos de VENTA / REVERSO / DEVOLUCION_CLIENTE.
- El precio, IVA y coste históricos no se sustituyen por los valores actuales del producto.
- Caja separa efectivo físico de tarjeta/transferencia/mixto y de las correcciones económicas.
- Libro IVA se mantiene como proyección de control; los casos SIN_REEMBOLSO o sin IVA histórico quedan marcados para revisión y no se presentan como declaración fiscal definitiva.
- "Todos los locales" es consolidación de lectura dentro de la empresa activa; las mutaciones exigen local real y explícito.

## Supabase QA

Proyecto: `L&A Suite QA` (`qjqorixtkilwsndqayyx`).

Migraciones PM09 aplicadas únicamente en QA:

1. `20260905105620 pm09_conciliacion_caja`
2. `20260905115143 pm09_fecha_operacion_economica`
3. `20260905120546 pm09_operation_id_global_hardening`

No se ha aplicado ninguna migración PM09 a producción.

Limpieza final verificada antes de esta evidencia:

- operaciones temporales PM09 de stock: 0
- movimientos temporales PM09: 0
- devoluciones temporales PM09: 0
- movimientos temporales PM09 de caja: 0
- QA-A1: 18 almacén + 5 piso = 23
- QA-A2: 8 almacén + 2 piso = 10
- QA-A-CERRADO: 4 almacén + 0 piso = 4; no operable
- QA-B1: 5 almacén + 2 piso = 7

## Regresión final y artefacto

HEAD funcional validado inmediatamente antes de crear esta evidencia: `5880f5d6ac875f05795e9bfeff50ce9f1dd0e8f7`.

Workflow PM09 Punto 18 sobre el HEAD exacto de la rama: ejecución `33965850078`, resultado **success**.

En esa ejecución quedaron verdes:

- sintaxis de `fuente.js`
- contratos PM09 P17, P16, P15, P12, P11, P10, P09, LA-007 y LA-008
- regresiones heredadas PM05, PM07 y PM08
- contrato de migración PM08 y replay/scope PM08

Artefacto exacto de `fuente.js` validado mediante dos extracciones independientes desde el mismo objeto Git, comparación byte a byte, sintaxis y coincidencia con el working tree:

- SHA-256: `cfe6512d4036c3f31dee6350a3b5ba213ac60f5336178edaf4ac85aaa564182d`
- bytes: `5260374`
- `PM09_ARTIFACT_REPRODUCIBLE_FROM_GIT=1`

### Limitación de reconstrucción desde fuente

No se declara un rebuild fuente→bundle PM09. El script histórico de PM01 `source-recovery/recuperar_candidato.py` exige una marca exacta `// fuente.jsx`, pero el bundle PM09 actual contiene 0 marcas. La instantánea `source-recovery` no se mantuvo alineada con los cambios posteriores de PM09. Por tanto:

- el artefacto Git exacto sí está identificado, es estable y pasa sintaxis/regresiones;
- **no** se afirma que el bundle PM09 pueda regenerarse hoy desde `source-recovery` de forma byte-a-byte;
- esta carencia queda registrada como deuda técnica de trazabilidad de fuente y no se oculta como un build verde inexistente.

## Deploy Preview / visual

PR de validación: **#24**, base `main`, head `pm09-conciliacion-ventas-analitica`, marcada expresamente como NO FUSIONAR.

Deploy Preview observado en verde durante el cierre:

`https://deploy-preview-24--chic-entremet-9107cf.netlify.app`

El sitio mantiene `requiresSSOTeamLogin=true` para no-producción. No se desactiva esta protección. El smoke visual autenticado queda **BLOQUEADO POR PROTECCIÓN SSO DE NETLIFY**, igual que la limitación ya conocida en PM08; un deploy verde no se presenta como sustituto de un smoke visual autenticado.

## Producción

`main` se mantiene fuera del alcance de PM09. Último SHA verificado antes del cierre: `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.

No merge. No migraciones de producción. No publicación de producción. No cambio de configuración de seguridad de Netlify.

## Criterio de cierre

PM09 se considera **cerrado con limitaciones documentadas**: los contratos funcionales/económicos, QA, aislamiento, replay y Deploy Preview quedan validados; permanecen abiertas únicamente las limitaciones no ocultas de smoke visual autenticado y reconstrucción fuente→bundle. La PR #24 debe cerrarse sin merge después de verificar que el Deploy Preview y el workflow de cierre correspondan al HEAD final de evidencia.
