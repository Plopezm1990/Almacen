import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/';
const out = [];
const failures = [];
const log = (...x) => { const s=x.join(' '); console.log(s); out.push(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function check(cond, label, detail='') {
  if (cond) log(`[OK] ${label}${detail ? ': '+detail : ''}`);
  else { log(`[FAIL] ${label}${detail ? ': '+detail : ''}`); failures.push(label); }
}

const empresas = [
  {id:'emp-a', razonSocial:'EMPRESA A, S.L.', nif:'A00000001', marca:'Marca A', nombreComercial:'Marca A', activo:true},
  {id:'emp-b', razonSocial:'EMPRESA B, S.L.', nif:'B00000002', marca:'Marca B', nombreComercial:'Marca B', activo:true},
];
const locales = [
  {id:'a1', nombre:'Local A1', direccion:'Calle A1', empresaId:'emp-a', activo:true},
  {id:'a2', nombre:'Local A2', direccion:'Calle A2', empresaId:'emp-a', activo:true},
  {id:'a-old', nombre:'Local A cerrado', direccion:'Calle antigua', empresaId:'emp-a', activo:false},
  {id:'b1', nombre:'Local B1', direccion:'Calle B1', empresaId:'emp-b', activo:true},
];
const productos = [
  {id:'pa1', localId:'a1', nombre:'Harina origen A1', unidad:'kg', stock:10, stockPisoVenta:3, stockMinimo:0, stockMinimoPisoVenta:0, deficitPendiente:0, tipo:'elaborado', precioVenta:1, activo:true},
  {id:'pdef', localId:'a1', nombre:'Producto con déficit A1', unidad:'kg', stock:5, stockPisoVenta:0, stockMinimo:0, stockMinimoPisoVenta:0, deficitPendiente:1, tipo:'materia_prima', activo:true},
  {id:'pa2', localId:'a2', nombre:'Harina destino A2', unidad:'kg', stock:4, stockPisoVenta:1, stockMinimo:0, stockMinimoPisoVenta:0, deficitPendiente:0, tipo:'materia_prima', activo:true},
  {id:'pa2ud', localId:'a2', nombre:'Producto incompatible A2', unidad:'ud', stock:50, stockPisoVenta:0, stockMinimo:0, stockMinimoPisoVenta:0, deficitPendiente:0, tipo:'materia_prima', activo:true},
  {id:'pb1', localId:'b1', nombre:'Harina empresa B', unidad:'kg', stock:99, stockPisoVenta:0, stockMinimo:0, stockMinimoPisoVenta:0, deficitPendiente:0, tipo:'materia_prima', activo:true},
];

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:412,height:915}, locale:'es-ES'});
const page = await context.newPage();
await page.addInitScript(() => {
  window.addEventListener('error', e => {
    console.error('[audit-window-error]', e.message, e.filename, e.lineno, e.colno, e.error?.stack || '');
  });
});
page.on('pageerror', e => log('[pageerror]', e.stack || e.message));
page.on('console', msg => { if (msg.type()==='error') log('[console error]', msg.text()); });

