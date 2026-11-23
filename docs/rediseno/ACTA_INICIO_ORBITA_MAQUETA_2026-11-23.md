# Acta de implementación · Inicio Órbita alineado con la maqueta

Fecha: 2026-11-23  
Rama: `rediseno/f0-base-qa`  
PR: #225, borrador, dirigido a `release`  
Alcance: solo QA/preview; producción no se toca.

## Objetivo

Igualar la pantalla principal del producto con la composición móvil de la
maqueta Órbita sin sustituir lógica de negocio. El cambio se limita al marco,
la composición y la presentación del menú móvil. Los datos, permisos, rutas,
capacidades y handlers siguen siendo los del producto.

## Diagnóstico que motivó el cambio

La pantalla real montaba `PanelDiseno` y, a continuación, el dashboard
histórico completo. En Órbita eso producía una pantalla duplicada y mucho más
larga que la maqueta. El shell tampoco mostraba la marca L&A, el contexto en
dos líneas ni la segunda fila `Demostración · Avisos · Órbita · Índice`. El
hero real no tenía la ilustración orbital y el menú `Más` seguía agrupado con
las categorías históricas.

## Cambios realizados

### 1. Una sola composición visible de Inicio

- `Dashboard` conserva todo el contenido, datos y handlers históricos dentro
  de `.la-dashboard-legacy`.
- La hoja Órbita oculta esa capa únicamente cuando el módulo es Inicio y el
  diseño activo es Órbita. Otros diseños y módulos no se alteran.
- El acceso `Ver detalle operativo` lleva al resumen de almacén existente;
  no crea una ruta ni una RPC nuevas.

### 2. Hero de la maqueta

`PanelDiseno` monta la capa decorativa `.la-panel-orbita-visual` con:

- esfera/planeta con iluminación radial;
- tres anillos orbitales;
- puntos coral y violeta;
- cuadrícula espacial y textura de grano;
- coordenadas decorativas;
- respiración suave de la esfera y deriva de un anillo;
- desactivación completa de animación con `prefers-reduced-motion`.

La capa tiene `pointer-events: none`, por lo que no intercepta botones ni
eventos del panel.

### 3. Cabecera móvil

`la-orbita-shell.js` crea una cabecera única con marca L&A, empresa y local
apilados, estado QA/Producción, avatar `AV`, avisos y la segunda fila de
contexto. El selector de empresa/local sigue abriendo los `<select>` reales
del producto y mantiene su comportamiento.

### 4. Menú `Más`

Cuando el diseño activo es Órbita, `NavInferior` usa las secciones de la
maqueta:

- **En Inicio**: Panel general, Inicio del empleado, Panel de dirección y
  Búsqueda global.
- **Módulos**: Inicio, Servicio, Caja y fiscalidad, Compras, Inventario,
  Equipo, Calidad, Informes, Organización y Sistema, filtrados por los destinos
  realmente disponibles para el rol. Dentro de Compras se exponen de forma
  independiente Proveedores, Pedidos, Recepción, Albaranes y Facturas para no
  ocultar operaciones reales detrás de un único acceso.
- **Herramientas**: Apariencia, Buscar en la suite, Buscar registros, Índice
  de pantallas y Opciones de demo.

Los elementos existentes llaman a `setTab` y los accesos de maqueta que no son
una pestaña de producto navegan a sus rutas de demo (`ini-02`, `sis-14`,
`sis-15`). No se ocultan permisos ni se inventan capacidades.

## Paridad y archivos

La modificación de `fuente.js` se reprodujo en
`source-recovery/fuente-recuperado.js`. La comprobación de recuperación
devuelve `PARIDAD_CUERPO_EXACTA=1` y `SOURCE_RECOVERY_CHECK=PASS`.

Marcas de caché de la publicación:

- `la-apariencia.css?v=qa-orbita-shell-v80-20261123`
- `fuente.js?v=qa-orbita-home-v10-20261123`
- `la-orbita-shell.js?v=qa-orbita-shell-v27-20261123`

## Verificaciones locales

- 22 contratos en `tests/rediseno/*.mjs`: **22/22 PASS**.
- `node --check fuente.js`: **PASS**.
- `node --check source-recovery/fuente-recuperado.js`: **PASS**.
- `node --check la-orbita-shell.js`: **PASS**.
- `python source-recovery/recuperar_candidato.py --check`: **PASS**.
- `node .github/scripts/validar-manifiesto-ci.mjs --self-test`: **PASS**.
- `git diff --check`: **PASS**.

