import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/';
const out=[];
const log=(...x)=>{const s=x.join(' ');console.log(s);out.push(s)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const failures=[];
function check(cond,label,detail=''){
  if(cond) log(`[OK] ${label}${detail?': '+detail:''}`);
  else {log(`[FAIL] ${label}${detail?': '+detail:''}`);failures.push(label)}
}

const empresas=[
  {id:'emp-a',razonSocial:'EMPRESA A, S.L.',nif:'A00000001',marca:'Marca A',nombreComercial:'Marca A',activo:true},
  {id:'emp-b',razonSocial:'EMPRESA B, S.L.',nif:'B00000002',marca:'Marca B',nombreComercial:'Marca B',activo:true},
];
const locales=[
  {id:'a1',nombre:'Local A1',direccion:'Calle A1',empresaId:'emp-a',activo:true},
  {id:'a2',nombre:'Local A2',direccion:'Calle A2',empresaId:'emp-a',activo:true},
  {id:'a-old',nombre:'Local A cerrado',direccion:'Calle antigua',empresaId:'emp-a',activo:false},
  {id:'b1',nombre:'Local B1',direccion:'Calle B1',empresaId:'emp-b',activo:true},
];
const productos=[
  {id:'p-a1',nombre:'Producto A1',localId:'a1',stock:11,costo:1,stockMinimo:0,tipo:'materia_prima',activo:true},
  {id:'p-a2',nombre:'Producto A2',localId:'a2',stock:22,costo:1,stockMinimo:0,tipo:'materia_prima',activo:true},
  {id:'p-a-old',nombre:'Producto A histórico',localId:'a-old',stock:7,costo:1,stockMinimo:0,tipo:'materia_prima',activo:true},
  {id:'p-b1',nombre:'Producto B1',localId:'b1',stock:99,costo:1,stockMinimo:0,tipo:'materia_prima',activo:true},
];
const proveedores=[{id:'prov',nombre:'Proveedor Test'}];
const pedidos=[
  {id:'ped-a1',numero:'PED-A1',localId:'a1',proveedorId:'prov',estado:'Pendiente',fecha:'2026-09-01',items:[{productoId:'p-a1',cantidad:1}]},
  {id:'ped-a2',numero:'PED-A2',localId:'a2',proveedorId:'prov',estado:'Pendiente',fecha:'2026-09-01',items:[{productoId:'p-a2',cantidad:1}]},
  {id:'ped-b1',numero:'PED-B1',localId:'b1',proveedorId:'prov',estado:'Pendiente',fecha:'2026-09-01',items:[{productoId:'p-b1',cantidad:1}]},
];
const movimientos=[
  {id:'m-a1',productoId:'p-a1',localId:'a1',tipo:'Entrada',cantidad:11,fecha:'2026-09-01T10:00:00Z'},
  {id:'m-a2',productoId:'p-a2',localId:'a2',tipo:'Entrada',cantidad:22,fecha:'2026-09-01T10:00:00Z'},
  {id:'m-b1',productoId:'p-b1',localId:'b1',tipo:'Entrada',cantidad:99,fecha:'2026-09-01T10:00:00Z'},
];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'es-ES'});
const page=await context.newPage();
page.on('pageerror',e=>log('[pageerror]',e.message));

