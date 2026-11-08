// Prueba de ejecución del alta automática del proveedor desde la foto del albarán (ALB-PROV A02), con la pantalla REAL montada.
//
// Pedro pidió (8/10/2026): «que el programa registre el proveedor con foto IA cuando le doy entrada a un albarán, que registre
// ese proveedor por primera vez si nunca se ha registrado». Esta prueba monta de verdad Albaranes y Proveedores (con la lógica real
// de proveedores y un «Arnés» que se comporta como la aplicación: estado de React, solapado de proveedores recién creados, y un
// guardarAlbaran que RECHAZA —como el real— un albarán cuyo proveedor aún no existe en su vista del estado) y comprueba:
//   · proveedor ya existente → se reconoce por NIF o nombre y NO se crea nada;
//   · proveedor nuevo → se avisa, se crea SOLO al guardar el borrador o dar entrada, con la marca «pendiente de revisar», una sola vez;
//   · si dar entrada falla después de crear, el reintento no vuelve a crear el proveedor;
//   · proveedor dudoso (parecido) → se pregunta; no se puede dar entrada sin decidir; «Sí, es …» recupera el catálogo aprendido;
//   · sin datos / es la propia empresa → se bloquea y se pide elegirlo a mano;
//   · usuario sin permiso para crear proveedores → no se crea;
//   · si la persona eligió un proveedor a mano y la foto dice otro conocido → aviso, y manda lo elegido;
//   · NIF leído y válido de un proveedor sin NIF → se ofrece guardarlo en la ficha (un clic);
//   · Proveedores: campo NIF, marca «Creado por IA · revisar», «Marcar como revisado», NIF inválido rechazado.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/alb/a02-albaran-proveedor-ia-ui-runtime.mjs
// ALB_A02_FUENTE (opcional) permite probar otro archivo (la versión anterior, que debe fallar, o variantes rotas de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules (react@18.3.1, react-dom@18.3.1 y jsdom).');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { url: 'https://preview.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.FileReader = dom.window.FileReader;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.ALB_A02_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { Albaranes, Proveedores, crearLogicaProveedores };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
process.on('unhandledRejection', (e) => { resultados.push({ nombre: 'RECHAZO NO CONTROLADO', ok: false, det: String((e && e.stack) || e).slice(0, 400) }); });
const esperar = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const texto = () => document.getElementById('raiz').textContent;
const botones = () => Array.from(document.querySelectorAll('button'));
const boton = (t) => botones().find((b) => b.textContent.includes(t));
async function clic(el, descripcion = '') {
  if (!el) throw new Error(`clic sobre un elemento que no existe (${descripcion}); texto actual: ` + texto().slice(-700));
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await esperar(60);
}
async function cambiarSelect(sel, valor) {
  await act(async () => {
    sel.value = valor;
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await esperar(30);
}
const selectConOpcion = (t) => Array.from(document.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => o.text.includes(t)));

const NIF_A = 'B12345617';
const NIF_B = 'A58818501';
const EMP = 'E1';
const DATOS = (extra = {}) => ({
  proveedorNombre: 'QUESOS LA ABUELA S.L.', proveedorCif: NIF_A, numeroAlbaran: 'A-100', fecha: '2026-10-07',
  lineas: [{ codigo: 'Q1', descripcion: 'QUESO CURADO', cantidad: 2, unidad: 'kg', precioUnitario: 10, descuentoPct: 0, iva: 10, importeLinea: 20, canon: 0 }],
  totalAlbaran: 22, confianza: 'alta', avisos: [], ...extra
});

const DATOS_CONTACTO = {
  proveedorNombre: 'QUESOS LA ABUELA S.L.', proveedorCif: 'b-12345617',
  proveedorDireccion: 'C/ Electricistas 7, 28670 Villaviciosa de Odón (Madrid)', proveedorTelefono: '91 616 57 45', proveedorEmail: 'VENTAS@quesos.com', proveedorWeb: 'WWW.quesos.com',
  condicionesPago: '60 DIAS', diasPago: null, clienteNombre: 'CHOCOLOYOS, S.L.', clienteCif: 'B87342077'
};
let raiz = null;
let ctrl = null;
// Arnés: se comporta como la aplicación respecto a proveedores y albaranes
async function montar({ proveedores = [], datosIA = DATOS(), puedeAlta = true, empresasPropias = [], confirmarFalla = false, catalogo = {} } = {}) {
  if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
  document.getElementById('raiz').innerHTML = '';
  ctrl = { guardados: [], rechazados: [], confirmados: [], catalogoLlamadas: [], auditoria: [], fetchs: 0, confirmarFalla, vista: null };
  globalThis.fetch = async () => { ctrl.fetchs += 1; return { json: async () => ({ ok: true, datos: datosIA }) }; };
  const Arnes = () => {
    const [provs, setProvs] = React.useState(proveedores.map((p) => ({ empresaId: EMP, ...p })));
    const [albs, setAlbs] = React.useState([]);
    const recientes = React.useRef(new Map());
    const proveedorPorId = (id) => provs.find((p) => p.id === id) || recientes.current.get(id);
    React.useEffect(() => { for (const p of provs) recientes.current.delete(p.id); }, [provs]);
    const logica = mod.crearLogicaProveedores({
      proveedores: provs, setProveedores: setProvs, empresaId: EMP, proveedoresRecientes: recientes.current,
      registrarAuditoria: (a, d) => ctrl.auditoria.push([a, d])
    });
    ctrl.vista = { provs, albs };
    const guardarAlbaran = (alb) => {
      // como el real: si el proveedor no existe en SU vista del estado, rechaza en silencio
      const prov = alb.proveedorId ? proveedorPorId(alb.proveedorId) : null;
      if (alb.proveedorId && (!prov || prov.empresaId !== EMP)) { ctrl.rechazados.push(alb); return false; }
      ctrl.guardados.push(JSON.parse(JSON.stringify(alb)));
      setAlbs((s) => { const e = s.some((a) => a.id === alb.id); return e ? s.map((a) => a.id === alb.id ? alb : a) : [alb, ...s]; });
      return true;
    };
    const confirmarAlbaran = (alb) => {
      if (ctrl.confirmarFalla) return { ok: false, error: 'Fallo simulado al dar entrada.' };
      const r = guardarAlbaran({ ...alb, estado: 'confirmado' });
      if (r === false) return { ok: false, error: 'proveedor rechazado' };
      ctrl.confirmados.push(JSON.parse(JSON.stringify(alb)));
      return [];
    };
    return React.createElement(mod.Albaranes, {
      albaranes: albs, proveedores: provs, productos: [], proveedorPorId,
      buscarEnCatalogo: (prov, cod) => { ctrl.catalogoLlamadas.push(prov); return catalogo[`${prov}:${cod}`] || null; },
      guardarAlbaran, eliminarAlbaran() {}, confirmarAlbaran, anularAlbaran() {}, marcarPagada() {},
      duplicadosDe: () => ({ albaran: null, factura: null }), desviacionesDePrecio: () => [],
      prefill: null, limpiarPrefill() {}, pedidoParaFotoIA: null, limpiarPedidoParaFotoIA() {}, pedidos: [],
      empresaId: EMP, empresasPropias, puedeAltaProveedorIA: puedeAlta,
      addProveedorDesdeAlbaran: logica.addProveedorDesdeAlbaran, asignarNifProveedor: logica.asignarNifProveedor, completarProveedorConDatos: logica.completarProveedorConDatosAlb
    });
  };
  raiz = createRoot(document.getElementById('raiz'));
  await act(async () => { raiz.render(React.createElement(Arnes)); });
  await esperar(50);
}
// Foto con IA → subir una foto → Leer con IA → queda el editor abierto
async function leerFoto({ manual = '' } = {}) {
  await clic(boton('Foto con IA'), 'Foto con IA');
  const selModal = selectConOpcion('Detectar por la foto');
  if (!selModal) throw new Error('no hay selector «Detectar por la foto» en el modal; texto: ' + texto().slice(-500));
  if (manual) await cambiarSelect(selModal, manual);
  const input = document.querySelector('input[type=file]');
  const archivo = new dom.window.File(['x'], 'albaran.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  await act(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  await esperar(120);
  await clic(boton('Leer con IA'), 'Leer con IA');
  await esperar(200);
}
const selectEditor = () => selectConOpcion('Selecciona');
const proveedoresVista = () => ctrl.vista.provs;

async function escenario(nombre, fn) {
  try { await fn(); } catch (e) { resultados.push({ nombre: `${nombre} — EXCEPCIÓN`, ok: false, det: String((e && e.stack) || e).slice(0, 700) }); }
}

// ===== S1: proveedor que ya existe (por NIF) =====
await escenario('S1', async () => {
  await montar({ proveedores: [{ id: 'p1', nombre: 'Quesería de siempre', nif: NIF_A }] });
  await leerFoto();
  ok('S1 el modal ya no obliga a elegir proveedor y ofrece detectar', true);
  ok('S1 se reconoce el proveedor por NIF', texto().includes('Proveedor reconocido') && texto().includes('por su NIF/CIF'), texto().slice(-600));
  ok('S1 el selector del editor ya apunta al proveedor reconocido', selectConOpcion('Quesería de siempre') && Array.from(document.querySelectorAll('select')).some((s) => s.value === 'p1'), '');
  await clic(boton('Guardar como borrador'), 'Guardar como borrador');
  ok('S1 se guarda con el proveedor existente', ctrl.guardados.at(-1)?.proveedorId === 'p1', JSON.stringify(ctrl.guardados.at(-1)));
  ok('S1 no se crea ningún proveedor', proveedoresVista().length === 1 && !ctrl.auditoria.length, JSON.stringify(ctrl.auditoria));
  ok('S1 se usó el catálogo del proveedor reconocido', ctrl.catalogoLlamadas.includes('p1'), JSON.stringify(ctrl.catalogoLlamadas));
});

// ===== S2: proveedor nuevo → se crea al guardar el borrador, una sola vez =====
await escenario('S2', async () => {
  await montar({ proveedores: [] });
  await leerFoto();
  ok('S2 avisa de proveedor nuevo', texto().includes('Proveedor nuevo detectado') && texto().includes('Quesos la Abuela S.L.') && texto().includes(NIF_A), texto().slice(-700));
  ok('S2 todavía NO se ha creado nada', proveedoresVista().length === 0, JSON.stringify(proveedoresVista()));
  ok('S2 el selector dice en corto que es nuevo (el texto largo se cortaba en el móvil)', !!selectConOpcion('Nuevo: Quesos la Abuela S.L.') && !selectConOpcion('se dará de alta'), '');
  await clic(boton('Guardar como borrador'), 'Guardar como borrador');
  const prov = proveedoresVista()[0];
  ok('S2 se crea un proveedor', proveedoresVista().length === 1, JSON.stringify(proveedoresVista()));
  ok('S2 con nombre, NIF y marca de pendiente de revisar', prov && prov.nombre === 'Quesos la Abuela S.L.' && prov.nif === NIF_A && prov.pendienteRevision === true && prov.creadoPorIA === true && prov.empresaId === EMP, JSON.stringify(prov));
  ok('S2 el borrador se guarda con el proveedor recién creado (no se pierde en silencio)', ctrl.guardados.at(-1)?.proveedorId === prov?.id && ctrl.rechazados.length === 0, JSON.stringify({ g: ctrl.guardados.at(-1), r: ctrl.rechazados.length }));
  ok('S2 la tarjeta confirma el alta', texto().includes('dado de alta automáticamente') && texto().includes('pendiente de revisar'), texto().slice(-700));
  ok('S2 queda auditado', ctrl.auditoria.some((a) => a[0].startsWith('Alta automática de proveedor')), JSON.stringify(ctrl.auditoria));
  await clic(boton('Guardar como borrador'), 'Guardar como borrador (2)');
  ok('S2 guardar otra vez NO crea otro proveedor', proveedoresVista().length === 1, JSON.stringify(proveedoresVista()));
});

// ===== S3: proveedor nuevo → se crea al dar entrada =====
await escenario('S3', async () => {
  await montar({ proveedores: [] });
  await leerFoto();
  await clic(boton('Dar entrada al almacén'), 'Dar entrada');
  const prov = proveedoresVista()[0];
  ok('S3 se crea el proveedor al dar entrada', proveedoresVista().length === 1 && prov.pendienteRevision === true, JSON.stringify(proveedoresVista()));
  ok('S3 la entrada se registra con ese proveedor', ctrl.confirmados.length === 1 && ctrl.confirmados[0].proveedorId === prov?.id && ctrl.rechazados.length === 0, JSON.stringify({ c: ctrl.confirmados.length, r: ctrl.rechazados.length }));
  ok('S3 la lista avisa del alta automática', texto().includes('Se ha dado de alta el proveedor') && texto().includes('Quesos la Abuela S.L.'), texto().slice(-600));
  await clic(boton('Entendido'), 'Entendido');
  ok('S3 el aviso se puede cerrar', !texto().includes('Se ha dado de alta el proveedor'), '');
});

// ===== S4: dar entrada falla después de crear → el reintento no duplica =====
await escenario('S4', async () => {
  await montar({ proveedores: [], confirmarFalla: true });
  await leerFoto();
  await clic(boton('Dar entrada al almacén'), 'Dar entrada (falla)');
  ok('S4 el proveedor se creó una vez aunque la entrada falló', proveedoresVista().length === 1, JSON.stringify(proveedoresVista()));
  ok('S4 se muestra el error de la entrada', texto().includes('Fallo simulado'), texto().slice(-500));
  ctrl.confirmarFalla = false;
  await clic(boton('Dar entrada al almacén'), 'Dar entrada (reintento)');
  ok('S4 el reintento NO crea otro proveedor', proveedoresVista().length === 1, JSON.stringify(proveedoresVista()));
  ok('S4 y la entrada se registra', ctrl.confirmados.length === 1, JSON.stringify(ctrl.confirmados.length));
});

// ===== S5: proveedor parecido → se pregunta =====
await escenario('S5', async () => {
  await montar({
    proveedores: [{ id: 'p2', nombre: 'QUESOS LA ABUELA' }],
    datosIA: DATOS({ proveedorNombre: 'Quesos La Abuelo', proveedorCif: '' }),
    catalogo: { 'p2:Q1': { productoId: 'PR1', unidad: 'kg' } }
  });
  await leerFoto();
  ok('S5 se pregunta si es el parecido', texto().includes('Se parece a un proveedor que ya tienes') && !!boton('Sí, es QUESOS LA ABUELA') && !!boton('No, es un proveedor nuevo'), texto().slice(-800));
  await clic(boton('Dar entrada al almacén'), 'Dar entrada sin decidir');
  ok('S5 sin decidir NO se da entrada ni se crea nada', ctrl.confirmados.length === 0 && proveedoresVista().length === 1 && texto().includes('Confirma si el proveedor'), texto().slice(-600));
  await clic(boton('Sí, es QUESOS LA ABUELA'), 'Sí, es');
  await clic(boton('Guardar como borrador'), 'Guardar como borrador');
  const g = ctrl.guardados.at(-1);
  ok('S5 «Sí, es …» asigna el proveedor existente', g?.proveedorId === 'p2' && proveedoresVista().length === 1, JSON.stringify(g));
  ok('S5 y recupera lo aprendido de su catálogo', g?.lineas?.[0]?.productoId === 'PR1', JSON.stringify(g?.lineas?.[0]));
});
await escenario('S5b', async () => {
  await montar({ proveedores: [{ id: 'p2', nombre: 'QUESOS LA ABUELA' }], datosIA: DATOS({ proveedorNombre: 'Quesos La Abuelo', proveedorCif: '' }) });
  await leerFoto();
  await clic(boton('No, es un proveedor nuevo'), 'No, es nuevo');
  ok('S5b «No, es nuevo» pasa a proveedor nuevo y aún no crea nada', texto().includes('Proveedor nuevo detectado') && proveedoresVista().length === 1, texto().slice(-500));
  await clic(boton('Dar entrada al almacén'), 'Dar entrada');
  ok('S5b al dar entrada se crea el nuevo (2 proveedores)', proveedoresVista().length === 2 && ctrl.confirmados.length === 1, JSON.stringify(proveedoresVista().map((p) => p.nombre)));
});

// ===== S6: sin datos → elegir a mano =====
await escenario('S6', async () => {
  await montar({ proveedores: [{ id: 'p1', nombre: 'Uno' }], datosIA: DATOS({ proveedorNombre: null, proveedorCif: null }) });
  await leerFoto();
  ok('S6 avisa de que no se identificó', texto().includes('No he podido identificar al proveedor'), texto().slice(-600));
  await clic(boton('Dar entrada al almacén'), 'Dar entrada sin proveedor');
  ok('S6 no se da entrada sin proveedor', ctrl.confirmados.length === 0 && texto().includes('Selecciona el proveedor.'), texto().slice(-500));
  await cambiarSelect(selectEditor(), 'p1');
  await clic(boton('Dar entrada al almacén'), 'Dar entrada con proveedor elegido');
  ok('S6 elegido a mano, se da entrada', ctrl.confirmados.length === 1 && ctrl.confirmados[0].proveedorId === 'p1', JSON.stringify(ctrl.confirmados));
});

// ===== S7: la IA leyó la propia empresa =====
await escenario('S7', async () => {
  await montar({ proveedores: [], empresasPropias: [{ id: EMP, razonSocial: 'Chocoloyos S.L.', nif: NIF_B }], datosIA: DATOS({ proveedorNombre: 'CHOCOLOYOS SL', proveedorCif: NIF_B }) });
  await leerFoto();
  ok('S7 avisa de que leyó a la propia empresa', texto().includes('tu propia empresa'), texto().slice(-600));
  await clic(boton('Dar entrada al almacén'), 'Dar entrada');
  ok('S7 no crea a la propia empresa como proveedor', proveedoresVista().length === 0 && ctrl.confirmados.length === 0, JSON.stringify(proveedoresVista()));
});

// ===== S8: usuario sin permiso para crear proveedores =====
await escenario('S8', async () => {
  await montar({ proveedores: [], puedeAlta: false });
  await leerFoto();
  ok('S8 explica que no puede crear proveedores', texto().includes('tu usuario no puede crear proveedores'), texto().slice(-600));
  await clic(boton('Dar entrada al almacén'), 'Dar entrada');
  ok('S8 no crea el proveedor ni da entrada', proveedoresVista().length === 0 && ctrl.confirmados.length === 0 && texto().includes('no puede crearlo'), texto().slice(-600));
});

// ===== S9: proveedor elegido a mano y la foto dice otro conocido =====
await escenario('S9', async () => {
  await montar({ proveedores: [{ id: 'p1', nombre: 'Quesería de siempre', nif: NIF_A }, { id: 'p2', nombre: 'Otro proveedor' }] });
  await leerFoto({ manual: 'p2' });
  ok('S9 avisa de que la foto parece de otro proveedor', texto().includes('La foto parece de') && texto().includes('Quesería de siempre') && texto().includes('Otro proveedor'), texto().slice(-700));
  await clic(boton('Guardar como borrador'), 'Guardar como borrador');
  ok('S9 manda lo elegido a mano', ctrl.guardados.at(-1)?.proveedorId === 'p2', JSON.stringify(ctrl.guardados.at(-1)));
});

// ===== S10: proveedor reconocido por nombre con la ficha vacía → ofrecer completarla con los datos de la foto =====
await escenario('S10', async () => {
  await montar({ proveedores: [{ id: 'p1', nombre: 'Quesos La Abuela' }], datosIA: DATOS(DATOS_CONTACTO) });
  await leerFoto();
  ok('S10 reconocido por el nombre y se ofrece completar la ficha', texto().includes('por el nombre') && texto().includes('La ficha de este proveedor no tiene estos datos y la foto los trae') && !!boton('Completar su ficha con los datos de la foto'), texto().slice(-800));
  ok('S10 la tarjeta enseña qué datos traería', texto().includes('NIF/CIF: ' + NIF_A) && texto().includes('dirección: C/ Electricistas 7, 28670 Villaviciosa de Odón') && texto().includes('teléfono: 91 616 57 45') && texto().includes('correo: ventas@quesos.com') && texto().includes('condiciones de pago: 60 días') && texto().includes('días de pago: 60'), texto().slice(-900));
  ok('S10 todavía no ha tocado la ficha', proveedoresVista()[0].nif === undefined && proveedoresVista()[0].telefono === undefined, JSON.stringify(proveedoresVista()[0]));
  await clic(boton('Completar su ficha con los datos de la foto'), 'Completar ficha');
  const f = proveedoresVista()[0];
  ok('S10 la ficha queda completa', f.nif === NIF_A && f.direccion.startsWith('C/ Electricistas 7') && f.telefono === '91 616 57 45' && f.email === 'ventas@quesos.com' && f.web === 'www.quesos.com' && f.condiciones === '60 días' && f.diasPago === 60, JSON.stringify(f));
  ok('S10 lo dice y ya no ofrece lo mismo', texto().includes('Ficha completada:') && !boton('Completar su ficha con los datos de la foto'), texto().slice(-700));
  ok('S10 queda auditado', ctrl.auditoria.some((a) => a[0] === 'Completar ficha de proveedor con los datos de la foto del albarán'), JSON.stringify(ctrl.auditoria));
});

// ===== S10b: lo que la ficha ya tiene NO se pisa =====
await escenario('S10b', async () => {
  await montar({ proveedores: [{ id: 'p1', nombre: 'Quesos La Abuela', nif: NIF_A, telefono: '600 000 000', email: 'otro@correo.es', direccion: 'Mi dirección', web: 'mi.web.es', condiciones: 'Contado', diasPago: 7 }], datosIA: DATOS(DATOS_CONTACTO) });
  await leerFoto();
  ok('S10b con la ficha ya completa no se ofrece nada', !boton('Completar su ficha con los datos de la foto') && texto().includes('Proveedor reconocido'), texto().slice(-600));
  ok('S10b y la ficha queda intacta', proveedoresVista()[0].telefono === '600 000 000' && proveedoresVista()[0].diasPago === 7, JSON.stringify(proveedoresVista()[0]));
});

// ===== S13: proveedor NUEVO con todos los datos de la foto =====
await escenario('S13', async () => {
  await montar({ proveedores: [], datosIA: DATOS(DATOS_CONTACTO) });
  await leerFoto();
  ok('S13 antes de crear enseña lo que se guardará', texto().includes('Se guardará también:') && texto().includes('teléfono: 91 616 57 45') && texto().includes('web: www.quesos.com'), texto().slice(-900));
  await clic(boton('Dar entrada al almacén'), 'Dar entrada');
  const f = proveedoresVista()[0];
  ok('S13 el proveedor nace con toda su ficha', proveedoresVista().length === 1 && f.nif === NIF_A && f.direccion.startsWith('C/ Electricistas 7') && f.telefono === '91 616 57 45' && f.email === 'ventas@quesos.com' && f.web === 'www.quesos.com' && f.condiciones === '60 días' && f.diasPago === 60 && f.pendienteRevision === true, JSON.stringify(f));
  ok('S13 y la entrada se registra', ctrl.confirmados.length === 1 && ctrl.rechazados.length === 0, '');
});

// ===== S14: la IA devuelve como NIF del proveedor el del cliente (la propia empresa) =====
await escenario('S14', async () => {
  await montar({ proveedores: [], datosIA: DATOS({ proveedorCif: 'B87342077', clienteCif: 'B-87342077', clienteNombre: 'CHOCOLOYOS, S.L.' }) });
  await leerFoto();
  ok('S14 avisa de que ese NIF es el del cliente', texto().includes('es el del cliente') && texto().includes('no se guardará'), texto().slice(-700));
  await clic(boton('Guardar como borrador'), 'Guardar como borrador');
  ok('S14 el proveedor se crea SIN ese NIF', proveedoresVista().length === 1 && !proveedoresVista()[0].nif, JSON.stringify(proveedoresVista()[0]));
});

// ===== S11: pantalla Proveedores =====
await escenario('S11', async () => {
  if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
  document.getElementById('raiz').innerHTML = '';
  const registro = [];
  const Arnes2 = () => {
    const [provs, setProvs] = React.useState([
      { id: 'a', empresaId: EMP, nombre: 'Quesos la Abuela S.L.', nif: NIF_A, direccion: 'C/ Mayor 1, Madrid', web: 'www.abuela.es', pendienteRevision: true, creadoPorIA: true },
      { id: 'b', empresaId: EMP, nombre: 'Manual', cif: NIF_B }
    ]);
    registro.vista = provs;
    const l = mod.crearLogicaProveedores({ proveedores: provs, setProveedores: setProvs, empresaId: EMP, registrarAuditoria() {} });
    return React.createElement(mod.Proveedores, { proveedores: provs, addProveedor: l.addProveedor, updateProveedor: l.updateProveedor, deleteProveedor: l.deleteProveedor, marcarProveedorRevisado: l.marcarProveedorRevisado, pedidos: [] });
  };
  raiz = createRoot(document.getElementById('raiz'));
  await act(async () => { raiz.render(React.createElement(Arnes2)); });
  await esperar(50);
  ok('S11 aviso de pendientes de revisar', texto().includes('1 proveedor(es) se dieron de alta automáticamente'), texto().slice(0, 500));
  ok('S11 marca «Creado por IA · revisar» solo en el creado por IA', texto().split('Creado por IA').length === 2, texto().slice(0, 600));
  ok('S11 muestra el NIF/CIF (incluido el guardado como cif antiguo)', texto().includes(`NIF/CIF: ${NIF_A}`) && texto().includes(`NIF/CIF: ${NIF_B}`), texto().slice(0, 600));
  await clic(boton('Marcar como revisado'), 'Marcar como revisado');
  ok('S11 «Marcar como revisado» quita la marca y el aviso', registro.vista[0].pendienteRevision === false && !texto().includes('Creado por IA') && !texto().includes('se dieron de alta automáticamente'), JSON.stringify(registro.vista[0]));
  // edición: NIF inválido rechazado, válido aceptado y normalizado
  ok('S11 las tarjetas enseñan dirección y web cuando las hay', texto().includes('C/ Mayor 1, Madrid') && texto().includes('www.abuela.es'), texto().slice(0, 700));
  await clic(botones().filter((b) => b.textContent.trim() === 'Editar')[1], 'Editar');
  ok('S11 la edición tiene los campos Dirección y Web', texto().includes('Dirección (opcional)') && texto().includes('Web (opcional)'), '');
  const inputNif = Array.from(document.querySelectorAll('input')).find((i) => i.value === NIF_B);
  ok('S11 la edición muestra el NIF/CIF actual (cif antiguo incluido)', !!inputNif, '');
  const poner = async (el, v) => { await act(async () => { const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); await esperar(20); };
  await poner(inputNif, 'B12345608');
  await clic(boton('Guardar cambios'), 'Guardar cambios (NIF malo)');
  ok('S11 un NIF con dígito de control incorrecto se rechaza', texto().includes('El NIF/CIF no es válido') && registro.vista[1].nif === undefined, texto().slice(-500));
  await poner(Array.from(document.querySelectorAll('input')).find((i) => i.value === 'B12345608'), NIF_A);
  await clic(boton('Guardar cambios'), 'Guardar cambios (NIF de otro proveedor)');
  ok('S11 un NIF que ya es de otro proveedor se rechaza diciendo de cuál', texto().includes('Ya tienes un proveedor con ese NIF/CIF: Quesos la Abuela S.L.') && registro.vista[1].nif === undefined, texto().slice(-500));
  await poner(Array.from(document.querySelectorAll('input')).find((i) => i.value === NIF_A), ' b-12345625 ');
  await clic(boton('Guardar cambios'), 'Guardar cambios (NIF bueno)');
  ok('S11 un NIF válido y libre se guarda normalizado', registro.vista[1].nif === 'B12345625', JSON.stringify(registro.vista[1]));
});

if (raiz) { await act(async () => { raiz.unmount(); }); }
const fallos = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.nombre}${r.ok ? '' : '\n      → ' + r.det}`);
console.log(`\nALB_A02_RESULTADO ${resultados.length - fallos.length}/${resultados.length}`);
if (fallos.length) { console.error('ALB_A02_ALBARAN_PROVEEDOR_IA_UI_RUNTIME=FAIL'); process.exit(1); }
console.log('ALB_A02_ALBARAN_PROVEEDOR_IA_UI_RUNTIME=PASS');
process.exit(0);
