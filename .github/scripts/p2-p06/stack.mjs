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
// La rama del propietario era una linea y aqui se fijaba su texto literal. El
// PR #220 la endurecio: el propietario sigue leyendo directo las colecciones
// controladas, pero "empleados" pasa antes por un filtro que le quita el PIN.
// Este contrato no se enteraba porque `edge-auth-patch.js` no esta en el filtro
// de rutas de su flujo de trabajo, asi que seguia exigiendo la forma vieja. Lo
// que se fija ahora es la forma endurecida, y de paso el filtro en si, que no
// estaba cubierto en ningun sitio.
assert.match(edge,/if \(rol === "Propietario"\) \{[\s\S]{0,160}if \(key === "empleados"\) return empleadosPropietarioSinSecretos\(contexto, shared\);[\s\S]{0,80}return getOriginal\(key, shared\);/, 'el propietario conserva la lectura directa y "empleados" pasa por el filtro de secretos');
assert.match(edge,/async function empleadosPropietarioSinSecretos\([\s\S]{0,500}delete copia\.pin;[\s\S]{0,120}copia\.pinConfigurado = false;/, 'el filtro de secretos sigue borrando el PIN del empleado');
assert.match(edge,/if \(modoLocalNoReclamado\(\)\) return key === "empleados" \? empleadosPropietarioSinSecretos\(null, shared\) : getOriginal\(key, shared\);/, 'el modo local no reclamado tampoco entrega el PIN');
assert.match(edge,/if \(key === "empleados"\)[\s\S]{0,200}contexto\.empleadosFichaje/);
assert.match(edge,/if \(key === "fichajes" && rol !== "Encargado"\)/, 'fichajes queda restringido por rol');
assert.match(edge,/if \(key === "fichajes" && rol !== "Encargado"\)[\s\S]{0,240}permisoConsultaPM13\(contexto, "PM13_FICHAJE_CONSULTAR"\)[\s\S]{0,160}fichajesDelPropioEmpleado/, 'el acceso de fichajes propios conserva la capacidad PM13 y el filtrado por empleado');

assert.match(bridge,/var originalGet = storage\.get\.bind\(storage\)/);
assert.match(bridge,/var originalSet = storage\.set\.bind\(storage\)/);
assert.match(bridge,/var originalSubirPendientes = typeof window\.subirPendientes/);
assert.match(bridge,/window\.subirPendientes = async function/);

console.log('P2_P06_STACK_OK=1');
