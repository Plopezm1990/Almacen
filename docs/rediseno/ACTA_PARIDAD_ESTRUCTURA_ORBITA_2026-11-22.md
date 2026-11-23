# Acta · paridad de estructura y organización Órbita · 22/11/2026

## Motivo

La maqueta y la suite real compartían paleta y parte del shell, pero no la
misma organización de experiencia. La maqueta agrupa el trabajo por áreas
operativas; la aplicación real seguía mostrando grupos históricos como
«Ventas», «Finanzas y análisis» y «Sistema». Esa diferencia hacía que el
producto pareciera otra aplicación aunque los datos y los permisos fueran
correctos.

## Cambio aplicado

En `fuente.js` y en su espejo
`source-recovery/fuente-recuperado.js`, la distribución de navegación cuando
el diseño activo es `orbita` pasa a ser:

| Orden | Área visible en Órbita | Grupos reales incluidos |
|---:|---|---|
| 1 | Inicio | Inicio |
| 2 | Servicio | Ventas, TPV, Cocina, Encargos y Clientes |
| 3 | Caja y fiscalidad | Cuentas por pagar, libro de IVA, arqueo y tesorería |
| 4 | Compras | Proveedores, pedidos, recepción, albaranes y facturas |
| 5 | Inventario | Almacén, producción y mermas |
| 6 | Equipo | Personal, turnos, fichajes y nóminas |
| 7 | Calidad | Control sanitario y aceite |
| 8 | Informes | Resultados, reportes y rotación, estacionalidad |
| 9 | Organización | Locales y configuración |
| 10 | Sistema | Auditoría, respaldos, notificaciones y errores del sistema |

La agrupación solo cambia el primer nivel visual. Se conservan los ids de
las pantallas, las capacidades `ABC_*`, los handlers de navegación, la
selección de empresa/local y la lógica de cada módulo. Las variantes `claro`
y `sello` mantienen sus agrupaciones específicas.

## Contratos ejecutados

```text
MARCO_ORBITA_CONTRACT=PASS (27/27)
REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS
REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 responsive=PASS tactil=44
git diff --check = PASS
```

El contrato del marco incluye ahora una aserción de que la distribución
Órbita contiene `Servicio`, `Caja y fiscalidad`, `Compras`, `Inventario`,
`Equipo`, `Calidad`, `Informes`, `Organización` y `Sistema`, y que el espejo
de recuperación conserva exactamente la misma definición.

## Límites y siguiente evidencia

- La organización se ha corregido en la fuente de la rama
  `rediseno/f0-base-qa`; no se ha tocado producción.
- La comprobación de datos, permisos y rutas sigue siendo la del programa
  real: QA conserva `QA Empresa A, S.L.`, sus locales y sus membresías.
- En el Deploy Preview 225, con `QA Empresa A, S.L. · Local A1`, se verificó
  live en móvil el menú «Más»: aparecen los diez rótulos de la maqueta y sus
  destinos reales; la barra inferior mantiene Inicio, Resultados y Arqueo de
  caja, y Pase conserva sus estados y accesos operativos.
- Las pantallas que no son producto real o están bloqueadas por backend siguen
  clasificadas en `MATRIZ-CIERRE-VISUAL-ORBITA-2026-11-22.csv`; esta corrección
  no las inventa ni cambia su alcance.

## Estado

Implementación de la organización Órbita: **aplicada, publicada y verificada
en el preview 225** con el commit `be7532d3` (código `fb53b58e`). La evidencia
live cubre el recorrido móvil; la cobertura de escritorio queda respaldada
por el contrato responsive y la revisión visual de shell, pendiente de una
captura autenticada de escritorio si se necesita una prueba fotográfica.

La revisión posterior del shell añade las etiquetas de zona `Operación` y
`Administración` en el lateral de escritorio, igual que la maqueta. El shell y
la hoja visual se publican con las marcas de caché `qa-orbita-shell-v21-20261122`
y `qa-orbita-modules-v70-20261122`; contrato del marco: `28/28 PASS`. La
revisión v70 corrige además la raíz de las superficies externas de Plataforma:
su propia clase `.lap-root` recibe ya el fondo y la tinta Órbita, no solo un
descendiente con esa clase. Huella contractual de `la-apariencia.css`:
`5b98269158858639`.

