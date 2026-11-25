import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');
const source = readFileSync(resolve(root, 'fuente.js'), 'utf8');
const recovery = readFileSync(resolve(root, 'source-recovery/fuente-recuperado.js'), 'utf8');

const checks = [
  [index.includes('la-orbita-shell.js?v=qa-orbita-shell-v35-20261125') && index.includes('la-apariencia.css?v=qa-orbita-shell-v89-20261125'), 'index carga las capas Órbita con sus marcas de caché'],
  [shell.includes('var superficie = ruta === "inicio" ? "inicio"'), 'Inicio conserva la identidad de módulo sobre subpaneles'],
  [shell.includes('data-la-orbita-header') && shell.includes('data-la-orbita-qa'), 'capa común con cabecera y estado QA'],
  [shell.includes('crearSidebarParaClaro') && shell.includes('la-orbita-legacy-header'), 'la propuesta claro deja de conservar una cabecera de marco alternativa'],
  [shell.includes('data-la-orbita-sidebar-toggle') && shell.includes('la-orbita:sidebar'), 'menú lateral con estado abierto/cerrado persistente'],
  [shell.includes('data-la-orbita-context-label') && shell.includes('selectorsContexto'), 'selector común de empresa y local'],
  [shell.includes('abrirPanelParaContexto') && shell.includes('Abrir Panel general'), 'selector de contexto accesible desde cualquier pantalla'],
  [shell.includes('abrirBusqueda') && shell.includes('event.key.toLowerCase() !== "k"'), 'buscador global con acceso Ctrl/Cmd K'],
  [shell.includes('data-la-orbita-alertas') && shell.includes('la-orbita-appearance'), 'avisos y acción Apariencia expuestos desde la cabecera'],
  [shell.includes('nombreDisenoActivo') && shell.includes('data-la-orbita-appearance'), 'Apariencia conserva el diseño activo en su acción funcional'],
  [!shell.includes('la-orbita-subheader') && !shell.includes('Opciones de demo'), 'el marco no muestra controles de maqueta sin funcionalidad'],
  [shell.includes('la-apariencia:cambio') && shell.includes('actualizarCabecera'), 'la cabecera se sincroniza al cambiar propuesta o paleta sin recargar'],
  [shell.includes('la-orbita-profile-menu') && shell.includes('Cuenta y seguridad'), 'perfil común con acciones de cuenta, tema, empleado y salida'],
  [shell.includes('cliente.auth.signOut({ scope: "local" })') && shell.includes('window.location.reload()'), 'salida del perfil Órbita no depende del encabezado oculto'],
  [shell.includes('marcarHerramientasLegadas') && shell.includes('la-orbita-legacy-tool'), 'controles duplicados neutralizados en la navegación antigua'],
  [shell.includes('rutaActiva') && shell.includes('data-la-orbita-route'), 'cada ruta queda identificada dentro del marco común'],
  [shell.includes('resumen de almacen') && shell.includes('return "inventario"'), 'Resumen de almacén entra en la superficie visual de Inventario'],
  [shell.includes('data-la-orbita-surface') && shell.includes('la-operacion-cocina'), 'superficies TPV, Pase, Cocina y Caja quedan marcadas'],
  [shell.includes('marcarZonasSidebar') && shell.includes('data-la-orbita-zone-label') && css.includes('.la-orbita-zone-label'), 'lateral Órbita conserva las zonas Operación y Administración de la maqueta'],
  // 25/11/2026: «Más módulos» se retiró. El detalle de cada área ya no se
  // despliega en el lateral: vive en la fila de pestañas sobre el contenido
  // (PestanasAreaOrbita en fuente.js), como en la maqueta. Se exige que el
  // lateral siga compacto y que el botón «Más módulos» no vuelva.
  [shell.includes('compactarSidebar') && css.includes('.la-orbita-sidebar-compacta') && !shell.includes('la-orbita-sidebar-more') && !shell.includes('data-la-orbita-more-toggle'), 'lateral Órbita muestra solo el primer nivel; el detalle va en las pestañas del área, sin «Más módulos»'],
  [shell.includes('label: "Compras", destino: /^pedidos(') && shell.includes('destino: /^configuraci[oó]n$/i') && shell.includes('button.dataset.laOrbitaOriginalLabel || textoVisible(button)'), 'Compras abre Pedidos a proveedor y Organización abre Configuración del local, también tras volver a compactar'],
  // 25/11/2026: las zonas del lateral siguen a la maqueta (orbitaNav):
  // «Operación» empieza en Inicio y «Gestión» en Equipo. La expresión
  // anterior no estaba anclada y «fiscalidad» contiene «calidad», así que la
  // segunda zona empezaba en «Caja y fiscalidad»; ahora el título se compara
  // entero y la vieja expresión sin anclar no puede volver.
  [shell.includes('/^(equipo|calidad|informes|organizaci[oó]n|sistema)$/i') && !shell.includes('/equipo|calidad|informes|organizaci[oó]n|sistema/i') && shell.includes('insertar(gestion, "gestion", "Gestión")') && shell.includes('secciones.find(esInicio)'), 'zonas del lateral como la maqueta: Operación desde Inicio, Gestión desde Equipo'],
  // 25/11/2026: el área marcada sale del botón que React pinta activo, no
  // del aria-current que el propio marco había puesto antes (dejaba dos
  // áreas marcadas y podía desviar rutaActiva).
  [shell.includes('var hayActivo = botonPulsado ? botones.indexOf(botonPulsado) >= 0 : botones.some(') && shell.includes('sincronizarSidebarCompacto(sidebar, button);') && !shell.includes('return button.getAttribute("aria-current") === "page" || /rgba'), 'el lateral marca una sola área, la que el programa tiene activa'],
  [shell.includes('El destino elegido por la navegación manda') && shell.includes('laOrbitaRouteBound'), 'Inicio conserva prioridad sobre subpaneles incrustados'],
  [shell.includes('la-orbita-page-title') && shell.includes('SectionTitle'), 'títulos de módulos históricos reciben la jerarquía Órbita'],
  [shell.includes('data-la-barra-inferior') && shell.includes('la-orbita-bottom-nav'), 'navegación inferior móvil conservada dentro del marco común'],
  [css.includes('.la-orbita-shell') && css.includes('@media (max-width: 767px)'), 'grid común y adaptación móvil'],
  [css.includes('.la-orbita-sidebar.la-orbita-colapsada') && css.includes('.la-orbita-header'), 'estilos de lateral colapsada y cabecera'],
  [css.includes('.la-orbita-search-dialog') && css.includes('.la-orbita-context-menu'), 'tratamiento común de búsqueda y selector'],
  [css.includes('.la-orbita-profile-menu') && css.includes('.la-orbita-legacy-tool'), 'estilos del menú de perfil y neutralización del marco antiguo'],
  [css.includes('data-la-orbita-surface="general"') && css.includes('data-la-orbita-surface="tpv"'), 'tratamiento visual consistente por superficie'],
  [css.includes('.la-orbita-page-title-wrap') && css.includes('.la-orbita-page-title::after'), 'cabecera de contenido común para módulos'],
  [css.includes('min-height: 44px'), 'objetivo táctil mínimo de los controles del marco'],
  // 25/11/2026: las áreas de Órbita ya no se arman juntando grupos
  // históricos enteros, sino destino a destino desde AREAS_ORBITA (tabla de
  // equivalencias aprobada). El detalle lo defiende
  // tests/rediseno/orbita-pestanas-area-contract.mjs; aquí solo se exige que
  // Órbita use esa tabla en las dos fuentes.
  [source.includes('const AREAS_ORBITA = [') && source.includes('if (diseno === "orbita") return agruparNavegacionOrbita(grupos);'), 'Órbita organiza sus áreas desde la tabla de equivalencias de la maqueta'],
  [recovery.includes('const AREAS_ORBITA = [') && recovery.includes('if (diseno === "orbita") return agruparNavegacionOrbita(grupos);'), 'la recuperación conserva la organización de áreas de Órbita'],
  [source.includes('const definicion = distribucion[diseno] || null;') && recovery.includes('const definicion = distribucion[diseno] || null;'), 'Órbita se aplica al diseño activo y no queda como definición inerte'],
  [source.includes('"Propietario": ["dashboard", "venta", "caja", "resultados"]') && recovery.includes('"Propietario": ["dashboard", "venta", "caja", "resultados"]'), 'la barra móvil de Propietario conserva el orden Inicio/Sala/Caja/Resultados de la maqueta'],
  [source.includes('const ETIQUETA_PESTANA = { dashboard: "Inicio", venta: "Sala", caja: "Caja",') && recovery.includes('const ETIQUETA_PESTANA = { dashboard: "Inicio", venta: "Sala", caja: "Caja",'), 'la barra móvil conserva las etiquetas Sala y Caja de la maqueta'],
];

const failures = checks.filter(([ok]) => !ok);
if (failures.length) {
  throw new Error(failures.map(([, message]) => message).join('\n'));
}
console.log(`MARCO_ORBITA_CONTRACT=PASS (${checks.length}/${checks.length})`);
