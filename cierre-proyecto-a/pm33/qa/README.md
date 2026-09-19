# PM33 — Kit de validación QA (versionado, NO ejecutado más allá del preflight)

Estado: scripts implementados y versionados. El **preflight** (`00_preflight.sql`)
sí se ejecutó de verdad contra `qjqorixtkilwsndqayyx` el 19/09/2026 (solo
lectura, dentro de la autorización existente). Los demás scripts
(`01`-`04`) **no se han ejecutado**: el propio preflight bloquea seguir,
por la razón que se explica abajo. Nada de esto se ha aplicado a QA ni a
PROD.

## Hallazgo del preflight: QA no es un objetivo válido para este candidato, hoy

Se pidió explícitamente no asumir que la definición/permisos de QA
coinciden con los de PROD. No coinciden, y la diferencia es sustancial,
no cosmética: `obtener_contexto_operativo()` en QA es una
**reimplementación completa**, no una variante del mismo diseño:

| | PROD (hoy) | QA (hoy) |
|---|---|---|
| Fuente de datos de empleado | `almacen_kv` (JSON, clave `'empleados'`) | tabla relacional `public.empleados` |
| Locales | implícitos en `almacen_kv` | tabla relacional `public.locales`, catálogo por empresa |
| Autorización | mezcla membresías + vía heredada (el defecto R10 que corrige este candidato) | **solo** `membresias_usuario`, sin vía heredada |
| Forma de la respuesta | `rol/empresaId/localId/empleado/empleadosFichaje/proveedores/fichasProduccion/cobrosEncargos` | `ok/rol/empresaId/localId/todosLocales/empresas/locales/empleado/empleadosFichaje/modulos` |
| Errores | `errcode 42501` con mensajes en español | excepciones con nombre (`contexto_sesion_requerida`, etc.) |

Aplicar el candidato PM33 P03/P04 (diseñado para el modelo real de PROD)
sobre QA **sustituiría una implementación ya migrada y más estricta por
una más antigua** — no sería una validación neutral, sería un
retroceso real para QA. El preflight (`00_preflight.sql`) lo detecta
automáticamente (no es solo un aviso en un documento: es un `DO` block
que compara la definición real contra lo que el candidato asume, y
**aborta con `RAISE EXCEPTION`** si no coincide) y así lo hizo al
ejecutarlo hoy.

Esto es coherente con lo ya registrado en el Punto 5 del documento
maestro (`cierre-proyecto-a/SEGUIMIENTO_18_PUNTOS.md`): QA tiene 27
migraciones que no existen en PROD, y P2 está por delante de PROD en
varios frentes. Este hallazgo es la prueba concreta de esa deuda de
trazabilidad aplicada a esta función exacta.

## Qué significa esto para "validar P04 en PostgreSQL 17 real"

Sigue pendiente, pero **no puede cerrarse contra `qjqorixtkilwsndqayyx`
tal como está hoy** sin antes decidir una de estas dos cosas (decisión
del propietario, no tomada aquí):

1. **QA está en un frente de migración distinto** (el modelo relacional es
   el futuro, todavía no reconciliado con PROD) y este candidato PM33
   debería, en su momento, dirigirse a ese modelo en vez de al de
   `almacen_kv` — lo que cambiaría sustancialmente el propio candidato.
2. **QA necesita primero un entorno "espejo de PROD"** (mismo modelo
   `almacen_kv`) para poder validar este candidato tal como está, sin
   tocar la implementación ya migrada de QA. Candidatos: reactivar el
   proyecto `ytavvyusrmwandchjyei` (L&A Suite P2-R03 validation, hoy
   `INACTIVE` — activar un proyecto pausado tiene coste real, requiere
   autorización) tras comprobar que SU función coincide con el modelo de
   PROD, o crear una rama de desarrollo Supabase sobre QA o PROD (tiene
   coste, requiere `confirm_cost` y autorización).

## Los scripts (implementados, listos para el entorno correcto)

- `00_preflight.sql` — solo lectura. Ejecutado de verdad contra QA hoy.
  Repetirlo contra cualquier entorno antes de considerar aplicar nada:
  aborta solo si el entorno no coincide con el modelo asumido.
- `01_crear_usuarios_prueba.mjs` — crea usuarios de Supabase Auth
  desechables vía Admin API (`SUPABASE_SERVICE_ROLE_KEY`, nunca en este
  repo), uno por escenario, y escribe sus UIDs reales a
  `._usuarios_prueba.json` (gitignored, se genera en tiempo de
  ejecución).
- `02_cargar_datos_prueba.mjs` — con esos UIDs reales, inserta filas de
  prueba en `perfiles`/`membresias_usuario`/`almacen_kv`, todas
  prefijadas `qa-pm33-` para ser triviales de identificar y borrar.
- `03_ejecutar_bateria.mjs` — con `SUPABASE_ANON_KEY` (o publishable key)
  y `signInWithPassword` real por usuario, ejecuta los escenarios
  centrales de aislamiento (equivalentes a T01-T05, T16-T20, D1-D2 de la
  batería local) vía PostgREST real, JWT real -- no `pg` directo.
- `04_limpiar.mjs` — borra las filas de prueba y los usuarios de Auth
  creados en `01`, en ese orden.

Ninguno de `01`-`04` se ha ejecutado. `00_preflight.sql` corre primero
siempre; si aborta (como hizo hoy contra QA), los siguientes pasos no
tienen sentido ejecutarlos ahí.

## Variables de entorno requeridas (ninguna con valor por defecto, ninguna committeada)

```
SUPABASE_PROJECT_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # solo 01 y 04 (crear/borrar usuarios)
SUPABASE_ANON_KEY=...           # solo 03 (login real de cada usuario de prueba)
SUPABASE_DB_URL=...             # solo 02 (conexión directa para insertar datos de prueba)
```