La batería shell global no se ejecutó en este entorno Windows porque `bash.exe`
no puede iniciarse y además el runner aborta deliberadamente si `index.html`
está modificado antes de comenzar. La batería específica de rediseño sí quedó
completa y en verde; la puerta global debe repetirse en CI después del commit.

## Evidencia visual del preview

El deploy inmutable `6b0432b201edef6e69bc9606` sirve el commit
`4e7edbbfa953578cd9b708bd6fdebce64e64f261` en el preview #225. La observación
live confirmó la composición Órbita: planeta, anillos, textura, puntos y
coordenadas; cabecera con marca L&A, contexto, QA, avisos, perfil y segunda
fila; y el menú `Más` en rejilla de dos columnas con las tres secciones.
La vista local se abrió sin sesión para no mutar QA; la evidencia autenticada
de rutas y datos permanece en los ensayos anteriores. En los anchos cubiertos
por los contratos (390×844, 430×932, tablet y escritorio) se registra:

1. ausencia de scroll horizontal;
2. botones y enlaces con al menos 44×44 px;
3. hero visible sin cubrir acciones;
4. una sola composición de Inicio, con `Ver detalle operativo` como acceso
   secundario;
5. menú `Más` con una sola cabecera de Herramientas y destinos funcionales.

La corrección final de la rejilla se publicó en `4e7edbbf` y el deploy quedó
en estado `ready`. No se detectó scroll horizontal en la comprobación live.

## Excepciones y no alcance

- No se ejecutaron cobros, reembolsos ni acciones destructivas.
- No se modificó producción ni se fusionó el PR #225.
- No se eliminó el dashboard histórico: queda aislado para preservar sus
  datos y handlers y permitir volver a él desde el detalle operativo.
- El objetivo visual se considera cerrado con la evidencia live del deploy
  `6b0432b201edef6e69bc9606` y los contratos responsive; la batería shell global
  sigue dependiendo de CI por la limitación de `bash.exe` en Windows.

## Revisión comparada del Inicio y del menú móvil, 23 de noviembre

Se reabre la conclusión de equivalencia visual anterior. En la sesión de QA de Local A1, el selector de local precedía al titular, la esfera ocupaba una fila completa en móvil y la capa general añadía al titular el tamaño y subrayado de las páginas interiores. La maqueta original de la propuesta 7 sitúa la esfera detrás del contenido, a la derecha. Su menú presenta Compras como un módulo.

La revisión usa los recursos originales de grano, Inter e Instrument Serif, sitúa el contexto de local en el titular y conserva el selector operativo debajo del panel. Las tres tarjetas principales comparten fila. Los accesos secundarios pasan después del resumen. Más → Compras agrupa los destinos disponibles para el rol, incluido Albaranes cuando corresponde. Ver sala lleva al plano operativo del panel, con acceso al TPV como alternativa si el plano todavía no está montado.

El contenido de los indicadores y el periodo del gráfico siguen siendo los del producto. La maqueta presenta ventas del día, ocupación y comandas, y agrupa el gráfico por día. Esta revisión no acredita equivalencia del resto de las pantallas.

Comprobación autenticada en el preview del PR #225 sobre la revisión 0ee63ff7. A 390 px, el documento medía 390 px y el planeta medía 100 px dentro de una tarjeta de 358 px. A 1440 px, el documento medía 1440 px, el planeta 172 px y el titular 73 px. Se abrió Más → Compras → Albaranes desde Local A1 y aparecieron Entrada de albaranes, Filtrar por mes y los registros existentes. Los botones de edición quedaron sin accionar.

En la revisión `6de4f70f` el shell deja de fijar la etiqueta «Órbita» cuando se
cambia de propuesta. La subcabecera y la ayuda del botón Apariencia leen el
diseño activo (`Oliva`, `Claro`, `Pulso`, `Patio`, `Rumbo`, `Sello`, `Órbita`,
`Ascua` o `Pase`). La selección sigue resolviéndose en `la-apariencia.js` y
no modifica datos, permisos ni handlers.

### Sincronización inmediata del marco · revisión 23/11/2026

La revisión siguiente (`qa-orbita-shell-v26-20261123`) escucha también el
evento `la-apariencia:cambio`. Al cambiar una propuesta o una paleta, la
subcabecera, la ayuda de Apariencia y la marca del diseño activo se actualizan
sin recargar ni navegar. La huella queda fijada en el contrato de capas
(`f21b3bbf6b80dd41`) para impedir que el CDN sirva una versión anterior.

### Ajuste de paridad de indicadores y navegación · 23/11/2026

La revisión `c94a6863` corrige dos diferencias que todavía quedaban en el
Inicio de Órbita:

