# F5 revisión de advisors Supabase

Fecha de consulta: 2026-10-01  
Estado: `REVISADO_CON_ALERTAS_EXISTENTES_NO_APLICAR`

## Alcance de la comprobación

Se consultaron los advisors de seguridad y rendimiento, en modo de solo
lectura, sobre los dos proyectos conectados:

- QA `qjqorixtkilwsndqayyx` — PostgreSQL 17.6.1.166.
- PROD `flqercbgpgmmfaakrwkc` — PostgreSQL 17.6.1.155.

También se revisaron el historial de migraciones y las tablas públicas. La
migración `20261001220000_abc_f5_c12_close_rehearsal` y la tabla
`abc_c12_ensayos_cierre` no están presentes en QA ni PROD. Por tanto, esta
consulta no valida la aplicación remota de C03-C12; solo describe el estado
actual de las bases conectadas.

## Resultado de seguridad

| Advisor | QA | PROD | Nivel observado |
| --- | ---: | ---: | --- |
| RLS habilitado sin política | 7 | 7 | INFO |
| SECURITY DEFINER ejecutable por `authenticated` | 106 | 95 | WARN |
| Protección de contraseñas filtradas | 1 | 1 | WARN |

Las alertas de `SECURITY DEFINER` afectan a funciones públicas históricas y
deben revisarse por intención, ACL y autenticación; no se revocan de forma
masiva porque eso podría romper RPC existentes. Las tablas con RLS sin
política y la protección de contraseñas requieren un alcance de seguridad
separado.

## Resultado de rendimiento

| Advisor | QA | PROD | Nivel observado |
| --- | ---: | ---: | --- |
| Claves foráneas sin índice de cobertura | 103 | 105 | INFO |
| Tabla sin clave primaria | 1 | 0 | INFO |
| Índices sin uso | 32 | 29 | INFO |

Los índices sin uso no se eliminan basándose solo en esta fotografía: primero
deben observarse cargas reales y verificarse dependencias. Las claves foráneas
sin índice requieren priorización por volumen y plan de consultas.

## Decisión de alcance

La revisión de advisors queda completada como diagnóstico. No se aplicaron
migraciones, no se modificaron políticas, ACL, funciones, índices ni Auth, y
no se ejecutó deploy. El siguiente trabajo debe ser un subproyecto de
remediación priorizada o la revisión de asesoría/proveedor, con autorización
específica para cada escritura remota.

## Referencias de Supabase

- [RLS habilitado sin política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER ejecutable por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Protección frente a contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Claves foráneas sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Tabla sin clave primaria](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key)
- [Índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
