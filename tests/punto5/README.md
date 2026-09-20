# Punto 5 — Matriz de procedencia de migraciones

Captura de metadatos de `release@21ee66bdb52e4d5ad0af2341543f53720a4cf027`, PROD y QA realizada el 20/09/2026.

## Límites

- Solo se registran nombres, versiones, hashes de catálogo y privilegios.
- No hay filas de negocio, datos de Auth ni secretos.
- La captura no aplicó migraciones, DDL, DML, reparación de historial ni cambios de configuración.
- Una coincidencia de nombre con otra versión es evidencia de linaje, **no** equivalencia semántica.

## Artefactos

- `MATRIZ_PROCEDENCIA_MIGRACIONES.json`: inventarios completos, clasificación y huellas de catálogo.
- `catalogo_solo_lectura.sql`: consulta reproducible de catálogo usada contra cada entorno.
- `verificar_matriz.mjs`: comprobación offline de conteos, cobertura y clasificaciones.

```bash
node tests/punto5/verificar_matriz.mjs
```

## Resultado de esta captura

| Fuente | Migraciones | Coincidencia exacta con el repo |
|---|---:|---:|
| Repositorio | 34 | — |
| PROD | 37 | 1 |
| QA | 62 | 16 |

La única coincidencia exacta repo↔PROD es PM33, registrada como
`20260919225831_pm33_p05_identidad_antes_de_actividad`.

La matriz separa historial de estado efectivo: PROD y QA comparten 26 tablas
con la misma configuración estructural de RLS, pero sus funciones difieren
materialmente. No se deriva ninguna acción automática de esta evidencia.