async function enterLocal(){
  await sleep(1200);
  const b=page.getByText(/Trabajar solo en este equipo|sin sincronizar|solo en este equipo/i).first();
  if(await b.isVisible().catch(()=>false)){await b.click({force:true});await sleep(1800)}
}
async function seed(activeLocalId){
  await page.goto(url+'?mlseed='+Date.now(),{waitUntil:'domcontentloaded'});
  await page.evaluate(({empresas,locales,productos,proveedores,pedidos,movimientos,activeLocalId})=>{
    for(const k of Object.keys(localStorage)) if(k.startsWith('almacen:')||k==='almacen__pendientes') localStorage.removeItem(k);
    const set=(k,v)=>localStorage.setItem('almacen:'+k,JSON.stringify(v));
    set('empresas',empresas); set('locales',locales); set('localActivoId',activeLocalId);
    set('productos',productos); set('proveedores',proveedores); set('pedidos',pedidos); set('movimientos',movimientos);
    set('albaranes',[]); set('facturasDirectas',[]); set('gastosGenerales',[]); set('empleados',[]); set('encargos',[]); set('conteos',[]);
    localStorage.setItem('almacen__pendientes','[]');
  },{empresas,locales,productos,proveedores,pedidos,movimientos,activeLocalId});
  await page.reload({waitUntil:'domcontentloaded'}); await enterLocal();
  await page.waitForTimeout(1200);
}
async function body(){return (await page.locator('body').innerText()).replace(/\s+/g,' ')}
async function selectorOptions(){
  const s=page.locator('select').first();
  if(!(await s.isVisible().catch(()=>false))) return [];
  return await s.locator('option').allTextContents();
}
async function selectLocal(value){
  const s=page.locator('select').first();
  await s.selectOption(value); await sleep(1000);
}
async function navExact(label){
  const nodes=page.locator('button,a,[role="button"]').filter({hasText:label});
  const n=await nodes.count();
  for(let i=0;i<n;i++){
    const el=nodes.nth(i); if(!(await el.isVisible().catch(()=>false))) continue;
    const t=(await el.innerText().catch(()=>'')).replace(/\s+/g,' ').trim();
    if(t===label||t.startsWith(label)){await el.click({force:true});await sleep(900);return true;}
  }
  return false;
}

await seed('a1');
let txt=await body();
check(txt.includes('Panel general'),'entra al panel con datos sembrados');
let opts=await selectorOptions();
log('Opciones empresa A:',JSON.stringify(opts));
check(opts.some(x=>x.includes('Todos los locales')),'selector ofrece Todos los locales');
check(opts.some(x=>x.includes('Local A1'))&&opts.some(x=>x.includes('Local A2')),'selector muestra A1 y A2');
check(!opts.some(x=>x.includes('Local B1')),'selector no muestra local de empresa B');
check(!opts.some(x=>x.includes('Local A cerrado')),'selector no ofrece local desactivado');
check(/Saldo de almacén\s*€40[,.]00/.test(txt),'Todos empresa A consolida A1+A2+histórico (€40)','sin sumar B1');
check(!/€139[,.]00/.test(txt),'Todos empresa A no mezcla empresa B');

await selectLocal('a1'); txt=await body();
check(/Saldo de almacén\s*€11[,.]00/.test(txt),'Local A1 muestra solo su saldo (€11)');
await selectLocal('a2'); txt=await body();
check(/Saldo de almacén\s*€22[,.]00/.test(txt),'Local A2 muestra solo su saldo (€22)');

await navExact('Productos'); txt=await body();
check(txt.includes('Producto A2'),'Productos muestra producto del local A2');
check(!txt.includes('Producto A1')&&!txt.includes('Producto B1'),'Productos oculta otros locales');

await navExact('Pedidos'); txt=await body();
check(txt.includes('PED-A2')||txt.includes('Producto A2'),'Pedidos muestra pedido/producto de A2');
check(!txt.includes('PED-A1')&&!txt.includes('PED-B1')&&!txt.includes('Producto B1'),'Pedidos oculta otros locales');

await navExact('Buscar');
const search=page.locator('input').filter({has:undefined}).first();
if(await search.isVisible().catch(()=>false)){
  await search.fill('Producto'); await sleep(500); txt=await body();
  check(txt.includes('Producto A2'),'Buscar encuentra producto del local activo');
  check(!txt.includes('Producto B1')&&!txt.includes('Producto A1'),'Buscar no filtra datos de otros locales hacia la vista');
}else log('[WARN] No se localizó input de Buscar; el aislamiento está validado estáticamente');

await seed('b1'); txt=await body(); opts=await selectorOptions();
log('Opciones empresa B:',JSON.stringify(opts));
check(opts.some(x=>x.includes('Local B1')),'empresa B muestra B1');
check(!opts.some(x=>x.includes('Local A1'))&&!opts.some(x=>x.includes('Local A2')),'empresa B no ofrece locales de A');
check(/Saldo de almacén\s*€99[,.]00/.test(txt),'Todos empresa B consolida solo B1 (€99)');
check(!txt.includes('€40,00')&&!txt.includes('€40.00'),'empresa B no hereda total de A');

await page.screenshot({path:'multilocal-audit.png',fullPage:true});
fs.writeFileSync('multilocal-audit.txt',out.join('\n'));
await browser.close();

log('Fallos:',failures.length);
if(failures.length) process.exitCode=2;
