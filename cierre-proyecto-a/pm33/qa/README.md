# PM33 — Kit de validación (versionado). Estado real, sin dar nada por bueno sin ejecutarlo

Estado: scripts implementados, corregidos y versionados. El **preflight**
(`00_preflight.sql`) se ha **ejecutado de verdad** dos veces contra
`qjqorixtkilwsndqayyx` (QA): una vez con una versión con un defecto (v1,
ver corrección abajo) y una segunda vez, ya corregido, con el resultado
real documentado en `HALLAZGOS_P02.md` sección 11. Los demás scripts
(`01`-`04`) **no se han ejecutado contra ningún proyecto real**: el propio
preflight sigue bloqueando seguir contra QA tal como está hoy. Nada de
esto se ha aplicado a QA ni a PROD.

## Corrección sobre la versión anterior: el preflight v1 tenía el mismo defecto que debía detectar

La v1 de este preflight comprobaba "¿el cuerpo menciona `public.empleados`
Y NO menciona `almacen_kv`?" para decidir si abortar. La función real de
QA es **híbrida**: usa `almacen_kv` para leer el catálogo de locales (clave
`'locales'`) Y la tabla relacional `public.empleados` para los datos del
empleado. Con esa condición, `true AND NOT true` = `false`: **el aborto no
se disparaba**. El documento anterior afirmaba que el preflight "abortó,
correctamente, contra QA real" -- esa afirmación era incorrecta por partida
doble: no se había ejecutado el *script* en sí (se razonó a mano sobre
consultas de introspección sueltas), y ese razonamiento manual tenía el
mismo punto ciego que la condición.

**Corregido**: `00_preflight.sql` ya no usa heurísticas sobre qué tablas
menciona el texto. Compara el **hash md5 exacto** de
`pg_get_functiondef()` de la definición vigente contra una lista corta de
hashes conocidos y compatibles (hoy, únicamente el de la función real de
PROD, capturado directamente el 19/09/2026: `40d7bf2ea50776b7eb40a3fff239c0b4`).
Cualquier definición que no coincida EXACTAMENTE aborta -- sin intentar
adivinar "se parece lo suficiente". Esto cubre también, sin heurísticas
adicionales, "no existe la función" y "hay más de una sobrecarga".

**Ejecutado de verdad, ya corregido, el 19/09/2026 contra QA**: abortó,
con el hash real de QA (`3064430c63c97f6c50e05ff0117da862`, distinto del
de PROD) en el propio mensaje de error -- ver la salida literal en
`HALLAZGOS_P02.md` sección 11. La definición completa de QA, capturada en
esa misma ejecución, se conserva en `99_rollback_especifico_de_qa_20260919.sql`
por si alguna vez tocara esa función ahí (no planeado, no autorizado):
nunca se asume que el cuerpo de PROD serviría de reversión para QA.

## Qué significa esto para "validar el candidato en PostgreSQL 17 real"

Decisión ya tomada por el propietario: **preparar un entorno aislado
equivalente al modelo actual de PROD** (no reconciliar con el modelo de
QA, no incorporar P2 al cierre de PM33). QA se conserva intacto, sin
tocar. Ver `docs/plan-maestro/PM33_ENTORNO_AISLADO.md` (rama del
candidato) para la propuesta concreta de ese entorno -- pendiente de
presentar coste/destino/operaciones antes de crear o reactivar nada.

## Los scripts (implementados, corregidos, listos para el entorno correcto)

- **`00_preflight.sql`** — solo lectura. Aborta (hash exacto, ver arriba)
  si el entorno objetivo no es una copia real del modelo de PROD. Repetir
  contra cualquier entorno nuevo antes de considerar aplicar nada --
  nunca asumir que "ya se comprobó una vez".
- **`_entorno.mjs`** — (nuevo) exige que `SUPABASE_PROJECT_URL` (API) y
  `SUPABASE_DB_URL` (conexión directa) apunten al MISMO proyecto,
  comparando la referencia de proyecto extraída de cada URL. Sin esto, un
  `SUPABASE_DB_URL` copiado por error de otro proyecto escribiría datos de
  prueba en un entorno y los leería de otro, sin ningún error visible
  hasta mucho después. Lo usan `02`, `03` y `04`.
- **`_manifest.mjs`** — (nuevo) cada ejecución tiene un `RUN_ID` propio
  (fecha + al azar). Todo lo que crea `01`/`02` se registra en
  `._manifest.json` (gitignored) según se va creando, no al final --
  usuarios de Auth, empresas, locales, filas de `almacen_kv`, ids de
  membresía. `04_limpiar.mjs` borra EXACTAMENTE esos objetos, nunca "todo
  lo que empiece por qa-pm33-" (que alcanzaría restos de otra ejecución).
  Si algo falla a mitad de camino, el manifest se conserva (nunca se
  borra en un fallo) con el estado `fallo_parcial`, como registro de lo
  pendiente.
- **`01_crear_usuarios_prueba.mjs`** — crea usuarios de Supabase Auth
  desechables vía Admin API, uno por escenario, con el `RUN_ID` en el
  email. Se niega a correr si ya hay un manifest sin limpiar.
- **`02_cargar_datos_prueba.mjs`** — **corrige un defecto real** de la
  versión anterior: escribía la fila `almacen_kv` de `(emp-A, loc-A,
  'empleados')` dos veces por separado (una con el empleado de la
  colisión + el activo, otra con el heredado legítimo), y el segundo
  `INSERT ... ON CONFLICT DO UPDATE SET value = excluded.value`
  **reemplazaba el valor entero**, perdiendo los dos primeros. Ahora cada
  fila de `almacen_kv` se construye COMPLETA en memoria antes de un único
  `INSERT` -- nunca dos escrituras a la misma clave. Verifica los datos
  cargados con una consulta explícita (contenido de las filas de
  `almacen_kv`, número de perfiles y membresías) **antes** de marcar el
  manifest como `confirmado`; si la verificación falla, lo marca
  `fallo_parcial` y no continúa.
- **`03_ejecutar_bateria.mjs`** — lee los identificadores exactos del
  `RUN_ID` vigente desde el manifest (nunca valores fijos como
  `'loc-A'` a secas); exige que el manifest esté `confirmado` antes de
  arrancar. `signInWithPassword` real por usuario, sin `pg` directo.
- **`04_limpiar.mjs`** — borra exactamente lo del manifest (membresías,
  perfiles, filas de `almacen_kv`, locales, empresas, usuarios de Auth,
  en ese orden). Si algo falla, dice exactamente qué y conserva el
  manifest para reintentar o revisar a mano.

Ninguno de `01`-`04` se ha ejecutado contra un proyecto real. `00_preflight.sql`
corre primero siempre; mientras aborte contra el entorno objetivo (como
sigue haciendo contra QA), los pasos siguientes no tienen sentido
ejecutarlos ahí.

## Variables de entorno requeridas (ninguna con valor por defecto, ninguna committeada)

```
SUPABASE_PROJECT_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # solo 01 y 04 (crear/borrar usuarios)
SUPABASE_ANON_KEY=...           # solo 03 (login real de cada usuario de prueba)
SUPABASE_DB_URL=...             # solo 02 y 04 (conexión directa)
```

`_entorno.mjs` comprueba que `SUPABASE_PROJECT_URL` y `SUPABASE_DB_URL`
apunten al mismo proyecto antes de que `02`/`03`/`04` hagan nada.
