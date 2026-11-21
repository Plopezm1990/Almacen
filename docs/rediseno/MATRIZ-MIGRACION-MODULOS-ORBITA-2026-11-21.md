# Matriz de migración visual por módulos · Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador

Esta matriz evita confundir “usa el shell” con “está migrado visualmente”. Un
módulo solo pasa a `CERRADO` cuando tiene el marco común, sus componentes
visuales normalizados, revisión de escritorio y móvil, estados de carga/error/
vacío y contratos sin regresión.

| Orden | Módulo | Superficie identificable | Estado actual | Cierre pendiente |
|---:|---|---|---|---|
| 1 | Inicio y panel general | `inicio`, `.la-panel-diseno` | PARCIAL: panel Órbita ya visible y detalle antiguo separado; el panel tiene prioridad cuando Pase está incrustado | Revisar todas las variantes de indicadores y estados en 5 viewports |
| 2 | TPV y sala | `tpv`, `.tpv-layout` | PARCIAL: superficie Órbita aplicada a catálogo, filtros, mesas, ticket/caja, paginación y dock móvil; recorridos de datos intactos | Verificar venta rápida, sala, cuentas, mesas, tickets y estados en las rutas reales de escritorio y móvil |
| 3 | Pase | `pase`, `.la-pase` (`#la-pase` legado) | PARCIAL: panel real y cola ya integrados; la raíz semántica ya queda marcada aunque el recorrido histórico use otro selector | Igualar tarjetas, filtros, destinos y revisión móvil |
| 4 | Cocina | `cocina`, `.la-operacion-cocina` | PARCIAL: cabecera, tarjetas, estados, filtros, estaciones/rutas y cola ya tienen capa Órbita; recorrido de estados reales aún pendiente | Verificar rutas reales, vacío/carga/error, estados de comanda y densidad en escritorio y móvil |
| 5 | Caja | `caja`, `.la-operacion-caja` | PARCIAL: apertura, arqueo, movimientos, historial y traspasos ya tienen capa Órbita; recorrido de cobro/cierre real aún pendiente | Verificar cobros, arqueos, cierres, reembolsos, documentos y estados en rutas reales |
| 6 | Clientes | `clientes` | PARCIAL: listado, vistas guardadas, filtros, paginación y fichas ya tienen capa Órbita; actividad/NIF aún requieren recorrido real | Verificar ficha, actividad, NIF y estados vacío/carga/error en escritorio y móvil |
| 7 | Compras | `compras` | PARCIAL: tarjetas, formularios, tablas, estados y controles ya tienen capa Órbita | Recorrer proveedores, pedidos, recepción, albaranes y facturas en rutas reales |
| 8 | Inventario | `inventario` | PARCIAL: productos, tablas, formularios, estados y controles ya tienen capa Órbita | Recorrer movimientos, mermas, caducidad y ajustes en rutas reales |
| 9 | Personal | `personal` | PARCIAL: empleados, permisos, turnos, tablas y formularios ya tienen capa Órbita | Recorrer fichajes, cargos, permisos y estados en rutas reales |
| 10 | Configuración | `configuracion` | PARCIAL: empresa, locales, terminales, fiscalidad y apariencia ya comparten la capa base | Recorrer configuración y selectores sin romper persistencia ni permisos |
| 11 | Plataforma | `plataforma` | PARCIAL: paneles administrativos ya comparten tarjetas, tablas y controles base | Verificar acceso administrador y paneles exclusivos en QA |
| 12 | Acceso | `.la-acceso` y `acceso` | PARCIAL: login dividido, recuperación, MFA y selector conservan la capa visual Órbita | Verificar login, recuperación, MFA, expiración y selección de empresa/local en escritorio y móvil |

## Cambio de esta tanda

`la-orbita-shell.js` etiqueta ahora cada ruta autenticada con
`data-la-orbita-module` y `data-la-orbita-surface`. Esto permite que cada
bloque se migre y se mida sin duplicar navegación ni handlers. El contrato
visual aplica además a la superficie independiente `.la-acceso`, que no usa
el shell autenticado.

### Corrección de esta tanda · raíz semántica de Pase

En la comprobación del preview, Inicio montó el panel real con la clase
`.la-pase`, no con el id histórico `#la-pase`. El shell quedaba en `pantalla`
y las reglas específicas de Órbita no alcanzaban la cabecera, plano y cola.
La detección y los selectores visuales aceptan ahora ambas raíces. Es un cambio
solo de presentación: no modifica estados de mesa, cola, permisos ni navegación.
La marca de caché de la capa pasó a `qa-orbita-modules-v16-20261121`.

El mismo detector da prioridad a `.la-panel-diseno` cuando Inicio incluye el
panel Pase operativo. Así `Inicio` conserva su identidad de módulo y el Pase
independiente sigue etiquetándose como `pase`.

### TPV y sala · primera migración de superficie

El commit `3ff74403` añade la capa visual scoped a
`main[data-la-orbita-module="tpv"]`: búsqueda, categorías, tarjetas de
producto, paginación, mesas, columna de ticket/caja y dock táctil. La rejilla
se mantiene en dos columnas en móvil y el lateral baja sin overflow; no se
modificaron handlers, fiscalidad, permisos ni persistencia. El módulo sigue en
`PARCIAL` hasta recorrer todos los estados reales (venta rápida, sala, cuenta
abierta, tickets, vacío, carga y error) en escritorio y móvil.

Evidencia live actual: tarjeta de producto de `104 px`, búsqueda de `47 px`,
rejilla de dos columnas en el ancho táctil del banco, lateral estable,
`scrollWidth === innerWidth` y control mínimo de `44 px`.

### Cocina · primera migración de superficie

El commit `6aace0b1` aplica la capa visual Órbita scoped a
`main[data-la-orbita-module="cocina"] .la-operacion-cocina`. La cabecera de
«Cocina y comandas», las tarjetas operativas, avisos de estado, estaciones y
rutas, y la cola de comandas comparten ahora borde, radio, sombra, fondo y
jerarquía tipográfica del sistema. Las tarjetas anidadas de cada comanda
conservan sus estados y acciones; selects, inputs y botones mantienen un área
mínima de `44 px`. En móvil la cabecera envuelve y la cola no fuerza
desbordamiento horizontal. No se cambiaron handlers, RPC, permisos, estados
de cocina ni persistencia.

La caché CSS quedó en `qa-orbita-modules-v18-20261121`. Pasan los contratos
P01, marco (21/21), componentes, rutas (20/20) y autoridad de persistencia.
El bloque sigue en `PARCIAL`: falta recorrer en QA la ruta real de Cocina con
datos, los estados vacío/carga/error y las transiciones de comanda en
escritorio y móvil. El fallo histórico de `pm11-compra/p10` («parche móvil
P10 carga antes del dashboard») continúa aislado y no procede de esta capa.

## Evidencia de base

- `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`.
- `MARCO_ORBITA_CONTRACT=PASS (21/21)`.
- `MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`.
- `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1`.
- `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1`.
- `REDISENO_P05_PROPUESTAS_OK=1`.
- `REDISENO_ORG33_SALA_CONTRACT=PASS`.
- `REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 matriz=12 responsive=PASS tactil=44`.
- `SOURCE_RECOVERY_CHECK=PASS`.
- `git diff --check` limpio.

Esta matriz es de seguimiento, no un cierre prematuro. El objetivo 4 sigue
activo hasta que los doce módulos pasen individualmente a `CERRADO`.

### Estado de publicación y auditoría · 21/11/2026 · SHA `ba7bf3e4`

La última revisión de la rama `rediseno/f0-base-qa` está publicada en el
Deploy Preview 225 como `6b01754bbbb331413cdf306d` (`ready`). El PR #225
continúa abierto, en borrador y sin fusionar; producción no se ha tocado.
La corrección de esta revisión marca también las raíces administrativas que
se montan antes del shell (`#la-plataforma-root` y
`#la-plataforma-cambio-root`) con `data-la-orbita-external="plataforma"` y
`data-la-orbita-surface="plataforma"`, de modo que Plataforma no conserva una
segunda escala visual cuando aparece antes de la navegación autenticada.