- Las tarjetas principales ahora son exactamente `Ventas de hoy`, `Mesas
  ocupadas` y `Comandas activas`, en el mismo orden que la maqueta. Las dos
  últimas leen el mapa de sala y la cola de comandas mediante los puentes
  reales ya autorizados (`cargarMapaSalaA07({ paraPanel: true })` y
  `listarEstacionesA10.listarPedidosTurno`). No se introducen datos ficticios,
  RPC nuevas ni permisos nuevos. Mientras cargan muestran `…`; si el servidor
  falla muestran `—` y el motivo.
- La línea decorativa de Administración empieza ahora en Equipo/Calidad, igual
  que en la maqueta, y no altera rutas ni capacidades.

El contrato `ini01-kpi-sala-comandas-contract.mjs` protege ambas fuentes
(`fuente.js` y `source-recovery/fuente-recuperado.js`) y verifica que no haya
polling propio. La huella del shell pasa a
`qa-orbita-shell-v27-20261123` (`e756829705ce10e5`). La batería local de
rediseño queda en **22/22 PASS**, la puerta de manifiesto en **389 entradas /
372 activas / 333 Node**, la paridad de recuperación en PASS y
`git diff --check` limpio. Esta evidencia cubre el Inicio; aún no sustituye
la comprobación visual autenticada de cada módulo restante frente a la
maqueta.

### Verificación live tras publicar v27 · 23/11/2026

Después del push `e0528883`, el HTML del preview 225 sirve
`la-orbita-shell.js?v=qa-orbita-shell-v27-20261123`. La pestaña que conservaba
una sesión anterior fue recargada antes de medir, para no confundir una copia
de caché con el estado publicado. En el DOM autenticado de Local A1 se
observó:

- `html[data-la-diseno="orbita"]` y `main[data-la-orbita-module="inicio"]`;
- `.la-dashboard-legacy` con `display: none`, por lo que el panel histórico no
  se pinta junto al nuevo;
- ausencia de `#la-pase-panel` en Órbita (ese panel queda reservado para Pase y
  Ascua);
- las tres tarjetas del Inicio: `Ventas de hoy`, `Mesas ocupadas` y
  `Comandas activas`. Las tarjetas muestran el dato cuando el servidor lo
  confirma y `—` durante un vacío/error, sin fabricar ceros;
- `Más` dividido en `En Inicio`, `Módulos` y `Herramientas`. El submenú de
  Compras expone `Proveedores`, `Pedidos`, `Recepción`, `Albaranes`, `Facturas`
  y `Devoluciones a proveedor`.

La recarga no ejecutó acciones de escritura. Esta evidencia confirma la
corrección de la duplicación y de la caché en el preview; no sustituye los
recorridos live pendientes de los módulos que todavía no tienen captura
autenticada propia.

### Corrección de alcance visual de Inventario · shell v28 · 23/11/2026

En la revisión live de la ruta `Resumen de almacén` se detectó que el shell la
marcaba como `resumen-de-almacen`, aunque pertenece al bloque Inventario. Eso
dejaba fuera de esa pantalla parte del CSS scoped de Órbita. La revisión
`563c2618` añade esa etiqueta a la clasificación semántica del shell; no
modifica la ruta, la tabla, los datos ni los handlers.

Tras recargar el preview 225, la lectura autenticada confirmó
`data-la-orbita-module="inventario"`, `data-la-orbita-surface="inventario"`,
una tabla visible, sin scroll horizontal (`scrollWidth=758` y
`clientWidth=758`) y controles con mínimo de 44 px. El contrato del marco pasa
de 32/32 a **33/33** y P01 fija la huella
`885a6191da101d8d` con `qa-orbita-shell-v28-20261123`.

### Barrido live adicional de superficies operativas · 23/11/2026

Sin pulsar acciones de escritura, el preview recargado mostró además:

- **Cocina**: `data-la-orbita-module="cocina"`, cola vacía honesta
  (`No hay comandas para este filtro`), aviso de sesión de caja cerrada,
  `scrollWidth=clientWidth=758` y controles táctiles desde 44 px.
- **Caja**: `data-la-orbita-module="caja"`, apertura/arqueo/historial
  visibles y el historial bajo demanda, `scrollWidth=758` y mínimo táctil de
  44 px; no se abrió sesión ni se guardó arqueo.
- **Compras → Proveedores**: `data-la-orbita-module="compras"`, proveedor QA
  visible con aviso de revisión, sin overflow y mínimo táctil de 44 px.
- **Inventario → Resumen de almacén**: `data-la-orbita-module="inventario"`,
  tabla de stock y movimientos reales visibles, sin overflow y mínimo táctil
  de 44 px.

