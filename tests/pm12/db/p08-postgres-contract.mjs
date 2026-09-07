import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const url=new URL(process.env.PM12_TEST_DATABASE_URL || 'postgresql://postgres:pm12-local-only@127.0.0.1:55438/pm12_p08_test');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Only loopback databases are allowed');
assert.equal(url.pathname,'/pm12_p08_test','Only the disposable PM12 test database is allowed');
const admin=new pg.Client({connectionString:url.href});await admin.connect();
const clients=[];
const sql=p=>fs.readFileSync(p,'utf8');
const migration=name=>sql('supabase/migrations/'+name);
const extract=(source,name)=>{const i=source.indexOf('create or replace function '+name+'(');assert.ok(i>=0,name);const end=source.indexOf('$$;',i);return source.slice(i,end+3);};
async function actor(role='Propietario'){
 const c=new pg.Client({connectionString:url.href});await c.connect();clients.push(c);
 await c.query("select set_config('pm12.actor','11111111-1111-1111-1111-111111111111',false),set_config('pm12.rol',$1,false)",[role]);
 await c.query('set role authenticated');return c;
}
const request=(id='c',quantity=-2)=>{
 const operationId=`pm12-ajuste-conteo:${id}:2026-09-07`;
 return [operationId,'E','L',{id,empresaId:'E',localId:'L',estado:'COMPLETADO',cerradoEn:'2026-09-07',items:[{productoId:'p',conteo:10+quantity}]},[{productoId:'p',movimientoId:operationId+':producto:p:inventario-total',operationId,cantidad:quantity,tipo:'INVENTARIO',origen:'aplicarAjustes',documentoOrigenId:id,afectaStockTotal:true,afectaStockPisoVenta:false,camposExtra:{pm12PlanLeg:'inventario-total'}}],[{productoId:'p',conteo:10+quantity,stock:10,stockPisoVenta:0}]];
};
const apply=async(c,r)=>(await c.query('select public.pm12_confirmar_ajuste_stock($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb) as r',r.map((x,i)=>i>=3?JSON.stringify(x):x))).rows[0].r;
const cancel=async(c,r)=>(await c.query('select public.pm12_cancelar_conteo_stock($1,$2,$3::jsonb,$4::jsonb) r',[r[1],r[2],JSON.stringify(r[3]),JSON.stringify({operationId:r[0].replace('pm12-ajuste-conteo:','pm12-cancelar-conteo:'),motivo:'Anular',responsable:'A'})])).rows[0].r;
const stock=async()=>Number((await admin.query("select almacen+piso as total from public.stock_ubicacion where producto_id='p' and empresa_id='E' and local_id='L'")).rows[0].total);
async function reset(){await admin.query("truncate public.movimientos_stock,public.stock_operaciones,private.g1_operation_ids_global,public.pagos_factura cascade; update public.stock_ubicacion set almacen=10,piso=0,local_operable=true;");}
try {
 assert.equal((await admin.query('select current_database() as db')).rows[0].db,'pm12_p08_test');
 await admin.query(`drop schema if exists public cascade;drop schema if exists private cascade;drop schema if exists auth cascade;
 create schema public;create schema private;create schema auth;
 do $$begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;end$$;
 grant usage on schema public,auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('pm12.actor',true),'')::uuid$$;
 create function private.la_usuario_activo() returns boolean language sql stable as $$select auth.uid() is not null$$;
 create function private.la_rol() returns text language sql stable as $$select current_setting('pm12.rol',true)$$;
 create function private.la_tiene_empresa(e text) returns boolean language sql stable as $$select e='E'$$;
 create function private.la_tiene_local(e text,l text) returns boolean language sql stable as $$select e='E' and l='L'$$;
 create table public.caja_operaciones(operation_id text primary key);create table public.arqueos_caja(operation_id text primary key);
 create table public.arqueos_caja_anulaciones(operation_id text primary key);create table public.pagos_factura(operation_id text primary key);`);
 await admin.query(migration('20260904135838_pm07_stock_ubicacion_y_reversos.sql'));
 const pm08=migration('20260904204500_pm08_caja_devolucion_indivisible.sql');
 await admin.query(extract(pm08,'private.pm08_validar_operation_id')+extract(pm08,'private.pm08_bloquear_operation_id'));
 await admin.query(extract(migration('20260905120500_pm09_operation_id_global_hardening.sql'),'private.pm09_bloquear_operation_id_stock'));
 const global=migration('20260905185935_g1_p08_operation_id_finanzas_global.sql');
 await admin.query(global.slice(0,global.indexOf('create or replace function public.registrar_pago_factura(')));
 await admin.query(sql('supabase/migrations/20260907155028_pm12_p08_stock_atomico.sql'));
 await admin.query("insert into public.stock_ubicacion(empresa_id,local_id,producto_id,almacen,piso) values('E','L','p',10,0),('E','L','q',10,0);");
 const a=await actor(),b=await actor();
 await a.query('begin');const first=await apply(a,request());
 let settled=false;const waiting=apply(b,request()).then(r=>{settled=true;return r;});
 // Observe a real database lock; no sleep-based assumption that requests overlapped.
 let blocked=false;
 for(let i=0;i<100;i++){
   blocked=(await admin.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select public.pm12_confirmar%'")).rowCount>0;
   if(blocked)break;
 }
 assert.equal(blocked,true,'second connection waits on the operation lock');assert.equal(settled,false);
 await a.query('commit');const duplicate=await waiting;
 assert.equal(first.replayed,false);assert.equal(duplicate.replayed,true);assert.equal(await stock(),8);
 assert.equal(Number((await admin.query('select count(*) from public.movimientos_stock')).rows[0].count),1);
 console.log('P08_PG_SAME_ID_CONCURRENT_LOCK_AND_REPLAY=PASS');
 // Losing the response is represented by discarding the first result and reconnecting.
 const fresh=await actor();const lost=await apply(fresh,request());assert.equal(lost.replayed,true);assert.deepEqual(lost.conteo,first.conteo);assert.equal(await stock(),8);
 console.log('P08_PG_COMMITTED_RESPONSE_LOST_RECONNECT=PASS');
 const altered=request();altered[3].items[0].conteo=9;
 await assert.rejects(apply(b,altered),/operation_id_conflict/);assert.equal(await stock(),8);
 await reset();
 // Trigger failure after the stock UPDATE, during the first movement insert.
 await admin.query("create function private.pm12_test_fail() returns trigger language plpgsql as $$begin raise exception 'injected_intermediate_failure';end$$;create trigger pm12_test_fail before insert on public.movimientos_stock for each row execute function private.pm12_test_fail();");
 await assert.rejects(apply(a,request()),/injected_intermediate_failure/);
 assert.equal(await stock(),10);assert.equal(Number((await admin.query('select count(*) from public.stock_operaciones')).rows[0].count),0);
 assert.equal(Number((await admin.query('select count(*) from private.g1_operation_ids_global')).rows[0].count),0);
 await admin.query('drop trigger pm12_test_fail on public.movimientos_stock');
 assert.equal((await apply(a,request())).ok,true);assert.equal(await stock(),8);
 console.log('P08_PG_INTERMEDIATE_FAILURE_FULL_ROLLBACK_RETRY=PASS');
 await reset();await a.query('begin');await apply(a,request('first'));
 const stale=apply(b,request('second',-3));const staleCheck=assert.rejects(stale,/stock_base_obsoleto/);
 await a.query('commit');await staleCheck;assert.equal(await stock(),8);
 console.log('P08_PG_DISTINCT_INTENTS_STALE_BASE_REJECTED=PASS');
 await reset();await a.query('begin');await apply(a,request());
 const concurrentCancel=cancel(b,request());await a.query('commit');assert.equal((await concurrentCancel).ok,true);assert.equal(await stock(),10);
 assert.equal((await cancel(b,request())).replayed,true);assert.equal(Number((await admin.query("select count(*) from public.movimientos_stock where tipo='REVERSO'")).rows[0].count),1);
 await reset();await b.query('begin');await cancel(b,request());
 const rejectedAfterCancel=assert.rejects(apply(a,request()),/conteo_cancelado|operation_id_conflict/);await b.query('commit');await rejectedAfterCancel;assert.equal(await stock(),10);
 console.log('P08_PG_APPLY_CANCEL_BOTH_ORDERS=PASS');
 await reset();await apply(a,request());
 await admin.query("create trigger pm12_test_fail before insert on public.movimientos_stock for each row execute function private.pm12_test_fail();");
 await assert.rejects(cancel(b,request()),/injected_intermediate_failure/);assert.equal(await stock(),8);
 assert.equal((await admin.query("select payload->'resultado'->'conteo'->>'estado' as estado from public.stock_operaciones where tipo='INVENTARIO_PM12'")).rows[0].estado,'COMPLETADO');
 await admin.query('drop trigger pm12_test_fail on public.movimientos_stock');await cancel(b,request());assert.equal(await stock(),10);
 console.log('P08_PG_CANCEL_ROLLBACK_RETRY=PASS');
 for(const role of ['Cajero/a','Estándar','']) await assert.rejects(apply(await actor(role),request('forbidden')),/ajuste_no_autorizado/);
 const cross=request('scope');cross[1]='OTHER';await assert.rejects(apply(a,cross),/contexto_no_autorizado/);
 const all=request('all');all[2]='todos';await assert.rejects(apply(a,all),/contexto_no_autorizado/);
 const anonymous=new pg.Client({connectionString:url.href});await anonymous.connect();clients.push(anonymous);await anonymous.query('set role anon');await assert.rejects(apply(anonymous,request()),/permission denied/);
 console.log('P08_PG_P07_AUTH_SCOPE_ANON=PASS');
 await assert.rejects(a.query("update public.stock_ubicacion set almacen=0"),/permission denied/);
 await reset();await admin.query('insert into public.pagos_factura(operation_id) values($1)',[request()[0]]);
 await assert.rejects(apply(a,request()),/operation_id_conflict/);assert.equal(await stock(),10);
  console.log('P08_PG_EXISTING_GLOBAL_LEDGER_REUSED=PASS');
 await reset();
 // Run the real count planner, client adapter and server hydration against this PostgreSQL instance.
 for(const file of ['fuente.js','source-recovery/fuente-recuperado.js']) {
  await reset();
  const w={__nubeActiva:true};
  vm.runInNewContext(sql('pm12-conteo-estados-v1.js'),{globalThis:w});
  vm.runInNewContext(sql('pm12-stock-atomico-v1.js'),{globalThis:w});
  let loseResponse=false;
  const facade={
    async rpc(name,args){
      try {
        let r;
        if(name==='pm12_confirmar_ajuste_stock')r=await apply(a,[args.p_operation_id,args.p_empresa_id,args.p_local_id,args.p_intencion,args.p_plan,args.p_bases]);
        else if(name==='pm12_cancelar_conteo_stock')r=(await a.query('select public.pm12_cancelar_conteo_stock($1,$2,$3::jsonb,$4::jsonb) r',[args.p_empresa_id,args.p_local_id,JSON.stringify(args.p_conteo),JSON.stringify(args.p_cancelacion)])).rows[0].r;
        else throw Error('unexpected RPC');
        if(loseResponse){loseResponse=false;throw Error('response_lost_after_commit');}return {data:r,error:null};
      }catch(error){return {data:null,error};}
    },
    from(table){
      assert.ok(['stock_estado','stock_operaciones','movimientos_stock'].includes(table));
      const filters=[];const q={select(){return q;},order(){return q;},limit(){return q;},eq(key,value){filters.push([key,value]);return q;},async then(resolve,reject){try{const rows=(await a.query('select * from public.'+table)).rows.filter(row=>filters.every(([k,v])=>row[k]===v));return resolve({data:rows,error:null});}catch(e){return reject(e);}}};return q;
    }
  };
  w.getSupabaseClient=async()=>facade;w.__pm12StockAtomico=w.__pm12CrearStockAtomico(w.getSupabaseClient);
  const src=sql(file),extractBlock=(from,to)=>src.slice(src.indexOf(from),src.indexOf(to,src.indexOf(from)));
  // End stock synchronization exactly; following helpers differ between bundle and recovered source.
  const stockStart=src.indexOf('async function sincronizarStockPm07('), stockEnd=src.indexOf('\n}',stockStart)+2;
  const factoryCode=extractBlock('async function sincronizarConteosPm12(', 'async function sincronizarStockPm07(')+src.slice(stockStart,stockEnd)+extractBlock('function crearMotorStock(', '\nfunction crearLogicaReconciliacion')+extractBlock('function crearLogicaConteos(', '\nfunction crearLogicaProduccion');
  const counts=new Function('window','todayISO','uid',factoryCode+';return crearLogicaConteos;')(w,()=> '2026-09-07',()=> 'unused');
  const s={productos:[{id:'p',nombre:'P',empresaId:'E',localId:'L',stock:10,stockPisoVenta:0,deficitPendiente:0}],movimientos:[],conteos:[{id:'c',empresaId:'E',localId:'L',estado:'COMPLETADO',cerradoEn:'2026-09-07',ambito:'total',items:[{productoId:'p',conteo:8}]}],localActivoId:'L',empresaActivaId:'E',registrarAuditoria(){},obtenerContextoActor:()=>({rol:'Propietario',actorId:'a',actorNombre:'A',empresaId:'E',localId:'L'})};
  s.setProductos=fn=>{s.productos=fn(s.productos);};s.setMovimientos=fn=>{s.movimientos=fn(s.movimientos);};s.setConteos=fn=>{s.conteos=fn(s.conteos);};
  loseResponse=true;const lost=await counts(s).aplicarAjustes('c');assert.equal(lost.ok,false);assert.notEqual(s.conteos[0].ajustesAplicados,true);assert.equal(await stock(),8);
  const recovered=await counts(s).aplicarAjustes('c');assert.equal(recovered.replayed,true);assert.equal(s.productos[0].stock,8);assert.equal(s.movimientos.length,1);assert.equal(s.conteos[0].ajustesAplicados,true);
  const c1=counts(s),c2=counts(s);
  const cancelled=await Promise.all([c1.eliminarConteo('c',{motivo:'Anular',responsable:'A'}),c2.eliminarConteo('c',{motivo:'Anular',responsable:'A'})]);
  assert.ok(cancelled.every(x=>x.ok));assert.equal(await stock(),10);assert.equal(s.conteos[0].estado,'CANCELADO');assert.equal(s.movimientos.length,2);assert.equal(s.movimientos.filter(m=>m.origen==='cancelarConteo').length,1);
  console.log(file+': P08_REAL_PLANNER_RPC_HYDRATION_P06=PASS');
  for (const [ambito,contado,piso,totalFinal,pisoFinal,legs] of [
    ['total',7,9,7,7,2], ['total',10,0,10,0,0],
    ['piso_venta',3,2,11,3,1], ['almacen',5,2,10,5,1], ['almacen',10,2,12,4,2]
  ]) {
    await reset();await admin.query("update public.stock_ubicacion set almacen=$1,piso=$2 where producto_id='p'",[10-piso,piso]);
    s.productos=[{id:'p',nombre:'P',empresaId:'E',localId:'L',stock:10,stockPisoVenta:piso,deficitPendiente:0}];s.movimientos=[];
    s.conteos=[{id:'scope',empresaId:'E',localId:'L',estado:'COMPLETADO',cerradoEn:'2026-09-07',ambito,items:[{productoId:'p',conteo:contado}]}];
    const applied=await counts(s).aplicarAjustes('scope');assert.equal(applied.ok,true,JSON.stringify(applied));
    assert.equal(s.productos[0].stock,totalFinal);assert.equal(s.productos[0].stockPisoVenta,pisoFinal);assert.equal(s.movimientos.length,legs);
    assert.equal((await counts(s).aplicarAjustes('scope')).replayed,true);
    assert.equal((await counts(s).eliminarConteo('scope',{motivo:'Anular',responsable:'A'})).ok,true);
    assert.equal(s.productos[0].stock,10);assert.equal(s.productos[0].stockPisoVenta,piso);assert.equal(s.movimientos.length,legs*2);
  }
  w.__nubeActiva=false;await reset();s.conteos=[{id:'offline',empresaId:'E',localId:'L',estado:'COMPLETADO',cerradoEn:'2026-09-07',ambito:'total',items:[{productoId:'p',conteo:8}]}];
  assert.equal((await counts(s).aplicarAjustes('offline')).codigo,'conexion_atomica_requerida');assert.equal(await stock(),10);assert.notEqual(s.conteos[0].ajustesAplicados,true);
  console.log(file+': P08_P05_SCOPES_ZERO_MULTI_LEG_P06_OFFLINE=PASS');
 }
 const privileges=await admin.query("select has_function_privilege('anon','public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)','execute') as anon,has_function_privilege('authenticated','public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)','execute') as member");
 assert.deepEqual(privileges.rows[0],{anon:false,member:true});
 console.log('P08_POSTGRES_ISOLATED_CONTRACT=PASS');
} finally {for(const c of clients)await c.end();await admin.end();}