La batería `tests/rediseno/*.mjs` queda en `ALL_REDISENO_TESTS_PASS`, incluido
`REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12
responsive=PASS tactil=44`; `git diff --check` también pasa. Esta evidencia
confirma la integración del marco, no sustituye el recorrido autenticado de
cada módulo. Por eso las doce filas permanecen deliberadamente en `PARCIAL`.

Además, el arranque sin configuración de empresa conserva ahora `orbita` como
fallback visual. La ausencia de una preferencia ya no elimina
`data-la-diseno` ni devuelve la suite a los estilos históricos; una propuesta
o paleta guardada explícitamente continúa teniendo precedencia.

### Pasada local adicional · preview 225 · 21/11/2026

Se hizo una pasada de renderizado en el Deploy Preview 225 desde el navegador
integrado, en viewport táctil `618×678`, sin credenciales ni escrituras de
negocio. El modo «Trabajar solo en este equipo» terminó mostrando el shell
Órbita y permitió navegar por las rutas reales. La hidratación tarda unos
segundos en este banco, pero no quedó bloqueada: tras esperar diez segundos el
árbol ya mostraba el panel y la consola no registró errores ni advertencias.

| Ruta | `data-la-orbita-module` | `data-la-orbita-surface` | `scrollWidth` | control mínimo visible |
|---|---|---|---|---:|
| Inicio / Panel general | `inicio` | `inicio` | igual al viewport | 44 px |
| TPV | `tpv` | `tpv` | igual al viewport | 44 px |
| Cocina | `cocina` | `cocina` | igual al viewport | 44 px |
| Caja / Arqueo | `caja` | `caja` | igual al viewport | 44 px |
| Clientes | `clientes` | `clientes` | igual al viewport | 44 px |

La misma pasada añadió, sin mutaciones, Proveedores (`compras`), Productos
(`inventario`), Personal (`personal`) y Configuración (`configuracion`).
Proveedores mostró el vacío «Todavía no has añadido proveedores»; Personal
mostró el estado de carga «Cargando empleados…»; Productos mostró filtros y
acciones de inventario; Configuración mostró el contexto de QA y sus controles.
En las cuatro rutas el `scrollWidth` siguió igual al viewport y el mínimo
visible fue `44 px`.

En Inicio se observaron «El pulso del negocio», accesos rápidos, cuatro
indicadores, selector de local, cabecera QA, buscador global, avisos, perfil,
botón Apariencia y navegación inferior. TPV mantuvo venta rápida, sala,
catálogo, paginación, historial y caja en la misma superficie. Cocina mostró
cabecera, estado de conexión, estación y cola vacía. Caja mostró apertura y
arqueo; Clientes mostró vistas guardadas, filtros, búsqueda y estado vacío.

Esta evidencia cierra la comprobación de composición responsive para esas
cinco rutas, pero no las convierte aún en `CERRADO`: falta recorrer cada acción
con sesión QA y datos reales, además de los estados de carga/error y las rutas
restantes de cada módulo. No se ejecutaron cobros, reembolsos ni cambios de
datos en esta pasada.

La documentación quedó publicada en `23f98029ea10e658ef13af3484ac0adab474939e`.
El Deploy Preview 225 asociado (`6b0164cbaf0db151e7fa02b2`) terminó en estado
`ready`, con el escaneo de secretos sin coincidencias y sin cambios en
producción.

La ampliación de la evidencia de Compras, Inventario, Personal y Configuración
está en `aeafd3629134177018cf5a789c9de9b3e8e0272d`; su Deploy Preview asociado
es `6b0165979a8ca4a5e6bbc99b`, también `ready`.

### Arranque local sin espera remota · 21/11/2026 · commit posterior `2c3c84a6`

La hidratación de la suite conserva un atajo explícito para el botón «Trabajar
solo en este equipo, sin sincronizar»: las 37 claves iniciales se leen desde
la copia `almacen:*` del dispositivo sin resolver sesión, contexto operativo,
Supabase ni la cola de IndexedDB. El camino autenticado de QA no cambia y
continúa pasando por el adaptador, sus RPC y RLS. Esto elimina una espera
acumulativa cuando una pestaña antigua deja una promesa de almacenamiento
pendiente; si una copia local está dañada, se muestra el estado de carga fallida
existente y se conserva el reintento, sin borrar datos.

La regla está cubierta por `PREVIEW_ARRANQUE_RESILIENTE=PASS` y publicada en
el Deploy Preview 225. Es una corrección de arranque, no un cierre visual de
los módulos: las doce filas continúan en `PARCIAL` hasta recorrer sus rutas
autenticadas y estados reales.

### Corrección transversal · arranque local desde Acceso

El botón «Trabajar solo en este equipo, sin sincronizar» cambiaba la fase de
login a `dentro`, pero conservaba el cliente Supabase que se había creado al
abrir el formulario. En Deploy Preview eso dejaba el arranque intentando leer
la nube QA y podía mantener «Cargando almacén…» indefinidamente. `fuente.js` y
`source-recovery/fuente-recuperado.js` ahora activan explícitamente
`__modoPruebasLocal`, limpian el cliente y desactivan la sincronización antes
de montar la suite. La corrección no toca datos ni producción; la marca de
caché pasó a `qa-persistencia-sin-advertencias-v2-20261121`.

### Inicio y panel general · eliminación de la paleta heredada

La superficie de Inicio conserva el panel Órbita y el detalle operativo
colapsable, pero la capa `dashboard-premium-v2.js` todavía pintaba sus KPIs,
acciones rápidas, alertas, CTA y toast con verdes/dorados propios del diseño
Sello. En `56901e31` se sustituyeron esos colores literales por los tokens del
tema (`--c-surface`, `--c-bg`, `--c-ink`, `--c-accent`, `--c-accent-fill`,
`--c-on-accent`, `--c-ink-soft` y `--c-red`). Así el panel no vuelve a
introducir una segunda identidad visual cuando la empresa usa Órbita ni cuando
se prueba otra propuesta. No se tocaron indicadores, navegación, permisos ni
handlers. La caché pasó a `qa-orbita-panel-v3-20261121`.

El contrato de componentes ahora falla si reaparecen los cuatro colores
heredados en esa capa. Inicio sigue en `PARCIAL` hasta comprobar en QA las
variantes de indicadores y los estados vacío/carga/error en los cinco
viewports definidos.

### TPV y sala · superficies secundarias · v23

La capa scoped de TPV cubre ahora también la tarjeta de venta rápida, el
selector de modalidad, el resumen/historial de ventas, el flujo de factura a
empresa y los avisos de error. Esas superficies conservan sus handlers y
operaciones, pero dejan de depender de fondos literales y adoptan los tokens
de tarjeta, estado y foco de Órbita. El resumen de ventas se apila en móvil
para que la pantalla no se alargue horizontalmente. La caché CSS pasó a
`qa-orbita-modules-v23-20261121` (huella P01 `dc23dacac016d12d`). TPV sigue en
`PARCIAL` hasta el recorrido QA de venta rápida, sala, cuentas, mesas,
historial, vacío/carga/error y factura a empresa en escritorio y móvil.

La versión v23 está publicada en el Deploy Preview 225 como deploy
`6b0137dac55d9e163e63c27e` (`ready`), commit `a9147300`.

### Pase · variante Órbita · v2

La raíz `.la-orbita-pase` ya no hereda la paleta verde/lima genérica de Pase:
usa fondo carbón, superficie, acero y coral mediante los tokens del diseño.
También se normalizaron el turno, el plano, la cola, los accesos y los estados
`OCUPADA`/`RESERVADA`; los estados `LIBRE`, `BLOQUEADA` y `FUERA_SERVICIO`
siguen saliendo del servidor sin reinterpretarlos. La caché de `la-pase.css`
pasó a `qa-orbita-pase-v2-20261121` (huella P01 `4b14613f8923c353`). Pase
continúa `PARCIAL` hasta recorrer datos reales, cola de cocina y estados en
escritorio y móvil.

### Verificación posterior · commit `74b32091`

El cambio se publicó en el Deploy Preview 225 como deploy
`6b01359c82a0e124af379731`, estado `ready`, con `review_id=225` y sin tocar
producción. La batería oficial sin base de datos volvió a registrar
`NODE_ACTIVE_TOTAL=328`, `NODE_ACTIVE_PASS=305`, `NODE_ACTIVE_FAIL=23`,
`UTILITIES_RUN=8`, `DIAGNOSTICS_RUN=5`, `INFRA_FAIL=0`; los 23 fallos son la
misma lista histórica ya documentada. `git diff --check` y el árbol quedaron
limpios. La revisión live autenticada de Inicio queda pendiente de completar
el MFA en la sesión de QA.

