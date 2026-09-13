# PM27 — C13 SECURITY DEFINER y helpers privados

Fecha de corte: 2026-09-13
Candidato auditado e inmutable: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`.
Resultado: **FAIL**.

## 1. Objetivo

Reauditar las funciones `SECURITY DEFINER` y sus helpers privados para comprobar que el privilegio del propietario no convierta una simple autenticación o un rol de interfaz en un bypass de RLS/multiempresa. C13 exige revisar ACL, autorización interna, aislamiento de helpers y negativos de bypass.

La inspección de producción fue exclusivamente de lectura. No se llamó a ninguna RPC mutadora, no se creó ni modificó ningún usuario/membresía y no se escribió en ninguna tabla.

## 2. Inventario vivo

En el estado vivo consultado existen 19 funciones `SECURITY DEFINER` en `public`/`private`:

- 9 en `public`.
- 10 en `private`.
- 0 son ejecutables por `anon`.
- 5 funciones públicas son ejecutables por `authenticated`.

Los helpers privados de autorización (`la_usuario_activo`, `la_tiene_empresa`, `la_tiene_local`, helpers PM07/PM12, etc.) sí incorporan `auth.uid()`, membresía activa y/o comprobación de empresa/local según su dominio. Además, `anon` y `authenticated` no tienen `USAGE` ni `CREATE` sobre el esquema `private`.

Por tanto, el problema encontrado no es que los helpers privados sean públicos: el problema es que varias RPC públicas privilegiadas no los usan.

## 3. Hallazgo bloqueante

Las siguientes RPC públicas están actualmente concedidas a `authenticated`, son `SECURITY DEFINER`, pertenecen al propietario privilegiado y no exigen membresía empresa/local dentro de su cuerpo:

- `public.descontar_stock_carrito(jsonb,text)`
- `public.anular_venta_tpv(text,text)`
- `public.obtener_contexto_operativo()`

### `descontar_stock_carrito`

Comprueba `auth.uid()` y que exista un perfil activo con uno de varios roles de venta. Después lee y actualiza `public.almacen_kv` (`key = 'productos'`) y registra movimientos. No valida una membresía activa ni recibe/valida un contexto `empresa_id/local_id` autoritativo.

### `anular_venta_tpv`

Comprueba `auth.uid()` y rol activo `Propietario`/`Encargado`, pero no comprueba membresía de empresa/local. Después bloquea y actualiza `public.almacen_kv`, consulta/escribe movimientos y reserva la operación de anulación.

### `obtener_contexto_operativo`

Comprueba identidad y perfil activo, pero no membresía empresa/local. Lee colecciones operativas desde `public.almacen_kv` según el rol (`empleados`, `proveedores`, `fichasCosto`, `encargos`, etc.).

## 4. Por qué la RLS no corrige este defecto

`public.almacen_kv` tiene RLS habilitada, pero las RPC anteriores ejecutan como `SECURITY DEFINER` bajo un propietario con `BYPASSRLS`; la tabla no tiene `FORCE ROW LEVEL SECURITY`.

Por tanto, las políticas RLS de `almacen_kv` que sí distinguen roles no constituyen una segunda barrera dentro de esas RPC privilegiadas. La autorización efectiva es la comprobación incluida en el cuerpo de cada función.

Además, `almacen_kv` conserva el modelo legacy `key/value/updated_at` y no tiene columnas `empresa_id` ni `local_id`; las RPC anteriores tampoco reciben un contexto de tenant que pueda validarse mediante `private.la_tiene_local`.

## 5. Alcanzabilidad comprobada sin ejecutar la mutación

La inspección de solo lectura de `public.perfiles` y `public.membresias_usuario` confirmó que existe actualmente al menos un perfil activo cuyo rol satisface los predicados de esas RPC y que no tiene ninguna membresía activa.

Concretamente, el recuento vivo mostró:

- perfiles activos sin membresía activa: 1;
- perfiles que satisfacen los roles aceptados por `descontar_stock_carrito` y no tienen membresía: 1;
- perfiles que satisfacen los roles aceptados por `anular_venta_tpv` y no tienen membresía: 1.

No se identifica al usuario ni se ejecuta la RPC. Esto basta para demostrar que el guard actual de rol/perfil no implica el guard multiempresa que exige el modelo de autorización.

C13 no afirma que se haya explotado el defecto ni que existan hoy datos de dos empresas mezclados dentro de cada colección JSON. El FAIL se basa en una precondición autorizativa ausente y alcanzable, no en una explotación destructiva.

## 6. Controles que sí están bien

- Ninguna función `SECURITY DEFINER` inspeccionada es ejecutable por `anon`.
- Las funciones internas/trigger que no deben ser API no tienen `EXECUTE` para `authenticated`.
- El esquema `private` no concede `USAGE`/`CREATE` a `anon` ni a `authenticated`.
- Los helpers `private.la_usuario_activo()` / `private.la_tiene_local(...)` sí aplican identidad, membresía y ámbito.
- El patrón preparado para las RPC PM11 de prefiltros es correcto: `SECURITY DEFINER`, `search_path=''`, autorización por helper privado, revocación de grants por defecto y `EXECUTE` únicamente a `authenticated`.
- El gate remoto exacto del candidato reejecutó P06h con su batería aislada de 15 casos en PASS, incluidos rol insuficiente, empresa/local ajenos y bypass directo de INSERT/DELETE.

## 7. `search_path` — endurecimiento adicional

Las cinco funciones públicas `SECURITY DEFINER` ejecutables por `authenticated` observadas usan `search_path=public`, no `search_path=''`.

No se ha encontrado un vector de inyección de objetos por este punto porque ni `anon` ni `authenticated` tienen privilegio `CREATE` sobre `public`; además, las referencias sensibles revisadas están mayoritariamente cualificadas. Por ello este aspecto queda como endurecimiento adicional y no es la causa principal del FAIL.

Al corregir las RPC bloqueantes conviene fijar `search_path=''` y cualificar todos los objetos, siguiendo el patrón PM11 ya preparado.

## 8. Remediación exigida antes de cerrar C13

No se corrige dentro del candidato congelado. La corrección posterior deberá, como mínimo:

1. Definir el contexto de empresa/local para las RPC de venta, anulación y contexto operativo.
2. Requerir en servidor una membresía activa coherente, reutilizando `private.la_usuario_activo()` / `private.la_tiene_local(...)` o un helper de dominio equivalente; no confiar en el navegador.
3. Asegurar que toda lectura/mutación de datos operativos queda acotada al tenant/local autorizado.
4. Mantener `EXECUTE` únicamente para los roles PostgreSQL necesarios y `anon` revocado.
5. Endurecer `search_path` y cualificar objetos.
6. Añadir negativos reproducibles: perfil activo sin membresía, empresa ajena, local ajeno y ausencia de sesión; positivos solo para contexto propio.
7. Ejecutar regresiones de TPV/stock/anulación y el gate remoto sobre el SHA exacto de la corrección.

## 9. Conclusión

C13 **no puede cerrarse en verde**. Se encontró una brecha real entre autorización por rol/perfil y autorización multiempresa dentro de RPC `SECURITY DEFINER` alcanzables por `authenticated`.

Marcadores:

`PM27_C13_ANON_SECURITY_DEFINER=PASS`

`PM27_C13_HELPERS_PRIVATE_AISLADOS=PASS`

`PM27_C13_RPC_TENANT_GUARD=FAIL`

`PM27_C13_PERFIL_SIN_MEMBRESIA_ALCANZABLE=FAIL`

`PM27_C13_RESULTADO=FAIL`

## 10. Integridad

No se modificaron `main`, `release`, PR #38, Netlify, el candidato PM27, Supabase ni datos reales. Este archivo es únicamente evidencia de auditoría en `claude/pm27-auditoria-25-casos`.