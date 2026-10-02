# F5 plan de remediación priorizada de advisors

Fecha: 2026-10-01  
Estado: `PLAN_LOCAL_PENDIENTE_APLICACION_REMOTA`

## Objetivo

Convertir la fotografía de advisors en trabajo seguro y reversible, sin
corregir masivamente objetos históricos ni asumir que un aviso INFO equivale a
un defecto. Las alertas se tratan por intención, exposición, impacto y carga
real.

## Orden recomendado

### P0 — Protección de contraseñas filtradas

QA y PROD informan una alerta WARN cada uno. Es una configuración de Auth,
no una migración SQL. Debe habilitarse primero en QA, comprobar el flujo de
alta/cambio de contraseña y revisar el impacto sobre usuarios existentes antes
de valorar PROD.

### P1 — Seguridad de funciones públicas

El advisor informa 106 funciones `SECURITY DEFINER` ejecutables por
`authenticated` en QA y 95 en PROD. No se revoca `EXECUTE` en bloque: varias
RPC públicas son la API intencionada del sistema. La revisión debe generar una
lista allowlist por función, comprobar `auth.uid()`, capacidad empresa/local,
`search_path` fijo y ausencia de acceso directo equivalente; solo las
funciones no justificadas se corrigen en una migración compensatoria separada.

### P1 — RLS habilitado sin política

Hay 7 tablas en cada proyecto. Antes de añadir políticas se debe comprobar su
ACL y si son tablas internas protegidas por RPC. Una tabla interna sin grants
directos puede mantenerse así y documentarse; una tabla expuesta necesita una
política de mínimo privilegio. No se crea una política genérica para todas las
tablas.

### P2 — Índices de claves foráneas

El advisor informa 103 claves foráneas sin índice de cobertura en QA y 105 en
PROD. Se priorizarán las tablas de mayor volumen y las rutas de borrado/joins
observadas mediante `EXPLAIN`, generando índices concurrentes cuando proceda.
No se añadirán índices solo por el contador del advisor.

### P2 — Índices sin uso y clave primaria

QA informa una tabla sin clave primaria y 32 índices sin uso; PROD informa 29
índices sin uso. La tabla sin clave primaria requiere identificar primero si es
un staging interno o un dato de negocio. Los índices sin uso no se eliminan
sin ventana de observación, revisión de dependencias y plan de recuperación.

## Alcance realizado en este punto

- Se clasificaron las alertas de seguridad y rendimiento de QA/PROD.
- Se mantuvieron fuera de alcance las escrituras remotas, los cambios de Auth,
  migraciones, grants, políticas, índices y deploys.
- C03-C12 continúa como candidato local validado; C12 no está aplicado en QA ni
  PROD.

## Siguiente subpunto

El siguiente subpunto aislado será el inventario de funciones `SECURITY
DEFINER` y sus grants, empezando por QA y en modo de solo lectura. La eventual
corrección será otra decisión independiente, con SQL compensatorio, preflight,
rollback y autorización específica.

## Referencias

- [Advisor de SECURITY DEFINER ejecutable por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Advisor de RLS sin política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Advisor de claves foráneas sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Advisor de tabla sin clave primaria](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key)
- [Advisor de índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