### Clientes · primera migración de superficie

La capa añadida en `2c709144` se limita a
`main[data-la-orbita-module="clientes"]`: vistas guardadas, filtros, búsqueda,
paginación, tarjetas de listado y estados de ficha comparten tarjetas, bordes,
radios, tipografía y controles Órbita. Los campos y botones conservan un área
mínima de `44 px`; en móvil los filtros y tarjetas se apilan sin overflow. No
se modificaron sincronización, anonimización, actividad, NIF ni handlers.

La caché CSS es `qa-orbita-modules-v20-20261121`, huella P01
`7f70543a840f3e64`. Pasan P01, marco `21/21`, componentes, rutas `20/20` y
`git diff --check`. El módulo permanece `PARCIAL` hasta recorrer ficha,
actividad, NIF y estados vacío/carga/error con datos reales de QA.

### Gestión · primera capa común `91943176`

Compras, Inventario, Personal, Configuración y Plataforma reciben en el commit
`91943176` una capa visual Órbita scoped por `data-la-orbita-module`. Unifica
tarjetas, formularios, tablas, alertas/estados, tipografía y botones; en móvil
los grids pasan a una columna y las tablas se desplazan dentro de su propio
contenedor sin ampliar la página. Los handlers, permisos, datos y RPC de cada
módulo no se tocaron.

La caché CSS es `qa-orbita-modules-v21-20261121`, huella P01
`b4aa9acf6bc07ec2`. Pasan P01, marco `21/21`, componentes, rutas `20/20` y
`git diff --check`. Los cinco bloques quedan en `PARCIAL` hasta recorrer sus
rutas reales, estados vacío/carga/error y acciones específicas en escritorio y
móvil. En Plataforma sigue siendo necesaria una cuenta de administrador QA;
no se elevó ningún privilegio durante esta tanda.

### Caja · primera migración de superficie

El commit `92785c52` aplica la capa visual Órbita a
`main[data-la-orbita-module="caja"]`. La apertura de sesión, el arqueo diario,
los movimientos y ajustes de caja, el historial, los traspasos y sus avisos
comparten tarjetas, bordes, radios, sombras y jerarquía tipográfica. Los
campos, selectores y botones respetan `44 px`; en móvil los bloques de
denominaciones y formularios pasan a una columna para evitar desbordamientos.
La capa también cubre la raíz histórica `.la-operacion-caja`. No se tocaron
handlers, cobros, reembolsos, permisos, fiscalidad ni persistencia.

La marca de caché CSS es `qa-orbita-modules-v19-20261121` y la huella fijada
por P01 es `ce277db80f8e2cf4`. Pasan P01, marco `21/21`, componentes, rutas
`20/20`, autoridad de persistencia y `git diff --check`. Caja permanece en
`PARCIAL` hasta recorrer en QA cobro, cierre, reembolso, documento y estados
vacío/carga/error en escritorio y móvil; no se ejecutaron nuevas operaciones
de negocio en esta tanda.

### Endurecimiento de escala contra estilos heredados · v22

La capa común ahora fuerza `min-height: var(--la-control-height) !important`
para inputs, selects, textareas, botones, tabs, opciones y elementos de menú
dentro de cualquier módulo Órbita. Esto neutraliza los `minHeight` inline que
todavía emite código histórico (por ejemplo, el selector de asignación de
Personal con `40px`) sin tocar sus handlers ni su lógica. La misma regla se
aplica a tabs y dropdowns globales. La caché pasó a
`qa-orbita-modules-v22-20261121`, huella P01 `bdeee2cb4df1c980`.

Este cambio es una guarda de escala, no un cierre visual de los módulos: los
doce siguen en `PARCIAL` hasta la revisión live de cada ruta real.

### Batería global y manifiesto · 21/11/2026

Se incorporó `tests/rediseno/migracion-modulos-contract.mjs` al manifiesto
oficial y al validador de inventario: `384` entradas, `367` contratos activos,
`328` Node activos. La batería completa ejecutó los `328` contratos Node, la
prueba de frontera Netlify, `8` utilidades y `5` diagnósticos: `305 PASS`,
`23 FAIL` históricos, `INFRA_FAIL=0`. Los 23 fallos son exactamente la familia
ya conocida (alb, cfg, f3, f4, plataforma, pm11-compra y pm33); el contrato de
migración modular pasa dentro de la batería. El runner dejó las únicas
modificaciones intencionadas del manifiesto/validador y el `git diff --check`
continúa limpio.

El commit `1e3de70c` se publicó en Deploy Preview 225
(`6b01335abbb331413cd060a0`, estado `ready`). La comprobación live del alias
sirve `la-apariencia.css?v=qa-orbita-modules-v22-20261121`; en la pantalla de
acceso el control táctil mínimo observado fue `44 px` y no hubo desbordamiento
 horizontal.

### Gestión · estados y tablas semánticos · v24

La capa común de Compras, Inventario, Personal, Configuración y Plataforma
deja de heredar colores históricos en los mensajes de estado: los `role=alert`
usan el fondo/error Órbita y los `role=status` el estado informativo Órbita.
Las cabeceras y filas de tablas reciben la superficie, contraste, densidad y
hover del sistema común. No se modifican ordenación, filtros, permisos,
handlers ni datos. La caché CSS pasa a
`qa-orbita-modules-v24-20261121`, huella P01 `471a45c1efb84092`.

Los cinco módulos siguen `PARCIAL`: aún falta el recorrido autenticado de
cada ruta, estados vacío/carga/error y comprobación conjunta escritorio/móvil
con datos reales de QA. La revisión está publicada en Deploy Preview 225 como
`6b0139add1ed5298ee9b64ab` (`ready`), commit `a1120082`.

### Acceso · MFA alineado con Órbita · v25

El paso MFA se monta fuera del formulario de login y conservaba una tarjeta
verde/dorada inline. La capa v25 lo identifica por `autocomplete="one-time-code"`
y normaliza tarjeta, título, campo numérico, error, botón primario y salida con
los tokens Órbita; en móvil mantiene el ancho útil y controles de `44 px`.
No se modifican desafío, verificación, inscripción, cierre de sesión ni
handlers de autenticación. El bloque continúa `PARCIAL` hasta comprobar login,
recuperación, MFA y selección de empresa/local en ambas superficies.
La capa quedó publicada en el Deploy Preview 225 (`6b013c51e5a98b1501fc71df`,
`ready`), commit `f7157f0c`.

### Estados globales · cierre de convivencia antigua · v26

La primitiva global de alerta/estado deja de depender del color heredado del
componente que la emite: todos los `role=alert` reciben fondo y tinta de
error Órbita y todos los `role=status` la superficie informativa Órbita. Esto
alcanza también Clientes, Caja y cualquier pantalla de gestión que todavía no
tenga un selector específico. Se conserva el contenido, la semántica ARIA y
los handlers. Caché `qa-orbita-modules-v26-20261121`, huella P01
`0471acf3bfc85099`.
Deploy Preview 225: `6b013d3584eba994f4ee5306` (`ready`), commit `4e51e027`.

### Tablas · contención móvil común · v27

Todas las tablas dentro de un módulo Órbita encapsulan su desplazamiento en
móvil, sin ampliar el viewport ni alterar la semántica de cabeceras, celdas,
ordenación o selección. Las celdas conservan una anchura legible y el área
interactiva común. Caché `qa-orbita-modules-v27-20261121`, huella P01
`bb7e168a744878e6`.
La corrección está publicada en Deploy Preview 225 como `6b013ddcf49a09cfd3ecd251`
(`ready`), commit `8b07d8e7`. El recorrido autenticado de las doce superficies
continúa pendiente antes de cambiar cualquier estado de `PARCIAL` a `CERRADO`.

### Contenedores históricos · contención móvil común · v28

