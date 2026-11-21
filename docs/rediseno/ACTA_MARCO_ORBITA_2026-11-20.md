# Acta · marco Órbita común · 20/11/2026

## Alcance de esta iteración

Se reanudó el objetivo de convertir Órbita en el único marco visual de la
aplicación autenticada. La capa sigue siendo aditiva: no se modifican los
handlers de negocio, permisos, contratos de TPV ni datos de QA.

## Cambios realizados

- El selector de empresa/local del encabezado ahora identifica únicamente el
  selector operativo real, evitando confundirlo con formularios ajenos.
- Cuando una pantalla no expone ese selector, el mismo menú ofrece «Abrir
  Panel general» y vuelve a abrir el selector allí, sin inventar empresas ni
  locales.
- El menú de contexto marca la opción activa con `aria-checked` y mantiene
  áreas táctiles de 44 px.
- Perfil, seguridad, tema, modo empleado y cierre de sesión se reúnen en un
  único menú de cabecera y ejecutan los handlers originales.
- Los controles duplicados que permanecían en el bloque antiguo del lateral
  se neutralizan visualmente; no se eliminan sus handlers.
- Se actualizaron las marcas de caché de `la-orbita-shell.js` y
  `la-apariencia.css` para impedir que el CDN sirva la versión anterior.
- El shell identifica la ruta activa con `data-la-orbita-route` y la superficie
  operativa con `data-la-orbita-surface`. TPV, Pase, Cocina, Caja y las vistas
  generales pasan por la misma raíz de contenido, lo que permite aplicar el
  mismo tratamiento tipográfico y de espaciado sin duplicar componentes.
- Las vistas generales reciben un encabezado Órbita homogéneo (jerarquía,
  subrayado de acento y separación) y las cuatro superficies operativas quedan
  marcadas para que sus reglas no dependan de encabezados históricos.

## Evidencia estática

- `MARCO_ORBITA_CONTRACT=PASS (19/19)`.
- `MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`.
- `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1 capas=7 migraciones=2`.
- `REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS`.
- `REDISENO_ORG33_SALA_CONTRACT=PASS`.
- `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=3 mudos=0`.
- `SOURCE_RECOVERY_CHECK=PASS`.
- `git diff --check` sin salida.

### Pasada visual de módulos generales

La pasada final añadió una ancla visual común para los títulos de módulo que
siguen viniendo del `SectionTitle` histórico. El shell marca el primer título
de cada vista con `la-orbita-page-title` y su envolvente con
`la-orbita-page-title-wrap`; así Clientes, Productos, Inventario, Proveedores,
Pedidos, Recepción, Albaranes, Facturas, Locales y Configuración comparten la
misma jerarquía, línea de acento y separación responsive sin duplicar sus
acciones ni tocar el bundle de negocio.

El contrato del marco queda en `21/21`, además de las 20 rutas cubiertas. La
hoja y el shell se publican con las marcas `qa-orbita-shell-v9-20261120` y
`qa-orbita-shell-v5-20261120` para evitar caché antigua.

## Evidencia live · Deploy Preview 225

- Commit final de esta tanda: `9d132d72f996c54177f48cb14031b301b2570f05`.
- Deploy Netlify: `6b00b373ce91b4e9db365e88`, estado `ready`.
- URL: https://deploy-preview-225--chic-entremet-9107cf.netlify.app
- La pestaña autenticada monta `.la-orbita-shell`, cabecera, lateral y barra
  inferior; muestra el distintivo `QA` y no presenta `#error-arranque`.
- El selector global abrió y mostró `Todos los locales`, `Local A1` y
  `Local recuperado`.
- El menú de perfil mostró `Cuenta y seguridad`, `Cambiar tema`, `Modo
  empleado` y `Cerrar sesión`.
- En viewport `390×844`: cabecera visible, lateral oculta, barra inferior
  visible y `document.documentElement.scrollWidth === innerWidth`.
- No hubo errores ni advertencias de consola durante la prueba.

## Estado y límites

El marco común queda operativo en la base de QA. La vista TPV de caja a
pantalla completa conserva su excepción documentada para no tapar el ticket y
los productos; no se ejecutaron cobros, reembolsos ni escrituras de negocio.
La revisión visual pantalla por pantalla continúa después de cerrar este
marco estructural; esta tanda deja cubierta la identificación y composición
común de las superficies que todavía tenían raíces visuales distintas.

## Addendum de continuidad · 20/11/2026 · commit `9ef6a9c5`

La referencia vigente de esta entrega es el commit
`9ef6a9c574710efc72964eb1490c559f6acddf3f`, publicado en el Deploy Preview
`6b00b5092bd7410861c6dc3e` (`ready`). La URL de comprobación es:
https://deploy-preview-225--chic-entremet-9107cf.netlify.app/?cache=qa-orbita-audit-v5-20261120

