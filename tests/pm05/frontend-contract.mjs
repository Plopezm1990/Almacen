import fs from 'node:fs';

const index = fs.readFileSync('index.html','utf8');
const source = fs.readFileSync('source-recovery/fuente-recuperado.js','utf8');
const backend = JSON.parse(fs.readFileSync('tests/pm05/backend-results.json','utf8'));

function ok(cond, msg){ if(!cond) throw new Error(msg); }

ok(index.includes('proveedores: "proveedores_empresa"'), 'proveedores no usa tabla empresarial');
ok(index.includes('clientes: "clientes_empresa"'), 'clientes no usa tabla empresarial');
ok(index.includes('CLAVES_CACHE_POR_USUARIO'), 'cache sensible no está separada por identidad');
ok(index.includes('key + "::usuario:" + uid'), 'cache no incorpora uid');
ok(index.includes('sincronizarColeccionEmpresa'), 'falta sincronización empresarial');
ok(index.includes('Hay registros sin id/empresaId; se bloquea la sincronización'), 'falta fail-closed para registros sin empresa');
ok(index.includes('p_empresa_id: d.empresaId || null'), 'auditoría diferida no transmite empresa');
ok(index.includes('p_local_id: d.localId || null'), 'auditoría diferida no transmite local');

ok(source.includes('crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria, empresaId })'), 'lógica de proveedores sin empresa');
ok(source.includes('const nuevo = { id: uid(), ...data, empresaId };'), 'alta proveedor no fija empresa');
ok(source.includes('p2.id === id && p2.empresaId === empresaId'), 'edición proveedor no limita empresa');
ok(source.includes('crearLogicaClientes({ clientes, setClientes, registrarAuditoria, empresaId })'), 'lógica de clientes sin empresa');
ok(source.includes('fechaAlta: todayISO(), ...data, empresaId'), 'alta cliente no fija empresa');
ok(source.includes('c2.id === id && c2.empresaId === empresaId'), 'edición cliente no limita empresa');
ok(source.includes('empresaId: empresaDelLocalActivo?.id || null, localId: localActivoId || null'), 'evento auditoría sin contexto empresa/local');
ok(source.includes('p_empresa_id: entrada.empresaId'), 'RPC auditoría no recibe empresa');
ok(source.includes('p_local_id: entrada.localId'), 'RPC auditoría no recibe local');

ok(backend.live_validation.failed === 0 && backend.live_validation.passed === 15, 'backend live PM05 no está verde');
ok(backend.pm04_negative_baseline_after_pm05.failed === 0 && backend.pm04_negative_baseline_after_pm05.passed === 5, 'baseline PM04 no quedó cerrado');
ok(backend.production_touched === false, 'la evidencia indica producción modificada');
ok(backend.temporary_validator.final_verify_jwt === true && backend.temporary_validator.final_behavior === '410 disabled', 'validador temporal no quedó neutralizado');

console.log('PM05_FRONTEND_CONTRACT_OK=1');
console.log('PM05_BACKEND_LIVE_15_15=1');
console.log('PM05_PM04_NEGATIVOS_5_5=1');
