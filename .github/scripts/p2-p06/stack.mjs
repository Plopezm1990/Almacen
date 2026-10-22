import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const storage=fs.readFileSync('index-storage-bootstrap.js','utf8');
const edge=fs.readFileSync('edge-auth-patch.js','utf8');
const bridge=fs.readFileSync('server-authority-storage-bridge.js','utf8');

const order=[
  './index-storage-bootstrap.js',
  './server-authority-storage-bridge.js',
  './edge-auth-patch.js',
  './ui-context-bridge.js',
  './owner-bootstrap-post-reset.js',
  './fuente.js'
].map(x=>index.indexOf(x));

assert.ok(order.every(x=>x>=0),'missing runtime layer');
for(let i=1;i<order.length;i++) assert.ok(order[i-1]<order[i],'runtime order broken at '+i);

assert.match(storage,/var TABLAS_POR_FILA = \{[\s\S]*fichajes:\s*"fichajes_registro"/);
assert.match(storage,/window\.subirPendientes\s*=\s*async function/);

assert.match(edge,/var getOriginal = window\.storage\.get\.bind\(window\.storage\)/);
assert.match(edge,/var setOriginal = window\.storage\.set\.bind\(window\.storage\)/);
assert.match(edge,/if \(rol === "Propietario"\) return getOriginal\(key, shared\)/);
assert.match(edge,/if \(key === "empleados"\)[\s\S]{0,200}contexto\.empleadosFichaje/);
assert.match(edge,/if \(key === "fichajes" && rol !== "Encargado"\)[\s\S]{0,100}fichajesDelPropioEmpleado/);

assert.match(bridge,/var originalGet = storage\.get\.bind\(storage\)/);
assert.match(bridge,/var originalSet = storage\.set\.bind\(storage\)/);
assert.match(bridge,/var originalSubirPendientes = typeof window\.subirPendientes/);
assert.match(bridge,/window\.subirPendientes = async function/);

console.log('P2_P06_STACK_OK=1');
