# Punto 9 — Índices / Performance Advisor

**Estado:** candidato preparado; **NO aplicado** a QA ni PROD.  
**Baseline Git:** `release@3e1e2558951e630a021f970c023e4731499de189`.  
**Regla:** no usar `db push`, `migration repair` ni reconciliar historial de migraciones para este paquete.

## Evidencia viva de PROD usada para decidir

Performance Advisor, observado el 21/09/2026:

- 4 foreign keys sin índice de cobertura:
  - `public.locales.locales_empresa_id_fkey` → `empresa_id`
  - `public.movimientos_stock.movimientos_stock_actor_user_id_fkey` → `actor_user_id`
  - `public.movimientos_stock.movimientos_stock_operation_id_fkey` → `operation_id`
  - `public.stock_operaciones.stock_operaciones_actor_user_id_fkey` → `actor_user_id`
- 5 índices sin uso reportado:
  - `proveedores_empresa_empresa_idx`
  - `prefiltro_limites_actualizado_en_idx`
  - `idx_fichajes_fecha`
  - `clientes_empresa_empresa_idx`
  - `gastos_empresa_scope_idx`

Ventana de estadísticas observada:
- `pg_stat_user_indexes`: desde 24/07/2026.
- `pg_stat_statements`: desde 31/07/2026.

Filas vivas al preflight:
- `locales`: 4
- `movimientos_stock`: 0
- `stock_operaciones`: 0
- `prefiltro_limites`: 1
- `proveedores_empresa`, `clientes_empresa`, `gastos_empresa`, `fichajes_registro`: 0

## Decisión

### Crear

1. `idx_locales_empresa_id ON public.locales(empresa_id)`
   - 65 llamadas observadas con `empresa_id` en cláusulas WHERE.
   - 22 llamadas observadas con `empresa_id` en JOIN.
   - La FK existe y carece de índice de cobertura.

2. `idx_movimientos_stock_operation_id ON public.movimientos_stock(operation_id)`
   - 12 llamadas observadas con `operation_id` en WHERE.
   - La FK existe y carece de índice de cobertura en PROD.
   - QA ya contiene un índice equivalente con este nombre, pero esa coincidencia se usa solo como evidencia secundaria; QA y PROD no se asumen equivalentes.

### Diferir

- `movimientos_stock(actor_user_id)`: no se observaron filtros/join por esa columna y la tabla está vacía.
- `stock_operaciones(actor_user_id)`: no se observaron filtros/join por esa columna y la tabla está vacía.

Estos dos avisos quedan como riesgo residual documentado. Se deben revaluar cuando exista carga real o aparezcan consultas/referential actions que lo justifiquen.

### Mantener; no borrar

Los 5 índices marcados como "unused" se conservan. Tres de sus tablas están actualmente vacías y el coste de almacenamiento observado es mínimo (8–16 kB por índice). Un `idx_scan=0` no demuestra inutilidad cuando el volumen es pequeño o todavía no existe carga representativa.

## Archivos del candidato

- `PUNTO9_INDICES_PREFLIGHT.sql`: comprobación read-only.
- `PUNTO9_INDICES_APLICAR.sql`: DDL atómico con `lock_timeout=5s` y `statement_timeout=30s`; crea solo los dos índices seleccionados.
- `PUNTO9_INDICES_POSTFLIGHT.sql`: verifica tipo B-tree, validez, disponibilidad y primera clave.
- `PUNTO9_INDICES_ROLLBACK.sql`: rollback hacia delante; solo elimina los dos índices si su contrato coincide.

## Secuencia operativa autorizable

1. Ejecutar `PUNTO9_INDICES_PREFLIGHT.sql` en PROD.
2. Si y solo si PASS, autorización productiva separada.
3. Ejecutar `PUNTO9_INDICES_APLICAR.sql`.
4. Ejecutar `PUNTO9_INDICES_POSTFLIGHT.sql`.
5. Volver a consultar Performance Advisor.
6. Criterio esperado: `unindexed_foreign_keys` baja de 4 a 2; los 5 `unused_index` permanecen sin cambio.
7. Si el postflight falla o aparece drift, usar `PUNTO9_INDICES_ROLLBACK.sql` con autorización separada.

## Fuera de alcance

- No borrar índices.
- No crear índices para `actor_user_id` todavía.
- No tocar datos, RLS, grants, funciones, Edge Functions, Auth, Netlify ni frontend.
- No modificar `main` ni PR #38.
