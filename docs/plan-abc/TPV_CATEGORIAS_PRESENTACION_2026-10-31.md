# TPV — orden y color de categorías por local

Fecha: 2026-10-31
Alcance: carril de categorías del TPV. **Aplicado en QA (`qjqorixtkilwsndqayyx`) el 31/10/2026. Producción no tocada.**
Estado: `APLICADO_Y_VERIFICADO_EN_QA_PENDIENTE_DE_PRUEBA_EN_PANTALLA`
Autorización: «aplica la migración en QA» (Pedro, 31/10/2026).

## Qué se pidió

Cerrar lo último que quedaba de la fase 4 del rediseño del TPV: que el orden y el
color de las categorías se puedan configurar. Se plantearon dos opciones y Pedro
eligió la **B**: guardado **por local, en el servidor**, de modo que la caja, los
comanderos y cualquier terminal nuevo vean lo mismo.

## Decisiones

1. **Se guarda la clave del color, no el color.** La tabla guarda `AZUL`,
   `NARANJA`… y la aplicación decide el tono exacto. Así el tema oscuro puede
   tener su propia versión de cada color sin migrar datos, y nadie puede dejar
   una categoría con un color ilegible.
2. **Una fila por local, con la lista entera en `jsonb`.** El carril se edita y
   se lee como una unidad ordenada, y una sola fila permite un bloqueo optimista
   con una sola versión. El orden es la posición en el array.
3. **Permiso: se reutiliza `ABC_SALA_CONFIGURAR`** (Propietario y Encargado), que
   ya existe y ya es ajustable desde el catálogo de capacidades por rol. **No se
   añade una capacidad nueva** para no tocar `private.abc_tiene_capacidad`, que
   según el inventario de la capa de configuración es la función con más
   dependencias y más riesgo de regresión del proyecto.
4. **El día operativo es opcional en la escritura.** La pantalla de ajustes no
   tiene por qué haber abierto una cuenta, así que si no llega lo resuelve el
   servidor con `private.abc_resolver_operating_day_contexto`. El evento de
   auditoría queda con el día correcto del local, no con la fecha del navegador.
5. **La tabla no se lee ni se escribe directamente.** Sin políticas RLS y con los
   permisos revocados: solo se entra por las dos funciones `security definer`.
6. **Las categorías sin configurar no desaparecen.** Salen detrás de las
   configuradas, por orden alfabético, para que un producto nuevo de una
   categoría nueva no se pierda del carril.

## Qué entra

| Pieza | Archivo |
|---|---|
| Tabla y funciones | `supabase/migrations/20261031120000_abc_tpv_categorias_presentacion.sql` |
| La lectura dice si puedes configurar | `supabase/migrations/20261031150000_abc_tpv_categorias_puede_configurar.sql` |
| Contrato de base de datos | `tests/cfg/tpv-categorias-presentacion-db-contract.mjs` |
| Adaptadores, lectura, aplicación y editor | `fuente.js` y `source-recovery/fuente-recuperado.js` |

### Funciones

- `public.abc_listar_categorias_tpv(empresa, local)` — lectura. La puede llamar
  cualquiera que tenga el local. Sin configurar devuelve `version 0` y lista
  vacía, y el TPV se queda con su orden y color por defecto.
- `public.abc_configurar_categorias_tpv(operation_id, empresa, local, categorias,
  expected_version, terminal, session, operating_day)` — escritura. Exige
  `ABC_SALA_CONFIGURAR`, es idempotente por `operation_id`, falla cerrado si la
  versión no coincide y deja evento `TPV_CATEGORIAS_PRESENTACION_CONFIGURADA`.

### Validación de la lista

Máximo 60 categorías; nombre no vacío y de hasta 80 caracteres; color dentro de
la paleta cerrada (`AZUL`, `NARANJA`, `VERDE`, `GRANATE`, `MORADO`, `MARRON`,
`ROJO`, `TEAL`, `AMBAR`); sin categorías repetidas. Cualquier otra cosa se
rechaza con un error propio, no se recorta en silencio.

## Qué se ha probado

`node tests/cfg/tpv-categorias-presentacion-db-contract.mjs` sobre un **Postgres
16 local y desechable**, con la migración del repositorio aplicada tal cual y las
dependencias compartidas sustituidas por equivalentes mínimos (`auth.uid`,
`la_tiene_local`, `abc_tiene_capacidad`, operaciones, eventos y el resolutor del
día operativo). 12 comprobaciones, todas en verde:

| Comprobación | Qué demuestra |
|---|---|
| `SIN_CONFIGURAR_DEVUELVE_VACIO` | El TPV funciona igual antes de configurar nada |
| `GUARDA_Y_NORMALIZA` | Guarda y pasa el color a mayúsculas |
| `LECTURA_CONSERVA_ORDEN` | El orden sobrevive al viaje de ida y vuelta |
| `BLOQUEO_OPTIMISTA` | Versión obsoleta falla **y no pisa** lo del otro terminal |
| `REORDENA` | Con la versión buena sí cambia |
| `CAMARERO_NO_CONFIGURA` | Tener el local no basta: hace falta la capacidad |
| `AISLAMIENTO_POR_LOCAL` | Quien no tiene el local ni lee ni escribe |
| `VALIDACION` | Color inválido, duplicado, nombre vacío, más de 60 y no-array |
| `IDEMPOTENCIA` | Reintentar el mismo `operation_id` no sube la versión |
| `DIA_OPERATIVO_DEL_SERVIDOR` | Se puede guardar sin cuenta abierta |
| `AUDITORIA` | Un evento por cambio aplicado y ninguno por los rechazados |
| `TABLA_SOLO_POR_FUNCION` | La sesión del usuario no llega a la tabla |

**Lo que esa prueba no cubre:** las dependencias compartidas son equivalentes
mínimos, no las del servidor. La prueba valida la lógica de estas dos funciones,
no el comportamiento de `abc_tiene_capacidad` ni del resolutor reales. Eso solo
se ve en QA.

Los 173 contratos que leen `fuente.js` y la fuente recuperada siguen en
**158 PASS / 15 FAIL**, los mismos que antes de este trabajo.

## Aplicación en QA (31/10/2026)

El preflight de solo lectura encontró **un fallo de diseño antes de aplicar**: de
los 14 locales de QA, **solo QA-A1 y QA-A2 tienen regla de día operativo
vigente**. Los otros 12, incluidos los de aspecto real, tienen cero. Con la
versión original la pantalla de ajustes habría fallado en 12 de 14 locales con
`operating_day_configuracion_ausente`.

Corregido antes de aplicar: si el local no tiene regla, el día operativo cae a la
fecha del servidor y **se marca como estimado** (`operating_day_estimado`) en el
evento y en la respuesta, para que nadie lo confunda después con un día operativo
autoritativo. Cualquier otro fallo del resolutor (local inactivo, regla ambigua)
sigue cortando. Se añadió la comprobación `LOCAL_SIN_REGLA_NO_BLOQUEA` al
contrato: 13 comprobaciones en verde.

Verificado ya aplicado en QA:

| Comprobación | Resultado |
|---|---|
| Tabla creada, RLS activa, 0 políticas | Sí, como se diseñó |
| Las tres funciones existen | Sí |
| `authenticated` **no** puede leer la tabla | Correcto |
| `authenticated` puede ejecutar las dos funciones | Correcto |
| `anon` **no** puede configurar | Correcto |
| Llamada sin sesión a leer y a escribir | Cortan con `abc_tpv_categorias_no_autorizada` |
| Filas, eventos y operaciones creados por las pruebas | 0: QA queda limpio |

Del linter de Supabase, dos avisos sobre estos objetos son los mismos que ya
tienen el resto de tablas y funciones del proyecto (`rls_enabled_no_policy`, 61
tablas; `authenticated_security_definer_function_executable`, 230 funciones).
El tercero sí era propio: `private.abc_tpv_categorias_normalizar` era **la única
función del proyecto** con `search_path` mutable. Corregido en la migración y en
QA; las tres funciones quedan con `search_path=""`.

## Lo que queda

1. Probar en pantalla, con dos terminales a la vez, que el conflicto de versión
   se explica bien y que el carril se recarga.
2. Decidir si `ABC_SALA_CONFIGURAR` es el permiso definitivo o si la presentación
   del TPV merece el suyo propio cuando se aborde la tabla de capacidades por
   empresa y local (hueco «Permisos por rol», marcado como **Grande** en el
   inventario de la capa de configuración).
