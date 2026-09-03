import fs from 'node:fs';
import vm from 'node:vm';

const codigo = fs.readFileSync('reset-pruebas-preview.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

class LocalStorageFake {
  constructor(inicial = {}) { this.map = new Map(Object.entries(inicial)); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? String(this.map.get(k)) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  snapshot() { return Object.fromEntries(this.map); }
}

let fallos = 0;
function check(condicion, mensaje) {
  if (condicion) console.log(`[OK] ${mensaje}`);
  else { console.error(`[FAIL] ${mensaje}`); fallos++; }
}

function ejecutar(hostname, inicial) {
  const localStorage = new LocalStorageFake(inicial);
  const window = { location: { hostname } };
  const contexto = vm.createContext({ window, localStorage, console });
  vm.runInContext(codigo, contexto, { filename: 'reset-pruebas-preview.js' });
  return { window, localStorage, contexto };
}

const estructura = {
  'almacen:empresas': '[{"id":"empresa-a"}]',
  'almacen:locales': '[{"id":"a1","empresaId":"empresa-a"}]',
  'almacen:localActivoId': '"a1"',
  'almacen:configEmpresa': '{"marca":"Empresa A"}',
  'almacen:disenoMenu': '"B"',
  'almacen:temaOscuro': 'false',
  'almacen:pinPropietario': '"hash-pin"'
};

const operativos = {
  'almacen:productos': '[{"id":"p1"}]',
  'almacen:proveedores': '[{"id":"prov1"}]',
  'almacen:clientes': '[{"id":"c1"}]',
  'almacen:pedidos': '[{"id":"ped1"}]',
  'almacen:movimientos': '[{"id":"m1"}]',
  'almacen:arqueos': '[{"id":"a1"}]',
  'almacen:empleados': '[{"id":"e1"}]',
  'almacen:facturasDirectas': '[{"id":"f1"}]',
  'almacen:historialRespaldos': '[{"id":"r1"}]',
  'almacen:auditoria': '[{"id":"au1"}]',
  'almacen:claveFuturaOperativa': '[{"id":"x1"}]',
  'almacen__pendientes': '["productos","pedidos"]',
  'almacen__borrados:movimientos': '["m-antiguo"]',
  'almacen__borrados:productos': '["p-antiguo"]',
  'almacen__caducidades_avisadas': '["lote1"]',
  'sb-auth-token-de-prueba': 'NO_TOCAR'
};

const previewHost = 'deploy-preview-10--chic-entremet-9107cf.netlify.app';
const prodHost = 'chic-entremet-9107cf.netlify.app';

// PREVIEW: debe limpiar todo lo operativo y conservar estructura + auth ajena al almacén.
const preview = ejecutar(previewHost, { ...estructura, ...operativos });
const snapPreview = preview.localStorage.snapshot();
check(preview.window.__modoPruebasLocal === true, 'Preview entra en modo de pruebas local');
check(preview.window.__resetPruebasEjecutado === true, 'Preview ejecuta el reset en la primera carga');
for (const k of Object.keys(estructura)) check(k in snapPreview, `Conserva estructura: ${k}`);
for (const k of Object.keys(operativos).filter(k => k.startsWith('almacen:'))) check(!(k in snapPreview), `Borra dato operativo: ${k}`);
check(!('almacen__pendientes' in snapPreview), 'Elimina cola de pendientes anterior');
check(!('almacen__borrados:movimientos' in snapPreview) && !('almacen__borrados:productos' in snapPreview), 'Elimina marcadores de borrados anteriores');
check(!('almacen__caducidades_avisadas' in snapPreview), 'Elimina avisos de caducidad de datos antiguos');
check(snapPreview['sb-auth-token-de-prueba'] === 'NO_TOCAR', 'No toca almacenamiento de autenticación ajeno a almacen:');
check(snapPreview['la_suite_reset_pruebas_multilocal_v1'] === '1', 'Deja marcador de reset realizado');

// Una sola vez: los datos creados DESPUÉS del reset deben sobrevivir a una recarga.
preview.localStorage.setItem('almacen:productos', '[{"id":"nuevo-test"}]');
vm.runInContext(codigo, preview.contexto, { filename: 'reset-pruebas-preview.js' });
check(preview.localStorage.getItem('almacen:productos')?.includes('nuevo-test'), 'No vuelve a borrar los datos nuevos en cada recarga');

// PRODUCCIÓN: absolutamente nada debe alterarse.
const inicialProd = { ...estructura, ...operativos };
const prod = ejecutar(prodHost, inicialProd);
const snapProd = prod.localStorage.snapshot();
check(prod.window.__modoPruebasLocal !== true, 'Producción no entra en modo de pruebas');
check(JSON.stringify(snapProd) === JSON.stringify(inicialProd), 'Producción queda byte-a-byte sin modificaciones');
check(!('la_suite_reset_pruebas_multilocal_v1' in snapProd), 'Producción no recibe marcador del reset');

// Integración estática: el reset se carga antes de nube y el puente no crea pendientes en modo pruebas.
const posReset = index.indexOf('src="./reset-pruebas-preview.js"');
const posNube = index.indexOf('var NUBE_URL =');
check(posReset >= 0 && posReset < posNube, 'index carga el reset antes de inicializar la nube');
check(index.includes('if (window.__modoPruebasLocal) {') && index.includes('window.NUBE_URL = "";') && index.includes('window.NUBE_CLAVE = "";'), 'Preview bloquea credenciales de nube en memoria');
check(index.includes('else if (!window.__modoPruebasLocal) {\n        marcarPendiente(key);'), 'Preview no acumula una cola para subir datos de prueba después');

if (fallos) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log('\nRESET PREVIEW: TODAS LAS COMPROBACIONES PASARON');
