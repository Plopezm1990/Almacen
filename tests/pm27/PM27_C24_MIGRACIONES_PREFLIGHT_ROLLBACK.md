# PM27-C24 — Migraciones, preflight y rollback

Fecha de inspección: 2026-09-14

## Estado de producción: bloqueo explícito

**PRODUCCIÓN NO ES DESTINO DIRECTO DEL MANIFEST C24 ACTUAL.**

La inspección realizada para C24 fue exclusivamente **solo lectura** sobre metadatos de PostgreSQL/Supabase. C24 no ha aplicado migraciones, no ha escrito datos, no ha alterado usuarios, no ha modificado RLS y no ha realizado ningún despliegue remoto.

El manifest `tests/pm27/pm27-c24-migration-manifest.json` contiene ocho migraciones C13→C23 certificadas para un baseline que ya dispone de las dependencias funcionales previas. El proyecto productivo actual no cumple ese baseline y, por tanto, el lote de ocho migraciones no debe ejecutarse allí hasta completar una reconciliación previa separada y expresamente autorizada.

## Matriz estructural observada en producción

### Objetos base presentes

- `public.perfiles`
- `public.membresias_usuario`
- `public.almacen_kv`
- `public.stock_ubicacion`
- `public.stock_operaciones`
- `public.movimientos_stock`
- `private.g1_operation_ids_global`
- `private.la_usuario_activo()`
- `private.la_tiene_empresa(text)`
- `private.la_tiene_local(text,text)`
- `private.pm07_puede_vender()`
- `private.pm07_puede_gestionar_stock()`
- `private.pm07_validar_cantidad(numeric,boolean,smallint)`
- `private.pm08_bloquear_operation_id(text)`
- `private.pm09_bloquear_operation_id_stock(text)`
- `private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)`
- `private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)`
- `private.g1_claim_operation_id()`
- `public.obtener_contexto_operativo()`

### Objetos requeridos por C24 que faltan en producción

- `public.clientes_empresa`
- `public.encargos_empresa`
- `public.pagos_encargo`
- `private.pm08_local_operable(text,text)`
- `private.pm08_puede_operar_caja()`
- `private.pm08_validar_dinero(numeric,boolean,boolean)`
- `public.registrar_venta_stock(text,text,text,text,numeric,jsonb)`
- `public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)`
- `public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)`
- `public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)`
- `public.registrar_encargo(text,text,text,text,numeric,text,jsonb)`
- `public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)`
- `public.revertir_pago_encargo(text,text,text,text)`

## Drift de esquema frente a historial de migraciones

La inspección de `supabase_migrations.schema_migrations` en producción confirmó que las siguientes versiones exactas **no están registradas** como aplicadas:

- `20260904135838`
- `20260904142656`
- `20260905120500`
- `20260908071757`
- `20260908071911`
- `20260908071936`
- `20260908075655`
- `20260912120000`

Sin embargo, producción sí contiene algunos objetos asociados históricamente a esa cadena, por ejemplo tablas de stock, helpers PM07 y `private.pm09_bloquear_operation_id_stock(text)`. Esto demuestra un estado parcial/drift que debe reconciliarse por definición real de objeto y no únicamente por número de versión.

**Prohibido como mecanismo de reparación:** insertar o editar manualmente filas de `supabase_migrations.schema_migrations` para simular que una migración fue aplicada. La historia solo podrá quedar alineada mediante un procedimiento de reconciliación explícito, probado y autorizado.

## Cadena de prerrequisitos identificada

Las rutas siguientes siguen versionadas y explican los objetos que el baseline C24 espera. No constituyen autorización para aplicarlas a producción y no deben ejecutarse a ciegas sobre el estado actual.

### A. Stock/RPC base para C18 y C19

1. `supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql`
   - Crea/endurece las tablas base de stock.
   - Define `private.pm07_validar_cantidad(...)`, helpers de rol de stock, `public.registrar_venta_stock(...)` y `public.trasladar_stock_interno(...)`.
2. `supabase/migrations/20260904142656_pm07_carrito_y_traslado_interlocal_atomicos.sql`
   - Añade la semántica multílínea/interlocal.
   - Define `public.registrar_venta_stock_carrito(...)` y `public.trasladar_stock_entre_locales(...)`.
