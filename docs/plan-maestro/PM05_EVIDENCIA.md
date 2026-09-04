# PM-05 · Cerrar aislamiento transversal

Fecha: 2026-09-04
Rama: `pm05-aislamiento-transversal`
Base: cierre PM-04 `c11578ed2bf839a03c12e92ee647aad2537abba8`
Entorno: Supabase **L&A Suite QA** `qjqorixtkilwsndqayyx`
Producción/main: **sin cambios**

## Alcance cerrado

PM-05 cierra LA-001 (Proveedores), LA-002 (Clientes), LA-003 (Auditoría), la parte temprana de NR-02 sobre los objetos modificados y la separación de caché sensible vinculada a NR-08. La matriz exhaustiva de roles/RLS/API/vistas/RPC/Storage continúa en PM-21 según el Plan Maestro.

## Backend aplicado solo en QA

Migraciones Supabase registradas:
- `20260904104042 · pm05_aislamiento_transversal`
- `20260904104728 · pm05_scope_almacen_kv_qa`
- `20260904105337 · pm05_hardening_helpers`

Se añadió una fuente de autorización gestionada por servidor (`membresias_usuario`). `raw_user_meta_data` no se usa como autoridad. Los helpers de autorización internos quedaron endurecidos para no exponer una RPC pública capaz de recibir UUID arbitrarios.

Proveedores y clientes usan `proveedores_empresa` / `clientes_empresa`, con `empresa_id` explícito y RLS. La escritura con empresa ajena y la manipulación de `datos.empresaId` se rechazan.

`auditoria_registro` conserva `empresa_id`, `local_id` y `actor_user_id`. `registrar_auditoria` deriva el actor desde `auth.uid()` y valida usuario activo, empresa y local antes de insertar. La escritura directa de auditoría por `authenticated` queda revocada y la vista global no se concede implícitamente.

Los fixtures `almacen_kv` de PM-04 recibieron alcance servidor empresa/local y se eliminó la policy QA permisiva anterior. Un usuario inactivo no ve filas de negocio y A1 no ve A2/B1.

## Frontend

El adaptador de almacenamiento distingue `proveedores` y `clientes` como colecciones empresariales, lee/escribe sus tablas RLS y bloquea sincronización de registros sin `id/empresaId`.

La caché local de `proveedores`, `clientes` y `auditoria` se separa por UUID de usuario para impedir que un logout/login en el mismo navegador reutilice datos sensibles de otra identidad.

Las altas de proveedor/cliente fijan `empresaId` desde la empresa del local activo; las ediciones no pueden cambiar la propiedad empresarial. Los eventos de auditoría añaden empresa/local y la RPC recibe ambos valores.

Build/reconstrucción del parche frontend:
- workflow `PM-05 aplicar aislamiento frontend`
- run `33864564817`
- job `100996348709`
- conclusión `success`
- commit generado `b51dba24414917fa6d7fb3669df0b43a525361be`

## Pruebas reales backend · falla antes / pasa después

Baseline PM-04: 8 casos; 3 positivos pasaban y 5 negativos fallaban.

Primera validación PM-05 real:
- run `33864746977`
- job `100996926513`
- fixture `PM05-RLS-v1`
- resultado `15/15 PASS`

Validación final posterior al hardening:
- run `33865455179`
- job `100999162388`
- fixture `PM05-FINAL-v1`
- resultado `18/18 PASS · 0 fallos`

Casos finales demostrados: propietario A solo ve proveedor/cliente A; propietario B solo B; operador A1 accede solo a su ámbito autorizado; usuario inactivo no ve proveedores/clientes; escritura A→B denegada por RLS; `empresaId` manipulado denegado; auditoría A registra actor estable; B no ve ni fabrica auditoría A; Cajero no obtiene vista de auditoría; inactivo no registra auditoría; helper público antiguo no es invocable; owner A no ve marcador B en KV; A1 solo ve A1 en KV.

Los cinco negativos del baseline PM-04 quedan verdes en la autoridad QA.

## Seguridad del validador

`qa-pm05-validar-rls` fue un validador QA temporal. Tras la evidencia final quedó neutralizado en versión 4, `verify_jwt=true`, con respuesta `410 disabled`.

Limpieza final verificada:
- usuarios temporales PM-05: `0`
- auditorías temporales: `0`
- proveedores temporales: `0`
- clientes temporales: `0`

No hubo correo, push ni datos reales.

## Regresión persistente

- `tests/pm05/backend-results.json`
- `tests/pm05/frontend-contract.mjs`
- `.github/workflows/pm05-regresion.yml`

La regresión comprueba contrato frontend/backend, evidencia backend registrada y sintaxis de fuente/bundle. El live test queda enlazado mediante sus run/job reales y no se sustituye por el JSON.

La ejecución verde de `PM-05 regresión aislamiento` sobre el commit que contiene este documento constituye la evidencia de HEAD final del paquete.

## Riesgo residual / límites

PM-05 no declara cerrada la matriz completa de todos los módulos. Facturas siguen en PM-06, stock en PM-07 y la cobertura exhaustiva NR-02 de roles/RLS/API/vistas/RPC/Storage sigue en PM-21.

La migración de producción no se ha aplicado. Antes de cualquier promoción habrá que preparar y revisar una migración de datos legacy específica. No se copiará automáticamente el estado QA.

Los avisos de seguridad/performance ajenos al alcance de PM-05 permanecen documentados para paquetes posteriores. La RPC `registrar_auditoria` permanece deliberadamente invocable por `authenticated`, porque es el punto controlado de escritura y valida internamente `auth.uid()`, estado, empresa y local.

## Rollback QA

- Código: descartar la rama `pm05-aislamiento-transversal`.
- QA DB: usar migraciones compensatorias para retirar las tres migraciones PM-05 y sus dependencias si se abandona el paquete.
- Fixtures PM-04 pueden conservarse; son sintéticos.
- Producción no requiere rollback porque no fue modificada.

## Estado

**PM-05 CERRADO**, condicionado únicamente a que la regresión permanente asociada a este mismo HEAD termine en verde. No fusionar a `main` y no promover a producción sin autorización expresa.
