# F5 / PM09 — candidato local de hardening de seguridad

Fecha de actualización: 2026-10-02
Estado: `CANDIDATO_PM09_HARDENING_VALIDADO_NO_APLICADO`

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

No se ejecutaron migraciones remotas, no se tocaron QA/PROD y no se hizo
deploy.