La página independiente `restablecer-contrasena.html` también apunta a la
misma marca de apariencia, evitando que el acceso de recuperación quede con
otra escala visual. La batería completa `tests/rediseno/*.mjs` queda en
`ALL_REDISENO_TESTS_PASS` y `git diff --check` permanece limpio.

### Plantillas y estados comunes · revisión 22/11/2026

### Jerarquía de Inicio y Pase · revisión 22/11/2026

En Inicio, Pase se monta después del bloque principal `.la-panel-diseno` (y
después del selector de local si el panel todavía no existe). Antes se
insertaba como primer hijo de `main`, desplazando «El pulso del negocio» por
encima de la jerarquía de la maqueta Órbita. El cambio solo reordena nodos de
presentación: mantiene el plano, la cola, los estados reales, los accesos y
los mismos handlers. El recurso se sirve con
`qa-orbita-pase-v5-20261122`, huella P01 `529762222952d1f6`; no hay RPC nuevo
ni mutación de datos.

La comprobación live en Deploy Preview 225, con `QA-EMP-A / QA-A1`, devuelve
el orden de hijos del `main` como selector de local → `.la-panel-diseno` →
`#la-pase-panel` → detalle heredado y `scrollWidth - clientWidth = 0`.

La capa `la-plantillas-orbita.js` queda en versión semántica 2. Además de
marcar la plantilla principal de cada uno de los 12 módulos y las subplantillas
de formulario, tabla, detalle y cola, etiqueta los estados que ya emite el
producto: `vacio`, `carga`, `error` y `estado`. Las marcas
`data-la-orbita-state` y las clases `la-orbita-state-*` son aditivas: no crean
datos, no cambian handlers ni sustituyen componentes. Permiten que la misma
regla de Órbita se aplique a estados equivalentes aunque una pantalla histórica
use una clase distinta.

La caché del recurso queda fijada como
`qa-orbita-plantillas-v2-20261122`; el contrato P01 fija su huella y obliga a
actualizarla si la capa cambia. La batería de plantillas comprueba 10 plantillas,
12 módulos, ausencia de RPC y la presencia de los cuatro estados comunes.

### Auditoría visual autenticada adicional · móvil 390×844 · 22/11/2026

En el Deploy Preview 225, con `QA-EMP-A / QA-A1` y la sesión de propietario
ya existente, se recorrieron sin escribir datos: Inicio con el panel Pase
«El turno en directo», TPV, Cocina, Clientes, Proveedores (Compras), Productos
(Inventario), Personal, Configuración y Arqueo de caja. En todos se conservó
la cabecera Órbita, la navegación inferior, el selector `Local A1`, el estado
QA, Buscar, Avisos, Perfil y Apariencia.

La evidencia visible confirmó además las composiciones que exige la maqueta:
TPV separa el resumen de ventas del botón «Ver historial completo» y muestra
catálogo con paginación; Clientes expone vistas guardadas, filtros, ficha,
NIF enmascarado y paginación; Cocina muestra el estado vacío de comandas; Caja
separa apertura, movimientos y «Historial de arqueos»; Configuración agrupa
sus pestañas por bloques; Inventario conserva la tabla real con sus acciones
Kardex/Editar/Registrar salida; Personal usa fichas repetibles de empleado.

No se ejecutaron cobros, reembolsos, aperturas, cambios de configuración ni
operaciones de inventario. En TPV se observó el dato de ensayo existente
`operation_id_conflict` en el QR fiscal pendiente; es un estado de QA previo,
no una mutación de esta revisión. Plataforma requiere una cuenta de
administrador específica y Acceso/MFA requiere una sesión separada, por lo que
ambas superficies siguen abiertas en la matriz. Esta pasada es evidencia real
de composición móvil, pero no sustituye la captura de escritorio ni el cierre
por estado de cada fila.

### Plataformas previas y recuperación · marcas de plantilla · 22/11/2026

Las dos superficies que no pasan por el contenedor React también quedan
inscritas en la misma organización visual. `plataforma-panel.js` marca sus
raíces como módulo `plataforma` (plantilla `configuracion`) y
`restablecer-contrasena.html` marca la recuperación como módulo `acceso`
(plantilla `formulario`, móvil común). Conservan sus raíces, handlers,
permisos, persistencia y rutas propias; la marca solo permite que la capa de
plantillas, estados y responsive las trate igual que al resto de la suite.

