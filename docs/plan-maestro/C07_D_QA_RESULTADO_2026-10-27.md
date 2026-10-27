# C07-D · Resultado de reconciliación y primera migración QA

Fecha: 27/10/2026  
Proyecto Supabase: `qjqorixtkilwsndqayyx` (QA)  
Producción: no modificada y fuera del alcance autorizado.

## Resultado

La reconciliación C05 y la primera base C07-D se aplicaron correctamente en
QA.

Migraciones registradas en QA:

- `abc_f7_c07d_c05_reconcile`
- `abc_f7_c07d_fiscal_chain_queue`
- `abc_f7_c07d_fk_indexes`
- `abc_f7_c07d_entity_fk_index`

El hardening de concurrencia de la cadena se ejecutó mediante SQL idempotente
directo en QA después de que el conector de `apply_migration` expirase dos
veces con ese bloque concreto. El SQL reproducible está versionado en
`supabase/migrations/20261027133000_abc_f7_c07d_chain_hardening.sql`.

## Reconciliación C05

- Series reconciliadas: 2.
- Documentos reconciliados: 8.
- Series con `entidad_fiscal_id` nulo: 0.
- Documentos con `entidad_fiscal_id` nulo: 0.
- Se conservaron los números, estados, locales y documentos existentes.
- La unicidad pasó a considerar empresa, emisor fiscal, tipo, serie y número.
- La RPC de configuración de series quedó alineada con el emisor fiscal
  activo del local.
- Los mapeos ambiguos abortan la migración; no se adivina un emisor.

## Registro fiscal y cola

Se crearon:

- `public.abc_c07d_registros_fiscales`
- `public.abc_c07d_cola_fiscal`

Controles implementados:

- partición de la cadena por `empresa_id + entidad_fiscal_id`;
- snapshot JSON inmutable;
- `hash_anterior_sha256` y `hash_sha256` SHA-256;
- secuencia fiscal protegida por bloqueo transaccional por emisor;
- rechazo de modificaciones o borrados del registro fiscal;
- estados de cola `PENDIENTE`, `EN_PROCESO`, `ACEPTADO`, `RECHAZADO`,
  `ERROR` y `DESCONOCIDO`;
- reclamación con `claim_token`, intentos y lease temporal;
- separación de la cola fiscal respecto de `efectos_pendientes`;
- RLS habilitado y revocación de DML directo;
- RPC únicamente para usuarios autenticados con capacidad del emisor;
- ninguna llamada a AEAT ni almacenamiento de certificados o secretos.

## Evidencia de pruebas

- Contrato estático C07-D: `PASS`.
- Preflight C07-D solo lectura: `PASS`.
- Contrato C05: `PASS`.
- Smoke autenticado transaccional: `PASS`.
- Smoke endurecido con cadena y cola: `PASS`.
- El smoke se ejecutó con `ROLLBACK`; no dejó datos C07-D de prueba.
- Conteo final QA: 0 registros C07-D, 0 elementos de cola y 0 elementos en
  estado `ERROR`.
- Advisors posteriores: permanecen avisos generales históricos; los avisos
  RLS sin política son intencionados porque las tablas no admiten DML directo.

## Qué queda

1. Integrar el registro C07-D con el flujo real de emisión `EMITIDO`.
2. Añadir el panel de estado de cola al flujo visual QA.
3. Ejecutar un ensayo persistente controlado con fixture documentada.
4. Validar el payload fiscal definitivo con la asesoría de cada empresa.
5. Diseñar el adaptador por empresa y proveedor/sandbox antes de cualquier
   conexión real con la AEAT.
6. Mantener producción bloqueada hasta cerrar la evidencia y la revisión
   fiscal/legal.

## Actualización C07-D.1 — 2026-10-27

La integración con F4 quedó implementada y probada en QA. El checkout
`COMPLETADO` invoca `abc_c07d_emitir_checkout`, que enlaza C05 `EMITIDO`, la
cadena C07-D y la cola `PENDIENTE` en una sola transacción. El TPV muestra en
QA el número, la secuencia y el estado de cola mediante una RPC de lectura
acotada. El smoke volvió a terminar con `ROLLBACK`, por lo que el conteo QA
sigue en 0 registros C07-D y 0 elementos de cola.

El punto 1 y el punto 2 de “Qué queda” están completados en alcance QA. Sigue
el punto 3: ensayo persistente controlado, que ya se ejecutó con un fixture QA
documentado: 1 registro C07-D, 1 elemento de cola `PENDIENTE` y 0 elementos en
`ERROR`. La RPC de lectura autenticada devolvió C05 `EMITIDO`, `TPV-5`,
secuencia `1`, hash y transporte `DISABLED`; la lectura directa de las tablas
fue rechazada correctamente por RLS. Sigue C07-D.2 para cerrar la
configuración persistente de serie y el contrato del adaptador por empresa o
asesoría. AEAT y producción siguen fuera.