Además de las tablas, los wrappers históricos `overflow-x-auto` de matrices,
bandas de filtros y listados quedan contenidos dentro de su superficie Órbita.
El hijo conserva su scroll local, pero el `main` y el viewport reciben
`min-width: 0` y `max-width: 100%`. No se modifican contenido, ordenación ni
handlers. La caché CSS queda en `qa-orbita-modules-v28-20261121`, huella P01
`edb7c9116b854562`; queda repetir la revisión live de los módulos. La
publicación quedó lista en Deploy Preview 225 como
`6b01405358c478c62a3c92b0` (`ready`), commit `1c00a56a`; el alias estable es
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app`.

### Inicio y panel general · superficie única v29

El primer bloque de migración deja de tratar el panel Órbita y el detalle
operativo histórico como dos identidades visuales. La capa v29 normaliza el
panel de Inicio, sus accesos, indicadores, tarjetas de detalle, formularios,
tablas y estados con los tokens comunes de Órbita; fija anchura máxima,
radios, sombras, tipografía y controles táctiles de `44 px`, y en móvil
apila accesos e indicadores sin overflow. No cambia indicadores, datos,
permisos, navegación ni handlers. Caché `qa-orbita-modules-v29-20261121`,
huella P01 `b729a1b6a5c2f7d3`. La matriz permanece `PARCIAL` hasta recorrer
Inicio autenticado en los cinco viewports y comprobar vacío/carga/error.
La publicación v29 está lista en Deploy Preview 225 como
`6b0141b9c36cc507a332a536` (`ready`), commit `41532f7b`.

### TPV y sala · controles secundarios e historial · v30

La capa v30 completa la normalización de la superficie TPV: botones, inputs y
selectores del ticket, cuentas, sala, venta rápida y confirmaciones reciben la
misma altura mínima, radio y foco; la tabla de historial adopta la tarjeta y
cabecera Órbita y en móvil conserva el scroll dentro de su wrapper. No se
alteran cobros, persistencia, fiscalidad, permisos ni handlers. Caché
`qa-orbita-modules-v30-20261121`, huella P01 `742bf5b1ac1bc2fd`. TPV continúa
`PARCIAL` hasta recorrer sus rutas autenticadas y estados reales.
La publicación está lista en Deploy Preview 225 como
`6b014268ed0690c4525a4eb2` (`ready`), commit `47368d65`.

### Pase · raíces independientes y cola contenida · v31

La raíz de Pase queda normalizada tanto cuando se monta como módulo propio
como cuando se incrusta en Inicio. El plano, estados `LIBRE`, `OCUPADA`,
`RESERVADA`, `BLOQUEADA` y `FUERA_SERVICIO`, filtros, accesos y cola comparten
escala, foco, tarjetas y tokens Órbita; en móvil la cola mantiene su scroll
local y no hace crecer la pantalla. No se modifican RPC, estados de sala,
permisos ni navegación. Caché `qa-orbita-modules-v31-20261121`, huella P01
`42175d9f2bb452b1`. Pase continúa `PARCIAL` hasta el recorrido autenticado.
La publicación v31 está lista en Deploy Preview 225 como
`6b0142f47b251896fb16c39f` (`ready`), commit `cbea3472`.

### Cocina · controles y estados de la cola · v32

La capa v32 completa la normalización de Cocina: botones, selects, inputs y
acciones de reimpresión/gestión comparten la altura de `44 px` y el radio
común; los estados `role=alert` y `role=status` consumen tokens Órbita; las
tarjetas y la cola quedan contenidos en móvil sin overflow. No se modifican
estaciones, rutas, estados, RPC, permisos ni handlers. Caché
`qa-orbita-modules-v32-20261121`, huella P01 `9ea641f1c7c6adae`. Cocina sigue
`PARCIAL` hasta el recorrido autenticado en QA. Deploy Preview 225:
`6b014411457f622dbe7439c8` (`ready`), commit `81ca1074`.

### Caja · controles, estados y movimientos · v33

La capa v33 completa la normalización visual de Caja: botones, botones con
rol, selectores, campos y áreas de texto comparten altura táctil de `44 px` y
radio Órbita; los estados `role=alert`, `role=status` y `aria-busy` consumen
tokens semánticos; los detalles y tablas mantienen un área accionable legible
y el scroll queda contenido en móvil. No se modifican cobros, arqueos,
reembolsos, documentos, permisos ni handlers. Caché
`qa-orbita-modules-v33-20261121`, huella P01 `7ba54937325ac699`. Caja sigue
`PARCIAL` hasta el recorrido autenticado en QA. Deploy Preview 225:
`6b01458faf0db151e7f4ba59` (`ready`), commit `fd1f6a51`.

### Clientes · listados, vistas guardadas y ficha · v34

La capa v34 completa la superficie de Clientes: vistas guardadas, paginación,
botones con rol, ficha, tablas, detalles y estados comparten la escala Órbita;
alertas y estados informativos consumen tokens semánticos y en móvil las tablas
mantienen scroll local sin ampliar el viewport. No se modifican filtros,
actividad, NIF, datos, permisos ni handlers. Caché
`qa-orbita-modules-v34-20261121`, huella P01 `77fa483c6dc0cc62`. Clientes sigue
`PARCIAL` hasta el recorrido autenticado en QA. Deploy Preview 225:
`6b01467d071af1a092f9d639` (`ready`), commit `851f285c`.

### Compras · proveedores, pedidos, recepción y facturas · v35

La capa v35 normaliza Compras de extremo a extremo: tarjetas, botones,
selectores, campos, estados, detalles y tablas comparten la escala Órbita;
alertas y estados informativos consumen tokens semánticos y en móvil los
listados mantienen scroll local y columnas apiladas. No se modifican pagos,
recepción, albaranes, facturas, datos, permisos ni handlers. Caché
`qa-orbita-modules-v35-20261121`, huella P01 `edaafbdf5effde93`. Compras sigue
`PARCIAL` hasta el recorrido autenticado en QA. Deploy Preview 225:
`6b01472c82a0e124af3b427b` (`ready`), commit `5b0c4bad`.

### Inventario · productos, movimientos, mermas y ajustes · v36

La capa v36 normaliza Inventario para productos, movimientos, mermas,
caducidad y ajustes: tarjetas, botones, campos, estados, detalles y tablas
comparten la escala Órbita; en móvil los listados conservan scroll local y los
formularios se apilan sin overflow. No se modifican salidas, ajustes,
persistencia, permisos ni handlers. Caché `qa-orbita-modules-v36-20261121`,
huella P01 `b0199d11c27752d6`. Inventario sigue `PARCIAL` hasta el recorrido
autenticado en QA. Deploy Preview 225:
`6b0147c47a019a8ab1360f4d` (`ready`), commit `e015abb2`.

### Personal · empleados, cargos, permisos, turnos y fichajes · v37

La capa v37 normaliza Personal para empleados, cargos, permisos, turnos y
fichajes: tarjetas, botones, campos, estados, detalles y tablas comparten la
escala Órbita; en móvil los grupos se envuelven, las tablas mantienen scroll
local y los formularios se apilan. No se modifican permisos, fichajes,
turnos, datos ni handlers. Caché `qa-orbita-modules-v37-20261121`, huella P01
`7360be9936c414f6`. Personal sigue `PARCIAL` hasta el recorrido autenticado
en QA. Deploy Preview 225: `6b0148194d9d3057193003d7` (`ready`), commit
`2f3735b0`.

### Configuración · empresa, locales, terminales, fiscalidad y apariencia · v38

La capa v38 completa la normalización de Configuración: tarjetas, botones,
campos, selectores, estados, detalles y tablas comparten la escala Órbita; en
móvil los grupos se envuelven, las tablas mantienen scroll local y los
formularios se apilan sin overflow. No se modifican persistencia, fiscalidad,
apariencia, permisos ni handlers. Caché `qa-orbita-modules-v38-20261121`,
huella P01 `f186177be3f110a1`. Configuración sigue `PARCIAL` hasta el recorrido
autenticado en QA. Deploy Preview 225: `6b0149afafe536f0d8713604` (`ready`),
commit `9b2bde7b`.

### Plataforma · paneles exclusivos de administración · v39

La capa v39 completa la normalización de Plataforma: paneles administrativos,
tarjetas, botones, campos, selectores, estados, detalles y tablas comparten la
escala Órbita; en móvil los grupos se envuelven, las tablas mantienen scroll
local y los formularios se apilan sin overflow. No se modifican permisos,
roles, datos ni handlers. Caché `qa-orbita-modules-v39-20261121`, huella P01
`f26769170c7cdfa3`. Plataforma sigue `PARCIAL` hasta el recorrido autenticado
con privilegio de administración en QA. La capa alcanza tanto
`main[data-la-orbita-module="plataforma"]` como los paneles previos
`#la-plataforma-root` y `#la-plataforma-cambio-root`.
Deploy Preview 225: `6b014af5313583e7553eee86` (`ready`), commit `45722dc5`.