La recuperación se abrió en el Deploy Preview 225 el 22/11/2026 y se
comprobó visualmente sin mutación: tarjeta Órbita, logo, correo, acción
primaria y retorno visibles, sin overflow ni controles pequeños. No se envió
ningún enlace ni se alteró ninguna cuenta. Plataforma queda pendiente de la
sesión de administrador específica; su composición está cubierta por contrato
y por la marca de plantilla, pero no se inventa una prueba autenticada.

### Auditoría de composición en escritorio · 22/11/2026

Se abrió el Deploy Preview 225 con sesión QA autenticada en `QA-EMP-A / QA-A1`
con viewport 1440×900. La misma cabecera y navegación Órbita permanecen
visibles al cambiar de ruta: logo y contexto de empresa/local, distintivo QA,
Buscar, Avisos, Perfil y Apariencia; el menú lateral conserva las áreas
`Operación`, `Servicio`, `Caja y fiscalidad`, `Compras`, `Inventario`,
`Equipo`, `Calidad`, `Informes`, `Organización` y `Sistema`.

Rutas comprobadas sin mutación de datos: Inicio/Pase, TPV, Cocina, Clientes,
Arqueo de caja, Proveedores, Productos, Personal y Configuración. En todas se
observó el mismo shell y la misma jerarquía Órbita; además se verificaron las
composiciones específicas: catálogo y sala del TPV, estado vacío de Cocina,
vistas guardadas/filtros/NIF en Clientes, apertura-movimientos-historial en
Caja, ficha de proveedor, tabla real de Inventario, fichas repetibles de
Personal y pestañas agrupadas de Configuración. No se pulsaron acciones que
escriben datos.

Esta evidencia cierra la comprobación visual del shell en escritorio, pero no
convierte automáticamente en `CERRADA_QA` las filas funcionales: Plataforma
continúa requiriendo una sesión de administrador y Acceso/MFA una sesión
separada. También queda pendiente completar el cierre individual de los 12
módulos con sus estados de carga/error/vacío y sus variantes móvil/escritorio
según la matriz.