3. **Producción sigue sin tocar**, por decisión del 31/10/2026 (ver abajo).
4. Los 12 locales sin regla de día operativo son un hueco anterior a este
   trabajo (D06 del inventario). Esta funcionalidad ya no se bloquea por ello,
   pero el hueco sigue ahí.


## Producción: decisión del 31/10/2026

Se planteó aplicarla también en producción (`flqercbgpgmmfaakrwkc`). Preflight de
**solo lectura** sobre producción, sin escribir nada:

- Las seis dependencias existen y la tabla no: la migración aplicaría limpia.
- Es un sistema vivo: 3 empresas, 3 locales, 8 cuentas, 8 pedidos y 114 eventos,
  el último del 30/10/2026.
- **1 de los 3 locales** tiene regla de día operativo vigente. En los otros dos
  entraría el camino del día estimado, que es justo el que nadie ha visto nunca
  en pantalla.

**Decisión: esperar.** El motivo de peso no es el riesgo técnico (la migración es
aditiva: tabla y funciones nuevas, no toca nada existente), sino que **no aporta
nada todavía**: el código de la aplicación que llama a estas funciones vive solo
en la rama `ccr-e0f72ee0-mfjorr`, sin desplegar. Aplicarla hoy dejaría esquema
sin nadie que lo use, y sin que la funcionalidad se haya ejecutado jamás en un
navegador. Se aplicará junto con el despliegue del frontend, después de probarla
en la pantalla de QA.

Comprobado tras la decisión: en producción la tabla y las dos funciones **siguen
sin existir** y los eventos siguen en 114. No se escribió nada.

## Cómo probarlo en la pantalla de QA

1. Entra en el TPV de QA con un usuario **Propietario** o **Encargado** del local
   **QA-A1** o **QA-A2** (son los dos que tienen regla de día operativo; en los
   demás se guardará igual, pero el día saldrá marcado como estimado).
2. En la barra de botones del TPV, pulsa **«Categorías»**.
3. Cambia el orden con las flechas ▲▼ y elige otro color en alguna categoría.
   Pulsa **«Guardar para todo el local»**.
4. **Qué tiene que pasar:** la ventana se cierra y el carril de la izquierda pasa
   a mostrar ese orden y esos colores, y la franja de color de cada tarjeta de
   producto cambia a juego.
5. **Prueba del conflicto (la importante):** abre el TPV en dos terminales o dos
   navegadores con el mismo local. En los dos, abre «Categorías». Guarda en el
   primero. Después guarda en el segundo sin recargar. El segundo debe avisar de
   que *«otra persona cambió las categorías mientras editabas»* y recargar la
   lista, **sin pisar** lo que guardó el primero.
6. **Prueba del permiso:** con un usuario **Camarero/a**, el botón «Categorías»
   **no debe aparecer**. Con Propietario o Encargado, sí.

Si algo de esto no se comporta así, es cosa del código de pantalla, no del
servidor: el servidor ya está verificado en QA.


## El botón se esconde a quien no tiene el permiso (31/10/2026)

Decidido tras la aplicación en QA: el botón «Categorías» solo aparece si el
usuario puede configurarlas, en vez de dejarle abrir el editor y chocar con el
error al guardar.

**Quién lo decide: el servidor.** `abc_listar_categorias_tpv` devuelve ahora
`puede_configurar`, calculado con `private.abc_tiene_capacidad`. No se ha escrito
una lista de roles en el navegador a propósito: `ABC_SALA_CONFIGURAR` es
ajustable por empresa y local desde el catálogo de capacidades, y una lista en el
cliente se quedaría desfasada en cuanto alguien la ajustara.

**Esto no relaja nada.** La escritura sigue comprobando la capacidad por su
cuenta: esconder el botón es comodidad, no seguridad. La comprobación
`CAMARERO_NO_CONFIGURA` del contrato sigue ahí y sigue pasando.

Aplicado en QA y verificado: la función conserva `search_path=""`, sigue siendo
`security definer`, la ejecuta `authenticated` y no `anon`, y la tabla sigue con
0 filas y 0 eventos. Contrato: 14 comprobaciones en verde, con la nueva
`LECTURA_DICE_SI_PUEDE_CONFIGURAR`.

**Producción sigue sin tocar.**