### Acceso · login, recuperación, MFA y selección de empresa/local · v40

La capa v40 completa la normalización de Acceso: login, recuperación, MFA y
selección de empresa/local comparten campos, botones, alertas y estados Órbita;
en móvil se oculta el arte decorativo, el formulario ocupa el ancho disponible
y las opciones se envuelven sin overflow. No se modifican autenticación,
sesiones, permisos ni handlers. Caché `qa-orbita-modules-v40-20261121`, huella
P01 `67300938eb8c5c76`. Acceso sigue `PARCIAL` hasta el recorrido autenticado
completo en QA.
Deploy Preview 225: `6b014b8aabe0ae40a1c2ee97` (`ready`), commit `b1b142ba`.
Evidencia no autenticada: pantalla `Iniciar sesión`, recuperación, acceso sin
sincronizar y lanzador Apariencia visibles en el preview; el recorrido con
sesión y MFA queda pendiente.

## Evidencia de la tanda `b8a9a132` · 21/11/2026

La corrección final de Plataforma cubre también sus montajes previos al shell
(`la-plataforma-root` y `la-plataforma-cambio-root`) y sus primitivas `.lap-*`.
Los contratos de rediseño pasan con `REDISENO_REGRESSION_FAILED=0`; el chequeo
de recuperación de fuente devuelve `PARIDAD_CUERPO_EXACTA=1` y
`SOURCE_RECOVERY_CHECK=PASS`; `git diff --check` está limpio. La batería global
Bash no se pudo iniciar por un error de MSYS2 al crear `\BaseNamedObjects\msys-*`
en este Windows. Esto no cambia el estado funcional: los doce módulos siguen
`PARCIAL` hasta verificar sus rutas autenticadas reales en escritorio y móvil.
El deploy correspondiente del PR #225 es `6b015343ff0dcfeeefb454ae` (`ready`),
con la URL estable `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`.

### Recorrido visual de rutas · 21/11/2026 · SHA `56be8a75`

En el preview se activó el modo local sin sincronizar para aislar la capa
visual y se recorrieron diez entradas del menú. La lectura de la propia página
devolvió este anclaje, sin desbordamiento horizontal y con controles visibles
de al menos 44 px en cada ruta:

| Entrada | `data-la-orbita-module` / `surface` | Overflow | Mínimo |
|---|---|---:|---:|
| Panel general | `inicio` / `inicio` | no | 44 px |
| TPV | `tpv` / `tpv` | no | 44 px |
| Cocina | `cocina` / `cocina` | no | 44 px |
| Proveedores | `compras` / `compras` | no | 44 px |
| Productos | `inventario` / `inventario` | no | 44 px |
| Personal | `personal` / `personal` | no | 44 px |
| Clientes | `clientes` / `clientes` | no | 44 px |
| Configuración | `configuracion` / `configuracion` | no | 44 px |
| Arqueo de caja | `caja` / `caja` | no | 44 px |
| Encargos | `tpv` / `tpv` | no | 44 px |

La prueba confirma que las pantallas históricas ya no caen en la superficie
genérica `pantalla`. Al ser modo sin sincronizar, los estados de servidor,
permisos, cobros y persistencia siguen requiriendo el recorrido autenticado de
QA antes de cambiar cualquiera de las doce filas a `CERRADO`.
La corrección se sirve con `qa-orbita-shell-v8-20261121`, huella P01
`a6a93b11be680172`, en el commit `24d490c8`.

### Recorrido visual móvil · 21/11/2026

Se repitió el recorrido en el Deploy Preview con emulación móvil de **390 ×
844 px**, `deviceScaleFactor=1`, modo móvil y sesión local sin sincronización.
Se abrió la navegación inferior y el menú «Más» para todas las entradas
visibles:

| Entrada | Módulo | Superficie | Overflow horizontal | Control mínimo | Navegación inferior |
|---|---|---|---:|---:|---|
| Panel general | `inicio` | `inicio` | `false` | 44 px | `true` |
| TPV | `tpv` | `tpv` | `false` | 44 px | `true` |
| Cocina | `cocina` | `cocina` | `false` | 44 px | `true` |
| Proveedores | `compras` | `compras` | `false` | 44 px | `true` |
| Productos | `inventario` | `inventario` | `false` | 44 px | `true` |
| Personal | `personal` | `personal` | `false` | 44 px | `true` |
| Clientes | `clientes` | `clientes` | `false` | 44 px | `true` |
| Configuración | `configuracion` | `configuracion` | `false` | 44 px | `true` |
| Arqueo de caja | `caja` | `caja` | `false` | 44 px | `true` |
| Encargos | `tpv` | `tpv` | `false` | 44 px | `true` |

Resultado: **10/10 rutas móviles clasificadas correctamente**, sin
desbordamiento horizontal, con navegación inferior presente y controles
táctiles de al menos 44 px. La sesión fue local/sin sincronización; esta
evidencia valida el marco y la respuesta visual, pero no sustituye la
verificación autenticada de datos, permisos, cobros, MFA ni estados reales.
Por ello las filas permanecen `PARCIAL` hasta completar esos recorridos.

### Recorrido visual de escritorio actualizado · 21/11/2026

Se repitió el mismo conjunto de rutas con viewport de **1440 × 900 px** en el
preview actualizado. Las diez entradas resolvieron la superficie esperada, sin
overflow horizontal y con un control visible mínimo de 44 px:

| Ruta | Módulo/superficie | Overflow | Mínimo | Alertas | Estados |
|---|---|---:|---:|---:|---:|
| Panel general | `inicio/inicio` | `false` | 44 px | 0 | 3 |
| TPV | `tpv/tpv` | `false` | 44 px | 1 | 0 |
| Cocina | `cocina/cocina` | `false` | 44 px | 1 | 0 |
| Proveedores | `compras/compras` | `false` | 44 px | 0 | 1 |
| Productos | `inventario/inventario` | `false` | 44 px | 0 | 0 |
| Personal | `personal/personal` | `false` | 44 px | 0 | 1 |
| Clientes | `clientes/clientes` | `false` | 44 px | 0 | 2 |
| Configuración | `configuracion/configuracion` | `false` | 44 px | 1 | 0 |
| Arqueo de caja | `caja/caja` | `false` | 44 px | 0 | 0 |
| Encargos | `tpv/tpv` | `false` | 44 px | 0 | 1 |

La medición se hizo en modo local/sin sincronización para no generar cambios
de negocio. Es evidencia del marco, la escala y la comunicación visual; no
convierte por sí sola las filas en `CERRADO`.

### Acceso · revisión visual no autenticada · 21/11/2026

La superficie `.la-acceso` se comprobó directamente en el preview sin iniciar
sesión, en **390 × 844 px** y **1440 × 900 px**. En ambos tamaños se observó
login, recuperación, acceso local y lanzador de Apariencia; no hubo overflow y
el control visible mínimo fue de 44 px. Esta evidencia cubre la composición
responsive de Acceso, pero no el resultado de login, recuperación, expiración,
selección de local ni MFA, que requieren una sesión QA real.

### Estados observados en la pasada móvil local · 21/11/2026

Además del anclaje del shell, se comprobó que las rutas no quedan en blanco
cuando el modo local no puede consultar el servidor: muestran una alerta,
estado informativo o vacío explícito. La lectura fue realizada después de
cada navegación, manteniendo `overflow=false` y control mínimo de 44 px.

| Ruta | Módulo/superficie | Alertas | Estados informativos | Vacío/conexión visible |
|---|---|---:|---:|---|
| Inicio | `inicio/inicio` | 0 | 3 | no |
| TPV | `tpv/tpv` | 1 | 0 | no |
| Cocina | `cocina/cocina` | 1 | 0 | sí |
| Proveedores | `compras/compras` | 0 | 1 | no |
| Productos | `inventario/inventario` | 0 | 0 | no |
| Personal | `personal/personal` | 0 | 1 | no |
| Clientes | `clientes/clientes` | 0 | 2 | no |
| Configuración | `configuracion/configuracion` | 1 | 0 | sí |
| Arqueo de caja | `caja/caja` | 0 | 0 | no |
| Encargos | `tpv/tpv` | 0 | 1 | sí |

