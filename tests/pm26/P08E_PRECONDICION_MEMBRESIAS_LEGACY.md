# PM26 P08e — Precondición de autorización backend legacy

## Estado

**BLOQUEADO, DOCUMENTADO Y APLICADO COMO GUARD. NADA APLICADO NI
DESPLEGADO.** El usuario autorizó exactamente esto: reinspeccionar
producción en solo lectura, confirmar el impacto de `membresias_usuario`
vacía, determinar cómo crear una vinculación segura, comparar
alternativas, endurecer el preflight y preparar artefactos y pruebas —
subiendo el commit únicamente a `claude/pm26-preparacion-tecnica`.

No se creó ninguna membresía. No se aplicó ninguna migración. No se
escribió en producción, QA ni TPV. No se desplegó en Netlify. No se tocó
`main` ni `release`. No se fusionó ni cerró la PR #38.

**Conclusión: no existe hoy una fuente backend fiable que vincule al
propietario con una empresa y un local.** Tal como estaba previsto en la
autorización, me detengo en ese punto, lo documento y **no invento ni
debilito la autorización**. Lo que sí hago es convertir el hallazgo en un
guard que impide aplicar el Defecto L a ciegas.

---

## 1. Reinspección en solo lectura de producción

Consultas exclusivamente de catálogo y de agregados. No se leyó ningún
dato personal, token ni secreto, y no se publica ningún identificador
interno.

### 1.1 Estado de las tablas

| Tabla | Filas |
|---|---|
| `membresias_usuario` | **0** |
| `perfiles` | 2 (1 Propietario activo, 1 Encargado) |
| `auth.users` | 2 |
| `prefiltros_candidatos` | 0 |
| `almacen_kv` | **1** |
| `movimientos_stock` | 0 |
| `stock_operaciones` | 0 |
| `stock_ubicacion` | 0 |

Coincide con la verificación independiente del usuario.

### 1.2 Qué tablas existen realmente

`almacen_kv`, `auditoria_registro`, `errores_sistema`,
`fichajes_registro`, `membresias_usuario`, `movimientos_registro`,
`movimientos_stock`, `operaciones_procesadas`, `perfiles`,
`prefiltro_limites`, `prefiltros_candidatos`, `stock_operaciones`,
`stock_ubicacion`, `suscripciones_push`.

**No existe ninguna tabla `empresas` ni `locales`.** El concepto de
empresa no tiene ninguna entidad propia en el backend.

### 1.3 Dónde vive el estado de la aplicación

`almacen_kv` es un almacén clave/valor puro: `key text` (PK),
`value jsonb`, `updated_at`. **No tiene columna de usuario, ni de
empresa, ni de local.** Su autorización es por `perfiles.rol` más una
lista blanca de claves — sin ninguna dimensión de empresa o local en
ninguna de sus 4 políticas.

La tabla tiene **una sola fila**, y su clave es `disenoMenu`: una
preferencia de interfaz. **La clave `locales` no existe.** Es decir: el
backend no guarda hoy ninguna definición de ningún local ni de ninguna
empresa. Ese estado vive únicamente en el navegador.

### 1.4 Estructura de `perfiles`

`user_id`, `rol`, `empleado_id`, `created_at`, `updated_at`, `nombre`,
`activo`. **No tiene `empresa_id` ni `local_id`.** No puede vincular un
usuario con una empresa o un local.

## 2. Impacto real de `membresias_usuario` vacía

No se asume nada por el hecho de que el helper exista o aparezca en
otras políticas: se leyó su cuerpo real.

```sql
private.la_usuario_activo()
  select (select auth.uid()) is not null
     and exists( select 1 from public.membresias_usuario m
                  where m.user_id=(select auth.uid()) and m.activo=true )
     and not exists( ... perfiles inactivo ... );
```

`private.la_tiene_local(empresa, local)` empieza por
`private.la_usuario_activo()`. Con `membresias_usuario` vacía ese
`exists` es falso, así que:

- `la_usuario_activo()` → **false para todo usuario**
- `la_tiene_local()` → **false para todo usuario**
- `la_tiene_empresa()` → **false para todo usuario**
- `pm07_puede_gestionar_stock()` → **false** (depende de `la_usuario_activo`)

