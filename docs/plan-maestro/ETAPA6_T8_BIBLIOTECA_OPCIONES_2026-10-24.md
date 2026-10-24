# Plan Maestro L&A Suite — Etapa 6, T8 (pieza 1): biblioteca de opciones reutilizables

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-10 (Pedro, 24/10/2026, chat).

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
- **Enlazar un grupo con un producto** — un panel de enlace sencillo
  (elegir producto y grupo, fijar mínimo/máximo), a falta de la ficha
  completa de un producto en pantalla (pieza 2 de esta etapa, sin
  empezar).

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

## 7. Pendiente

- **Pieza 2 de T8 (editor de producto):** no existe todavía ninguna
  ficha completa de un producto en pantalla. El panel de enlace de esta
  pieza es un sustituto provisional hasta que se construya.
- **Piezas 3-5 de T8** (zonas y tarifas libres con horario, plantillas
  por tipo de negocio, teclas y permisos por cargo): sin empezar.

**T8, pieza 1: construida, probada en QA y corregida. Piezas 2-5 de T8
siguen pendientes.**
