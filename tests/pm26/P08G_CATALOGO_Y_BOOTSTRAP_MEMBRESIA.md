# PM26 P08g — Catálogo backend de empresas/locales y plantilla de bootstrap de membresía

**Estado: PREPARADO, NO APLICADO EN NINGÚN ENTORNO.**

## 1. Qué resuelve y por qué

P08e (informe, sección 3.2, paso 1; ver también la sección 4.1 tras la
corrección de P08f) dejó documentado un bloqueo: la Alternativa A
(bootstrap administrativo de `membresias_usuario`) es la única
seleccionada, pero está **bloqueada** porque no existe hoy en producción
ningún catálogo backend con autoridad real contra el que validar
`empresa_id` ni `local_id`. Crear una membresía sin ese catálogo
equivaldría a inventar identificadores — exactamente lo que P08e se negó
a hacer.

Este paquete resuelve esa precondición: propone el catálogo mínimo
(`public.empresas`, `public.locales`) y una plantilla de bootstrap para
la membresía real, ambos preparados y probados en PostgreSQL local
aislado, **sin tocar Supabase, QA, producción ni TPV**, y **sin que esta
sesión reciba, vea ni ejecute ningún identificador real**.

Este paquete es independiente de la migración del Defecto L
(`tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql`): no la
modifica ni depende de que se aplique. Aplicar el catálogo y la
membresía es un paso previo y separado; aplicar la migración del Defecto
L y desplegar el parche de P08d (candidato ya cerrado en P08d) sigue
siendo un paso posterior, que requiere su propia autorización explícita
y no se activa por este paquete.

## 2. Diseño del catálogo

Archivo: `tests/pm26/p08g-catalogo-membresia/catalogo-empresas-locales-propuesta.sql`.

- `public.empresas(id text primary key, nombre, activo, created_at)`.
- `public.locales(id text primary key, empresa_id references empresas(id), nombre, activo, created_at)`.
- RLS activada en ambas tablas, **cero políticas**.
- `revoke all ... from authenticated, anon, public` explícito en ambas
  tablas — no se confía en que una tabla nueva no conceda nada por
  defecto; queda documentado y a prueba de cambios futuros.
- Resultado: la única vía de escritura o lectura es una conexión
  administrativa (SQL editor de Supabase conectado como propietario de
  la base, o `service_role`) — nunca el cliente. Un Propietario no puede
  escribir su propia fila de empresa o local y fabricar así su propia
  autorización.
- Idempotente: `create table if not exists`, y los `revoke` no fallan si
  ya estaban revocados.
- Vive fuera de `supabase/migrations`: no se promueve automáticamente a
  ningún entorno.

## 3. Plantilla de bootstrap de membresía

Archivo: `tests/pm26/p08g-catalogo-membresia/bootstrap-membresia-plantilla.sql`.

Contiene **cinco marcadores** `<<...>>` (`EMPRESA_ID`, `EMPRESA_NOMBRE`,
`LOCAL_ID`, `LOCAL_NOMBRE`, `UUID_PROPIETARIO`) y ningún valor real. Esta
sesión no los conoce, no los pide y no los recibe.

Inserta, en este orden, dentro de una única transacción: la empresa, el
local, y la membresía (Variante A — todos los locales de la empresa —
o Variante B — solo el local indicado; se elige una y se comenta la
otra). Los tres `insert` son idempotentes (`on conflict (id) do nothing`
para empresas/locales; `where not exists (...)` para la membresía, el
mismo patrón que ya usa `validar-membresias.sh` de P08e). Termina con
tres `select` de verificación que deben devolver exactamente 1 fila cada
uno.

### 3.1 Instrucciones para que TÚ la ejecutes (esta sesión no lo hace)

1. Abre el SQL editor del proyecto de producción real ("L&A Suite") con
   tu propio acceso administrativo.
2. Busca tu `user_id` real en **Supabase Studio → Authentication →
   Users**, columna "UID".
3. Decide un `empresa_id` y un `local_id` cortos y estables (p. ej.
   `PRINCIPAL` / `CENTRAL`), sin espacios ni acentos.
4. Aplica primero `catalogo-empresas-locales-propuesta.sql` completo, si
   aún no lo has hecho.