**Consecuencia directa:** aplicar hoy la migración del Defecto L no
aislaría nada — convertiría un problema de exposición en una
**interrupción total** del flujo de prefiltros para el propietario
legítimo, que dejaría de poder crear, leer y borrar.

### 2.1 Por qué nadie lo había notado

Tres tablas ya dependen de `la_tiene_local` en producción
(`movimientos_stock`, `stock_operaciones`, `stock_ubicacion`) y sus
políticas deniegan todo desde siempre. **Las tres están vacías (0
filas)**, así que no hay nada que leer y el helper muerto nunca dio la
cara. El modelo multilocal se diseñó y se desplegó, pero **nunca se
llegó a poblar**.

### 2.2 El único primitivo que sí funciona hoy

`private.es_propietario_activo()` — `exists(... perfiles where user_id =
auth.uid() and activo and rol='Propietario')`. Es el que usan de verdad
las políticas de `perfiles`. Funciona, **pero no tiene ninguna dimensión
de empresa ni de local**, así que no sirve para el Defecto L.

`private.la_rol()` también funciona porque cae primero en `perfiles` y
solo después en `membresias_usuario`.

## 3. Alternativas comparadas

| # | Alternativa | Aislamiento real | Veredicto |
|---|---|---|---|
| A | **Bootstrap administrativo de `membresias_usuario`** | Sí | **Seleccionada**, pero bloqueada por la precondición de 3.1 |
| B | Adaptar `es_propietario_activo()` / `perfiles.rol` | **No** | Rechazada: no tiene empresa ni local; no corrige el Defecto L |
| C | Derivar empresa/local del JSON de `almacen_kv` | **No** | Rechazada: es circular — el Propietario puede escribir esa clave, así que podría asignarse cualquier empresa o local |
| D | Confiar en el `empresa_id`/`local_id` que envía el navegador | **No** | Rechazada: es exactamente la vulnerabilidad del Defecto L |
| E | Añadir `empresa_id`/`local_id` a `perfiles` | Sí | Rechazada por ahora: duplica el modelo que ya existe (`membresias_usuario`) y exige igualmente decidir qué valores poner — mismo bloqueo que A, con más superficie |

La **A** es la mínima y la más segura: usa el mecanismo que el sistema
ya tiene diseñado, es `SECURITY DEFINER`, no confía en el navegador, no
permite que un usuario se asigne otra empresa o local, y no exige
hardcodear ningún identificador en el repositorio.

### 3.1 Por qué A está bloqueada hoy

Para crear una membresía hay que decidir **qué `empresa_id` y qué
`local_id`**. Y en el backend **no existe ningún catálogo contra el que
validarlos**: no hay tablas `empresas`/`locales`, y la clave `locales`
ni siquiera está en `almacen_kv`. Los únicos valores posibles vendrían
del estado del navegador, que es justo lo que no se puede tomar como
fuente de autoridad.

Una membresía creada con valores inventados por mí sería una
autorización fabricada: parecería aislamiento sin serlo. **No la creo.**

### 3.2 Camino seguro, para autorización posterior

Es un procedimiento **administrativo y manual**, fuera del navegador, y
requiere una autorización nueva y explícita:

1. **Que exista un catálogo backend de locales.** Persistir la clave
   `locales` en `almacen_kv` desde la aplicación, o —mejor— crear una
   tabla real de locales. Sin esto, ninguna membresía es comprobable.
2. **Que una persona con acceso administrativo confirme** qué empresa y
   qué local corresponden a la cuenta propietaria, tomándolo del
   catálogo del paso 1, nunca de una suposición mía.
3. **Insertar una única membresía** con esos valores, vía SQL
   administrativo (nunca desde el cliente), con `activo=true` y, o bien
   `todos_locales=true`, o bien un `local_id` concreto distinto de
   `TODOS`.
4. **Verificar** que el preflight endurecido pasa (sección 4) antes de
   plantear siquiera aplicar la migración del Defecto L.

