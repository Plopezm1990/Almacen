# G1 · Núcleo seguro · Punto 5 — permisos y aislamiento

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Entorno vivo: Supabase QA `qjqorixtkilwsndqayyx`  
Producción/main: sin cambios

## 1. Objetivo

Revalidar el criterio G1 de permisos y aislamiento sobre el estado actual, usando las identidades sintéticas PM04 y las reglas congeladas en DEC-01:

- empresa A no ve/opera empresa B;
- operador A1 no ve/opera A2;
- operador A2 no ve/opera A1;
- propietario A puede leer A1, A2 y el local cerrado de A para histórico, pero no B;
- usuario inactivo no accede ni opera;
- `Todos los locales` es contexto consolidado de solo lectura y nunca un destino de mutación;
- las mutaciones sensibles siguen requiriendo usuario autenticado y autorizado.

## 2. Matriz de lectura RLS

Pruebas realizadas con `set local role authenticated` y `request.jwt.claim.sub` del fixture QA, siempre dentro de transacción.

| Identidad | Proveedor A | Proveedor B | Stock A1 | Stock A2 | Stock cerrado A | Stock B1 | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Cajero A1 | 1 | 0 | 1 | 0 | 0 | 0 | PASS |
| Encargado A2 | 1 | 0 | 0 | 1 | 0 | 0 | PASS |
| Propietario A | 1 | 0 | 1 | 1 | 1 | 0 | PASS |
| Propietario B | 0 | 1 | 0 | 0 | — | 1 | PASS |
| Inactivo | 0 visibles en proveedores/clientes/stock/KV/auditoría | | | | | | PASS |

## 3. Hallazgo real detectado durante G1.5

Antes de cerrar el punto se probó explícitamente una mutación de Caja con:

- usuario: Propietario A;
- empresa: `QA-EMP-A`;
- `local_id='TODOS'`;
- RPC: `registrar_movimiento_caja`.

Resultado inicial: **la RPC aceptó la operación** (`ok=true`). La llamada estaba encapsulada en `BEGIN ... ROLLBACK`, por lo que no dejó datos persistidos.

Esto violaba DEC-01, que exige que `Todos los locales` sea solo lectura y que toda mutación tenga un local real y explícito.

### Causa

`private.la_tiene_local()` permitía cualquier `p_local` cuando la membresía tenía `todos_locales=true`:

`m.todos_locales=true OR m.local_id=p_local`.

Por tanto el identificador virtual `TODOS` pasaba la autorización de contexto.

## 4. Corrección QA

Migración aplicada en Supabase QA:

- `20260905183353 · g1_p05_bloquear_todos_locales_mutacion`

La función `private.la_tiene_local()` ahora exige:

- `p_local` no vacío;
- `upper(btrim(p_local)) <> 'TODOS'`;
- usuario activo;
- empresa correcta;
- membresía local o `todos_locales` para locales reales.

La corrección está reflejada en:

`supabase/migrations/20260905183353_g1_p05_bloquear_todos_locales_mutacion.sql`

## 5. Reprueba después de la corrección

Casos de mutación:

| Caso | Esperado | Obtenido | Estado |
|---|---|---|---|
| Propietario A → Caja A1 | permitido | `ok=true` dentro de `ROLLBACK` | PASS |
| Cajero A1 → Caja A2 | rechazado | `contexto_no_autorizado` | PASS |
| Propietario A → Empresa B/B1 | rechazado | `contexto_no_autorizado` | PASS |
| Propietario A → local cerrado | rechazado | `local_inactivo` | PASS |
| Propietario A → `TODOS` | rechazado | `contexto_no_autorizado` | PASS |
| Escritura directa RLS KV con `local_id='TODOS'` | rechazada | `42501` RLS | PASS |
| Usuario inactivo → Caja A1 | rechazado | `caja_no_autorizada` | PASS |

## 6. Segundo hallazgo: RPC de stock ejecutables por anon

El Security Advisor de Supabase detectó que dos RPC `SECURITY DEFINER` mantenían `EXECUTE` para `anon`:

- `registrar_venta_stock_carrito(...)`;
- `trasladar_stock_entre_locales(...)`.

Aunque ambas validaban `auth.uid()` internamente, la superficie anónima era innecesaria para operaciones que el contrato considera autenticadas.

Migración aplicada en QA:

- `20260905183514 · g1_p05_restringir_rpc_stock_anon`

Se revocó `EXECUTE` únicamente a `anon`, conservando `authenticated=true`.

Verificación posterior:

- ambas funciones: `anon_exec=false`;
- ambas funciones: `auth_exec=true`;
- intento anónimo real contra `registrar_venta_stock_carrito`: `42501 permission denied for function`.

Migración reflejada en:

`supabase/migrations/20260905183514_g1_p05_restringir_rpc_stock_anon.sql`

Las advertencias del asesor sobre RPC `SECURITY DEFINER` accesibles por `authenticated` no se corrigen aquí de forma indiscriminada: son puntos de entrada intencionales del backend y su autorización interna se conserva y prueba. El alcance G1.5 solo elimina exposición anónima no necesaria y corrige el contexto virtual de `TODOS`.

## 7. Limpieza

Después de todas las pruebas:

- `caja_operaciones` con prefijo `G1-P05-`: **0**;
- `almacen_kv` con prefijo `G1-P05-`: **0**;
- `stock_operaciones` con prefijo `G1-P05-`: **0**;
- `devoluciones_venta` con prefijo `G1-P05-`: **0**.

No se usaron datos reales. No se modificó producción ni `main`.

## 8. Decisión

**G1.5 PERMISOS Y AISLAMIENTO = PASS**, después de corregir dos fallos detectados por la propia revalidación:

1. `TODOS` aceptado como destino de mutación;
2. dos RPC de stock ejecutables por `anon`.

La lectura histórica de local cerrado sigue permitida; las nuevas operaciones quedan bloqueadas. El aislamiento A/B y A1/A2 se mantiene correcto.

El gate G1 completo todavía NO está superado.

**G1_P05_PERMISOS_AISLAMIENTO=PASS**  
**G1_ESTADO=PENDIENTE**  
**SIGUIENTE=G1.6_CIFRAS_CONCILIACIONES**
