# PM27 — C21 Encargos, anticipos y clientes

Estado: **CERRADO — PASS técnico certificado por gate remoto; este commit documental debe recertificarse exact-SHA**.

Primer gate C21 en **SUCCESS**: run `34820565962` sobre `c1e70097b543cf53f6f2c5eb8709037d6e557c4f`. Este commit incorpora la evidencia de cierre; el mismo workflow C21 debe recertificar este SHA antes de considerar definitivo el cierre documental.

C21 parte del cierre exacto de C20 `fb3a08f72e7789fc5e8771c2f0d7d6bd49dd4d3a`, cuyo workflow `PM27 C20 - Inventarios conteos` terminó `SUCCESS` en el run `34817698292`. No reabre C20.

## Alcance

C21 reaudita el paquete histórico PM14 desde el estado real actual: documento de encargo, cliente asociado, estados Pendiente/Entregado/Cancelado/Devuelto, anticipo/saldo como condición de integridad y frontera de autorización empresa/local/rol.

C21 **no** rehace el ledger de `pagos_encargo`, sus reembolsos ni la idempotencia global `operation_id`: eso corresponde a C22. Tampoco corrige la pérdida de actualización del blob `almacen_kv` bajo dos pestañas: PM14-P07 ya la reprodujo y PM27 la reserva para C23 como concurrencia transversal.

No modifica `main`, `release`, PR #38, Netlify ni datos de Supabase. Toda inspección remota de C21 es de solo lectura. **La migración C21 no se ha aplicado en ningún proyecto Supabase.**

## Estado histórico contrastado

PM14 ya había corregido los defectos funcionales iniciales de entrega, cancelación, devolución, clientes y replay local. Entre otras garantías, el frontend actual:

- exige un local concreto para mutar encargos;
- usa `entrega-encargo:<id>` como identidad determinista de entrega;
- comprueba empresa al editar/borrar/anonimizar clientes;
- sincroniza el espejo de encargos mediante la RPC `registrar_encargo`;
- mantiene `clientes` y `encargos` también en blobs `almacen_kv`, con el riesgo de *lost update* ya documentado y diferido a C23.

## Inspección viva, solo lectura

En el proyecto Supabase `qjqorixtkilwsndqayyx` se localizaron `clientes_empresa`, `encargos_empresa` y `pagos_encargo`, todas con RLS, además de `registrar_encargo`, `registrar_pago_encargo` y `revertir_pago_encargo` como RPC `SECURITY DEFINER`. `registrar_encargo` no concede EXECUTE a `anon` y sí a `authenticated`.

La inspección también mostró dos hechos relevantes:

1. `encargos_empresa` tenía privilegios directos de tabla para `authenticated` (y grants heredados para `anon`). Sus políticas RLS verificaban pertenencia empresa/local, pero una escritura directa podía saltarse la regla de negocio `private.pm08_puede_operar_caja()` y las validaciones de `registrar_encargo`.
2. La RPC `registrar_encargo` validaba sesión, rol de caja, empresa, local, local operable, total y estado, pero no contrastaba que un `cliente_id` ya conocido en `clientes_empresa` perteneciera a la misma empresa. Tampoco serializaba el documento ni imponía una máquina de transiciones: un registro existente podía reinterpretarse con otro estado/total/cliente mientras mantuviera empresa/local.

En `flqercbgpgmmfaakrwkc` la búsqueda por objetos PM14 no devolvió estas relaciones/RPC. No se escribió nada en ninguno de los dos proyectos.

## Defectos C21 reproducidos

### C21-D1 — bypass de autorización por escritura directa

Una identidad autenticada con pertenencia empresa/local podía intentar mutar `encargos_empresa` directamente. La RLS protegía el tenant, pero no exigía el permiso funcional de caja que sí exige la RPC. Esto creaba dos fronteras de escritura con contratos distintos.

### C21-D2 — asociación de cliente cross-empresa no validada en backend

El frontend rechaza un cliente con `empresaId` explícitamente distinto, pero `registrar_encargo` no contrastaba `p_cliente_id` contra `clientes_empresa`. Un llamador directo de la RPC podía asociar a un encargo un id de cliente ya perteneciente a otra empresa.

