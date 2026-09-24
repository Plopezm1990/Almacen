# F3/A09 — candidato de migración y plan de revisión

Estado: candidato **solo local y revisable**. No se creó un archivo en `supabase/migrations`; no hubo escrituras en QA/PROD.

## Identidad del candidato

- Fuente exacta: `tests/f3/a09/a09-migration-draft.sql`
- SHA-256 al 24/09/2026: `9cdf0c31c26016337993ae72db427c33694b28aa49593f74cad32bffaae23f50`
- Rama: `codex/abc-f3-a09-discounts-comps`
- Base de release: `89a163906d2b7c3c7c082e0c0d7a65c334e3871e` (A08 ya cerrada en PROD)
- Último commit de base revisado: `03e39592e8cd3d77e7045a4b3738f4a9fcaec4a9`

El borrador contiene dos tablas, cuatro funciones, cuatro índices, RLS/ACL y un trigger fiscal. El trigger protege el orden de locks línea/fiscalización y rechaza cantidades/importes obsoletos. La RPC de cuenta puede modificar repartos A08, líneas fuente, versiones y eventos solo tras una llamada autorizada. La función de proyección es privada y auxiliar; no es un emisor ni autoriza facturación.

## Puerta local antes de promoción

1. Mantener el candidato fuera de `supabase/migrations` hasta que se completen y revisen las comprobaciones de permisos/motivo/estados, A04 con modificadores negativos en PostgreSQL real y el análisis final de bloqueo/rendimiento. La rama debe permanecer separada de `main` y `release`.
2. Cuando ese gate se cierre, crear el nombre timestamped mediante `supabase migration new abc_f3_a09_descuentos_cortesias`; copiar el contenido revisado sin alterarlo y comparar el SHA-256 de su cuerpo con el candidato. No ejecutar `db push` ni `migration repair`.
3. Desde una base temporal UTF-8 vacía, ejecutar `node --test tests/f3/a09/*.test.mjs`, `node tests/f3/a09/local-pglite-contract.mjs` y el contrato de dos conexiones en PostgreSQL 16.15 y 17.11. Repetir la carrera A08/A09/fiscalización después de cualquier cambio SQL. Requerir cero diferencias en línea fuente/repartos y un único asiento/evento por operación.
4. Revisar en el archivo generado el orden de locks, los `search_path`, el uso de `auth.uid()`, la propiedad de las funciones, ACL/RLS, índices y los casos explícitamente rechazados. Comprobar el hash/cuerpo exactos y que no haya una segunda migración A09.

Preparación local verificada el 24/09/2026: 31/31 pruebas JS; contrato PGlite; PostgreSQL 16.15 y 17.11 con dos conexiones reales. En ambos motores pasan A08→A09 y A09→A08, fiscalización→A09 y A09→fiscalización, reintentos, payload conflictivo, versiones obsoletas, rollback sin eventos parciales y conciliación íntegra de cantidad/importes. Un defecto de reparto de céntimos descubierto por revisión independiente quedó corregido con rechazo explícito y vector equivalente JS/SQL. Esas pruebas justifican este candidato como material de revisión, no sustituyen las puertas pendientes del punto 1.

## Aplicación futura a QA/PROD

No está autorizada ni se propone en esta etapa. Si posteriormente se solicita, presentar antes el SQL final y su hash, el preflight de versiones/dependencias/objetos/ACL, ventana, impacto y recuperación; pedir autorización específica antes de cualquier escritura.

Impacto esperado de aplicar solo DDL: crear las estructuras, políticas de lectura y funciones; no altera líneas ni genera descuentos hasta invocar explícitamente la RPC. Las futuras invocaciones actualizan repartos/líneas/versiones y registros de auditoría bajo transacción. Si falla la DDL, cancelar/verificar la transacción; si ya se aplicó, preservar datos y preparar una migración compensatoria revisada. No eliminar operaciones ni reconstruir historial con `migration repair`.

## Reservado para la fase fiscal

La proyección a céntimos está probada como aritmética, pero el ajuste genérico `rounding_adjustment_cents` aún no tiene aceptación del formato fiscal ni del servicio emisor. La futura fase debe implementar el snapshot de documento/líneas con importes internos y proyectados, tipos de IVA, referencias/versiones A08/A09, ajuste y hash SHA-256 de JSON JCS (RFC 8785); validar ese snapshot en base de datos y confirmar su persistencia con un outbox antes de cualquier llamada externa. Si el emisor no puede conservar los importes y el ajuste sin reescribir la base o el IVA, se bloquea la emisión. A09 no realiza ni valida la emisión fiscal.
