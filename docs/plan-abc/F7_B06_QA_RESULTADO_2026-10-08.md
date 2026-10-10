# F7 · B06 en QA — resultado de aplicación y humo

Fecha: 2026-10-08  
Entorno: `L&A Suite QA` (`qjqorixtkilwsndqayyx`)  
Estado: `APLICADO_Y_VERIFICADO_EN_QA`  
Producción: no tocada

## 1. Fuente aplicada

La fuente de B06 ya formaba parte de `release` en el commit
`9ca58df6633da38edd259d215033a8f71802f587`. Su rama histórica termina en
`f6fe0f998e6555a1c1bde07b48bcb510fbb4c117` y es antecesora de `release`.

Se aplicaron, en orden, estos cuatro archivos sin modificarlos:

1. `20260930100000_abc_f4_b06_non_sale_receipts.sql`
2. `20260930103000_abc_f4_b06_advance_traceability.sql`
3. `20260930110000_abc_f4_b06_advance_balance_guard.sql`
4. `20260930120000_abc_f4_b06_policy_catalog.sql`

## 2. Comprobación previa

La lectura previa de QA confirmó:

- proyecto activo y saludable, PostgreSQL 17;
- presentes `abc_operaciones`, `ventas_fiscales`, `caja_operaciones` y `locales`;
- presentes `private.la_tiene_local`, `private.abc_operacion_iniciar`,
  `private.abc_operacion_completar` y `private.abc_tiene_capacidad`;
- ausentes las tres tablas y la RPC de B06;
- ninguna instalación parcial de B06 en el historial de migraciones.

## 3. Registro remoto

Supabase registró estas filas:

| Versión remota | Nombre |
|---|---|
| `20261008172050` | `20260930100000_abc_f4_b06_non_sale_receipts` |
| `20261008172053` | `20260930103000_abc_f4_b06_advance_traceability` |
| `20261008172057` | `20260930110000_abc_f4_b06_advance_balance_guard` |
| `20261008172103` | `20260930120000_abc_f4_b06_policy_catalog` |

## 4. Verificación estructural y de permisos

El postflight confirmó:

- existen `abc_cobros_no_venta`, `abc_anticipo_movimientos` y
  `abc_b06_politica_conceptos`;
- las tres tablas tienen RLS activado;
- el catálogo contiene exactamente tres conceptos y los tres permanecen en
  `PENDIENTE_ASESORIA`;
- `authenticated` puede ejecutar `abc_registrar_movimiento_anticipo`;
- `anon` no puede ejecutar esa RPC;
- las tablas transaccionales quedaron vacías tras la instalación.

## 5. Humo transaccional

Se ejecutó un fixture ficticio dentro de una transacción. El ensayo comprobó:

1. un anticipo de 5 EUR admite una aplicación de 4 EUR;
2. el saldo devuelto es 1 EUR;
3. repetir el mismo `operation_id` devuelve el mismo movimiento con
   `replayed=true`;
4. intentar aplicar otros 2 EUR falla con `b06_saldo_insuficiente`.

El ensayo terminó deliberadamente con
`B06_QA_SMOKE_PASS_ROLLBACK`. Después se comprobó que no quedaron usuarios,
perfiles, empresas, locales, cuentas, ventas, operaciones ni movimientos del
fixture. Los recuentos de `abc_cobros_no_venta` y
`abc_anticipo_movimientos` siguen en cero.

El primer intento del humo también se revirtió: el fixture heredado no creaba
`perfiles`, requisito actual de `private.la_usuario_activo`. Se añadió el perfil
ficticio al segundo fixture; no fue necesario cambiar B06.

## 6. Advisors

El asesor de seguridad emitió un aviso para la RPC B06 por ser
`SECURITY DEFINER` ejecutable por `authenticated`. La exposición es intencional:
la RPC comprueba `auth.uid()`, pertenencia a empresa/local y capacidad efectiva;
usa `search_path=''`; las tablas revocan escritura directa a
`anon` y `authenticated`. Referencia del aviso:
[lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

El asesor de rendimiento informó ocho claves foráneas sin índice de cobertura y
cuatro índices B06 todavía sin uso. Son avisos `INFO` con tablas vacías; se
revisarán como endurecimiento antes de promover B06 a producción. Referencias:
[lint 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) y
[lint 0005](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## 7. Conclusión

B06 queda aplicado y verificado en QA. No se autoriza todavía su promoción a
producción. Antes de esa promoción hacen falta la revisión de índices, una copia
manual de producción del mismo día, el preflight final y la autorización escrita
del paquete exacto.