Los identificadores concretos los aporta el operador en el momento de
ejecutar; **este repositorio no los contiene ni los contendrá**.

## 4. Preflight endurecido

Dos comprobaciones nuevas, en el preflight embebido y en el
independiente (siguen siendo byte a byte idénticos):

**5) Membresías activas.** Si `membresias_usuario` no tiene ninguna fila
activa, aborta: `la_tiene_local` devolvería `false` para todos y la
migración dejaría el flujo inutilizable.

**6) Cobertura por propietario.** Cada `perfiles` activo con rol
`Propietario` debe tener una membresía activa y **coherente con lo que
el helper exige de verdad**: `empresa_id` no vacío y, o bien
`todos_locales`, o bien un `local_id` concreto distinto de `TODOS`. Si
alguno no la tiene, aborta nombrando cuántos.

Ambas viven entre los marcadores `-- PM26_P08E_GUARD_INICIO` y
`-- PM26_P08E_GUARD_FIN`, para que el contrato pueda aislarlas y
comprobar por control negativo real que son ellas —y no otra cosa del
preflight— las que rechazan el estado de 0 membresías.

Ninguna de las dos usa identificadores hardcodeados: son genéricas y se
evalúan contra el catálogo real en el momento de aplicar.

**El estado actual de producción (0 membresías) falla de forma explícita
en las pruebas**, que es justo lo que se pedía.

| Archivo | SHA-256 |
|---|---|
| `tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql` | `667059f9e0b2fa0bce42daaa024d557524f6f42cb3a1a865cc9ac9636b88218c` |
| `tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql` | `edb3ca7e9afc1051dc1857e639938fb7fe500874e8931312538d7ed4f3cff582` |
| `tests/pm26/p08e-precondicion-membresias/validar-membresias.sh` | `f677d9094d0241292f733afe160fb0eb014b6ba65669e31a5e004ef60b1381c8` |
| `tests/pm26/p08e-precondicion-membresias/comportamiento-membresias.sql` | `c745d581a40802e90b7b61978f8dd971911ba07229f4feedec575cc0e9ef7b9b` |

Ambos siguen **fuera de `supabase/migrations`** y no se han ejecutado en
ningún entorno real.

## 5. Reproducción en PostgreSQL local aislado

`tests/pm26/p08e-precondicion-membresias/validar-membresias.sh`, sobre
una base temporal creada y destruida por el propio script, con barrera
que rechaza cualquier `PGHOST` no local.

| Escenario | Resultado exigido |
|---|---|
| **0 membresías** (estado real de producción) | Preflight rechaza con mensaje explícito, y la migración completa aborta sin crear columnas |
| Propietario activo sin membresía | Rechazado por la comprobación 6 |
| Membresía incoherente (`local_id='TODOS'` sin `todos_locales`) | Rechazada |
| Membresías válidas | Preflight pasa y la migración se aplica |
| Creación en empresa/local autorizados | Permitida (`M1`) |
| Empresa ajena / local ajeno | Bloqueados (`M2`, `M3`) |
| Usuario sin membresía | Bloqueado (`M4`) — el rol Propietario no basta |
| Lectura cruzada | Bloqueada (`M5`) |
| Borrado cruzado | 0 filas afectadas, la ajena intacta (`M6`) |
| Compatibilidad con el parche P08d | `INSERT` con empresa/local y `DELETE ... RETURNING` funcionan (`M7`) |
| Desactivar la membresía | Retira el acceso de inmediato (`M8`) |
| Reaplicación | Rechazada |
| Rollback | Controlado, columnas retiradas |
| Guard tras revertir | Sigue detectando al propietario sin membresía |

`M4` y `M8` son los que demuestran el punto central: **el aislamiento lo
da la membresía, no el rol**.

## 6. Contrato y gate propios

`tests/pm26/p08e-contract.mjs`, ejecutado por
`.github/workflows/pm26-p08e-precondicion-membresias.yml` en dos trabajos
(`validar` → `gate-final`).

Lo que certifica, además de los marcadores y las huellas:

- El bloque de preflight sigue siendo **byte a byte idéntico** entre el
  embebido y el independiente: endurecer solo uno dejaría sin guard a la
  migración real.
