import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');

const checks = [
  [index.includes('la-orbita-shell.js?v=qa-orbita-shell-v7-20261121') && index.includes('la-apariencia.css?v=qa-orbita-modules-v34-20261121'), 'index carga las capas Órbita con sus marcas de caché'],
  [shell.includes('data-la-orbita-header') && shell.includes('data-la-orbita-qa'), 'capa común con cabecera y estado QA'],
  [shell.includes('crearSidebarParaClaro') && shell.includes('la-orbita-legacy-header'), 'la propuesta claro deja de conservar una cabecera de marco alternativa'],
  [shell.includes('data-la-orbita-sidebar-toggle') && shell.includes('la-orbita:sidebar'), 'menú lateral con estado abierto/cerrado persistente'],
  [shell.includes('data-la-orbita-context-label') && shell.includes('selectorsContexto'), 'selector común de empresa y local'],
  [shell.includes('abrirPanelParaContexto') && shell.includes('Abrir Panel general'), 'selector de contexto accesible desde cualquier pantalla'],
  [shell.includes('abrirBusqueda') && shell.includes('event.key.toLowerCase() !== "k"'), 'buscador global con acceso Ctrl/Cmd K'],
  [shell.includes('data-la-orbita-alertas') && shell.includes('la-orbita-appearance'), 'avisos y acción Apariencia expuestos desde la cabecera'],
  [shell.includes('la-orbita-profile-menu') && shell.includes('Cuenta y seguridad'), 'perfil común con acciones de cuenta, tema, empleado y salida'],
  [shell.includes('marcarHerramientasLegadas') && shell.includes('la-orbita-legacy-tool'), 'controles duplicados neutralizados en la navegación antigua'],
  [shell.includes('rutaActiva') && shell.includes('data-la-orbita-route'), 'cada ruta queda identificada dentro del marco común'],
  [shell.includes('data-la-orbita-surface') && shell.includes('la-operacion-cocina'), 'superficies TPV, Pase, Cocina y Caja quedan marcadas'],
  [shell.includes('la-orbita-page-title') && shell.includes('SectionTitle'), 'títulos de módulos históricos reciben la jerarquía Órbita'],
  [shell.includes('data-la-barra-inferior') && shell.includes('la-orbita-bottom-nav'), 'navegación inferior móvil conservada dentro del marco común'],
  [css.includes('.la-orbita-shell') && css.includes('@media (max-width: 767px)'), 'grid común y adaptación móvil'],
  [css.includes('.la-orbita-sidebar.la-orbita-colapsada') && css.includes('.la-orbita-header'), 'estilos de lateral colapsada y cabecera'],
  [css.includes('.la-orbita-search-dialog') && css.includes('.la-orbita-context-menu'), 'tratamiento común de búsqueda y selector'],
  [css.includes('.la-orbita-profile-menu') && css.includes('.la-orbita-legacy-tool'), 'estilos del menú de perfil y neutralización del marco antiguo'],
  [css.includes('data-la-orbita-surface="general"') && css.includes('data-la-orbita-surface="tpv"'), 'tratamiento visual consistente por superficie'],
  [css.includes('.la-orbita-page-title-wrap') && css.includes('.la-orbita-page-title::after'), 'cabecera de contenido común para módulos'],
  [css.includes('min-height: 44px'), 'objetivo táctil mínimo de los controles del marco'],
];

const failures = checks.filter(([ok]) => !ok);
if (failures.length) {
  throw new Error(failures.map(([, message]) => message).join('\n'));
}
console.log(`MARCO_ORBITA_CONTRACT=PASS (${checks.length}/${checks.length})`);
