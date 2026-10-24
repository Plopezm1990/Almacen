# Plan Maestro L&A Suite — Etapa 6, T8 (piezas 1 y 2): biblioteca de opciones reutilizables y opciones por producto

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-10 (Pedro, 24/10/2026, chat) + continuación de la
pieza 2 ("VALE SEGUIMOS", Pedro, 24/10/2026, chat).

## 1. Lo pedido

Empezar la Etapa 6 (T8, «configuración para cualquier negocio»), por su
primera pieza: una biblioteca de opciones (variantes y modificadores) que
se pueda reutilizar entre varios productos sin duplicarla, antes de
diseñar la Hoja QA-10.

## 2. Lo que ya existía (investigación previa)

El esquema de T3-A04 (`catalogo_tpv_grupos_opciones`,
`catalogo_tpv_opciones`, `catalogo_tpv_producto_grupos`) ya estaba
diseñado para que un mismo grupo de opciones (p. ej. «Tamaño») se
enlazara a varios productos sin duplicarlo: un grupo vive por
empresa+local, no por producto, y una tabla aparte enlaza el grupo con
cada producto que lo usa. Lo que faltaba era la parte de administración:
no existía ninguna función para crear o editar esas filas (solo se
habían insertado a mano por SQL en QA, para poder probar la compra con
variantes/modificadores), ni ninguna pantalla para gestionarlas.

## 3. Qué se construyó

Migración `20261024180000_t8_biblioteca_opciones_reutilizables.sql`, sin
crear ninguna tabla nueva:

- `abc_guardar_grupo_opciones`: crea o edita un grupo de la biblioteca
  (nombre, tipo fijo una vez creado: Variante o Modificador).
- `abc_guardar_opcion`: crea o edita una opción dentro de un grupo
  (nombre, tipo, precio añadido, impuesto, cantidad máxima) — exige la
  misma coherencia tipo_grupo/tipo_opcion que ya comprueba la compra
  (`abc_calcular_linea_tpv_configurada`): un grupo Variante solo admite
  opciones Variante; un grupo Modificador no admite ninguna opción
  Variante.
- `abc_vincular_grupo_producto`: enlaza (o desenlaza, desactivando) un
  grupo con un producto, con su propio mínimo/máximo de selección para
  ese producto.

Las 3 exigen el mismo permiso que ya gestiona el catálogo
(`abc_catalogo_puede_gestionar`: Propietario o Encargado) y siguen el
mismo patrón idempotente del resto del proyecto. Se añadieron dos
índices de nombre único (grupo dentro de un local; opción dentro de su
grupo) que no existían todavía.

La lectura (ver la biblioteca, ver qué productos usan un grupo) no
necesitó ninguna función nueva: las 3 tablas ya tenían SELECT abierto a
cualquier miembro del local desde F3-A04.

### Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

Pestaña nueva **"Opciones y variantes"** en Configuración, con tres
paneles:

- **Biblioteca: grupos de opciones** — lista, crear, editar, activar o
  desactivar.
- **Biblioteca: opciones dentro de cada grupo** — igual, con precio,
  impuesto (propio o heredado del producto) y cantidad máxima.
- **Opciones por producto** (pieza 2, ver sección 8) — una ficha por
  cada producto activo del catálogo TPV, con sus grupos enlazados y un
  botón para enlazar uno más, ahí mismo.

## 4. Hallazgos en la prueba en vivo (Cowork)

Los 10 pasos de la prueba salieron bien funcionalmente: creación de
grupos y opciones, bloqueo del tipo al editar un grupo, rechazo de
opciones Variante dentro de un grupo Modificador, activar/desactivar,
enlace a un producto, rechazo de nombres duplicados y rechazo de
enlazar un grupo desactivado — todo con mensajes claros.

Cowork señaló dos mejoras de UX (no bloqueantes; el servidor ya
rechazaba correctamente ambos casos, solo tardaba en avisar):

1. El desplegable «Tipo» del formulario de opción no filtraba según el
   grupo elegido: dejaba escoger «Variante» dentro de un grupo
   Modificador, y solo se enteraba al guardar.
2. El desplegable «Grupo» del panel de enlace seguía ofreciendo grupos
   desactivados.

**Corregido** en el mismo turno: el desplegable «Tipo» ahora se calcula
con `tiposOpcionPara(grupoId)` (solo «Variante» si el grupo es Variante;
el resto si es Modificador) y se recalcula también al cambiar de grupo;
el panel de enlace ahora solo ofrece `gruposActivos` (grupos con
`activo=true`), tanto en el desplegable como en el valor inicial del
formulario.

## 5. Verificación