async function enterLocal() {
  await sleep(900);
  const b = page.getByText(/Trabajar solo en este equipo|sin sincronizar|solo en este equipo/i).first();
  if (await b.isVisible().catch(()=>false)) { await b.click({force:true}); await sleep(1500); }
}
async function seed() {
  await page.goto(url+'?traspasoseed='+Date.now(), {waitUntil:'domcontentloaded'});
  await page.evaluate(({empresas,locales,productos}) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('almacen:') || k.startsWith('almacen__')) localStorage.removeItem(k);
    const set=(k,v)=>localStorage.setItem('almacen:'+k, JSON.stringify(v));
    set('empresas', empresas); set('locales', locales); set('localActivoId', 'a1');
    set('productos', productos); set('movimientos', []); set('traspasos', []); set('fichasCosto', []);
    set('proveedores', []); set('pedidos', []); set('albaranes', []); set('conteos', []); set('facturasDirectas', []);
    localStorage.setItem('almacen__pendientes','[]');
  }, {empresas,locales,productos});
  await page.reload({waitUntil:'domcontentloaded'});
  await enterLocal();
  await sleep(1000);
}
async function body() { return (await page.locator('body').innerText()).replace(/\s+/g,' '); }
async function navExact(label) {
  const nodes = page.locator('button,a,[role="button"]').filter({hasText:label});
  for (let i=0;i<await nodes.count();i++) {
    const el=nodes.nth(i);
    if (!(await el.isVisible().catch(()=>false))) continue;
    const t=(await el.innerText().catch(()=>'')).replace(/\s+/g,' ').trim();
    if (t===label || t.startsWith(label)) { await el.click({force:true}); await sleep(900); return true; }
  }
  return false;
}
async function optionTexts(select) { return (await select.locator('option').allTextContents()).map(x=>x.replace(/\s+/g,' ').trim()); }
async function findSelectByOption(text) {
  const selects=page.locator('select');
  for(let i=0;i<await selects.count();i++) {
    const s=selects.nth(i);
    if (!(await s.isVisible().catch(()=>false))) continue;
    const opts=await optionTexts(s);
    if (opts.some(x=>x.includes(text))) return s;
  }
  return null;
}
async function findSelectByAllOptions(texts) {
  const selects=page.locator('select');
  for(let i=0;i<await selects.count();i++) {
    const s=selects.nth(i);
    if (!(await s.isVisible().catch(()=>false))) continue;
    const opts=await optionTexts(s);
    if (texts.every(text => opts.some(x=>x.includes(text)))) return s;
  }
  return null;
}
async function readData(key) {
  return page.evaluate(k => JSON.parse(localStorage.getItem('almacen:'+k) || '[]'), key);
}
async function product(id) { return (await readData('productos')).find(p=>p.id===id); }

await seed();
check(await navExact('Traspasos'), 'abre el módulo Traspasos');
let txt=await body();
check(txt.includes('Entre locales'), 'muestra la nueva sección Entre locales');
check(txt.includes('Dentro de este local'), 'conserva el traspaso almacén ↔ piso');

const destSelect = await findSelectByOption('Local A2');
check(!!destSelect, 'selector de destino ofrece Local A2');
if (destSelect) {
  const opts=await optionTexts(destSelect);
  check(!opts.some(x=>x.includes('Local B1')), 'selector de destino excluye empresa B');
  check(!opts.some(x=>x.includes('Local A cerrado')), 'selector de destino excluye local inactivo');
}

const sourceSelect = await findSelectByAllOptions(['Harina origen A1', 'Producto con déficit A1']);
check(!!sourceSelect, 'selector inter-local de origen usa productos del local activo');
const targetSelect = await findSelectByOption('Harina destino A2');
check(!!targetSelect, 'selector de producto destino ofrece producto compatible de A2');
if (targetSelect) {
  const opts=await optionTexts(targetSelect);
  check(!opts.some(x=>x.includes('Producto incompatible A2')), 'producto destino excluye unidad incompatible');
  check(!opts.some(x=>x.includes('Harina empresa B')), 'producto destino excluye productos de otra empresa');
}

const numberInputs=page.locator('input[type="number"]');
check((await numberInputs.count()) >= 2, 'hay cantidades separadas para movimiento interno e inter-local');
if (sourceSelect) await sourceSelect.selectOption('pa1');
await sleep(300);
const targetSelect2 = await findSelectByOption('Harina destino A2');
if (targetSelect2) await targetSelect2.selectOption('pa2');
if ((await numberInputs.count()) >= 2) await numberInputs.nth(1).fill('2');
const btnInter=page.getByRole('button',{name:/Confirmar traspaso entre locales/i}).first();
check(await btnInter.isVisible().catch(()=>false), 'botón de confirmación inter-local disponible');
if (await btnInter.isVisible().catch(()=>false)) { await btnInter.click({force:true}); await sleep(900); }

let p1=await product('pa1'), p2=await product('pa2');
check(Number(p1?.stock)===8, 'salida descuenta 2 del stock total de A1', `stock=${p1?.stock}`);
check(Number(p1?.stockPisoVenta)===3, 'salida no toca piso de venta de A1', `piso=${p1?.stockPisoVenta}`);
check(Number(p2?.stock)===6, 'entrada suma 2 al stock total de A2', `stock=${p2?.stock}`);
check(Number(p2?.stockPisoVenta)===1, 'entrada no toca piso de venta de A2', `piso=${p2?.stockPisoVenta}`);
check(Number(p1?.stock)+Number(p2?.stock)===14, 'traspaso conserva el stock total combinado A1+A2');

