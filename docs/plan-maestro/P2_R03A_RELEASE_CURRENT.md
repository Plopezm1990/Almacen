# P2-R03A — reconstrucción sobre release actual

Estado: **candidato GitHub-only; no aplicado a Supabase QA ni PROD**.

Baseline exacta:

- `release@a34ac998f6e806e4dbeefaf511f4de6ca3bbbfc4`
- rama: `claude/p2-r03a-release-current`

## Decisión de reconstrucción

La rama histórica `p2-r03a-runtime-post-reset` quedó divergida respecto al release actual (35 commits por delante y 62 por detrás en el inventario del 21/09/2026). No se hace merge ni rebase masivo de esa rama.

Para R03A se recupera únicamente el paquete históricamente validado de Caja/Arqueos/Devoluciones:

- SQL histórico exacto: blob Git `f4e75925a418ca35eb00dec5805aeae41566728e`
- contrato estático histórico exacto: blob `e4862d18ad93740ccee06ddccc12ab4db0709542`
- harness PostgreSQL histórico exacto: blob `2f14d2bb89af969eb5dc8e5917cca95a7d8022a2`

Los dos ficheros de test se colocan bajo `.github/scripts/p2-r03a/` para no alterar el manifiesto cerrado de 133 contratos activos del bloque 1–13. El gate específico corre adicionalmente al `gate-final` general del PR.

## Preflight vivo contra PROD — solo lectura

Se comprobó sin escribir en Supabase que siguen presentes todas las precondiciones del SQL R03A:

- `public.stock_operaciones`
- `public.movimientos_stock`
- `public.stock_ubicacion`
- `private.g1_operation_ids_global`
- `private.g1_claim_operation_id()`
- `private.pm09_bloquear_operation_id_stock(text)`
- `private.pm08_bloquear_operation_id(text)`
- `private.pm08_validar_operation_id(text)`
- `private.pm08_validar_dinero(numeric,boolean,boolean)`
- `private.pm08_puede_operar_caja()`
- `private.pm08_local_operable(text,text)`
- `private.pm07_puede_gestionar_stock()`
- `private.pm07_validar_cantidad(numeric,boolean,smallint)`
- `private.la_tiene_empresa(text)`
- `private.la_tiene_local(text,text)`
- `private.la_usuario_activo()`
- `private.la_rol()`
- `public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)`

También se confirmó que las RPC legacy que P2-R02 cerró continúan sin EXECUTE para `authenticated`:

- `public.anular_venta_tpv(text,text)`
- `public.descontar_stock(text,numeric,text,jsonb)`
- `public.descontar_stock_carrito(jsonb,text)`

## Wiring del frontend actual

El `fuente.js` del release actual sigue consumiendo las superficies restauradas por R03A, entre ellas:

- `registrar_movimiento_caja`
- `registrar_arqueo_caja`
- `registrar_devolucion_venta_pm09`
- `registrar_devolucion_proveedor`
- `registrar_venta_stock_carrito_pm09`
- `revertir_venta_stock_carrito_pm09`

Por tanto el paquete no se conserva por razones históricas solamente: cubre llamadas que siguen vivas en el frontend actual.

## Qué crea el candidato

R03A restaura, entre otros objetos:

- `public.caja_operaciones`
- `public.arqueos_caja`
- `public.arqueos_caja_anulaciones`
- `public.devoluciones_venta`
- `public.devoluciones_proveedor`

con RLS por empresa/local, escritura directa revocada a `authenticated`, ledger global de `operation_id`, replay/idempotencia y RPC SECURITY DEFINER que verifican sesión y alcance.

## Qué NO hace este candidato

- No aplica la migración en QA.
- No aplica la migración en PROD.
- No usa `db push`.
- No usa `migration repair`.
- No copia el estado de QA a PROD.
- No toca `main` ni PR #38.
- No incorpora R03B, R03C, PM11, PM13 o P06.

## Criterio para pasar a la siguiente fase

Antes de proponer aplicación remota deben quedar verdes, sobre el SHA exacto del PR:

1. gate específico `p2-r03a`;
2. pruebas funcionales PostgreSQL efímeras;
3. aislamiento RLS multiempresa;
4. regresiones PM08/PM09;
5. `gate-final` general 133/133;
6. Deploy Preview sin errores relevantes.

La aplicación a QA, y posteriormente cualquier propuesta para PROD, requieren autorizaciones separadas.