- `node --check` en ambos archivos: OK.
- Prueba de contrato
  (`tests/plan-maestro/etapa6-t8-biblioteca-opciones-contract.mjs`):
  comprueba las 3 funciones de la migración (permiso, coherencia
  tipo_grupo/tipo_opcion, inmutabilidad, índices de nombre único,
  idempotencia), la pantalla y sus 2 correcciones de UX, y la paridad
  carácter a carácter entre `fuente.js` y el espejo. Todo en verde.
- Todos los contratos existentes de `tests/plan-maestro/`: sin cambios
  de resultado.
- Manifiesto de CI actualizado (316→317 archivos, 299→300 contratos
  activos, Node 269→270).
- Probado en vivo en QA (Cowork, 24/10/2026): los 10 pasos de la Hoja
  QA-10, con los dos ajustes de UX aplicados después.

## 6. Límites respetados

- No se ha tocado PROD.
- No se ha creado ninguna tabla nueva: se reutiliza el esquema de
  T3-A04.
- No se ha tocado ninguna función ni lógica existente (T3-A04, cobro,
  caja, vale regalo, Bizum, impresión/cajón).

## 7. Pendiente (tras la pieza 1)

- **Pieza 2 de T8 (ver sección 8):** resuelta con el alcance que Pedro
  eligió — enlazar opciones por producto, sin editor completo del
  catálogo TPV.
- **Piezas 3-5 de T8** (zonas y tarifas libres con horario, plantillas
  por tipo de negocio, teclas y permisos por cargo): sin empezar.

## 8. Pieza 2: opciones por producto

### Alcance elegido

Pedro eligió, entre tres opciones planteadas, la más acotada: **"solo
enlazar opciones"** — una pantalla donde ver los productos del catálogo
TPV (los que ya refleja el Almacén) y enlazarles grupos de la
biblioteca ahí mismo, sin construir un editor completo del catálogo TPV
(precio, impuesto, alta/baja) ni tocar la pantalla "Productos" del
Almacén.

### Qué se construyó

Se sustituyó el panel de enlace suelto de la pieza 1 (un formulario con
un desplegable de producto) por una **ficha por producto**: la lista de
productos activos de `catalogo_tpv_productos` (con su nombre, no solo
el código), y bajo cada uno sus grupos ya enlazados (con mínimo/máximo
y botón para desenlazar) y un botón "Enlazar un grupo" que abre el
formulario dentro de la misma ficha, sin pedir elegir el producto de
nuevo. No se añadió ninguna función ni tabla nueva: sigue usando
`abc_vincular_grupo_producto`.

### Hallazgos en la prueba en vivo (Cowork)

Los 7 pasos relevantes de la ficha nueva salieron bien (lista de
productos con nombre real, enlace visible directamente en la ficha de
"Porción de tarta", mensaje claro sin enlaces, formulario que abre sin
pedir el producto otra vez, guardar, desenlazar). El paso 8 (grupo sin
ningún grupo activo disponible) no se pudo observar porque en ese
momento había 4 grupos activos en QA; no bloqueante.

**Hallazgo real, de paso, no de esta pieza:** en la sección "Biblioteca:
opciones dentro de cada grupo", las opciones de un grupo ya desactivado
mostraban el id en crudo del grupo en vez de su nombre (p. ej.
`102f75e2-93ce-487a-9bd0-c7a6f1e846e8` en vez de `Extras`). Causa: la
carga de grupos y opciones filtraba por `activo` en el propio servidor
según "Ver también los desactivados"; con la casilla desmarcada, el
grupo desactivado ni siquiera se cargaba, y `nombreGrupo` no tenía de
dónde resolver el nombre.

**Corregido:** ahora siempre se cargan todos los grupos y todas las
opciones; el filtro de "ver desactivados" se aplica solo al mostrarlos
(`gruposVisibles` / `opcionesVisibles`), nunca a la carga. De paso, el
botón "Añadir una opción" y el desplegable "Grupo" de su formulario
pasan a usar `gruposActivos` al crear una opción nueva (evita ofrecer
un grupo desactivado, que el servidor rechazaría igualmente), y siguen
mostrando todos los grupos al editar una opción ya existente, para no
perder el nombre de un grupo que se haya desactivado después.

### Verificación de la pieza 2

- `node --check` en ambos archivos: OK.
- Prueba de contrato ampliada: comprueba la ficha por producto, que el
  selector de producto suelto se retiró, y que la carga de grupos y
  opciones ya no filtra por `activo` en el servidor. Todo en verde.
- Todos los contratos existentes: sin cambios de resultado.
- Probado en vivo en QA (Cowork, 24/10/2026): los 7 pasos relevantes de
  la ficha por producto, y el hallazgo del nombre de grupo corregido
  después.

**T8, piezas 1 y 2: construidas, probadas en QA y corregidas. Piezas
3-5 de T8 siguen pendientes.**
