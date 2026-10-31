# TPV — orden y color de categorías por local

Fecha: 2026-10-31
Alcance: carril de categorías del TPV. **Nada aplicado en QA ni en producción.**
Estado: `IMPLEMENTADO_EN_RAMA_Y_PROBADO_EN_POSTGRES_LOCAL_PENDIENTE_DE_AUTORIZACION_PARA_QA`

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

## Lo que hace falta antes de aplicar

1. **Autorización explícita** para aplicar la migración en QA.
2. Comprobar en QA que los dos locales tienen regla de día operativo vigente: si
   no la tienen, la escritura falla con `operating_day_configuracion_ausente`.
3. Repasar en pantalla con dos terminales a la vez que el conflicto de versión se
   explica bien y que el carril se recarga.
4. Decidir si `ABC_SALA_CONFIGURAR` es el permiso definitivo o si la presentación
   del TPV merece el suyo propio cuando se aborde la tabla de capacidades por
   empresa y local (hueco «Permisos por rol», marcado como **Grande** en el
   inventario de la capa de configuración).
