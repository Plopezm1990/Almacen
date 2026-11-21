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
