import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('server-authority-storage-bridge.js','utf8');

function makeScenario({capability=true,tables={},pending=['empleados','fichajes','productos']}={}) {
  const calls={get:[],set:[],del:[],rpc:[],from:[],queueSnapshots:[]};
  const local=new Map([['almacen__pendientes',JSON.stringify(pending)]]);
  const legacy={
    async get(key,shared){ calls.get.push([key,shared]); return {key,value:JSON.stringify(['legacy:'+key]),shared:!!shared}; },
    async set(key,value,shared){ calls.set.push([key,value,shared]); return {key,value,shared:!!shared,legacy:true}; },
    async delete(key,shared){ calls.del.push([key,shared]); return {key,deleted:true,shared:!!shared,legacy:true}; }
  };
  const client={
    async rpc(name){
      calls.rpc.push(name);
      if(!capability) return {data:null,error:{code:'PGRST202',message:'function missing'}};
      return {data:{personal:'pm11',fichajes:'pm13',legacyPersistence:false},error:null};
    },
    from(table){
      calls.from.push(table);
      return {
        async select(columns){
          const fixture=tables[table];
          if(fixture && fixture.error) return {data:null,error:{message:fixture.error}};
          return {data:fixture && fixture.data ? fixture.data : [],error:null,columns};
        }
      };
    }
  };
  const localStorage={
    getItem(k){return local.has(k)?local.get(k):null;},
    setItem(k,v){local.set(k,String(v));},
    removeItem(k){local.delete(k);}
  };
  const window={
    storage:legacy,
    async subirPendientes(){
      calls.queueSnapshots.push(JSON.parse(localStorage.getItem('almacen__pendientes')||'[]'));
      return {ok:true};
    },
    async getSupabaseClient(){return client;},
    actualizarIndicador(){}
  };
  const context={window,localStorage,Object,Array,String,Promise,JSON,Error,setInterval(){throw new Error('unexpected retry');},clearInterval(){}};
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'server-authority-storage-bridge.js'});
  return {window,calls,localStorage};
}

{
  const s=makeScenario({tables:{empleados:{data:[{
    id:'emp-1',empresa_id:'e1',local_id:'l1',estado:'activo',nombre:'Ana',
    datos:{telefono:'600'},created_at:'c',updated_at:'u',baja_at:null,reactivado_at:null,anonimizado_at:null
  }]}}});
  const res=await s.window.storage.get('empleados',false);
  assert.equal(typeof res,'object');
  assert.equal(res.key,'empleados');
  const rows=JSON.parse(res.value);
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'emp-1');
  assert.equal(rows[0].empresaId,'e1');
  assert.equal(rows[0].localId,'l1');
  assert.equal(rows[0].telefono,'600');
  assert.equal(rows[0].activo,true);

  const saved=await s.window.storage.set('empleados','IGNORED',false);
  assert.equal(saved.serverAuthoritative,true);
  assert.equal(s.calls.set.length,0);

  const deleted=await s.window.storage.delete('empleados',false);
  assert.equal(deleted.serverAuthoritative,true);
  assert.equal(deleted.deleted,false);
  assert.equal(s.calls.del.length,0);

  const other=await s.window.storage.get('productos',false);
  assert.deepEqual(JSON.parse(other.value),['legacy:productos']);
  assert.equal(s.calls.get.length,1);
}

{
  const s=makeScenario({tables:{fichajes_registro:{data:[{
    id:'f1',fecha:'2026-09-22',datos:{empleadoId:'emp-1',tipo:'entrada',hora:'09:00'},creado_en:'c'
  }]}}});
  const res=await s.window.storage.get('fichajes',false);
  const rows=JSON.parse(res.value);
  assert.equal(rows[0].id,'f1');
  assert.equal(rows[0].fecha,'2026-09-22');
  assert.equal(rows[0].empleadoId,'emp-1');
  await s.window.subirPendientes();
  assert.deepEqual(s.calls.queueSnapshots.at(-1),['productos']);
}

{
  const s=makeScenario({capability:false});
  const res=await s.window.storage.get('empleados',false);
  assert.deepEqual(JSON.parse(res.value),['legacy:empleados']);
  const saved=await s.window.storage.set('empleados','legacy-data',false);
  assert.equal(saved.legacy,true);
  const deleted=await s.window.storage.delete('fichajes',false);
  assert.equal(deleted.legacy,true);
  await s.window.subirPendientes();
  assert.deepEqual(s.calls.queueSnapshots.at(-1),['empleados','fichajes','productos']);
  assert.equal(s.calls.from.length,0);
}

{
  const s=makeScenario({tables:{fichajes_registro:{error:'rls read denied'}}});
  await assert.rejects(()=>s.window.storage.get('fichajes',false),/rls read denied/);
  assert.equal(s.calls.get.length,0);
  const saved=await s.window.storage.set('fichajes','legacy-data',false);
  assert.equal(saved.serverAuthoritative,true);
  assert.equal(s.calls.set.length,0);
}

console.log('P2_P06_BRIDGE_BEHAVIOR_OK=1');
