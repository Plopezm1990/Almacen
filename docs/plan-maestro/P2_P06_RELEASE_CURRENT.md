# P2-P06 — Persistencia / autoridad de servidor

## Base certificada

- Base de construcción: ba06125123d10796d7cc64eee2ccea529927d105 (release).
- Alcance: exclusivamente autoridad de lectura/persistencia de empleados y fichajes.
- No modifica fuente.js, PM11, PM13, main, PR #38 ni Supabase PROD.
- La aplicación de la migración P06 en Supabase QA requiere autorización separada.

## Inventario reconciliado

1. El frontend actual carga ambas colecciones mediante loadKey(), que exige que window.storage.get() devuelva un objeto con { key, value, shared }.
2. PM11/PM13 ya son la ruta remota para las mutaciones funcionales de Personal/Fichajes.
3. index-storage-bootstrap.js aún contiene persistencia legacy: empleados puede caer en almacen_kv; fichajes usa fichajes_registro por sincronización fila-a-fila; y window.subirPendientes() puede reintentar claves legacy ya encoladas.
4. edge-auth-patch.js envuelve window.storage para aplicar mínimo privilegio. P06 debe quedar por debajo de esa capa, no por encima.
5. La firma vigente de edición PM11 es pm11_editar_empleado(text,text,text,jsonb,text); la firma histórica de tres argumentos no es válida.

## Diseño

Orden runtime: index-storage-bootstrap -> P06 server authority -> edge role guard -> ui-context -> owner bootstrap -> fuente.

Mientras p2_server_authority_capabilities() no exista o no confirme exactamente PM11/PM13 con legacyPersistence=false, P06 delega al storage anterior. Esto mantiene compatibilidad con un backend pre-P2.

Cuando la capability queda demostrada:

- storage.get(empleados) lee public.empleados bajo RLS.
- storage.get(fichajes) lee public.fichajes_registro bajo RLS.
- storage.set/delete para esas dos claves no ejecutan persistencia legacy.
- empleados y fichajes se retiran de la cola legacy antes de subirPendientes().
- Un fallo de lectura después de demostrar autoridad de servidor falla cerrado: no reabre la copia legacy.
- El bridge no ejecuta INSERT/UPDATE/DELETE/UPSERT en Supabase.

La capability se cachea únicamente de forma positiva para el objeto cliente Supabase actual. Si el cliente cambia, debe demostrarse de nuevo.

## Preflight SQL

La migración P06 verifica:

- tablas empleados y fichajes_registro;
- las cuatro RPC PM11 usadas por el frontend;
- las cuatro RPC PM13 usadas por el frontend;
- la firma corregida de pm11_editar_empleado;
- RLS activo en ambas tablas;
- SELECT autenticado y ausencia de DML directo autenticado;
- políticas pm11_empleados_select_gestion y pm13_fichajes_select_scope;
- EXECUTE autenticado y ausencia de EXECUTE anónimo para las ocho RPC.

La función p2_server_authority_capabilities() es SECURITY INVOKER, no eleva privilegios y solo concede EXECUTE a authenticated.

## Gates

El workflow P06:

- fija la base exacta de release;
- exige exactamente los nueve archivos autorizados;
- ejecuta contratos estáticos, comportamiento del bridge y orden de wrappers;
- ejecuta regresiones R03A/R03B/R03C/PM11/PM13 y UI context;
- valida la migración en PostgreSQL 16 efímero;
- no usa secretos ni toca Supabase remoto.

La puerta general gate-final sigue siendo obligatoria para cualquier PR a release.

## Fronteras de autorización

Este candidato GitHub no autoriza aplicar DDL en Supabase QA, fusionar el PR, desplegar deliberadamente a producción ni modificar Supabase PROD. Cada transición requiere autorización separada.
