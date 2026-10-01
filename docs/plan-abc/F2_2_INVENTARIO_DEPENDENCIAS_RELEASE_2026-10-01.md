# F2.2 — inventario de dependencias de `origin/release`

Fecha: 2026-10-01  
Estado: `INVENTARIO_ESTATICO_PENDIENTE_VERIFICACION_SQL`  
Base exacta: `origin/release` `7859508`

Este inventario identifica las migraciones que condicionan F2. La existencia de
un archivo no demuestra que el objeto remoto esté aplicado, sano o expuesto al
Data API; esa comprobación queda para una ejecución local/QA autorizada.

## Cadena de migraciones observada

### F2 — caja, pagos y efectos

- `20260923210000_abc_f2_m01_base_transaccional_caja.sql`
- `20260923210100_abc_f2_m01b_acl_hardening.sql`
- `20260923220000_abc_f2_m02a_core_comercial_fiscal.sql`
- `20260923230000_abc_f2_m02b_pagos_reservas_reembolsos.sql`
- `20260923233000_abc_f2_m03a_autoridad_transaccional.sql`
- `20260923234500_abc_f2_m03b_checkout_cobro.sql`
- `20260923235900_abc_f2_m03c_reembolsos_transaccionales.sql`
- `20260924001000_abc_f2_m04a_caja_sesiones.sql`
- `20260924002000_abc_f2_m04b_movimientos_caja.sql`
- `20260924003000_abc_f2_m04c_outbox_persistente.sql`
- `20260924004000_abc_f2_m04d_acl_parity.sql`

### Dependencias ABC posteriores

- F3 A03–A11: autoridad de servidor, variantes, estados, recuperación, mesas,
  descuentos, cocina y día operativo.
- F4 B02–B07: bridge de checkout, resultado desconocido, pagos mixtos,
  anticipos y registro/configuración/eventos del proveedor.
- PM07/PM08/PM09/P2: stock, caja, devoluciones, replay, aislamiento y
  autoridad heredada que no puede romperse.

## Comprobaciones previas a una migración nueva

| Área | Comprobación | Resultado actual |
|---|---|---|
| Orden | dependencias y timestamps | identificado, requiere revisión SQL |
| Tablas | columnas, claves e índices | pendiente de consulta local |
| RPC | firmas, `search_path`, permisos | pendiente de consulta local |
| RLS | `ENABLE ROW LEVEL SECURITY` y políticas | pendiente de consulta local |
| ACL | grants/revokes por rol | pendiente de consulta local |
| Outbox | reintentos, dedupe y recuperación | contrato presente; prueba pendiente |
| Data API | exposición/grants explícitos | pendiente de revisar configuración |
| Compatibilidad | cliente antiguo y datos existentes | pendiente de ensayo |
| Reversión | compensación sin borrar hechos | pendiente de procedimiento |

## Regla para la migración candidata

La futura migración debe ser aditiva, tener nombre generado por la CLI de
Supabase, incluir dependencias explícitas y no modificar silenciosamente ventas,
pagos, documentos ni stock históricos. Antes de comprometerla se revisarán
advisors, RLS, ACL, índices, funciones y el manifiesto de pruebas.

No se usará `apply_migration` para iterar sobre un esquema local ni se hará
`db push` como atajo. La iteración será local y la migración final se generará
solo cuando el diseño y los contratos estén revisados.

## Resultado de F2.2

La cadena de dependencias de release queda documentada. El siguiente paso es
construir una consulta/contrato de verificación local sobre PostgreSQL, sin
aplicar todavía cambios en QA/PROD.
