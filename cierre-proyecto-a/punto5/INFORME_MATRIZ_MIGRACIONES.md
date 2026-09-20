# Punto 5 — Matriz de procedencia de migraciones

## Alcance y límites

Auditoría de metadatos realizada el 20/09/2026 contra:

- Repositorio: `release@21ee66bdb52e4d5ad0af2341543f53720a4cf027`
- PROD: `flqercbgpgmmfaakrwkc`
- QA: `qjqorixtkilwsndqayyx`

Se consultaron archivos de migración, historial registrado y catálogos de
funciones, tablas, permisos efectivos, RLS, políticas, vistas y triggers.
No se leyeron filas de negocio ni datos de Auth. No se ejecutaron DDL, DML,
`apply_migration`, `db push` ni `migration repair`.

## Inventario

| Fuente | Cantidad |
|---|---:|
| Archivos SQL en `supabase/migrations/` de release | 34 |
| Registros de migración en PROD | 37 |
| Registros de migración en QA | 62 |

| Clasificación | Cantidad |
|---|---:|
| Repo↔PROD exacta: versión y nombre | 1 |
| Repo↔QA exacta: versión y nombre | 16 |
| Mismo nombre, versión diferente: PROD | 7 |
| Mismo nombre, versión diferente: QA | 10 |
| Solo PROD, sin nombre ni versión local | 29 |
| Solo QA, sin nombre ni versión local | 36 |

La única coincidencia exacta repo↔PROD es PM33:
`20260919225831_pm33_p05_identidad_antes_de_actividad`.

El nombre `p2_r02_revocar_exec_rpcs_legacy` figura en PROD como
`20260916035012`, pero no tiene archivo ni versión homónima en release.
Permanece no resuelto. No se deduce que deba copiarse a release, ni que deba
alterarse el historial remoto.

## Estado efectivo de objetos

| Tipo | Compartidos | Iguales | Distintos | Solo PROD | Solo QA |
|---|---:|---:|---:|---:|---:|
| Funciones (firma, definición, propietario, EXECUTE) | 38 | 8 | 30 | 14 | 54 |
| Tablas (RLS, propietario y privilegios efectivos) | 26 | 16 | 10 | 1 | 7 |
| Políticas RLS | 22 | 22 | 0 | 27 | 25 |
| Vistas | 1 | 1 | 0 | 0 | 0 |
| Triggers | 8 | 8 | 0 | 4 | 8 |

La diferencia de funciones es significativa y ya visible en
`obtener_contexto_operativo`: PROD tiene firma
`p_local_id text` y QA conserva la sobrecarga de cero argumentos. Esto es
coherente con la decisión previa de no tratar QA como entorno equivalente de
PROD para PM33.

## Evidencia reproducible

Rama: `claude/punto5-matriz-migraciones`  
SHA validado: `690691811ec16e0f762a2c39d7ec5344e9a9619a`

Archivos:

- `tests/punto5/MATRIZ_PROCEDENCIA_MIGRACIONES.json`
- `tests/punto5/catalogo_solo_lectura.sql`
- `tests/punto5/verificar_matriz.mjs`
- `tests/punto5/README.md`
- `.github/workflows/validate-punto5-matriz.yml`

Validación CI:
[run 35538924300](https://github.com/Plopezm1990/Almacen/actions/runs/35538924300)
SUCCESS, con salida real:

```
PUNTO5_MATRIZ=PASS REPO=34 PROD=37 QA=62 EXACT_PROD=1 EXACT_QA=16
```

## Decisión pendiente

La matriz está completa para la trazabilidad solicitada; la reconciliación
no está autorizada ni se inicia automáticamente. Antes de cualquier cambio,
debe elegirse explícitamente uno de estos enfoques:

1. Documentar el historial remoto como legado y mantener una línea base de
   estado efectivo, sin alterar `schema_migrations`.
2. Incorporar al repositorio únicamente pruebas documentales de las
   migraciones históricas, después de demostrar contenido y efectos.
3. Diseñar migraciones correctivas nuevas, hacia delante, para una
   divergencia concreta aprobada.

Quedan descartados: copiar migraciones de QA a PROD, ejecutar `db push`
contra el estado actual o reparar masivamente los historiales.
