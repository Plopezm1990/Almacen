# PM25-P02 — ensayo integral en entorno representativo desechable

Estado del candidato: **preparado, no aplicado a QA ni PROD**.

Baseline Git: `release@5264523fd3c271c4fcdf394aa0139b8033900bdd`.

## Motivo

El Punto 11 exige un ensayo conjunto de Auth, JWT, PostgREST, RLS, restauración y reversión. QA no puede tomarse como réplica de PROD: sus historiales, tablas, funciones y políticas difieren. La organización permanece en Supabase Free, por lo que no se usa Branching gestionado ni una copia de datos productivos.

Este candidato usa exclusivamente un stack local desechable de Supabase CLI, PostgreSQL 17, GoTrue y PostgREST. No necesita ni acepta credenciales remotas.

## Qué reutiliza

Se reutiliza la baseline productiva aislada de PM12 P08 ya incorporada al gate general:

- `tests/pm12/supabase-full/prepare-production-baseline.mjs`
- `tests/pm12/supabase-full/p08-auth-postgrest-rls-contract.mjs`
- `tests/pm12/supabase-full/p08-production-baseline-contract.mjs`

La preparación elimina fixtures QA y levanta únicamente el subconjunto productivo necesario para el contrato PM12.

## Ensayo integral

1. Arranca Auth, PostgREST y PostgreSQL 17 locales.
2. Ejecuta PM12 P08 con usuarios reales de GoTrue y JWT reales.
3. Comprueba:
   - rechazo anónimo;
   - autorización por rol y empresa/local;
   - aislamiento RLS;
   - denegación de escritura directa;
   - idempotencia/concurrencia;
   - ajuste de stock y su **reversión operativa** mediante la cancelación real del conteo.
4. Obtiene un backup SQL **solo de datos** de `public.stock_ubicacion` usando el `pg_dump` del propio contenedor PostgreSQL 17.
5. Registra conteo y huella MD5 del conjunto de filas.
6. Simula pérdida controlada eliminando únicamente esas filas dentro del stack efímero.
7. Restaura el backup con `psql` del mismo contenedor y exige igualdad exacta de conteo + huella.
8. Vuelve a iniciar sesión mediante Auth con los usuarios sintéticos existentes.
9. Decodifica y valida claims básicos de los JWT.
10. Repite las consultas PostgREST y exige que RLS mantenga el aislamiento después de restaurar.
11. Confirma que la reversión de negocio sigue materializada: stock total restaurado a 10, un movimiento `REVERSO` y presencia de las operaciones de ajuste y cancelación.

## Alcance y límites

Este ensayo demuestra **recuperación de datos operativos dentro de un stack Supabase completo y desechable**, no una restauración del servicio gestionado de Supabase ni una recuperación PITR/backup de PROD. En Free no se dispone del flujo de Branching gestionado para clonar PROD y no se introducen datos productivos en el ensayo.

No se considera evidencia de equivalencia total de esquema entre el fixture y PROD. Sí es evidencia de que, en un entorno representativo con Auth/JWT/PostgREST/RLS reales, una pérdida de datos del objeto operativo ensayado puede restaurarse de forma exacta y que la autorización y la reversión siguen funcionando después.

## Guardas

- Cero llamadas al proyecto Supabase remoto.
- Cero secretos remotos.
- Cero datos personales/productivos.
- No `db push`.
- No `migration repair`.
- No escrituras en QA o PROD.
- No cambios en `main` ni PR #38.
- Todos los GitHub Actions usados por el workflow están fijados por SHA.

## Criterio de cierre del candidato

El workflow `PM25 P02 — ensayo integral Auth JWT PostgREST RLS restore reversión` debe terminar con:

- `PM12_P08_SUPABASE_FULL_STACK=PASS`
- `PM25_P02_RESTORE_HASH_MATCH=PASS`
- `PM25_P02_JWT_REAL_POST_RESTORE=PASS`
- `PM25_P02_RLS_POST_RESTORE=PASS`
- `PM25_P02_POSTGREST_LEAST_PRIVILEGE_POST_RESTORE=PASS`
- `PM25_P02_REVERSION_PERSISTE_TRAS_RESTORE=PASS`
- `PM25_P02_INTEGRAL_POST_RESTORE=PASS`
- `PM25_P02_GATE=PASS`

Hasta obtener esos marcadores en CI, PM25-P02 no se considera cerrado.