let traspasos=await readData('traspasos');
const inter=traspasos.find(t=>t.tipo==='ENTRE_LOCALES');
check(!!inter, 'guarda registro ENTRE_LOCALES');
check(inter?.origenLocalId==='a1' && inter?.destinoLocalId==='a2', 'registro guarda origen y destino correctos');
check(inter?.productoOrigenId==='pa1' && inter?.productoDestinoId==='pa2', 'registro guarda ambos productos explícitos');
let movimientos=await readData('movimientos');
const salida=movimientos.find(m=>m.tipo==='TRASPASO_ENTRE_LOCALES_SALIDA');
const entrada=movimientos.find(m=>m.tipo==='TRASPASO_ENTRE_LOCALES_ENTRADA');
check(salida?.localId==='a1' && Number(salida?.cantidad)===-2, 'movimiento de salida queda en A1');
check(entrada?.localId==='a2' && Number(entrada?.cantidad)===2, 'movimiento de entrada queda en A2');

if ((await numberInputs.count()) >= 2) await numberInputs.nth(1).fill('99');
if (await btnInter.isVisible().catch(()=>false)) { await btnInter.click({force:true}); await sleep(500); }
txt=await body();
check(/Solo hay .* disponibles en el almacén/i.test(txt), 'bloquea cantidad superior al almacén disponible');
p1=await product('pa1'); p2=await product('pa2');
check(Number(p1?.stock)===8 && Number(p2?.stock)===6, 'intento inválido no altera stock');

if (sourceSelect) await sourceSelect.selectOption('pdef');
await sleep(400);
const targetAfterDef=await findSelectByOption('Harina destino A2');
if (targetAfterDef) await targetAfterDef.selectOption('pa2');
if ((await numberInputs.count()) >= 2) await numberInputs.nth(1).fill('1');
if (await btnInter.isVisible().catch(()=>false)) { await btnInter.click({force:true}); await sleep(500); }
txt=await body();
check(/déficit de stock pendiente/i.test(txt), 'bloquea traspaso si existe déficit pendiente');
const pdef=await product('pdef'); p2=await product('pa2');
check(Number(pdef?.stock)===5 && Number(p2?.stock)===6, 'bloqueo por déficit no altera stock');

const selects=page.locator('select');
let internal=null;
for(let i=0;i<await selects.count();i++) {
  const s=selects.nth(i); if(!(await s.isVisible().catch(()=>false))) continue;
  const opts=await optionTexts(s);
  if(opts.some(x=>x.includes('Harina origen A1')) && !opts.some(x=>x.includes('Producto con déficit A1'))) { internal=s; break; }
}
if (internal) await internal.selectOption('pa1');
check(!!internal, 'localiza selector del movimiento interno');
if ((await numberInputs.count()) >= 1) await numberInputs.nth(0).fill('1');
const btnInternal=page.getByRole('button',{name:/Confirmar movimiento/i}).first();
if (await btnInternal.isVisible().catch(()=>false)) { await btnInternal.click({force:true}); await sleep(700); }
p1=await product('pa1');
check(Number(p1?.stock)===8, 'movimiento interno no cambia stock total');
check(Number(p1?.stockPisoVenta)===4, 'movimiento interno sigue sumando al piso de venta');

await page.evaluate(() => localStorage.setItem('almacen:localActivoId', JSON.stringify('a2')));
await page.reload({waitUntil:'domcontentloaded'});
await enterLocal();
await sleep(1000);
check(await navExact('Traspasos'), 'A2 puede abrir Traspasos tras recargar como local activo');
txt=await body();
check(txt.includes('Local A1 → Local A2'), 'A2 ve la ruta del traspaso en su historial');
check(/Entrada .*Harina origen A1 .*Harina destino A2/i.test(txt), 'A2 identifica el traspaso como entrada');

await page.screenshot({path:'traspasos-multilocal-audit.png',fullPage:true});
fs.writeFileSync('traspasos-multilocal-audit.txt', out.join('\n'));
await browser.close();
log('Fallos:', failures.length);
if (failures.length) process.exitCode=2;