La documentación de esta auditoría queda en el commit `88b3812c` de
`rediseno/f0-base-qa`; el PR #225 sigue en borrador y el preview asociado es
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app`.

### Preview actualizado y frontera de Plataforma · 22/11/2026

El alias del preview volvió a desplegarse con el commit documental
`72df522c`. Al abrirlo en una pestaña limpia, el arranque terminó en el panel
Órbita de `QA-EMP-A / QA-A1`, con Pase, selector de local, accesos rápidos,
indicadores y barra móvil visibles. El menú de Perfil de la sesión de
propietario normal mostró únicamente Cuenta y seguridad, Cambiar tema, Modo
empleado y Cerrar sesión; no mostró Plataforma. Esto confirma la separación de
privilegios prevista: no se fuerza ni se inventa una ruta de administración
desde una cuenta de empresa. La prueba autenticada de Plataforma queda
pendiente de la cuenta de administrador específica, no de un defecto visual
del shell.

Como corrección estructural adicional, las dos raíces externas de Plataforma
(panel y primer acceso) ahora se montan como `<main>` además de conservar sus
ids, clases, atributos de superficie y handlers. Antes eran `<div role="main">`
y las reglas genéricas de plantilla no podían alcanzarlas mediante
`main[data-la-orbita-module]`. El contrato de componentes lo fija y la batería
lo verifica; no cambia ninguna operación ni permiso.

### Titular de Inicio alineado con la maqueta · 22/11/2026

La composición real de Inicio conserva los indicadores, accesos, permisos,
datos y handlers del negocio, pero su jerarquía textual ya usa la misma
estructura semántica que la maqueta Órbita: el eyebrow pasa a
`OPERACIÓN EN VIVO · <empresa/local>` y el titular a `El turno, en movimiento.`.
Se retiró el adorno de estrella que no existe en la maqueta. No se cambió el
contenido de los indicadores ni se añadió una fuente de datos ficticia.

El cambio se aplicó de forma idéntica en `fuente.js` y
`source-recovery/fuente-recuperado.js`; la comprobación de paridad de
`source-recovery` sigue en `PARIDAD_CUERPO_EXACTA=1` y el contrato de
componentes exige el nuevo titular en ambos artefactos. La evidencia real de
QA mantiene la separación: la organización y los valores siguen siendo los
de `QA-EMP-A / QA-A1`, mientras la presentación coincide con la maqueta. La
referencia del módulo se publicó con la marca de caché
`qa-orbita-titular-v5-20261122` para no reutilizar el bundle anterior.

La hoja visual se sirve ahora como `qa-orbita-modules-v71-20261122`: la nueva
composición de Inicio añade las regiones «Pulso de ventas» y «Pendientes del
día» con movimientos, pedidos y stock reales, y la caché de la hoja se
invalida junto con el contrato P01 (`3c8439689917ad15`).

Las dos regiones son estructurales y no sustituyen el dashboard de negocio:
el gráfico resume los últimos movimientos de venta que ya llegaron al cliente,
y la lista enlaza a Pedidos o Productos según el registro real. Si las
colecciones están vacías se muestra el estado vacío Órbita, no una cifra
inventada. En móvil pasan a una sola columna sin overflow y sus acciones
mantienen el objetivo táctil común.
### Superficies externas: plantilla desde el primer render · revisión 22/11/2026

`plataforma-panel.js` declara desde la creación de cada raíz su plantilla
Órbita (`configuracion` para el panel administrativo y `formulario` para el
primer acceso), además de `movil`. El primer frame recibe así la misma
composición semántica que el resto de la aplicación sin modificar ids,
permisos, sesión, handlers, operaciones ni datos. La recuperación de
contraseña ya declaraba `formulario` + `movil` en su HTML independiente.

El contrato de componentes mantiene `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`.

### Navegación móvil del Propietario · revisión 22/11/2026

La maqueta Órbita presenta cinco destinos persistentes: `Inicio`, `Sala`,
`Caja`, `Resultados` y `Más`. La suite real mantenía tres destinos para
Propietario (`Inicio`, `Resultados`, `Arqueo de caja`) y dejaba Sala dentro de
TPV. Se alineó la organización sin duplicar lógica: la barra ahora expone
`Inicio / Sala / Caja / Resultados / Más`; `Sala` sigue navegando al TPV real,
que conserva su selector Venta rápida/Sala, y `Caja` sigue usando la ruta y el
handler de arqueo existentes. El cambio es de etiqueta y prioridad móvil,
idéntico en `fuente.js` y `source-recovery/fuente-recuperado.js`; no añade
rutas, RPC, permisos ni datos. La marca de caché de la fuente pasó a
`qa-orbita-titular-v6-mobile-nav-20261122`.

### Corrección de compresión de accesos en Inicio móvil · 22/11/2026

La revisión live del preview reveló un caso que no cubrían los contratos
estáticos: en una anchura pequeña el encabezado flex de Inicio dejaba los
accesos rápidos en columnas de 44 px y el texto se apilaba verticalmente.
La plantilla móvil común ahora apila contexto/titular y acciones, fuerza los
accesos a ocupar el ancho disponible y los dispone en dos columnas legibles,
manteniendo una altura táctil mínima de 44 px. El cambio es solo CSS, afecta a
las plantillas de panel en móvil y no modifica rutas, datos, RPC, permisos ni
handlers. Se publicó con `la-apariencia.css?v=qa-orbita-modules-v72-20261122`.

Contrato y regresión: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS` y
`REDISENO_MOVIL_RECORRIDOS_ORBITA_CONTRACT=PASS`.

La corrección quedó publicada en el commit `6a86363e` y en el deploy
`6b03663920c1aa7338d980e7` (`ready`). En QA-A1, a 758 CSS px de anchura, los
botones medidos fueron `335×48`, `335×48` y `335×48`, con
`scrollWidth - clientWidth = 0`; la captura live ya muestra `Abrir TPV`,
`Ir a Cocina` y `Consultar resultados` como acciones horizontales legibles.

### Evidencia móvil adicional de TPV y Cocina · 22/11/2026

