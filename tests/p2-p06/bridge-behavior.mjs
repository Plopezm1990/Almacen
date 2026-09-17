import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('server-authority-storage-bridge.js','utf8');
const assert=(ok,msg)=>{if(!ok) throw new Error(`P2_P06_BEHAVIOR_FALLO:${msg}`);};

function makeScenario({capability=true, tables={}}={}) {
  const calls={get:[],set:[],rpc:[],from:[]};
  const legacy={
    async get(key){calls.get.push(key); return `legacy:${key}`;},
    async set(key,value){calls.set.push([key,value]); return {ok:true,legacy:true};}
  };
  const client={
    async rpc(name){
      calls.rpc.push(name);
      if(!capability) return {data:null,error:{message:'missing capability'}};
      return {data:{personal:'pm11',fichajes:'pm13',legacyPersistence:false},error:null};
    },
    from(table){
      calls.from.push(table);
      return {
        async select(columns){
          const fixture=tables[table];
          if(fixture && fixture.error) return {data:null,error:{message:fixture.error}};
          return {data:fixture?.data ?? [],error:null,columns};
        }
      };
    }
  };
  const window={storage:legacy,async getSupabaseClient(){return client;}};
  const context={window,Object,Array,String,Promise,JSON,Error,setInterval(){throw new Error('unexpected retry timer');},clearInterval(){}};
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'server-authority-storage-bridge.js'});
  return {window,calls};
}

{
  const s=makeScenario({tables:{empleados:{data:[{
    id:'emp-1',empresa_id:'e1',local_id:'l1',estado:'activo',nombre:'Ana',
    datos:{telefono:'600'},created_at:'c',updated_at:'u',baja_at:null,reactivado_at:null,anonimizado_at:null
  }]}}});
  const raw=await s.window.storage.get('empleados');
  const rows=JSON.parse(raw);
  assert(rows.length===1,'empleados row count');
  assert(rows[0].id==='emp-1' && rows[0].empresaId==='e1' && rows[0].localId==='l1','empleados identity mapping');
  assert(rows[0].nombre==='Ana' && rows[0].activo===true && rows[0].telefono==='600','empleados data mapping');
  const saved=await s.window.storage.set('empleados','IGNORED');
  assert(saved.serverAuthoritative===true,'empleados legacy write not suppressed');
  assert(s.calls.set.length===0,'empleados reached legacy set');
  assert(s.calls.rpc.length===1 && s.calls.rpc[0]==='p2_server_authority_capabilities','capability rpc count');

  const other=await s.window.storage.get('productos');
  assert(other==='legacy:productos','unrelated get not delegated');
  const otherSet=await s.window.storage.set('productos','x');
  assert(otherSet.legacy===true && s.calls.set.length===1,'unrelated set not delegated');
}

{
  const s=makeScenario({tables:{fichajes_registro:{data:[]}}});
  const raw=await s.window.storage.get('fichajes');
  assert(raw==='[]','empty authoritative fichajes must stay authoritative');
  const saved=await s.window.storage.set('fichajes','[]');
  assert(saved.serverAuthoritative===true,'empty fichajes write not suppressed');
  assert(s.calls.get.length===0 && s.calls.set.length===0,'empty authoritative path fell back');
}

{
  const s=makeScenario({capability:false});
  const raw=await s.window.storage.get('empleados');
  assert(raw==='legacy:empleados','missing capability get must fall back');
  const saved=await s.window.storage.set('empleados','legacy-data');
  assert(saved.legacy===true,'missing capability set must fall back');
  assert(s.calls.get.length===1 && s.calls.set.length===1,'legacy fallback counts wrong');
  assert(s.calls.from.length===0,'tables queried without capability proof');
}

{
  const s=makeScenario({tables:{fichajes_registro:{error:'rls read denied'}}});
  const raw=await s.window.storage.get('fichajes');
  assert(raw==='legacy:fichajes','failed authoritative read must fall back');
  const saved=await s.window.storage.set('fichajes','legacy-data');
  assert(saved.serverAuthoritative===true,'proven modern backend must block legacy write after read failure');
  assert(s.calls.set.length===0,'failed authoritative read reopened legacy write');
}

console.log('P2_P06_BRIDGE_BEHAVIOR_OK=1');
