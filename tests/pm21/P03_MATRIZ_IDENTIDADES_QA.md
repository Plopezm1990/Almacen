# PM21 P03 — Matriz de pruebas positiva/negativa con identidades QA reales

Tercer punto de PM21. Ejecuta contra QA, con sesiones reales (no solo lectura de
código), la matriz de autorización diseñada en P01 §6, y cierra el hueco de
identidad que P01 había señalado en §5.

## 0. Corrección de método: el hueco de "identidad revocada/inactiva" ya estaba cubierto

P01 §5 concluyó que faltaba una identidad QA con `perfiles.activo=false` o
`membresias_usuario.activo=false` para probar el caso negativo de sesión
revocada/inactiva. Al consultar directamente `perfiles`/`membresias_usuario`/
`auth.users` en QA para preparar este punto se confirmó que esa identidad **ya
existía**: `inactive@qa.invalid` (perfil "QA Inactivo", `activo=false` en ambas
tablas), documentada desde PM04 (`tests/pm04/fixtures.json`) como fixture
deliberada para este propósito exacto.

El hueco real no era la ausencia de la identidad, sino que el inventario de P01
§5 solo contó perfiles con **membresía activa** (los 7 que cubren
`ROLES_EMPLEADO`) y no buscó específicamente fixtures ya marcadas como
inactivas. Se documenta como corrección de método, en la misma línea que el
falso positivo de las 8 funciones de personal en P01 §1.2: no concluir un hueco
sin haber buscado expresamente lo contrario. No se creó ninguna identidad
nueva — habría sido una fixture redundante.

Identidades QA usadas en este punto (todas ya existentes, ninguna creada
específicamente para PM21):

| Identidad | Rol | Empresa/Local | Origen |
|---|---|---|---|
| `owner.a@qa.invalid` | Propietario (`todos_locales`) | QA-EMP-A | PM04 |
| `owner.b@qa.invalid` | Propietario (`todos_locales`) | QA-EMP-B | PM04 |
| `operator.a1@qa.invalid` | Cajero/a | QA-EMP-A / QA-A1 | PM04 |
| `operator.a2@qa.invalid` | Encargado | QA-EMP-A / QA-A2 | PM04 |
| `inactive@qa.invalid` | Básico, perfil y membresía inactivos | QA-EMP-A | PM04 |
| `pm11.smoke.a1@la-suite.test` | Camarero/a | QA-EMP-A / QA-A1 | PM11 |

## 1. Preparación de fixtures (autorización explícita del usuario)

Estas seis identidades ya existían pero no había ninguna contraseña operativa
disponible para iniciar sesión real contra QA. El usuario autorizó
explícitamente, con condiciones concretas, usar `service_role` **exclusivamente**
para restablecer la contraseña de estas seis identidades ya existentes — nunca
para ejecutar las pruebas de autorización en sí:

- No se creó ni eliminó ningún usuario.
- No se modificó correo, metadatos, membresía, rol, empresa ni local de ninguna
  identidad — únicamente el hash de contraseña (`auth.users.encrypted_password`,
  formato bcrypt estándar de GoTrue) y su `updated_at`.
- La contraseña se generó de forma aleatoria, se usó solo en memoria de esta
  sesión (fichero temporal en el scratchpad local, fuera del repositorio,
  eliminado al terminar) y no se ha impreso, guardado ni transcrito en ningún
  artefacto del repositorio, commit, log persistente o informe.
- Todas las pruebas de autorización siguientes se ejecutaron con la **anon key**
  pública del proyecto (la misma que usa el frontend) y el JWT real devuelto al
  iniciar sesión como cada identidad — nunca con `service_role`.

## 2. Matriz ejecutada (resultados reales, no simulados)

Todas las llamadas se hicieron contra la API real de QA (`/auth/v1/token`,
`/rest/v1/...`, `/storage/v1/object/...`) con las seis identidades anteriores.
Resultado: **12/12 verificaciones correctas**.

