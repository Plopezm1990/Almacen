import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const w={}; vm.runInNewContext(fs.readFileSync('pm12-conteo-estados-v1.js','utf8'),{globalThis:w});
for(const file of ['fuente.js','source-recovery/fuente-recuperado.js']) {
 const src=fs.readFileSync(file,'utf8');
 const extract=(start,end)=>src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));
 const block=extract('function crearMotorStock(', '\nfunction crearLogicaReconciliacion')+'\n'+extract('function crearLogicaConteos(', '\nfunction crearLogicaProduccion');
 const {crearMotorStock:create,crearLogicaConteos:counts}=new Function('window','todayISO','uid',block+'; return {crearMotorStock,crearLogicaConteos};')(w,()=> '2026-09-07',()=> 'unexpected-random');
 const setup=()=>{
  const s={productos:[{id:'p',nombre:'P',empresaId:'E',localId:'L',stock:10,stockPisoVenta:0,deficitPendiente:0}],movimientos:[],conteos:[{id:'c',empresaId:'E',localId:'L',estado:'COMPLETADO',cerradoEn:'2026-09-07',ambito:'total',items:[{productoId:'p',conteo:8}]}]};
  s.setProductos=fn=>{s.productos=fn(s.productos);};s.setMovimientos=fn=>{s.movimientos=fn(s.movimientos);};s.setConteos=fn=>{s.conteos=fn(s.conteos);};
  s.registrarAuditoria=()=>{};s.localActivoId='L';s.empresaActivaId='E';s.obtenerContextoActor=()=>({rol:'Propietario',actorId:'a',actorNombre:'A',empresaId:'E',localId:'L'});return s;
 };
 const op={movimientoId:'m',operationId:'op',productoId:'p',cantidad:-2,tipo:'INVENTARIO',origen:'aplicarAjustes',documentoOrigenId:'c'};
 {
  const s=setup(),a=create(s),b=create(s);
  assert.equal(a.aplicarMovimientoStock(op).ok,true);
  assert.equal(b.aplicarLoteMovimientosStock([op]).yaExistia,true);
  assert.equal(s.movimientos.length,1); assert.equal(s.productos[0].stock,8);
  assert.equal(b.aplicarMovimientoStock({...op,productoId:'other'}).ok,false);
  assert.equal(b.aplicarMovimientoStock({...op,movimientoId:'m2',operationId:'op2',cantidad:-3}).ok,true);
  assert.equal(s.productos[0].stock,5);
 }
 for(const setter of ['setProductos','setMovimientos']) for(const after of [false,true]) {
  const s=setup(),original=s[setter];let once=true;
  s[setter]=fn=>{if(once){once=false;if(after)original(fn);throw Error('injected');}original(fn);};
  const a=create(s),b=create(s);
  assert.equal(a.aplicarLoteMovimientosStock([op]).codigo,'publicacion_pendiente');
  assert.equal(b.aplicarMovimientoStock({...op,movimientoId:'other'}).codigo,'operacion_pendiente');
  assert.equal(b.aplicarLoteMovimientosStock([op]).ok,true);
  assert.equal(s.productos[0].stock,8);assert.equal(s.movimientos.length,1);
 }
 {
  const s=setup();let b, nested;const original=s.setProductos;
  s.setProductos=fn=>{nested=b.aplicarMovimientoStock(op);original(fn);};
  const a=create(s);b=create(s);assert.equal(a.aplicarMovimientoStock(op).ok,true);assert.equal(nested.codigo,'operacion_en_curso');assert.equal(s.movimientos.length,1);
 }
 for(const setter of ['setProductos','setMovimientos','setConteos']) {
  const s=setup(),original=s[setter];let fail=true;
  s[setter]=fn=>{if(fail){fail=false;throw Error('injected');}original(fn);};
  const first=counts(s).aplicarAjustes('c');assert.equal(first.ok,false,`${file} ${setter}: incomplete cannot report OK`);
  assert.notEqual(s.conteos[0].ajustesAplicados,true);
  const retry=counts(s).aplicarAjustes('c');assert.equal(retry.ok,true,`${file} ${setter}: resume prepared result`);
  assert.equal(retry.ajustados,1);assert.equal(s.productos[0].stock,8);assert.equal(s.movimientos.length,1);assert.equal(s.conteos[0].ajustesAplicados,true);
 }
 {
  const s=setup();s.registrarAuditoria=()=>{throw Error('audit offline');};
  const a=counts(s),b=counts(s);assert.equal(a.aplicarAjustes('c').ok,true);assert.equal(b.aplicarAjustes('c').replayed,true);
  assert.equal(s.movimientos.length,1);
  // Fresh setters simulate a reload with the stock/ledger saved but the document response lost.
  const reloaded=setup();reloaded.productos=s.productos;reloaded.movimientos=s.movimientos;
  const recovered=counts(reloaded).aplicarAjustes('c');assert.equal(recovered.replayed,true);assert.equal(recovered.ajustados,1);assert.equal(reloaded.productos[0].stock,8);
  const changed=setup();changed.productos=s.productos;changed.movimientos=s.movimientos;changed.conteos[0].items[0].conteo=9;
  assert.equal(counts(changed).aplicarAjustes('c').codigo,'conflicto_movimiento_existente');
 }
 {
  const s=setup();s.conteos.push({...s.conteos[0],id:'other',items:[{productoId:'p',conteo:7}]});
  const a=counts(s),b=counts(s);assert.equal(a.aplicarAjustes('c').ok,true);
  assert.equal(b.aplicarAjustes('other').codigo,'stock_base_obsoleto');assert.equal(s.productos[0].stock,8);
 }
 {
  const s=setup();s.productos[0].stockPisoVenta=9;s.conteos[0].items[0].conteo=7;
  assert.equal(counts(s).aplicarAjustes('c').ok,true);assert.equal(s.movimientos.length,2);
  const original=s.setMovimientos;let calls=0;
  // Preserve the store setter identity while injecting a failure on the second reversal.
  const proxy=fn=>{if(++calls===2)throw Error('second reversal failed');original(fn);};s.setMovimientos=proxy;
  assert.equal(counts(s).eliminarConteo('c',{motivo:'Anular',responsable:'A'}).ok,false);
  assert.notEqual(s.conteos[0].estado,'CANCELADO');
  assert.equal(counts(s).eliminarConteo('c',{motivo:'Anular',responsable:'A'}).ok,true);
  assert.equal(s.conteos[0].estado,'CANCELADO');assert.equal(s.productos[0].stock,10);assert.equal(s.productos[0].stockPisoVenta,9);assert.equal(s.movimientos.length,4);
 }
 // Evaluate the real UI handler; an error must preserve the selected count and clear the busy state.
 const ui=src.slice(src.indexOf('    onAplicar: async () => {'),src.indexOf('    onCerrarSinAjustar:',src.indexOf('    onAplicar: async () => {')));
 const body=ui.slice(ui.indexOf('{')+1,ui.lastIndexOf('},'));
 let selected='c',busy=false,summary;
 await new (Object.getPrototypeOf(async function(){}).constructor)('procesandoCierre','setProcesandoCierre','aplicarAjustes','activo','motivos','setMotivos','setResumenCierre','setActivoId',body)(false,v=>busy=v,()=>({ok:false,error:'injected'}),{id:'c'},{},()=>{},v=>summary=v,v=>selected=v);
 assert.equal(selected,'c');assert.equal(busy,false);assert.equal(summary.ok,false);
 console.log(`${file}: P08_SHARED_IDS_FAILURES_REENTRANCY_LOST_RESPONSE=PASS`);
}
