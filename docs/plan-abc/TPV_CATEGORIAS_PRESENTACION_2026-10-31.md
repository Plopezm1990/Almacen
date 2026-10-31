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
3. **Producción sigue sin tocar.** Promocionarla requiere su propia autorización.
4. Los 12 locales sin regla de día operativo son un hueco anterior a este
   trabajo (D06 del inventario). Esta funcionalidad ya no se bloquea por ello,
   pero el hueco sigue ahí.