Esta es evidencia de la capa visual y de sus estados de comunicación en modo
local; no certifica el contenido, permisos o persistencia del backend QA.

### Corrección transversal · control de navegación del shell · `6438b207`

La auditoría del criterio táctil detectó que el botón visible para contraer la
navegación lateral estaba definido en `36×36 px`. Aunque las comprobaciones
anteriores no lo incluían como control de módulo, forma parte del marco común y
no podía quedar por debajo del contrato de `44×44 px`. Se corrigió a `44×44 px`,
se invalidó la caché CSS a `qa-orbita-modules-v41-20261121` y se añadió una
aserción al contrato de componentes para impedir regresiones. No se tocaron
handlers, permisos, datos ni rutas. La corrección está publicada solo en
`rediseno/f0-base-qa`; PR #225 continúa en borrador y producción permanece
fuera de alcance.

El deploy de comprobación de esta revisión es
`6b015a051778aed939b61a43` (`ready`), con `commit_ref` exacto
`bc8043b217701c7f29198a718a8f759b2680bb08`, disponible en
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app`. El escaneo de
secretos no encontró coincidencias y se procesaron las siete reglas de
cabeceras sin error.

Tras el commit documental `e5f0a67efe6b2b3d16fff12b048e2eabf25e4dd6`, el
Preview 225 volvió a quedar `ready` en el deploy
`6b015a56e2b32501d2eb2c8d`; el alias estable sigue apuntando a esa rama de QA.

### Plataforma · corrección del token tipográfico · `e84079b3`

La auditoría del panel previo al shell detectó `var(--la-font-sans)`, una
variable inexistente que dejaba la tipografía de Plataforma en manos del
estilo heredado. Se sustituyó por `var(--la-font)`, se invalidó la caché a
`qa-orbita-modules-v42-20261121` y se añadió una aserción que impide volver a
referenciar el token huérfano. La lógica, permisos y handlers permanecen
intactos; Plataforma sigue `PARCIAL` hasta disponer de una sesión de
administrador QA para recorrer sus paneles reales.

### Acceso · token mono declarado · revisión `v43`

La auditoría de tokens encontró que el campo de MFA usaba `--la-mono` sin una
declaración en la capa Órbita. Se añadió el token IBM Plex Mono en `:root`, se
actualizó la caché a `qa-orbita-modules-v43-20261121` y se protegió con un
contrato estático. `--la-orbita-puntero` no es un hueco: es una propiedad
dinámica escrita por el movimiento del cursor y conserva su fallback.

La corrección quedó publicada en el deploy `6b015c30695cff02d317a7d6`
(`ready`), con `commit_ref` `af3ba1dec857d8c8219a29a2b50bc98083b84338`.

El contrato de componentes incorpora además un inventario automático de
tokens `--la-*`: cada uso debe estar declarado en la hoja o documentado como
propiedad dinámica. Así la normalización visual no puede introducir otra
variable huérfana sin romper la batería.

### Plataforma y Acceso · superficies fuera de `#root` · revisión actual

La auditoría del bloque 4 encontró dos superficies que no podían quedar
cubiertas solo por los selectores `#root`: el Panel de Plataforma (`.lap-root`,
montado bajo `body`) y `restablecer-contrasena.html` (documento independiente).
Ambas conservaban colores y geometría propios del marco antiguo. Se corrigió
sin tocar lógica, permisos, RPC ni handlers:

- `plataforma-panel.js` consume ahora los tokens `--c-*` y `--la-*` del diseño
  activo para barra, tarjetas, diálogos, estados, campos y botones. Todos sus
  controles y campos tienen `44 px` mínimos también en escritorio. Se retiró el
  fondo inline heredado del flujo de cambio de contraseña y se añadió la marca
  de caché `qa-orbita-platform-v2-20261121` en `index.html`.
- `restablecer-contrasena.html` fija el diseño inicial Órbita, carga la hoja
  común v43 y usa sus tokens para fondo, tarjeta, tipografía, campos, botón,
  mensajes y enlace de vuelta. Sus controles mantienen el suelo de `44 px`
  aunque la página se abra sin sesión.

Los contratos `p04-panel-contract`, `componentes-orbita-contract`,
`marco-orbita-contract`, `migracion-modulos-contract` y `git diff --check`
 pasan tras la corrección. Plataforma y Acceso siguen en `PARCIAL`: todavía se
 necesita el recorrido autenticado de administración, recuperación, selección
 de local y MFA para cerrar sus filas de QA.

La corrección está en `bfb0e6856c4baa1fe64858f45b98cfdf89485685` y se publicó
en el Deploy Preview 225 como `6b015f565f50b1269577c814` (`ready`), con
escaneo de secretos sin coincidencias y las siete reglas de cabeceras
procesadas. El PR #225 continúa en borrador y producción no se tocó.

### Arranque y bootstrap de instalación · revisión `9ae45621`

El barrido del punto 4 también cubrió el primer render, antes de que React
monte `#root`, y el diálogo de instalación inicial que crea el propietario.
`index.html` fija `data-la-diseno="orbita"` desde el documento, usa el fondo,
tipografía y acento semánticos del tema en la pantalla de carga y mantiene la
barra de progreso sin la paleta verde/beige antigua. `owner-bootstrap-post-reset.js`
consume los mismos tokens para su modal, avisos, campos y botones; inputs y
acciones tienen `min-height: 44px` y el flujo de servidor queda intacto.

Los contratos de componentes, shell, rutas, módulos y `git diff --check` pasan
con esta revisión. Se publicó en el Deploy Preview 225 como deploy
`6b0160c90992330e675aecdf` (`ready`). Plataforma
y Acceso siguen `PARCIAL` hasta completar sus recorridos autenticados reales.

Evidencia visual adicional de Acceso en el Preview 225 (ruta de login sin
sesión, viewport disponible `618×678`): `data-la-diseno="orbita"`, fondo
`rgb(23,25,28)`, tipografía Inter, `scrollWidth === innerWidth` y cero
controles por debajo de `44 px`. Esta comprobación cierra la revisión visual
del primer render, pero no sustituye el recorrido autenticado de login,
recuperación, expiración, MFA y selección de empresa/local.

### Marco transversal · barra inferior móvil Órbita · `5c452ff4`

El recorrido modular detectó una convivencia que no aparecía en las filas de
los módulos: la navegación inferior móvil seguía siendo el componente histórico
con estilos inline. Se normalizó como parte del shell común, sin sustituir sus
handlers React: cinco destinos con la misma superficie, tipografía, borde,
estado activo, foco y área táctil mínima de `44×44 px`. La barra queda oculta
en escritorio, ocupa una fila propia en móvil y el buscador global incluye sus
destinos sin duplicar los del menú lateral.

La corrección está servida con `la-apariencia.css?v=qa-orbita-modules-v44-20261121`.
Se añadieron marcas semánticas `data-la-orbita-nav-item` y
`aria-current="page"` únicamente para presentación y accesibilidad; no cambian
la selección de pestaña, permisos, persistencia ni rutas. El contrato de
componentes comprueba tanto la barra como la deduplicación del buscador.
La rama sigue siendo `rediseno/f0-base-qa`, PR #225 en borrador, y producción
permanece intacta. Este cambio mejora el marco de los doce módulos, pero no
convierte por sí solo ninguna fila `PARCIAL` en `CERRADO`: siguen pendientes
los recorridos autenticados y los estados de datos reales indicados arriba.

El commit quedó publicado en el Deploy Preview 225 como
`6b01684ad1ed5298eea45317` (`ready`), `commit_ref=37080596af67e46a04cc7c313293f69a0e8b3521`.
El escaneo de secretos no encontró coincidencias y las siete reglas de
cabeceras se procesaron sin error.

### Evidencia live posterior · barra móvil · Preview 225

