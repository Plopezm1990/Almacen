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
  realmente disponibles para el rol.
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

- `la-apariencia.css?v=qa-orbita-shell-v77-20261123`
- `fuente.js?v=qa-orbita-home-v8-20261123`
- `la-orbita-shell.js?v=qa-orbita-shell-v24-20261123`

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

## Evidencia visual pendiente de publicación

La comparación live anterior confirmó la maqueta móvil en
`http://192.168.1.129:8765/index.html?vista=movil#/screen/ini-01?propuesta=7`
y el preview #225 anterior. Este commit añade el hero orbital real, la cabecera
apilada y el menú por secciones, por lo que falta observar el deploy generado
por este SHA en 390×844, 430×932, tablet y escritorio. En esa observación se
debe registrar:

1. ausencia de scroll horizontal;
2. botones y enlaces con al menos 44×44 px;
3. hero visible sin cubrir acciones;
4. una sola composición de Inicio, con `Ver detalle operativo` como acceso
   secundario;
5. menú `Más` con una sola cabecera de Herramientas y destinos funcionales.

## Excepciones y no alcance

- No se ejecutaron cobros, reembolsos ni acciones destructivas.
- No se modificó producción ni se fusionó el PR #225.
- No se eliminó el dashboard histórico: queda aislado para preservar sus
  datos y handlers y permitir volver a él desde el detalle operativo.
- El estado final del objetivo no debe marcarse completo hasta observar este
  commit en el preview en las cuatro familias de ancho indicadas.
