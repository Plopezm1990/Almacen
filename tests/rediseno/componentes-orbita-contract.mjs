import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');
const dashboardPremium = readFileSync(resolve(root, 'dashboard-premium-v2.js'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');
const source = readFileSync(resolve(root, 'fuente.js'), 'utf8');
const recovery = readFileSync(resolve(root, 'source-recovery/fuente-recuperado.js'), 'utf8');
const resetPassword = readFileSync(resolve(root, 'restablecer-contrasena.html'), 'utf8');
const ownerBootstrap = readFileSync(resolve(root, 'owner-bootstrap-post-reset.js'), 'utf8');
const platformPanel = readFileSync(resolve(root, 'plataforma-panel.js'), 'utf8');
const appearance = readFileSync(resolve(root, 'la-apariencia.js'), 'utf8');

const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');
const localAccessBlock = (text) => {
  const start = text.indexOf('function entrarSinNube()');
  const end = text.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, 'no se pudo localizar el acceso local');
  return normalizeNewlines(text.slice(start, end + 4));
};
assert.match(source, /function entrarSinNube\(\)[\s\S]*__modoPruebasLocal = true/,
  'Acceso no desactiva la nube al elegir modo local');
assert.equal(localAccessBlock(source), localAccessBlock(recovery),
  'el acceso local debe conservar paridad entre fuente y recuperación');

assert.match(index, /la-apariencia\.css\?v=qa-orbita-modules-v69-20261122/);
assert.match(index, /data-la-diseno="orbita"/, 'el arranque debe fijar Órbita antes del primer render');
assert.match(appearance, /return aplicar\(empresa \|\| \{ diseno: "orbita" \}, empresa \? "empresa" : "base"\)/,
  'la ausencia de configuración de empresa debe conservar Órbita como fallback visual');
assert.match(appearance, /aplicar\(\{ diseno: "orbita" \}, "base"\)/,
  'el cambio de contexto no debe devolver temporalmente la suite a la capa antigua');
assert.match(index, /var\(--c-bg, #17191C\)/, 'la pantalla de carga conserva la superficie antigua');
assert.doesNotMatch(index, /#0C2714|#F7F3E9|#E7D1A5|#B8AC91|#7F5823|#C69A52|#D2AD68/, 'el arranque conserva la paleta antigua');
assert.match(ownerBootstrap, /min-height:var\(--la-control-height,44px\)/, 'el bootstrap de instalación conserva controles menores de 44 px');
assert.doesNotMatch(ownerBootstrap, /#153D27|#0C2714|#06170E|#F7F3E9|#7F5823|#b7b0a0|#8d2e1f/, 'el bootstrap de instalación conserva la paleta antigua');
assert.ok(css.includes('overscroll-behavior-inline: contain'), 'las tablas Órbita no encapsulan el desplazamiento móvil');
assert.ok(css.includes('main[data-la-orbita-module] .overflow-x-auto'), 'los wrappers históricos no encapsulan el desplazamiento móvil');
assert.match(css, /\.la-orbita-sidebar \.la-orbita-sidebar-toggle[\s\S]*?width:\s*44px;\s*min-width:\s*44px;\s*height:\s*44px;\s*min-height:\s*44px;/, 'el toggle del shell no respeta 44x44');
assert.ok(css.includes('main[data-la-orbita-module="inicio"] .la-panel-diseno'), 'Inicio no normaliza el panel Órbita');
assert.ok(css.includes('main[data-la-orbita-module="inicio"] .la-dashboard-v2'), 'Inicio no normaliza el detalle operativo');
assert.ok(css.includes('main[data-la-orbita-module="tpv"] .tpv-layout button'), 'TPV no normaliza sus controles secundarios');
assert.ok(css.includes('main[data-la-orbita-module="tpv"] [data-tpv-history-screen="1"] table'), 'TPV no normaliza la tabla de historial');
assert.ok(css.includes('main[data-la-orbita-module="pase"] .la-pase-mesa'), 'Pase no normaliza estados de mesa');
assert.ok(css.includes('main[data-la-orbita-module="pase"] .la-pase-cola'), 'Pase no contiene la cola operativa');
assert.ok(css.includes('main[data-la-orbita-module="cocina"] .la-operacion-cocina button'), 'Cocina no normaliza controles operativos');
assert.ok(css.includes('main[data-la-orbita-module="cocina"] .la-operacion-cocina [role="alert"]'), 'Cocina no normaliza el estado de error');
assert.ok(css.includes('main[data-la-orbita-module="caja"] .la-operacion-caja button'), 'Caja no normaliza controles operativos');
assert.ok(css.includes('main[data-la-orbita-module="caja"] .la-operacion-caja [role="status"]'), 'Caja no normaliza el estado informativo');
assert.ok(css.includes('main[data-la-orbita-module="clientes"] [role="group"][aria-label="Vistas guardadas de clientes"]'), 'Clientes no normaliza vistas guardadas');
assert.ok(css.includes('main[data-la-orbita-module="clientes"] nav[aria-label="Paginación de clientes"]'), 'Clientes no normaliza paginación');
assert.ok(css.includes('main[data-la-orbita-module="compras"] .la-ui-card'), 'Compras no normaliza tarjetas');
assert.ok(css.includes('main[data-la-orbita-module="compras"] [role="alert"]'), 'Compras no normaliza el estado de error');
assert.ok(css.includes('main[data-la-orbita-module="inventario"] .la-ui-card'), 'Inventario no normaliza tarjetas');
assert.ok(css.includes('main[data-la-orbita-module="inventario"] table'), 'Inventario no normaliza tablas');
assert.ok(css.includes('main[data-la-orbita-module="inventario"] .pm12-p09-report'), 'Inventario no normaliza el informe móvil PM12/P09');
assert.ok(css.includes('main[data-la-orbita-module="inventario"] .pm12-p09-capture-grid input'), 'Inventario no normaliza los campos de captura PM12/P09');
assert.ok(css.includes('Reconciliación de stock comparte los tokens Órbita'), 'Reconciliación no documenta su remapeo de tokens');
assert.ok(css.includes('main[data-la-orbita-module="inventario"] [style*="var(--c-accent)22"]'), 'Reconciliación no remapea badges de éxito');
assert.ok(source.includes('OK: { texto: "OK", color: C2.accent, fondo: C2.accentSoft }'), 'Reconciliación conserva el color legacy de éxito');
assert.ok(recovery.includes('OK: { texto: "OK", color: C2.accent, fondo: C2.accentSoft }'), 'source-recovery no conserva el token de éxito');
assert.equal(normalizeNewlines(source.match(/var ESTADO_RECONCILIACION = \{[\s\S]*?\n\};/)[0]), normalizeNewlines(recovery.match(/var ESTADO_RECONCILIACION = \{[\s\S]*?\n\};/)[0]), 'Reconciliación debe conservar paridad entre fuente y recuperación');
assert.ok(css.includes('linear-gradient(90deg, var(--c-accent-fill), var(--c-accent))'), 'Cocina/Caja no adaptan el degradado de título a la paleta activa');
assert.ok(css.includes('linear-gradient(105deg, var(--c-accent-fill), var(--c-accent) 55%, var(--c-ink))'), 'Pase no adapta el degradado de título a la paleta activa');
assert.match(css, /html\[data-la-diseno="orbita"\]:not\(\[data-la-paleta\]\):not\(\[data-la-personalizada\]\) #root \[data-la-contenedor\]/, 'el fallback de tokens Órbita no debe anular una paleta elegida');
assert.ok(css.includes('main[data-la-orbita-module="personal"] .la-ui-card'), 'Personal no normaliza tarjetas');
assert.ok(css.includes('main[data-la-orbita-module="personal"] [role="status"]'), 'Personal no normaliza el estado informativo');
assert.ok(css.includes('main[data-la-orbita-module="configuracion"] .la-ui-card'), 'Configuración no normaliza tarjetas');
assert.ok(css.includes('main[data-la-orbita-module="configuracion"] [role="alert"]'), 'Configuración no normaliza errores');
assert.ok(css.includes('main[data-la-orbita-module="plataforma"] .la-ui-card'), 'Plataforma no normaliza tarjetas');
assert.ok(css.includes('main[data-la-orbita-module="plataforma"] [role="alert"]'), 'Plataforma no normaliza errores');
assert.ok(css.includes('#la-plataforma-root .lap-tarjeta'), 'Plataforma previa no normaliza tarjetas');
assert.ok(css.includes('#la-plataforma-root .lap-btn'), 'Plataforma previa no normaliza controles');
assert.ok(css.includes('#la-plataforma-root .lap-campo textarea'), 'Plataforma previa no normaliza áreas de texto');
assert.ok(css.includes('.la-acceso button:focus-visible') && css.includes('.lap-btn:focus-visible'), 'Acceso y Plataforma no exponen foco Órbita');
assert.match(index, /plataforma-panel\.js\?v=qa-orbita-platform-v4-20261122/, 'Plataforma no invalida la caché tras marcar la superficie externa');
assert.match(platformPanel, /data-la-orbita-external["']:\s*["']plataforma["']/g, 'Plataforma no expone su marca externa Órbita');
assert.match(platformPanel, /data-la-orbita-surface["']:\s*["']plataforma["']/g, 'Plataforma no expone su superficie Órbita');
assert.doesNotMatch(css, /var\(--la-font-sans\)/, 'Plataforma usa un token tipográfico inexistente');
assert.ok(css.includes('.la-acceso .la-acceso-campo'), 'Acceso no normaliza campos');
assert.ok(css.includes('.la-acceso-arte .la-acceso-entorno') && css.includes('#error-arranque button'), 'Acceso y arranque no heredan la paleta Órbita');
assert.match(css, /--la-mono:\s*["']IBM Plex Mono["']/, 'MFA usa --la-mono sin declararlo');
assert.ok(css.includes('main:has(input[autocomplete="one-time-code"])'), 'MFA no conserva la composición Órbita');
assert.ok(css.includes('#root > div[style*="radial-gradient"] > main input[autocomplete="one-time-code"]'), 'MFA no remapea el campo de código a la escala Órbita');
assert.ok(css.includes('#root > div[style*="radial-gradient"] > main button:first-of-type'), 'MFA no remapea la acción primaria a la paleta Órbita');
assert.ok(css.includes('#root > div[style*="radial-gradient"] > main button:last-of-type'), 'MFA no remapea la salida a la paleta Órbita');
assert.ok(css.includes('body > [role="dialog"][aria-labelledby="la-m03-titulo"]'), 'MFA externo no queda dentro del marco visual Órbita');
assert.ok(css.includes('body > [role="dialog"][aria-labelledby="la-m03-titulo"] input') && css.includes('min-height: var(--la-control-height)'), 'MFA externo no conserva la escala táctil');
assert.ok(css.includes('#root > div[style*="#F7F3E9"] > main'), 'MFA error no remapea la superficie heredada');
assert.ok(css.includes('[style*="#C69A52"]') && css.includes('[class*="md:hidden"][class*="items-center"][class*="justify-between"]'), 'la cabecera móvil no remapea los acentos heredados');
assert.ok(css.includes('button[style*="rgba(255,255,255,0.08)"]') && css.includes('padding-inline: var(--la-space-3)'), 'Seguridad no remapea el botón heredado de la cabecera');
assert.ok(css.includes('button:has(> svg:only-child)') && css.includes('min-width: var(--la-control-height)'), 'los botones solo icono no garantizan un objetivo táctil cuadrado');
const shellVisual = css.slice(css.indexOf('.la-orbita-sidebar'), css.indexOf('/* ========================================================================\n   Órbita · módulos de gestión'));
assert.doesNotMatch(shellVisual, /rgba\(255,255,255|#8CC3FF|#c7d5ce|#8fb0a1/i,
  'el shell no debe imponer colores literales sobre las paletas activas');
assert.match(resetPassword, /data-la-diseno="orbita"/, 'la recuperación no fija la propuesta Órbita antes de iniciar sesión');
assert.match(resetPassword, /la-apariencia\.css\?v=qa-orbita-modules-v69-20261122/, 'la recuperación no carga el contrato de apariencia');
assert.match(resetPassword, /min-height:var\(--la-control-height,44px\)/, 'la recuperación conserva controles por debajo de 44 px');
assert.doesNotMatch(resetPassword, /#153D27|#0C2714|#C69A52|#8A6028/, 'la recuperación conserva colores literales del marco antiguo');

// Toda variable --la-* consumida por la capa debe estar declarada en la
// propia hoja. La única excepción es --la-orbita-puntero: la escribe en
// tiempo de ejecución el movimiento del cursor del panel Órbita.
const laTokensDefinidos = new Set([...css.matchAll(/--(la-[\w-]+)\s*:/g)].map((m) => m[1]));
const laTokensUsados = new Set([...css.matchAll(/var\(--(la-[\w-]+)/g)].map((m) => m[1]));
const laTokensDinamicos = new Set(['la-orbita-puntero']);
for (const token of laTokensUsados) {
  assert.ok(laTokensDefinidos.has(token) || laTokensDinamicos.has(token),
    `la capa visual usa --${token} sin declararlo ni documentarlo como dinámico`);
}
assert.match(index, /dashboard-premium-v2\.js\?v=qa-orbita-panel-v5-20261121/);
assert.match(dashboardPremium, /la-dashboard-detail-hidden/);
assert.match(dashboardPremium, /Ver detalle operativo/);
assert.match(dashboardPremium, /laDetalleVisible/);
assert.doesNotMatch(dashboardPremium, /grid\.classList\.add\([^)]*\);addQuickActions\(root,grid\)/, 'el dashboard heredado no debe inyectar un segundo panel de acciones');
assert.match(dashboardPremium, /removeOrphanDashboardToggle/, 'el detalle de Inicio no puede quedar huérfano en otras rutas');

const primitiveClasses = [
  'la-ui-button', 'la-ui-link-button', 'la-ui-input', 'la-ui-select',
  'la-ui-card', 'la-ui-section-title', 'la-ui-field', 'la-ui-badge',
  'la-ui-empty', 'la-ui-alert', 'la-ui-modal-backdrop', 'la-ui-modal',
  'la-ui-modal-head', 'la-ui-icon-button', 'la-ui-dropdown', 'la-ui-filter',
  'la-ui-pagination', 'la-ui-confirmation', 'la-ui-tooltip', 'la-ui-icon'
];
const sourcePrimitiveClasses = primitiveClasses.slice(0, 14);
for (const name of sourcePrimitiveClasses) {
  assert.ok(source.includes(name), `fuente.js no expone el componente común ${name}`);
  assert.ok(recovery.includes(name), `fuente-recuperado.js no conserva ${name}`);
}
for (const name of primitiveClasses) {
  assert.ok(css.includes(`.${name}`), `la-apariencia.css no define ${name}`);
}

for (const required of [
  'la-ui-button-primary', 'la-ui-button-ghost', 'la-ui-button-danger',
  '[role="tablist"]', '[role="tab"]', '[role="alert"]',
  'nav[aria-label*="Paginación"]', '[role="menu"]', '[role="listbox"]',
  '[role="tooltip"]', 'table thead th',
  'table tbody tr:hover', 'role="status"',
  'prefers-reduced-motion: reduce'
]) {
  assert.ok(css.includes(required), `falta la regla común ${required}`);
}
for (const moduleName of ['compras', 'inventario', 'personal', 'configuracion', 'plataforma']) {
  assert.ok(css.includes(`main[data-la-orbita-module="${moduleName}"] [role="status"]`), `falta el estado Órbita de ${moduleName}`);
  assert.ok(css.includes(`main[data-la-orbita-module="${moduleName}"] table tbody tr:hover`), `falta el hover de tabla de ${moduleName}`);
}
assert.ok(css.includes('background: var(--c-red-soft)'), 'los avisos de gestión deben consumir el token de error');

for (const token of [
  '--la-space-1: 4px', '--la-space-4: 16px', '--la-radius-md: 10px',
  '--la-shadow-1:', '--la-control-height: 44px', '--la-type-body: 14px',
  '--la-icon-md: 20px', '.gap-2', '.p-3', '.rounded-lg', '.text-\\[12px\\]',
  'min-height: var(--la-control-height)', 'table th', 'table td'
]) {
  assert.ok(css.includes(token), `falta el token o normalizador de escala ${token}`);
}
assert.match(dashboardPremium, /gap:var\(--la-space-3\)/);
assert.match(dashboardPremium, /border-radius:var\(--la-radius-lg\)/);
assert.match(dashboardPremium, /min-height:var\(--la-control-height-large\)/);
for (const token of [
  'var(--c-surface)', 'var(--c-bg)', 'var(--c-ink)', 'var(--c-accent)',
  'var(--c-accent-fill)', 'var(--c-on-accent)', 'var(--c-ink-soft)', 'var(--c-red)'
]) {
  assert.ok(dashboardPremium.includes(token), `el panel de Inicio no consume ${token}`);
}
assert.doesNotMatch(dashboardPremium, /#102F20|#0D351F|#DFAE52|#E3B75F|rgba\(201,154,75/, 'el panel de Inicio conserva colores heredados');
assert.match(css, /main\[data-la-orbita-module\]\:not\(\[data-la-orbita-module="inicio"\]\)[\s\S]*la-dashboard-detail-toggle/, 'el detalle operativo se limita visualmente a Inicio');

for (const moduleName of [
  'inicio', 'tpv', 'pase', 'cocina', 'caja', 'clientes', 'compras',
  'inventario', 'personal', 'configuracion', 'plataforma'
]) {
  assert.ok(shell.includes(`"${moduleName}"`), `el shell no identifica el módulo ${moduleName}`);
  assert.ok(css.includes(`data-la-orbita-module="${moduleName}"`), `falta la superficie CSS del módulo ${moduleName}`);
}
assert.ok(css.includes('.la-acceso-entrar'), 'el acceso no recibe el contrato visual Órbita');
assert.ok(css.includes('main:has(input[autocomplete="one-time-code"])'), 'MFA no recibe la composición Órbita');
assert.ok(css.includes('.la-orbita-bottom-nav'), 'la barra inferior móvil no recibe el marco Órbita');
assert.ok(css.includes('.la-orbita-bottom-item[aria-current="page"]'), 'la barra inferior móvil no expone estado activo');
assert.ok(css.includes('.la-orbita-sidebar [data-la-orbita-nav-item]'), 'la navegación heredada no consume la escala Órbita');
assert.ok(css.includes('.la-orbita-sidebar [style*="rgba(184, 139, 69, 0.07)"]'), 'el halo antiguo del logo no se remapea al acento Órbita');
assert.ok(css.includes('main[data-la-orbita-module="tpv"] button[style*="border-left"]') && css.includes('border-inline-start: 2px solid var(--c-accent-fill) !important'), 'los filtros de categoría del TPV conservan bordes heredados');
assert.ok(css.includes('main[data-la-orbita-module="inventario"] button[style*="rgb(18, 59, 45)"]'), 'el filtro Todos de Inventario conserva el color inline antiguo');
assert.ok(css.includes('[data-la-orbita-nav-item][style*="rgba(255, 255, 255, 0.12)"]'), 'el estado inicial del menú heredado no se reencamina a tokens');
assert.ok(css.includes('.la-orbita-control'), 'los módulos no comparten la marca semántica de control');
assert.ok(css.includes('.la-orbita-field'), 'los módulos no comparten la marca semántica de campo');
assert.ok(css.includes('.la-orbita-table'), 'los módulos no comparten la marca semántica de tabla');
assert.match(shell, /marcarComponentesOrbita/, 'el shell no normaliza componentes históricos');
assert.ok(shell.includes('"acceso"'), 'el shell conserva el identificador de acceso para la matriz de módulos');
assert.ok(shell.includes('data-la-orbita-module'), 'el shell no expone la marca verificable de módulo');
assert.match(shell, /marcarBarraInferior/, 'el shell no marca la navegación inferior para el buscador global');
assert.match(shell, /vistos\s*=\s*new Set/, 'el buscador global duplica las entradas de escritorio y móvil');

const block = (text) => {
  const start = text.indexOf('function Card(');
  const end = text.indexOf('function InicioEmpleado(', start);
  assert.ok(start >= 0 && end > start, 'no se pudo delimitar la capa común de primitivas');
  return text.slice(start, end).replace(/\r\n/g, '\n');
};
const sourceBody = block(source);
const recoveryBody = block(recovery);
assert.equal(sourceBody, recoveryBody, 'la capa común debe conservar paridad exacta entre fuente y recuperación');

console.log('REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS primitivas=14 selectores=7 estados=5 responsive=PASS paridad=PASS');