Con el Preview 225 actualizado (`?cache=qa-orbita-modules-v44-20261121`) se
abrió el modo local en viewport táctil `618×678`. El árbol accesible mostró las
cuatro pestañas `Inicio`, `Resultados`, `Arqueo de caja` y `Más`, además de la
cabecera común con contexto `Local A1 · QA Empresa A, S.L.`, QA, búsqueda,
avisos, perfil y Apariencia. La captura visual confirmó que la barra queda en
su propia fila inferior, que el estado activo se distingue con borde/acento y
que no tapa el contenido ni introduce desplazamiento horizontal visible.
La ruta quedó en Inicio/Órbita; los estados de Pase y Cocina se mostraron como
avisos de conexión explícitos en modo local, sin operaciones ni escrituras.
Esta evidencia confirma la corrección transversal del shell; las filas de los
módulos siguen `PARCIAL` hasta sus recorridos autenticados y de datos reales.

### Componentes comunes · normalización semántica de los doce módulos · `f7f6eb58`

La auditoría del punto 4 encontró que el shell ya era común, pero los controles
seguían llegando con nombres de clase históricos diferentes según la pantalla.
Eso podía dejar botones, campos, pestañas, tablas, estados, diálogos y tarjetas
con geometrías distintas aunque pertenecieran al mismo módulo. Se añadió en
`la-orbita-shell.js` la marca aditiva `marcarComponentesOrbita`: clasifica los
elementos existentes por su rol real (`la-orbita-control`, `la-orbita-field`,
`la-orbita-tab`, `la-orbita-table`, `la-orbita-state`, `la-orbita-dialog` y
`la-orbita-card`). No sustituye nodos, no añade handlers de negocio y no cambia
permisos, datos ni persistencia; solo permite que la hoja común aplique la
escala Órbita de forma uniforme cuando React vuelve a pintar una vista.

`la-apariencia.css` v45 consume esas marcas para tipografía, altura mínima de
44 px, foco, radios, bordes, estados, tablas y modales. La caché quedó en
`qa-orbita-modules-v45-20261121` y el shell en `qa-orbita-shell-v10-20261121`.
Los contratos P01, marco, componentes y migración modular, junto con
`git diff --check`, pasan en local. Esto reduce la convivencia visual antigua
en los doce módulos, pero no convierte una fila en `CERRADO`: todavía se exige
el recorrido QA autenticado de cada ruta, sus estados de datos y sus dos
viewports antes de cerrar individualmente.

### Modo local · montaje del shell sin `data-la-contenedor` · `1948bc4d`

La primera verificación del artefacto v45 reveló una diferencia entre sesión
autenticada y modo «Trabajar solo en este equipo»: el wrapper React local no
recibía `data-la-contenedor`, así que el shell no encontraba su raíz y dejaba
visible el marco histórico. `prepararMarco()` acepta ahora también la clase
estable del wrapper (`w-full min-h-[700px]`) y añade el atributo visual
`data-la-contenedor="orbita"` cuando falta. Es una guarda de presentación; no
inicia sincronización, no crea datos y no altera el diseño elegido.

El shell se sirve ahora como `qa-orbita-shell-v12-20261121`; tras volver a
publicar se repetirá la comprobación live en modo local antes de considerar
cerrada esta excepción.

La misma pasada detectó que el wrapper local podía no tener `data-la-diseno` y
que «Resumen general» no entraba en la clasificación de Inicio. El shell v12
fija Órbita solo como valor inicial cuando no existe otro diseño y reconoce
ese encabezado como `inicio`; una elección posterior de apariencia conserva
precedencia.

Evidencia live posterior: deploy `6b016bd8317438ca308d4d50` en estado `ready`,
commit `ee43cf1d`. En modo local del Preview, la raíz quedó con
`data-la-contenedor="orbita"`, `data-la-diseno="orbita"` y el shell común; la
superficie observada fue `pase`, con 24 controles semánticos, 1 campo, 5
estados, mínimo visible de 44 px y `overflow=false`. La captura confirmó
cabecera, lateral, contexto QA, buscador, avisos, perfil y Apariencia con la
misma jerarquía Órbita. No se hicieron escrituras de negocio. Esta evidencia
cierra la excepción de arranque local; las filas siguen `PARCIAL` hasta sus
recorridos autenticados.

La navegación histórica también queda sincronizada con `aria-current` al
activar un destino. Así «Panel general» conserva `inicio` aunque su contenido
incluya el panel Pase; una sub-superficie ya no roba la identidad del módulo.
La regresión queda cubierta por el contrato de marco y se comprobará en el
siguiente deploy v14.

Además, la selección actualiza `data-la-orbita-route` inmediatamente; no
depende de un repintado posterior de React para cambiar la superficie visual.
La marca `data-la-orbita-module` usa esa misma prioridad: Inicio ya no queda
clasificado como Pase cuando el panel operativo está incrustado.

### Recorrido modular local · prioridad de Inicio · `d08a905e`

En el deploy `6b016e263339e98d72dc5b68` (`ready`) se repitió el recorrido sin
sincronización. Al activar «Panel general», la superficie y el módulo quedaron
ambos en `inicio` aunque el panel Pase siga incrustado; se observaron 24
controles semánticos, mínimo de 44 px y `overflow=false`. El mismo banco
recorrió TPV (`tpv`), Cocina (`cocina`), Caja (`caja`), Clientes (`clientes`),
Proveedores (`compras`), Productos (`inventario`), Personal (`personal`) y
Configuración (`configuracion`), todos con mínimo 44 px y sin desbordamiento
horizontal. Es evidencia visual local, no cierre de permisos ni datos reales.

### Plataforma y Acceso · cierre de la normalización de controles · 21/11/2026

Se corrigió la última diferencia común detectada fuera de los recorridos
autenticados: las áreas de texto de `#la-plataforma-root` y
`#la-plataforma-cambio-root` quedaban fuera de la altura, borde y radio Órbita
que ya usaban inputs y selectores. También se fijó un foco visible común para
botones, campos y acciones de login, MFA y Plataforma. No se modifican lógica,
sesiones, permisos, RPC ni datos.

La hoja queda publicada con la marca `qa-orbita-modules-v46-20261121` y la
huella P01 `ebbf90ccdde80bb4`. Los 12 módulos siguen deliberadamente en
`PARCIAL`: esta corrección cierra la consistencia estática de los componentes,
pero no sustituye el recorrido autenticado de cada ruta, especialmente el
acceso administrador de Plataforma y el flujo login/recuperación/MFA de
Acceso.