Contratos ejecutados: marco Órbita 21/21, rutas 20/20, capas y migraciones,
propuestas, org-33, botones de solo icono, paridad `source-recovery` y
`git diff --check`, todos conformes.

El preview carga correctamente. La revisión visual autenticada de módulos
restantes queda pendiente de una sesión QA activa: la sesión del navegador
integrado había caducado y la pestaña quedó preparada en el acceso para que el
propietario introduzca sus credenciales directamente, sin compartirlas en el
chat. En esta tanda no se ejecutaron cobros, reembolsos ni mutaciones de QA.

## Cierre de revisión visual autenticada · 20/11/2026 · commit `614c5580`

Con sesión real de QA-A1 se recorrieron en escritorio los módulos generales
Productos, Proveedores, Pedidos, Recepción, Albaranes, Facturas, Clientes,
Locales y Configuración, además de TPV, Cocina y Arqueo de caja. Todos
conservaron el shell `.la-orbita-shell`, la cabecera y el lateral comunes, con
marcadores de ruta/superficie y sin desbordamiento horizontal.

En viewport móvil `390×844` se comprobó Clientes y Arqueo de caja: lateral
oculto, cabecera visible, barra inferior `.la-orbita-bottom-nav` visible y
`scrollWidth === innerWidth`.

Durante la comprobación apareció una advertencia React en `ClientesPunto3` por
los hijos de una lista sin `key`. Se corrigió de forma simétrica en `fuente.js`
y `source-recovery/fuente-recuperado.js`; la pestaña limpia abierta después de
la publicación no registra errores ni advertencias nuevas.

Referencia publicada: commit `614c5580970dd9cae8ab2f07e19227df5b5fa71c`,
Deploy Preview `6b00b89c879fb38200eafb4a` (`ready`). No se ejecutaron cobros,
reembolsos ni cambios de datos durante la revisión.

## Addendum sustitución de componentes comunes · 20/11/2026

Se cerró la segunda capa del objetivo: los componentes compartidos ya tienen un
contrato visual Órbita único, en vez de depender de nombres y reglas heredadas
por pantalla. `fuente.js` y `source-recovery/fuente-recuperado.js` exponen las
marcas semánticas `la-ui-*` para botones primarios, secundarios y destructivos,
enlaces, campos, selectores, tarjetas, títulos de sección, badges, estados
vacíos, alertas de carga/error y modales. El CSS común normaliza además tablas,
pestañas ARIA, paginación, filtros/selectores nativos, mensajes de estado,
confirmaciones, tooltips con `title`, iconos y botones de solo icono, incluidos
foco visible, áreas táctiles mínimas y reducción de movimiento.

La compatibilidad con las vistas que aún emiten marcado histórico se resuelve
con selectores semánticos globales del contrato; no se cambió la lógica de
negocio, los permisos ni los handlers. La capa CSS se publica con la marca
`qa-orbita-shell-v13-20261120` para impedir que el CDN mezcle la versión vieja.

Evidencia estática: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS` (14 primitivas,
7 selectores semánticos, 5 estados y paridad), `MARCO_ORBITA_CONTRACT=PASS (21/21)`,
`MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`, P01/P03/P05, org-33,
`SOURCE_RECOVERY_CHECK=PASS` y `git diff --check` sin salida. La verificación
live se hará sobre el deploy generado por esta rama en escritorio y móvil,
sin ejecutar cobros, reembolsos ni escrituras de negocio.

## Cierre de sustitución de componentes comunes · 20/11/2026

La sustitución del contrato visual común queda cerrada en la rama
`rediseno/f0-base-qa`, commit `b301222a3dc20ea768e5d01d2b8f9da0c91bc1f2`.
Se migraron botones primarios, secundarios y destructivos, enlaces, campos,
selectores, tarjetas, títulos, badges, estados vacíos, alertas, modales y
botones de solo icono; la hoja global cubre además tablas, pestañas ARIA,
paneles, paginación, filtros, dropdowns, estados de carga y error,
confirmaciones, tooltips e iconos. Los selectores semánticos también
normalizan el marcado histórico, evitando que cada pantalla conserve reglas
visuales antiguas.

Evidencia de código: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS` (14
primitivas, 7 selectores semánticos, 5 estados y paridad), marco Órbita 21/21,
rutas 20/20, P01/P03/P05, org-33, `SOURCE_RECOVERY_CHECK=PASS` y
`git diff --check` limpio. La batería sin base terminó con 305/327 contratos
activos en verde, 22 fallos históricos no relacionados con esta capa y
`INFRA_FAIL=0`; el límite de publicación Netlify pasó.

Evidencia visual en el Deploy Preview 225: en escritorio se recorrieron 46
módulos con el shell Órbita y sin desbordamiento horizontal; en móvil
`390×844` se verificaron TPV, Cocina, Productos, Configuración y Clientes,
todos con barra inferior, lateral oculto, ancho estable y ningún control
visible por debajo de 44 px. La pasada final se hizo en modo local del preview
porque la sesión autenticada de QA había caducado; no se ejecutaron cobros,
reembolsos ni escrituras de negocio. Es una comprobación de renderizado del
deploy, no una nueva mutación de QA.