### C21-D3 — documento terminal mutable / transición no cerrada

`registrar_encargo` hacía un UPSERT por id/contexto sin `FOR UPDATE`, sin matriz de estados y sin inmovilizar identidad económica al cerrar. Por tanto el espejo autoritativo podía reescribir un encargo Entregado/Cancelado/Devuelto o cerrar un Pendiente cambiando simultáneamente cliente/total.

## Remediación cerrada en rama de trabajo

`supabase/migrations/20260914090000_pm27_c21_encargos_authorization_hardening.sql` aplica un cambio mínimo sobre la frontera del encargo:

- revoca mutaciones directas de `encargos_empresa` a `authenticated` y todos los privilegios de tabla a `anon`; `authenticated` conserva `SELECT` sujeto a RLS;
- conserva la firma pública de `registrar_encargo`, `SECURITY DEFINER` y `search_path` endurecido;
- mantiene sesión, `pm08_puede_operar_caja`, empresa/local y local operable como requisitos;
- exige `cliente_id` y rechaza un id que ya exista en `clientes_empresa` con otra empresa;
- conserva compatibilidad con clientes legacy aún no espejados: ausencia de fila en `clientes_empresa` no se interpreta como pertenencia ajena;
- bloquea el encargo existente con `FOR UPDATE` antes de validar transición/saldo;
- fija transiciones: Pendiente→Pendiente/Entregado/Cancelado, Entregado→Entregado/Devuelto, Cancelado→Cancelado, Devuelto→Devuelto;
- un replay del mismo estado terminal devuelve la fila ya comprometida sin reescribir `updated_at` ni metadatos;
- impide cambiar cliente cuando existe saldo cobrado neto y rechaza un total inferior a lo ya pagado;
- al avanzar de estado conserva total y cliente del documento anterior;
- persiste en `datos` las identidades autoritativas `empresaId`, `localId`, `clienteId`, además de total/estado.

La remediación no reemplaza ni modifica `registrar_pago_encargo`, `revertir_pago_encargo`, `pagos_encargo` ni el ledger global. No crea otro motor de idempotencia.

## Contrato reproducible y gate

`tests/pm27/c21-encargos-anticipos-clientes.mjs`:

- reproduce sobre las migraciones PM14 la falta histórica de validación de cliente, lock, máquina de estados y revocación de escritura directa;
- verifica ACL, sesión/rol, tenant, local operable, cliente, `FOR UPDATE`, transiciones, saldo neto, terminales, identidad JSON y compatibilidad frontend;
- incluye mutaciones negativas deliberadas contra el revoke directo, el guard cross-empresa y la inmutabilidad terminal;
- ejecuta todos los contratos JavaScript de raíz de `tests/pm14` y después `tests/pm27/c20-inventarios-conteos.mjs`, que arrastra la regresión acumulada anterior.

El run `34820565962` completó en `SUCCESS`: SHA exacto, referencias protegidas, base C20, alcance de cuatro archivos, sintaxis, contrato C21, regresiones, evidencia de no-despliegue y árbol limpio quedaron en verde sobre `c1e70097b543cf53f6f2c5eb8709037d6e557c4f`.

## Criterio de cierre

El diff desde C20 queda limitado a estos cuatro archivos:

- `supabase/migrations/20260914090000_pm27_c21_encargos_authorization_hardening.sql`
- `tests/pm27/c21-encargos-anticipos-clientes.mjs`
- `tests/pm27/PM27_C21_ENCARGOS_ANTICIPOS_CLIENTES.md`
- `.github/workflows/pm27-c21-encargos-anticipos-clientes.yml`

`main` debe seguir en `93a570badba1c5375febfbddc1dffdbcef003dcd` y `release` en `a97740987be57aa9646f6a06e69b2230f140ec5f`. No hay despliegue ni aplicación remota de la migración C21 como parte de este cierre. El cierre documental solo es definitivo cuando este commit posterior al primer gate vuelva a terminar `SUCCESS` en el mismo workflow exact-SHA.