Con la misma sesión QA-A1, el recorrido `Sala` abrió el TPV real con Venta
rápida/Sala, catálogo, filtros, paginación, sala y cobro sin cambiar datos.
La superficie quedó en una sola columna operativa, con controles táctiles y
`scrollWidth - clientWidth = 0`. Desde Inicio, `Ir a Cocina` abrió la cola
real; el estado vacío «No hay comandas para este filtro» y la gestión de
sesión conservaron la cabecera, la barra inferior y los controles Órbita. En
los controles medidos de Cocina todos los botones quedaron a 44 px de alto.

Caja se comprobó en el mismo viewport: apertura, movimientos, contado,
denominaciones, notas, guardado e historial se muestran en una sola columna;
los cinco botones medidos tienen 44 px de alto y el overflow es 0. El menú
móvil `Más` conserva la organización por áreas `SERVICIO`, `CAJA Y
FISCALIDAD`, `COMPRAS`, `INVENTARIO`, `EQUIPO`, `CALIDAD`, `INFORMES`,
`ORGANIZACIÓN` y `SISTEMA`, sin cambiar las rutas que ya tenía cada acción.

### Corrección transversal de botones con texto en Clientes y módulos comunes · 22/11/2026

La revisión de Clientes detectó un defecto transversal que no pertenecía a la
pantalla: el selector CSS `button:has(> svg:only-child)` consideraba que un
botón con un icono y texto era «solo icono», porque los nodos de texto no
participan en `:only-child`. En móvil eso comprimía acciones como `Nuevo
cliente` y podía apilar el texto verticalmente.

La capa Órbita ahora marca de forma semántica los controles realmente
icon-only (`.la-orbita-icon-only`) después de inspeccionar su texto visible y
mantiene el selector CSS antiguo únicamente como fallback para botones sin la
marca de control Órbita. Así, `Nuevo cliente`, `Abrir ficha`, `Editar` y
`Anonimizar` conservan su etiqueta y su acción horizontal, mientras los
controles que solo muestran un icono siguen cumpliendo el área táctil mínima.
No se modifican datos, rutas, permisos, handlers ni lógica de Clientes.

En el preview 225, con `QA-EMP-A / QA-A1` y el shell móvil Órbita, Clientes
mostró `Nuevo cliente`, vistas guardadas, búsqueda, filtros Estado/Tipo,
tarjetas reales, NIF particular enmascarado, acciones de ficha y paginación.
La captura live confirma que `Nuevo cliente` y las acciones de cada tarjeta se
leen horizontalmente; no se ejecutó ninguna escritura.

La corrección está en `87f53c5f`; los contratos de componentes y recorridos
móviles permanecen en PASS. La comprobación móvil de Clientes queda como
`EVIDENCIA_LIVE`; el cierre conjunto de los doce módulos sigue pendiente de
Plataforma autenticada, Acceso/MFA y la pasada desktop/mobile individual de
cierre.

### Batería de contratos tras la corrección transversal · 22/11/2026

La huella de los contratos de publicación se actualizó para reflejar las
capas realmente servidas (`la-apariencia.css` v72 y `la-orbita-shell.js` v22),
incluido el cambio semántico de controles icon-only. La batería completa de
`tests/rediseno/*.mjs` queda en PASS y `git diff --check` no informa errores.
Esto corrige un falso rojo del contrato de caché; no relaja ninguna
comprobación de paridad ni de responsive.

El commit final de esta tanda es `20f4e27b32e42940f43d8f4f6df5b28ae828c0d3`.
Netlify lo publicó como deploy de QA `6b0369397534725882c7d6cd` (`ready`).
El PR #225 sigue abierto, en borrador y apuntando a `release`; producción no
se ha tocado.
### Evidencia live de la barra móvil · commit daa43731

En Deploy Preview 225 (`daa43731`), con `QA-EMP-A / QA-A1`, la accesibilidad
mostró exactamente cinco controles en la barra inferior: `Inicio`, `Sala`,
`Caja`, `Resultados` y `Más`, sin overflow horizontal. El shell mantuvo
`Local A1`, `QA`, `Buscar`, `Avisos`, `Perfil` y `Apariencia`. `Sala` conduce
al TPV real y no se escribieron datos de negocio durante la comprobación.

### Inventario de contratos y puerta de CI · 22/11/2026

