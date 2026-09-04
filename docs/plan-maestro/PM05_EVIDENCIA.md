# PM-05 · Cerrar aislamiento transversal

Fecha: 2026-09-04
Rama: `pm05-aislamiento-transversal`
Base: cierre PM-04 `c11578ed2bf839a03c12e92ee647aad2537abba8`
Entorno: Supabase **L&A Suite QA** `qjqorixtkilwsndqayyx`
Producción/main: **sin cambios**

## Alcance

PM-05 cubre LA-001 (Proveedores), LA-002 (Clientes), LA-003 (Auditoría), la parte temprana de NR-02 sobre objetos modificados y la separación de cache sensible vinculada a NR-08. La cobertura completa de roles/API/RPC/Storage continúa en PM-21, según Plan Maestro.

## Backend aplicado solo en QA

Migraciones Supabase registradas:
- `20260904104042 · pm05_aislamiento_transversal`
- `pm05_scope_almacen_kv_qa` (segunda migración QA del paquete)

Se añadió una fuente de autorización gestionada por servidor (`membresias_usuario`) y funciones `la_usuario_activo`, `la_tiene_empresa`, `la_tiene_local`, `la_rol`. `raw_user_meta_data` no se usa como autoridad.

Proveedores y clientes dejan de depender del bloque global compartido para el candidato PM-05 y usan `proveedores_empresa` / `clientes_empresa`, con `empresa_id` explícito y RLS. La escritura con una empresa ajena y la manipulación de `datos.empresaId` se rechazan.

`auditoria_registro` conserva `empresa_id`, `local_id` y `actor_user_id`. `registrar_auditoria` deriva el actor desde `auth.uid()` y valida empresa/local antes de insertar. La escritura directa de auditoría por `authenticated` queda revocada; la vista global no se concede implícitamente.

Los fixtures `almacen_kv` de PM-04 recibieron alcance servidor empresa/local y se eliminó la policy QA permisiva `qual=true`; un usuario inactivo no ve filas de negocio y A1 no ve A2/B1.

## Frontend

El adaptador de almacenamiento distingue `proveedores` y `clientes` como colecciones empresariales, lee/escribe sus tablas RLS y bloquea sincronización de registros sin `id/empresaId`.

La cache local de `proveedores`, `clientes` y `auditoria` se separa por UUID de usuario para que un logout/login en el mismo navegador no reutilice la cache sensible de otra identidad.

Las altas de proveedor/cliente fijan `empresaId` desde la empresa del local activo; las ediciones no pueden cambiar la propiedad empresarial. Los eventos de auditoría añaden empresa/local y la RPC recibe ambos valores.

Build/reconstrucción del parche frontend:
- workflow `PM-05 aplicar aislamiento frontend`
- run `33864564817`
- job `100996348709`
- conclusión `success`
- commit generado `b51dba24414917fa6d7fb3669df0b43a525361be`

## Pruebas reales backend · falla antes / pasa después

Baseline PM-04: 8 casos, 3 positivos pasaban y 5 negativos fallaban.

Validación PM-05 real mediante identidades temporales de QA y JWT de usuario:
- workflow `PM-05 validar RLS QA`
- run `33864746977`
- job `100996926513`
- 15/15 casos pasan, 0 fallos.

Casos demostrados: propietario A solo ve proveedor/cliente A; propietario B solo B; operador A1 solo ámbito A permitido; inactivo no ve proveedores/clientes; escritura A→B denegada por RLS; `empresaId` manipulado denegado; auditoría A registra actor estable; B no ve ni fabrica auditoría A; Cajero no obtiene vista de auditoría; inactivo no registra auditoría.

Re-test directo de los cinco negativos de PM-04 tras endurecer `almacen_kv`:
- owner A: proveedor A visible=1, proveedor B visible=0;
- operador A1: A1 visible=1, A2=0, B1=0;
- owner B: proveedor B visible=1, proveedor A=0;
- inactivo: filas de negocio visibles=0.

Por tanto los cinco casos que servían de baseline rojo quedan verdes en la autoridad QA.

## Seguridad del validador

`qa-pm05-validar-rls` fue un validador QA temporal. Tras obtener evidencia se desplegó versión 2 con `verify_jwt=true` y respuesta `410 disabled`. No quedan usuarios temporales `pm05-*` ni filas temporales de auditoría. No hubo correo/push ni datos reales.

## Regresión persistente

- `tests/pm05/backend-results.json`
- `tests/pm05/frontend-contract.mjs`
- `.github/workflows/pm05-regresion.yml`

La regresión comprueba el contrato frontend, la evidencia backend viva y sintaxis de fuente/bundle. El live test queda enlazado por run/job; no se sustituye por el JSON.

## Riesgo residual / límites

PM-05 cierra LA-001/002/003 en el alcance aprobado. No declara cerrada la matriz completa de todos los módulos: facturas siguen en PM-06, stock en PM-07, y la cobertura exhaustiva NR-02 de roles/RLS/API/vistas/RPC/Storage sigue en PM-21.

La migración de producción no se ha aplicado. Antes de cualquier promoción habrá que preparar y revisar una migración de datos legacy específica; no se copiará automáticamente el estado QA.

## Rollback QA

- Código: descartar la rama `pm05-aislamiento-transversal`.
- QA DB: revertir las dos migraciones PM-05 mediante migración compensatoria: restaurar policies QA anteriores solo si se abandona el paquete, eliminar tablas `proveedores_empresa`, `clientes_empresa`, `membresias_usuario` y columnas/funciones PM-05 tras retirar sus dependencias.
- Fixtures PM-04 pueden conservarse; no contienen datos reales.
- Producción no requiere rollback porque no fue modificada.

## Estado

**PM-05 CANDIDATO A CIERRE**, pendiente únicamente de que la regresión persistente pase sobre el HEAD final documentado.