- El guard exige exactamente lo que exige `private.la_tiene_local`
  (empresa no vacía, y `todos_locales` o un local concreto distinto de
  `TODOS`), y es **de solo lectura**: sin `insert`, `update`, `delete`,
  `alter`, `grant` ni `revoke`.
- **Control negativo real en PostgreSQL local:** con `membresias_usuario`
  vacía, el preflight íntegro aborta; el mismo preflight con el guard
  recortado **pasa**. Es lo que demuestra que son las comprobaciones 5 y
  6 —y no otra comprobación anterior que ya estuviera— las que rechazan
  el estado actual de producción.
- El preflight no contiene **ningún UUID**, y todos los de la batería son
  sintéticos (un solo dígito repetido).
- Los gates históricos P06h, P07b, P07c, P08a, P08b, P08c y P08d siguen
  exigiendo lo suyo: P08e solo añade comprobaciones, no relaja ninguna.

El paso protector del workflow se ancla al **commit de cierre de P08d**
(`67dbb6e`), no a `origin/main` ni al HEAD vivo, y comprueba que P08e no
ha tocado `fuente.js`, `source-recovery/`, `index.html`,
`reset-pruebas-preview.js`, `_headers` ni `supabase/`.

## Qué NO se hizo

- **No se creó ninguna membresía**, ni real ni de prueba, en ningún
  entorno.
- No se aplicó ninguna migración.
- No se escribió en producción, QA ni TPV.
- No se desplegó en Netlify.
- No se modificó `main` ni `release`.
- No se fusionó ni cerró la PR #38.
- No se cambió SSO, dominios, variables de entorno ni configuración
  remota.
- No se leyó ni se publicó ningún dato personal, token o secreto: solo
  catálogo y agregados.
- No se inventó ni se debilitó ninguna autorización.

```
PM26_P08E_ESTADO=BLOQUEADO_DOCUMENTADO_GUARD_APLICADO
PM26_P08E_FUENTE_BACKEND_FIABLE_EXISTE=NO
PM26_P08E_MEMBRESIAS_ACTIVAS_EN_PRODUCCION=0
PM26_P08E_LA_TIENE_LOCAL_FUNCIONA_HOY=NO
PM26_P08E_TABLAS_EMPRESAS_O_LOCALES=NO_EXISTEN
PM26_P08E_CATALOGO_LOCALES_EN_KV=NO_EXISTE
PM26_P08E_ALTERNATIVA_SELECCIONADA=BOOTSTRAP_ADMINISTRATIVO_MEMBRESIAS
PM26_P08E_ALTERNATIVA_BLOQUEADA_POR_FALTA_DE_CATALOGO=SI
PM26_P08E_PREFLIGHT_EXIGE_MEMBRESIA_ACTIVA=SI
PM26_P08E_PREFLIGHT_EXIGE_COBERTURA_POR_PROPIETARIO=SI
PM26_P08E_CERO_MEMBRESIAS_FALLA_EN_PRUEBAS=SI
PM26_P08E_SIN_IDENTIFICADORES_HARDCODEADOS=SI
PM26_P08E_COMPATIBLE_CON_PARCHE_P08D=SI
PM26_P08E_MEMBRESIA_CREADA=NO
PM26_P08E_MIGRACION_APLICADA=NO
PM26_P08E_ESCRITURA_EN_PRODUCCION_QA_TPV=NO
PM26_P08E_DESPLEGADO_EN_NETLIFY=NO
PM26_P08E_MAIN_RELEASE_TOCADOS=NO
PM26_P08E_PR_38_CERRADA_O_FUSIONADA=NO
PM26_P08E_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO
```

El Defecto L sigue sin aplicarse en producción y **no puede aplicarse
todavía**: le falta la precondición de autorización backend. Los dos
pasos siguientes —crear un catálogo de locales en el backend y hacer el
bootstrap administrativo de la membresía— requieren cada uno su propia
autorización explícita y separada, que esta preparación no incluye.
Quedan Aviso G y PM25–P02 sin tocar.