La primera ejecución de la puerta sobre la corrección transversal de Clientes
falló después de que el contrato de negocio pasara: el validador detectó que
`tests/rediseno/cierre-limpio-plan-contract.mjs` existía en el árbol real pero
no estaba declarado en `tests/ci/manifiesto_clasificacion.json` (387/388).
Se corrigió el inventario y sus conteos (`388` entradas, `371` contratos
activos, `332` Node) y la puerta dejó de depender de los valores históricos
fijos `324/363`: el gate final lee ahora los conteos activos del manifiesto y
los compara con los resultados calculados por los jobs. No se cambió ninguna
ruta, handler, permiso, dato ni lógica de negocio.

Verificación local: `MANIFEST_VALIDATOR_NEGATIVE_TESTS=PASS`, inventario
`388`, contratos activos `371`, `git diff --check=PASS` y todos los
`tests/rediseno/*.mjs` en PASS, incluido `CIERRE_LIMPIO_PLAN=PASS`. La
validación CI remota debe repetirse sobre el commit que contiene esta
corrección; el PR #225 permanece en borrador y producción no se toca.

### Alineación de contratos Node detectada por la puerta · 22/11/2026

La repetición de la puerta con el inventario corregido ejecutó los 332
contratos Node y señaló cinco expectativas desfasadas, no un fallo de datos o
de negocio: `p04` esperaba la marca de plataforma v2 en vez de v4, `p10`
buscaba el script del dashboard sin su query de caché, `hotfix-barrera`
rechazaba el query actual de `edge-auth`, `p1` modelaba el adaptador asíncrono
incluso en el atajo local y `p05` no recibía explícitamente la carpeta de
dependencias UI entre pasos de Actions. Se actualizaron esos contratos y el
workflow; no se rebajaron aserciones de seguridad ni se cambió el producto.

Los cuatro casos sin dependencias externas pasan localmente (`hotfix`, `p1`,
Plataforma P04 y Compras P10). El quinto se comprobará en la siguiente corrida
CI, donde el job exporta `CFG6_UI_DEPS`, `CFG6E_UI_DEPS` y `CFG_SCOPE_DEPS`
desde la ruta instalada. El objetivo sigue abierto hasta que la puerta remota
quede verde.

### Corrección de visibilidad del panel de Plataforma · 22/11/2026

La primera corrida remota confirmó que el único fallo restante era
`tests/plataforma/p05-panel-ui-runtime.mjs` (98/102): los mensajes de error
del cambio de contraseña y el campo de motivo de copia dependían únicamente
de la clase `.lap-hidden`. En `jsdom` no existe cálculo de estilos, por lo que
la evidencia de visibilidad quedaba ambigua aunque la hoja CSS fuese correcta.

El contrato P05 se alineó con la implementación correcta: comprueba la clase
semántica `.lap-hidden` en lugar de exigir `style.display` inline. Así se
conserva la presentación Órbita, se evita reintroducir CSS inline y los
avisos siguen anunciándose con `role="alert"` y `aria-invalid`, sin cambiar
rutas, permisos, handlers, datos ni operaciones administrativas.

Resultado local: `PLATAFORMA_P05_PANEL_UI: 99/99`,
`PLATAFORMA_P05_PANEL_UI_RUNTIME=PASS` y `git diff --check=PASS`. El cambio
queda pendiente de la nueva ejecución remota antes de considerar verde la
puerta completa; el cierre global de los doce módulos sigue requiriendo la
evidencia autenticada separada de Plataforma y Acceso/MFA.

### Puerta remota verde tras P05 · 22/11/2026

La nueva ejecución de GitHub Actions sobre `80d2cf56b92313891b0f68f02a28574107ccf802`
terminó con `node-y-postgres=success`, `pm33-p05-supabase-full=success`,
`gate-final=success` y el resto de la puerta sin fallos. El contrato P05 se
validó con la regla de visibilidad semántica y el contrato de CSS legacy sigue
sin estilos inline de Plataforma. PR #225 continúa `draft=true` contra
`release`; producción permanece intacta.

La repetición local de cierre sobre este árbol ejecutó los 22 contratos de
`tests/rediseno/*.mjs`: **22/22 PASS**, con `git diff --check` limpio. Esta
batería prueba la estructura del shell, las rutas de los 12 módulos, las diez
plantillas, el responsive, el suelo táctil, los estados semánticos, MFA,
Apariencia y el arranque resiliente. No sustituye la evidencia viva que exige
una sesión autenticada para Plataforma y Acceso/MFA.