Evidencia de esta revisión: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`,
`REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 responsive=PASS
tactil=44`, `MARCO_ORBITA_CONTRACT=PASS (23/23)`,
`MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`, batería completa
`tests/rediseno/*.mjs` en verde y `git diff --check` limpio.

El commit `1878e2b1` se publicó en el Deploy Preview 225 como deploy
`6b0170474f1e763bb9d3eab9` (`ready`). El alias estable sigue siendo
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`; la pantalla de
Acceso carga sin bloqueo y muestra el formulario Órbita con controles táctiles.
El PR #225 permanece abierto, en borrador, contra `release`; producción no se
ha tocado.

### Recorrido local adicional · preview v46 · 21/11/2026

En el deploy `6b0170d2f16c14c121a5b9e5` se activó «Trabajar solo en este
equipo, sin sincronizar» y se recorrieron las rutas visibles del shell sin
credenciales ni escrituras de negocio. El arranque terminó en el panel Órbita
tras la hidratación y mantuvo el contexto `Local A1 · QA Empresa A, S.L.`.

| Ruta | Evidencia observada |
|---|---|
| Inicio / Panel general | `El pulso del negocio`, accesos rápidos, cuatro indicadores, detalle operativo colapsable y cabecera Órbita |
| TPV | venta rápida/sala, buscador, categorías, catálogo QA, caja del TPV, resumen e historial bajo demanda |
| Cocina | cabecera, actualización, filtro de estación, aviso de conexión y estado vacío de comandas |
| Caja | apertura de sesión, arqueo, fecha, movimientos ocultos bajo demanda, contado y estados de cierre |
| Clientes | vistas guardadas, búsqueda, filtros de estado/tipo, vacío y paginación deshabilitada |
| Compras | Proveedores con estado vacío y acción Nuevo proveedor |
| Inventario | filtros, tabla de productos QA, acciones Kardex/Editar/Registrar salida/Eliminar y alerta de stock mínimo |
| Personal | cabecera, acción Nuevo empleado, pestañas Empleados/Selección y estado de carga |
| Configuración | selector de secciones, contexto empresa/local, motivo obligatorio, controles de cajas y fiscalidad/permisos |

La capa común siguió visible en todas las rutas; la batería estática garantiza
los controles táctiles de 44 px y la revisión responsive. Esta pasada no prueba
permisos, persistencia, cobros, reembolsos, MFA ni estados de servidor con una
sesión autenticada: esos requisitos siguen siendo el criterio pendiente para
pasar cada fila de `PARCIAL` a `CERRADO`.

### Plataforma previa al shell · marca semántica externa · 21/11/2026

Las dos superficies que Plataforma monta antes de abrir el `main` autenticado
(`la-plataforma-root` y `la-plataforma-cambio-root`) exponen ahora
`data-la-orbita-external="plataforma"` y
`data-la-orbita-surface="plataforma"`. La hoja visual ya las normalizaba por
id; la marca hace verificable que el panel administrador y el cambio de
contraseña pertenecen al mismo marco Órbita sin duplicar navegación ni tocar
permisos, RPC o handlers. `plataforma-panel.js` se sirve con
`qa-orbita-platform-v3-20261121`.

El contrato de componentes comprueba ambas marcas y la paridad del resto de
la capa. La verificación de acceso de administrador sigue pendiente para
cerrar Plataforma funcionalmente.

### Hallazgo de arranque durante la migración por bloques · 21/11/2026

Al probar el modo local desde el preview limpio, la vista podía quedarse en
«Cargando almacén…» si una lectura del adaptador de almacenamiento no resolvía
su promesa. El documento ya fijaba Órbita (`data-la-diseno="orbita"`), pero no
se podía verificar ningún módulo detrás del bloqueo. Se corrigió `loadKey` en
`fuente.js` y en `source-recovery/fuente-recuperado.js`: cada lectura tiene un
techo de 1,5 s sin conexión y 7,5 s en QA autenticado, conserva los reintentos y emite el
fallo real para que el arranque visible pueda ofrecer reintento. No cambia la
lógica, los handlers ni la persistencia; evita que una promesa colgada congele
los doce módulos. La batería de arranque, `loadKey`, componentes y migración
de módulos queda verde tras el cambio. El recorrido autenticado del preview
sigue siendo necesario para pasar cada fila de `PARCIAL` a `CERRADO`.

### Refuerzo transversal de superficies · v47 · 21/11/2026

La capa `la-apariencia.css` pasa a `qa-orbita-modules-v48-20261121` (huella
`6ee9a8f9998201d6`). Se añadió un contrato scoped a
`main[data-la-orbita-module]` que aplica la misma envolvente a los doce
módulos, incluidos los contenedores históricos que todavía no usan una
primitiva `la-ui-*`: tipografía y altura de controles, tarjetas, etiquetas,
estados vacío/carga/error, badges, tablas y wrappers de desplazamiento.

La regla es aditiva: no cambia handlers, RPC, permisos, datos ni navegación.
En móvil limita el ancho intrínseco de grids y tablas al contenedor de la
superficie y conserva el desplazamiento dentro del wrapper, de modo que el
viewport no crece. El contrato de capas fija la marca y la huella para que el
preview no pueda servir una hoja anterior desde caché.

Esta tanda completa la base técnica de la migración uno-a-uno; no convierte
por sí sola una fila en `CERRADO`. Las doce filas siguen `PARCIAL` hasta que
se recorra cada ruta real autenticada, sus estados vacío/carga/error y sus
acciones en escritorio y móvil.

### Arranque local sin espera remota · 21/11/2026

La revisión live mostró que el modo «Trabajar solo en este equipo» aún
atravesaba el guard de contexto remoto antes de leer `almacen:*`. Se corrigió
`fuente.js`: cuando `__modoPruebasLocal` es `true`, `storage.get`, `storage.set`
y `storage.delete` van directamente al adaptador local. QA autenticado no
entra en esta rama. La caché de `fuente.js` pasa a
`qa-arranque-lectura-local-directa-v4-20261121`; el contrato de arranque fija
la regresión. Esto reduce el arranque offline a la lectura local y evita que
la nube bloqueada genere avisos falsos de `localActivoId`.

### Corrección de clasificación con tildes · 21/11/2026 · `232f6974`

El recorrido visual local detectó que «Configuración» se resolvía como
`configuracion-configuracion` porque el detector comparaba el texto visible
con patrones sin diacríticos. El shell ahora normaliza la etiqueta a NFD antes
de clasificarla. En el preview actualizado, Configuración devuelve
`data-la-orbita-module="configuracion"`, `data-la-orbita-surface="configuracion"`,
sin overflow y con control mínimo de 44 px; por tanto la capa scoped de
Órbita sí alcanza esa pantalla.

### Limpieza del detalle operativo al cambiar de módulo · 21/11/2026 · `dashboard-premium-v4`

La revisión live encontró que el botón «Ver detalle operativo del panel
principal» sobrevivía al desmontaje de Inicio y aparecía al principio de TPV.
`dashboard-premium-v2.js` ahora retira los toggles huérfanos cuando el panel ya
no existe; además, la hoja Órbita los oculta como defensa en cualquier módulo
distinto de Inicio. La lógica del detalle sigue disponible únicamente en
Inicio. La marca de caché pasa a `qa-orbita-panel-v4-20261121`.

### Recorrido live adicional · Preview 225 · 21/11/2026 · commit `fbde8ec6`

Se recargó el preview contra el artefacto vigente antes de medir. La pestaña
que conservaba recursos `qa-orbita-shell-v15` y `qa-orbita-panel-v3` mostró
transitoriamente el botón «Ver detalle operativo del panel principal» dentro de
TPV; no era el artefacto actual. Tras la recarga, los recursos servidos fueron
`la-apariencia.css?v=qa-orbita-modules-v48-20261121`,
`la-orbita-shell.js?v=qa-orbita-shell-v16-20261121` y
`dashboard-premium-v2.js?v=qa-orbita-panel-v4-20261121`. En TPV el botón
heredado quedó en `toggleCount=0`.

En la vista móvil del preview (390 px) se recorrieron rutas reales del modo de
ensayo, sin escribir datos: TPV (`module=tpv`), Cocina (`cocina`, vacío
confirmado por «No hay comandas para este filtro»), Caja (`caja`), Clientes
(`clientes`, vacío confirmado), Compras mediante Proveedores (`compras`, vacío
confirmado), Inventario mediante Productos (`inventario`, 23 filas de tabla),
y Personal (`personal`, estado visible «Cargando empleados…»). En todos los
casos el shell etiquetó módulo y superficie correctamente, `overflow=false` y
el control visible mínimo fue `44` px. Personal quedó expresamente como estado
de carga pendiente de una sesión/servidor que confirme la colección; no se
interpretó como vacío.

La pantalla de Acceso del mismo preview expone login, recuperación, modo sin
sincronizar y selector de Apariencia; también devuelve `overflow=false` y
control mínimo de 44 px. Esta tanda es evidencia visual no autenticada: no
cierra ninguna fila, porque aún faltan permisos, datos reales, acciones y
estados autenticados de cada bloque.

### Shell y paletas · eliminación de literales heredados · v49 · 21/11/2026

La barra lateral, sus estados activo/hover, el control de colapso, los menús
de contexto/perfil, la barra móvil y los subrayados de página ya no dependen de
blancos, verdes ni azules literales. Usan mezclas y sombras derivadas de los
tokens activos (`--c-chrome`, `--c-on-chrome`, `--c-accent`, `--c-surface` y
`--c-bg`), de modo que el marco Órbita mantiene la misma geometría al cambiar
entre diseños y paletas. La capa se sirve como
`la-apariencia.css?v=qa-orbita-modules-v50-20261121`, huella
`b9519144fc6ebd36`. También se declara `--c-on-chrome` como token base para
evitar estados transparentes cuando una paleta no redefine el color de texto
del chrome. No se modificaron handlers, rutas, permisos ni datos.

Esta corrección reduce la convivencia cromática entre propuestas, pero no
cierra por sí sola las doce filas: siguen pendientes las acciones y estados
autenticados que figuran en la tabla inicial.

El commit `46c7e007` quedó publicado en el Deploy Preview 225 como
`6b01888ae50f6b98af641626` (`ready`, sin coincidencias en el escaneo de
secretos). La pantalla de Acceso del artefacto sirve v49 y conserva
`overflow=false`; esta verificación no autenticada no cierra la fila de Acceso.