Estas observaciones cubren composición, estado vacío/alerta y escala del marco
en la sesión actual; no sustituyen la ronda pendiente de Clientes, Personal,
Configuración, Plataforma y Acceso con sus estados específicos.

### Barrido live de Clientes, Personal y Configuración · 23/11/2026

La misma sesión autenticada de QA en Local A1 se llevó después a las tres
superficies que quedaban sin lectura propia en esta acta. La comprobación fue
solo de lectura; no se creó, editó, eliminó ni guardó ningún registro.

- **Clientes**: título, vistas guardadas (`Todos`, `Particulares`, `Empresas`,
  `Activos`), búsqueda, filtros de estado y tipo, ficha y paginación visibles.
  El DOM expone `data-la-orbita-module="clientes"` y
  `data-la-orbita-surface="clientes"`; `scrollWidth - clientWidth = 0` y el
  menor control medido es de 44 px.
- **Personal**: listado real de empleados, estados de baja/reactivación,
  exportación, historial, EPI y cuentas de acceso visibles bajo la cabecera
  común. El DOM expone `data-la-orbita-module="personal"` y
  `data-la-orbita-surface="personal"`; overflow 0 y mínimo táctil 44 px.
- **Configuración**: selector de bloques (Día y cajas, Sala y mesas,
  Modalidades, Equipos, Terminales y cajas, Fiscalidad y AEAT, Cargos y
  permisos, Permisos y Verificación en dos pasos), motivo obligatorio y estado
  de carga visibles. El DOM expone `data-la-orbita-module="configuracion"` y
  `data-la-orbita-surface="configuracion"`; overflow 0 y mínimo táctil 44 px.

Con este barrido quedan observados en vivo, en la sesión de QA, Inicio, TPV,
Cocina, Caja, Clientes, Compras, Inventario, Personal y Configuración. La
evidencia separada de Plataforma y Acceso/MFA permanece en
`EVIDENCIA_LIVE_ORBITA_2026-11-23.md` y en la matriz; no se repiten acciones
administrativas ni se introducen mutaciones para cerrar el rediseño visual.

### Lateral de escritorio alineado con la maqueta · shell v29 · 23/11/2026

La comparación visual solicitada entre la maqueta y el programa mostró una
diferencia concreta: la barra histórica exponía todas las pantallas hijas a la
vez, mientras la maqueta presenta solo el primer nivel. En `7675eedc` el shell
Órbita conserva los botones y sus handlers originales, pero los organiza así:

- **Operación:** Inicio y Servicio.
- **Administración:** Caja y fiscalidad, Compras, Inventario, Equipo, Calidad,
  Informes, Organización y Sistema.
- **Herramientas:** `Más módulos` despliega los destinos históricos completos y
  `Opciones de demo` mantiene el acceso a la ruta existente `sis-15`.

El primer nivel queda visible con una anchura de 248 px y el detalle se oculta
solo por CSS hasta que el usuario abre `Más módulos`. Tras las
re-renderizaciones de React el shell vuelve a marcar los botones, por lo que
no reaparecen elementos antiguos por un cambio de pantalla. El navegador no
crea rutas nuevas ni sustituye handlers; solo cambia etiquetas y composición
visual. En el preview 225 se confirmó `qa-orbita-shell-v29-20261123`,
`la-orbita-sidebar-compacta`, 10 entradas de primer nivel, 36 destinos
secundarios ocultos y despliegue correcto de todos ellos al abrir `Más
módulos`. El mínimo táctil del marco continúa en 44 px.

Contratos ejecutados: `MARCO_ORBITA_CONTRACT=PASS (34/34)`,
`MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`,
`REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`,
`REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1` y `git diff --check` limpio.
Producción permanece intacta y el PR #225 sigue en borrador.

### Retirada de controles de maqueta sin función · shell v30 · 23/11/2026

A petición de revisión visual se retiraron dos elementos que pertenecían a la
maqueta, pero no aportaban una capacidad operativa en el programa real:

- la franja superior `Demostración / Avisos / Órbita / Índice`;
- el botón lateral `Opciones de demo`.

La cabecera conserva únicamente controles funcionales: empresa/local, estado
QA, búsqueda, avisos reales, perfil y Apariencia. Los módulos y el botón
`Más módulos` no se modifican. La rama sirve
`la-orbita-shell.js?v=qa-orbita-shell-v30-20261123` y
`la-apariencia.css?v=qa-orbita-shell-v82-20261123`; contratos completos y
`git diff --check` pasan. Producción sigue intacta y el PR #225 continúa en
borrador.