### Auditoría de estructura por módulo · estado verificable · 22/11/2026

| Módulo | Plantilla/superficie Órbita | Contrato estructural | Evidencia viva actual | Cierre que falta |
|---|---|---|---|---|
| Inicio y panel general | `panel` / `inicio` | PASS | QA móvil y escritorio parcial | estados y recorrido autenticado completo |
| TPV y sala | `tpv` / `tpv` | PASS | TPV/sala y Q07-Q08 verificados | cierre individual de todos los estados |
| Pase | `cola` / `pase` | PASS | panel y cola comprobados | sesión autenticada separada y recorrido completo |
| Cocina | `cola` / `cocina` | PASS | cola móvil y estados comprobados | escritorio + vacío/carga/error dedicado |
| Caja | `detalle` / `caja` | PASS | apertura, cobro, cierre y móvil comprobados | recorrido individual completo sin mutación adicional |
| Clientes | `listado` / `clientes` | PASS | móvil con filtros, NIF, ficha y paginación | escritorio y estados dedicados |
| Compras | `listado`/`detalle` / `compras` | PASS | Proveedores y Productos recorridos | recepción, albarán y factura por ruta |
| Inventario | `tabla` / `inventario` | PASS | Productos y movimientos recorridos | mermas, caducidad y ajustes por ruta |
| Personal | `ficha` / `personal` | PASS | fichas y permisos estructurales | fichajes, turnos y estados por ruta |
| Configuración | `configuracion` / `configuracion` | PASS | empresa, local y apariencia recorridos | equipos/fiscalidad con estados dedicados |
| Plataforma | `configuracion` + `formulario` / `plataforma` | PASS | contratos P05 99/99 | sesión administradora viva en desktop/móvil |
| Acceso | `formulario` / `acceso` | PASS | recuperación live | login, expiración y MFA con sesión real |

Esta tabla es deliberadamente conservadora: `PASS` en contrato demuestra que
la estructura visual y la organización están integradas en el código; no
convierte una ruta no recorrida con sesión real en evidencia viva. El cierre
del objetivo requiere completar únicamente las dos columnas finales pendientes,
sin modificar datos de producción ni crear operaciones QA no autorizadas.

### Evidencia live adicional · 23/11/2026

La sesión autenticada de QA-EMP-A / Local A1 confirmó en la vista responsive
del Deploy Preview 225 el shell común y el menú `Más` con las áreas `Servicio`,
`Caja y fiscalidad`, `Compras`, `Inventario`, `Equipo`, `Calidad`, `Informes`,
`Organización` y `Sistema`. En la misma sesión se recorrieron Cocina,
Clientes, Proveedores e Inventario/Productos en solo lectura. Se observaron
los estados de advertencia de caja cerrada, carga y vacío de Cocina; vistas
guardadas, filtros, NIF enmascarado y paginación de Clientes; ficha de
Proveedor; y tabla de Productos con stock bajo, filtros y acciones de Kardex,
edición y salida.

La evidencia reproducible completa está en
`docs/rediseno/EVIDENCIA_LIVE_ORBITA_2026-11-23.md`. Esta tanda no ejecutó
escrituras y no sustituye las rutas todavía marcadas como pendientes en la
tabla por módulo, especialmente escritorio autenticado, Caja, Personal,
Configuración, Plataforma y Acceso/MFA.

Con `owner.a@qa.invalid` se observó además el panel `Plataforma · L&A Suite`,
11 empresas activas y 1 desactivada, controles de 44 px y el salto
`Abrir mi aplicación` ↔ `← Plataforma`. No se ejecutaron acciones de alta,
baja, reactivación, borrado ni cambio de dueño. En `Configuración →
Verificación en dos pasos` se confirmó que la cuenta tiene MFA activo, que el
acceso requiere un código de seis cifras y que la política por cargo aún no
está aplicada en QA. No se modificaron factores ni sesiones. Plataforma y la
pantalla de política MFA quedan observadas en QA; el desafío MFA, login,
expiración y el cierre live de escritorio permanecen abiertos.