PR #225 sigue en borrador y producción permanece fuera de alcance.

## Cierre del Panel principal Órbita · 21/11/2026

La revisión visual del Panel detectó que la capa nueva `la-panel-diseno`
(`El pulso del negocio`) convivía con el dashboard heredado `la-dashboard-v2`
(`Resumen general`). Se corrigió en el commit
`04b7cb4809d46904bdf000f5e6784cbe1ad9f3bc`: el detalle heredado ya no se
renderiza visible al entrar al Panel. El script `dashboard-premium-v2.js` dejó
de inyectar una segunda fila de acciones/alertas y ahora mantiene el detalle en
una sección secundaria marcada como `Detalle operativo`.

La acción `Ver detalle operativo` permite abrir y cerrar esa sección sin
alterar los datos, permisos ni handlers existentes. Así se conserva el acceso
a indicadores, alertas, caducidades y movimientos, pero no se duplica la
composición en la pantalla principal. El bloque de Pase permanece integrado
como módulo operativo independiente.

Evidencia en Deploy Preview 225, deploy Netlify
`6b01204b515686ad7b0dd5b3` (`ready`): en escritorio el Panel carga con una
sola composición Órbita, `Resumen general` está oculto por defecto y no hay
overflow (`scrollWidth=1440`). Al activar la acción se muestra el detalle y al
cerrarlo vuelve a quedar oculto. En móvil `390×844` se mantiene oculto por
defecto, la barra inferior tiene cuatro botones de 55 px, no hay overflow y no
hay controles visibles menores de 44 px. No hubo errores ni advertencias de
consola.

La batería global ejecutada después de esta corrección registró 304/327
contratos activos PASS, 23 fallos históricos ajenos al Panel y `INFRA_FAIL=0`;
el contrato específico de componentes Órbita volvió a pasar dentro de esa
batería.

## Cierre de escala visual única Órbita · 21/11/2026

Se definió y aplicó una sola escala geométrica para todas las vistas que
reciben `html[data-la-diseno]`. `la-apariencia.css` declara ahora el contrato
de espacio de 4 px (`--la-space-1` a `--la-space-7`), radios `sm/md/lg/xl`,
dos sombras, alturas de control de 44/48 px, seis escalones de texto y tres
tamaños de icono. La escala se aplica también a las clases utilitarias
históricas (`gap-*`, `p-*`, `px-*`, `py-*`, `rounded-*` y `text-[...]`), de
forma que los márgenes y tamaños escritos por las pantallas antiguas dejan de
imponer una segunda geometría.

Los controles nativos, tabs, opciones, menús y botones conservan un área
mínima de 44×44 px; tablas y tarjetas usan el mismo espaciado y radio. Se
mantienen como excepciones intencionadas los controles nativos checkbox/radio/
range y la densidad especial de TPV en modo caja completo. No se modificaron
handlers, permisos ni lógica de negocio.

El dashboard premium también consume los tokens de escala en lugar de valores
directos. La marca de caché pasó a `qa-orbita-scale-v14-20261121` y el
contrato P01 fija la huella de la hoja para evitar servir CSS anterior desde
CDN.

Evidencia estática: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`,
`MARCO_ORBITA_CONTRACT=PASS (21/21)`, rutas 20/20, P01/P03/P05, org-33,
`SOURCE_RECOVERY_CHECK=PASS` y `git diff --check` limpio. La batería completa
y la comprobación visual del deploy de esta tanda se añadirán al cerrar la
publicación. PR #225 continúa en borrador y producción permanece fuera de
alcance.

### Evidencia final de publicación · escala · 21/11/2026

La rama quedó publicada en el Deploy Preview 225 mediante el deploy
`6b0124c9e2b32501d2e28b9c` (`ready`), commit
`66b2b85360df498f4e39dff1e495c27d121240fb`, con la marca CSS
`qa-orbita-scale-v14-20261121`. En el navegador Codex se comprobó el mismo
preview en `1440×900` y `390×844`: `scrollWidth` coincidió con el ancho del
viewport (1440 y 390), el mínimo de los controles visibles fue 44 px en ambos
casos y no se observaron errores ni avisos de consola. El viewport se devolvió
después a su tamaño normal.

La batería oficial `tests/ci/ejecutar_bateria_no_db.sh` ejecutó 327 contratos
activos: 304 PASS y 23 fallos históricos ajenos a esta escala; utilidades 8,
diagnósticos 5, `INFRA_FAIL=0`, límite de publicación PASS y árbol limpio tras
la ejecución. Los 23 fallos quedan separados en el TSV de evidencia generado
por el runner; ninguno corresponde a `tests/rediseno`.

**Estado:** objetivo 3 terminado completamente. PR #225 sigue en borrador,
solo se publicó `rediseno/f0-base-qa` y producción no se tocó.