5. Copia `bootstrap-membresia-plantilla.sql`, sustituye los 5
   marcadores por tus valores reales, elige la Variante A o B (borra o
   comenta la otra), y ejecuta el archivo completo de una sola vez.
6. Ejecuta por separado las 3 consultas de verificación del final. Las
   tres deben devolver exactamente 1 fila. Si alguna devuelve 0, no
   continúes hasta entenderlo.
7. (Opcional) Pide a esta sesión que vuelva a ejecutar en modo solo
   lectura el preflight de P08e (`preflight-independiente.sql`) contra
   QA o, si tú lo ejecutas tú mismo, contra producción — sin que esta
   sesión vea ningún identificador real — para confirmar
   `PREFLIGHT_CATALOGO=PASS` con tu membresía real ya creada.

## 4. Batería de comportamiento (control negativo real)

Archivo: `tests/pm26/p08g-catalogo-membresia/comportamiento-catalogo.sql`.
Se ejecuta en PostgreSQL local aislado, con el catálogo ya aplicado.

- **C1**: `authenticated` NO puede insertar en `empresas` (RLS sin
  políticas lo bloquea).
- **C2**: `authenticated` NO puede insertar en `locales`.
- **C3**: `authenticated` NO puede leer el catálogo — al no existir
  ningún `grant select`, el intento falla por **permiso denegado**
  (no por RLS filtrando a 0 filas: sin `select` concedido, ni siquiera
  se llega a evaluar RLS). Este es el comportamiento real verificado,
  más estricto que "RLS deja ver 0 filas".
- **C4**: la vía administrativa (el dueño de la conexión, que bypassa
  RLS) SÍ puede escribir en el catálogo.
- **C5**: incluso por vía administrativa, la clave foránea impide un
  local que referencie una empresa inexistente.

Cada caso reporta explícitamente tanto la condición de éxito como la de
fallo (`Cn=PASS` / `Cn=FAIL`), de forma que un mutante que rompiera la
protección haría fallar la prueba en vez de pasar en silencio.

## 5. Validación local (`validar-catalogo.sh`)

Archivo: `tests/pm26/p08g-catalogo-membresia/validar-catalogo.sh`.
Sigue el patrón ya establecido en el proyecto (`PGHOST` restringido a
local, base temporal `pm26_p08g_$$` creada y destruida con `trap`, todo
el SQL por `stdin`, nunca `-f <ruta>`).

Secuencia real ejecutada:

1. Aplica `schema.sql` + `seed.sql` (reproducción de producción, ya
   usada por P08e).
2. Confirma que el catálogo **no existe** antes de aplicar la
   propuesta — el estado real de producción hoy.
3. Aplica el catálogo, ejecuta la batería C1–C5 completa, y **reaplica**
   el catálogo para probar idempotencia.
4. Sustituye los 5 marcadores de la plantilla por valores **sintéticos**
   (`EEEEEEEE`, `LLLLLLLL`, `99999999-9999-9999-9999-999999999999` — un
   solo carácter repetido, igual que el resto de la batería PM26) y
   aplica la plantilla así sustituida. Verifica que se creó exactamente
   1 fila de empresa, 1 de local y 1 de membresía. **Reaplica** la
   plantilla para probar idempotencia (no debe duplicar la membresía).
5. Con el catálogo y la membresía sintética ya creados, confirma que el
   preflight endurecido de P08e **sigue pasando**
   (`PREFLIGHT_CATALOGO=PASS`) — el catálogo es una precondición
   adicional, construida al margen; no sustituye ni debilita lo que el
   guard de P08e ya comprueba (presencia y coherencia estructural de la
   membresía), tal y como quedó documentado en P08e tras la corrección
   de P08f.

Ejecutado dos veces de forma consecutiva y determinista, con salida
real:

```
PM26_P08G_ENTORNO_LOCAL=PASS
PM26_P08G_ESQUEMA_Y_SEED=PASS
PM26_P08G_CATALOGO_NO_EXISTE_ANTES=PASS
PM26_P08G_CATALOGO_APLICADO=PASS
PM26_P08G_BATERIA_CATALOGO=PASS
PM26_P08G_CATALOGO_REAPLICACION_IDEMPOTENTE=PASS
PM26_P08G_PLANTILLA_APLICADA=PASS
PM26_P08G_PLANTILLA_CREA_EXACTAMENTE_UNA_FILA_CADA_UNA=PASS
PM26_P08G_PLANTILLA_REAPLICACION_IDEMPOTENTE=PASS
PM26_P08G_PREFLIGHT_P08E_SIGUE_PASANDO=PASS
PM26_P08G_VALIDACION_COMPLETA=PASS
```

## 6. Qué NO hace esta sesión (límites explícitos)

- No pide, no ve, no recibe ni ejecuta ningún UUID, nombre de empresa o
  nombre de local reales.
- No aplica el catálogo ni la plantilla en Supabase (ni producción, ni
  QA, ni TPV).
- No crea ninguna membresía real.
- No modifica `migracion-propuesta.sql` ni ningún archivo de P08a–P08f.
- No toca `fuente.js`, `source-recovery`, `_headers`, `supabase/`, ni
  ningún artefacto de la aplicación.
- No despliega en Netlify.
- No toca `main` ni `release`.
- No cierra ni fusiona la PR #38.
- No declara resuelta la Alternativa A de P08e: solo prepara la
  precondición que la desbloquearía si TÚ la ejecutas.

## 7. Huellas (SHA-256, archivos completos tal como quedan en este cierre)

- `catalogo-empresas-locales-propuesta.sql`: `b600d761c255d358976956fc3440c30eabdc58b48d538d618107c24312d94966`
- `bootstrap-membresia-plantilla.sql`: `3454196890ad55478d2e3ee23d1c7e24da4ddb006c1a5b7d6715c66488311c16`
- `comportamiento-catalogo.sql`: `1dcfcf347a1cb92a51937b9c86cf76b27baeaf5d89207bd84dc8e097e727093b`
- `validar-catalogo.sh`: `d33d9f26c69f426988513dbf59dc9f156da2b6f2f72326a8e4f2044379572aa4`

## 8. Marcadores de cierre

- `PM26_P08G_ESTADO=PREPARADO_NO_APLICADO`
- `PM26_P08G_CATALOGO_DISEÑADO=SI`
- `PM26_P08G_CATALOGO_RLS_SIN_POLITICAS=SI`
- `PM26_P08G_CATALOGO_ESCRITURA_SOLO_ADMINISTRATIVA=SI`
- `PM26_P08G_CATALOGO_LECTURA_SOLO_ADMINISTRATIVA=SI`
- `PM26_P08G_PLANTILLA_SIN_IDENTIFICADORES_REALES=SI`
- `PM26_P08G_SESION_NO_VE_IDENTIFICADORES_REALES=SI`
- `PM26_P08G_BATERIA_COMPORTAMIENTO_EJECUTADA=SI`
- `PM26_P08G_VALIDADOR_LOCAL_REPRODUCIDO=SI`
- `PM26_P08G_PREFLIGHT_P08E_NO_DEBILITADO=SI`
- `PM26_P08G_CATALOGO_APLICADO_EN_SUPABASE=NO`
- `PM26_P08G_MEMBRESIA_CREADA=NO`
- `PM26_P08G_ESCRITURA_EN_PRODUCCION_QA_TPV=NO`
- `PM26_P08G_MIGRACION_DEFECTO_L_APLICADA=NO`
- `PM26_P08G_PARCHE_P08D_DESPLEGADO=NO`
- `PM26_P08G_DESPLEGADO_EN_NETLIFY=NO`
- `PM26_P08G_MAIN_RELEASE_TOCADOS=NO`
- `PM26_P08G_PR_38_CERRADA_O_FUSIONADA=NO`
- `PM26_P08G_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO`

## 9. Siguiente paso (fuera de este paquete)

Cuando TÚ hayas ejecutado el catálogo y la plantilla en producción con
tus propios valores reales, y confirmado las 3 filas de verificación,
la Alternativa A de P08e deja de estar bloqueada por falta de catálogo.
Aplicar entonces la migración del Defecto L
(`migracion-propuesta.sql`) y desplegar el parche ya cerrado de P08d
sigue siendo un paso posterior y separado, que requiere su propia
autorización explícita — no queda autorizado por este paquete.
