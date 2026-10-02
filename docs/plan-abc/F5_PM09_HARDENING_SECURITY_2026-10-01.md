# F5 / PM09 — candidato local de hardening de seguridad

Fecha de actualización: 2026-10-02
Estado: `QA_APLICADO_VALIDADO_PROD_PENDIENTE`

## Alcance ejecutado

Se preparó un candidato local para los cinco wrappers PM09 que quedaron expuestos
en la revisión de funciones `SECURITY DEFINER`:

- `registrar_devolucion_venta_pm09`
- `registrar_venta_stock_pm09`
- `registrar_venta_stock_carrito_pm09`
- `revertir_venta_stock_pm09`
- `revertir_venta_stock_carrito_pm09`

También se endureció el helper privado
`private.pm09_bloquear_operation_id_stock`.

El candidato fija `search_path = ''` en las seis funciones y conserva las
referencias de negocio totalmente cualificadas (`public.*` y `private.*`). No
modifica las funciones base PM07/PM08, que siguen siendo responsables de
autenticación, tenant, capacidades, contexto operativo e idempotencia.

## Estado observado en QA

La lectura actual de QA confirma que los cinco wrappers públicos son
`SECURITY DEFINER`, no son ejecutables por `anon`, sí son ejecutables por
`authenticated` y todavía conservan `EXECUTE` para `service_role`. Tres
wrappers ya tienen `search_path = ''`; `registrar_venta_stock_pm09` y
`revertir_venta_stock_pm09` aún declaran
`search_path = public, auth, private, pg_temp`. El candidato homogeneiza los
cinco wrappers y revoca la concesión a `service_role`.

## Aplicación y verificación QA — 2026-10-02

Se aplicó la migración `abc_f5_pm09_security_hardening` en el proyecto QA
`qjqorixtkilwsndqayyx`. La consulta posterior confirmó:

- los cinco wrappers siguen siendo `SECURITY DEFINER`;
- los cinco tienen `search_path = ''`;
- los cinco son ejecutables por `authenticated`;
- ninguno es ejecutable por `anon` ni por `service_role`;
- `private.pm09_bloquear_operation_id_stock` no es ejecutable por roles cliente.

La aplicación no se hizo en producción. El advisor general mantiene sus avisos
existentes de funciones `SECURITY DEFINER` ejecutables por `authenticated` y
de tablas RLS sin políticas; esos avisos no son una regresión introducida por
este cambio y requieren revisión separada.

## Validación funcional y regresiva — 2026-10-02

Pasaron todos los contratos locales de PM09 y replay relacionados:

- historial, caja, IVA y resultados/margen;
- economía especial y fecha económica;
- aislamiento de empresa/local;
- robustez, replay e idempotencia;
- resultados LA-007 y rotación/margen LA-008;
- concurrencia y replay G1 P07.

La validación cubre el contrato de las RPC y su integración con el frontend sin
crear datos de negocio nuevos en QA. La comprobación funcional con datos reales
queda reservada a un smoke manual autenticado posterior si fuese necesario.

## Smoke manual del preview QA — 2026-10-02

El preview protegido cargó con la sesión autenticada `Local A1 · QA Empresa A,
S.L.`. Se abrió el módulo TPV y se mostró el historial de ventas sin registrar
un cobro, venta, devolución ni movimiento de stock nuevo. El TPV quedó operativo
para el local concreto. Se mantiene el aviso no bloqueante de sincronización
de `locales`, ya conocido y separado de este hardening.

## Negative tests y permisos

Los contratos locales verifican que:

- no existe concesión a `public` ni `anon`;
- `service_role` se revoca explícitamente en los cinco wrappers;
- únicamente `authenticated` recibe `EXECUTE`;
- el helper privado no es ejecutable por roles de cliente;
- permanecen las barreras `fecha_requerida` y `operation_id_conflict`;
- se conserva el bloqueo global de `operation_id` y la fecha económica.

## Puerta de compatibilidad antes de aplicar remoto

La revisión read-only de QA mostró una concesión explícita de `EXECUTE` a
`service_role` en los cinco wrappers. Por eso este cambio se deja como
candidato local: antes de aplicarlo en QA/PROD hay que inventariar si algún
backend, función o job usa esos wrappers con `service_role`. Si existe ese
caller, debe migrarse a un RPC interno controlado o aprobarse expresamente una
excepción; no se debe restaurar el permiso por defecto sin esa decisión.

## Evidencia

- Migración candidata:
  `supabase/migrations/20261001230000_abc_f5_pm09_security_hardening.sql`
- Contrato positivo:
  `tests/f5/pm09/pm09-security-hardening-contract.mjs`
- Contrato negativo:
  `tests/f5/pm09/pm09-security-hardening-negative-contract.mjs`
- Workflow: `.github/workflows/abc-f5-pm09-security.yml`

La migración ya se ejecutó únicamente en QA y no se hizo deploy de frontend.
Producción queda pendiente de una validación funcional y una autorización
separada.