| # | Caso | Identidad | Objeto | Esperado | Resultado |
|---|---|---|---|---|---|
| 1 | Positivo | Propietario A | `movimientos_registro` de su empresa | Ve exactamente sus 2 filas (A1, A2) | PASS |
| 2 | Positivo/Negativo | Propietario B | `movimientos_registro` | Ve solo su fila (B1); no ve las de A | PASS |
| 3 | Positivo/Negativo | Encargado A2 | `movimientos_registro` | Ve solo la fila de su local (A2), no la de A1 | PASS |
| 4 | Negativo (rol) | Cajero/a A1 | `movimientos_registro` | 0 filas — su rol no está en la política | PASS |
| 5 | Negativo (sesión inactiva) | `inactive@qa.invalid` | `movimientos_registro` | Login válido (200), pero 0 filas — `la_usuario_activo()` la bloquea igualmente | PASS |
| 6 | Negativo (rol financiero) | Cajero/a A1 | INSERT en `albaranes_empresa` | Rechazado (403) — verifica en vivo la corrección de PM21 P02 | PASS |
| 7 | Positivo (rol financiero) | Encargado A2 | INSERT en `albaranes_empresa` | Aceptado (201) — Encargado sí tiene el rol financiero | PASS |
| 8 | Positivo | Propietario A | Subir objeto Storage bajo `QA-EMP-A/...` | Aceptado (200) | PASS |
| 9 | Negativo | Propietario B | Leer el objeto subido por A | Rechazado (400, política de ruta) | PASS |
| 10 | Positivo | Propietario A | Leer su propio objeto | Aceptado (200) | PASS |
| 11 | Limpieza | Propietario A | Borrar el objeto de prueba | Aceptado (200) | PASS |
| 12 | Limpieza | Propietario A | Borrar la fila de `albaranes_empresa` de prueba (#7) | Aceptado (204) | PASS |

Los casos 6-7 verifican en vivo, con sesión real, la propia corrección aplicada
en PM21 P02 (matices de rol) — no solo releyendo la política, sino
comprobando el rechazo/aceptación real por rol. Los casos 8-11 verifican en
vivo la corrección de Storage de PM21 P02.

Ningún dato de prueba queda en QA: se confirmó tras la ejecución, con una
consulta de solo lectura, que tanto la fila de `albaranes_empresa`
(`QA-P03-ALBARAN-TEST`) como el objeto de Storage
(`QA-EMP-A/pm21-p03-prueba.png`) fueron eliminados — 0 filas/objetos
residuales. La fila `QA-P03-ALBARAN-RECHAZO` (caso 6) nunca llegó a insertarse,
al ser rechazada por la política.

## 3. Casos diseñados en P01 §6 no ejecutados en este punto

Por alcance y para no precipitar la cobertura, quedan pendientes de un
siguiente punto (no bloquean el cierre de este, se registran para no perder
el hueco):

- Manipulación directa de una relación cruzada dentro de un RPC (p. ej.
  `empleado_id` de otra empresa pasado a un RPC de fichaje) — el matiz "negativo
  por cruce de contexto, no solo por nombre del recurso" de la fila 6 de la
  tabla de P01. **Actualización (P04)**: analizado en detalle; no ejecutable
  hoy sin crear una fixture nueva en QA (solo existe un empleado, inactivo, y
  ninguno en `QA-EMP-B`). Documentado con precisión en P04 §2, pendiente de
  autorización si se decide crear esa fixture.
- Un segundo Propietario de una empresa distinta con un local ya
  cerrado/fusionado (no confundir con la identidad de sesión inactiva, que ya
  quedó cubierta en este punto). **Actualización (P04)**: cerrado — verificado
  en vivo en P04 §1 que un local con `activo:false` bloquea la operación
  incluso para el Propietario con más alcance posible (`todos_locales`), sin
  necesidad de una segunda identidad de otra empresa.
- Réplica/idempotencia de un RPC de escritura ejecutado dos veces con el mismo
  `operationId` bajo sesión real HTTP (ya verificado en PM12 P08 contra una
  base local desechable, pero no contra QA con estas identidades concretas).
  Sigue pendiente tras P04 (ver P04 §3).

## 4. Archivos

- `tests/pm21/P03_MATRIZ_IDENTIDADES_QA.md` (este documento).
- `tests/pm21/p03-matriz-contract.mjs` (nuevo): confirma que este documento
  registra las 12 verificaciones con resultado PASS y que no contiene
  identificadores internos ni secretos. El propio script que ejecuta las
  llamadas de red reales contra QA no se incorpora al repositorio ni a ningún
  workflow: requiere credenciales que solo existen de forma efímera en la
  sesión interactiva que las preparó (ver §1), nunca en CI.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración — este punto no modifica
esquema ni código, solo ejecuta y documenta pruebas reales sobre lo ya migrado
en P02. Suite completa del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Las únicas escrituras en QA fueron: (a) el restablecimiento
de contraseña de las 6 identidades ya existentes, autorizado explícitamente
con las 9 condiciones del usuario, y (b) los datos de prueba de los casos 6-11,
todos limpiados sin dejar residuo, verificado por consulta directa tras la
ejecución. Producción y TPV sin tocar.

**PM21_P03_MATRIZ_IDENTIDADES=PASS**