3. `supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql`
   - Define `private.pm09_bloquear_operation_id_stock(text)` y conecta el namespace/lock global de operation_id con stock.

Producción presenta parte de estos objetos pero no las cuatro RPC base requeridas por el preflight C24. Por ello la recuperación no puede consistir en reaplicar automáticamente toda la cadena; primero se necesita una migración de reconciliación específica, construida a partir del diff vivo y certificada en un baseline aislado.

### B. Clientes, encargos y pagos para C21/C22

4. `public.clientes_empresa` es una dependencia histórica existente en QA desde PM05. El cierre histórico de PM14 la identifica expresamente como fuente de verdad previa a PM14. El SQL PM05 original que la introdujo ya no está presente en el árbol de migraciones actual ni fue recuperable desde el commit consolidado inspeccionado. **Esto es un bloqueo duro:** antes de producción debe prepararse una nueva migración de reconciliación versionada que reproduzca el contrato real certificado de `clientes_empresa` (estructura, constraints, RLS, grants y datos/backfill si aplica). No se inventará ni se atribuirá a un archivo inexistente.
5. `supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql`
   - Requiere la base tenant existente.
   - Crea `private.pm08_puede_operar_caja()`, `private.pm08_local_operable(text,text)` y `private.pm08_validar_dinero(numeric,boolean,boolean)`.
   - Crea `public.encargos_empresa`, `public.pagos_encargo` y las RPC `registrar_encargo`, `registrar_pago_encargo` y `revertir_pago_encargo`.
6. `supabase/migrations/20260908071911_pm14_p02_revocar_ejecucion_anonima.sql`
7. `supabase/migrations/20260908071936_pm14_p02_revocar_anon_explicito.sql`
8. `supabase/migrations/20260908075655_pm14_p05_estado_devuelto_encargo.sql`
   - Estos tres archivos completan la superficie de seguridad/compatibilidad PM14 utilizada por el baseline QA certificado.
9. `supabase/migrations/20260912120000_pm26_p09f_b3_pagos_encargo_operation_id_global.sql`
   - Reutiliza `private.g1_operation_ids_global` y `private.g1_claim_operation_id()`.
   - Integra `pagos_encargo` en el ledger global e instala exactamente un trigger `g1_operation_id_global`, condición que C22 espera conservar.

## Orden seguro antes de cualquier rollout productivo de C24

Este orden es una **precondición futura**, no una autorización actual:

1. Tomar snapshot/backup recuperable de producción y conservar SHA/versiones exactas.
2. Reinspeccionar producción en modo solo lectura y comparar definiciones reales de tablas, funciones, triggers, RLS, grants e historial.
3. Preparar y certificar una migración de reconciliación para `public.clientes_empresa` porque su SQL PM05 original no está versionado actualmente.
4. Preparar una reconciliación mínima de las RPC base PM07/PM09 que faltan, sin recrear a ciegas objetos ya presentes ni destruir estado productivo.
5. Preparar/certificar la cadena PM14 de encargos/pagos y su seguridad sobre una copia/baseline representativo de producción.
6. Preparar/certificar PM26 P09f-B3 para integrar `pagos_encargo` en el ledger global.
7. Ejecutar de nuevo `supabase/qa-solo/pm27_c24_preflight_migraciones.sql` sobre el destino ya reconciliado y exigir `PM27_C24_PREFLIGHT=PASS`.
8. Verificar byte a byte y en orden las ocho migraciones del manifest C24.
9. Solo con **nueva autorización explícita** aplicar el lote C13→C23 en producción.
10. Ejecutar `supabase/qa-solo/pm27_c24_postflight_migraciones.sql` y exigir `PM27_C24_POSTFLIGHT=PASS`.
11. Ante cualquier diferencia de baseline, preflight, hash, lock/timeout o postflight: abortar y recuperar; nunca continuar parcialmente.

## Conclusión C24 respecto a producción

C24 certifica el paquete de ocho migraciones sobre PostgreSQL 17 y documenta por qué la producción actual no es todavía un destino válido. El trabajo pendiente para producción pertenece a un rollout/reconciliación posterior y requiere **nueva autorización explícita**. C24 no autoriza ni ejecuta ese rollout.
