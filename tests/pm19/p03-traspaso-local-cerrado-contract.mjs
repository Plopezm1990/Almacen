import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P03 (NR-07): "Crear operaciones antes de cerrar local; histórico permanece,
// operaciones ordinarias bloqueadas". traspasarEntreLocales ya comprobaba que origen y
// destino estuvieran activos; traspasarStock (el traspaso simple piso <-> almacén dentro
// del mismo local) no comprobaba nunca el estado del local activo. Este contrato prueba
// la función pura que cierra ese hueco.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function localActivoEstaActivoPM19(');
assert.ok(ini >= 0, 'localActivoEstaActivoPM19 no encontrada');
const fin = src.indexOf('function crearLogicaTraspasos(', ini);
assert.ok(fin > ini, 'no se pudo acotar localActivoEstaActivoPM19');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin), ctx);

const locales = [
  { id: 'l1', nombre: 'Centro', activo: true },
  { id: 'l2', nombre: 'Norte', activo: false },
  { id: 'l3', nombre: 'Fusionado', activo: true, fusionadoEn: 'l1' }
];

// ---- Positivo: local activo real permite operar. ----
{
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'l1'), true);
  console.log('P03_PM19_LOCAL_ACTIVO_PERMITE_OPERAR=PASS');
}

// ---- Negativo: local desactivado, local fusionado, local inexistente o sin
// localActivoId -- ninguno debe admitir operativa ordinaria. ----
{
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'l2'), false, 'un local desactivado no admite operativa ordinaria');
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'l3'), false, 'un local fusionado tampoco, aunque activo=true');
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'no-existe'), false);
  assert.equal(ctx.localActivoEstaActivoPM19(locales, null), false, 'sin local activo seleccionado, no se puede operar');
  assert.equal(ctx.localActivoEstaActivoPM19([], 'l1'), false);
  console.log('P03_PM19_LOCAL_CERRADO_BLOQUEA=PASS');
}

// ---- Replay: comprobar el mismo local varias veces seguidas, alternando con otros, da
// siempre el mismo resultado. ----
{
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'l1'), true);
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'l2'), false);
  assert.equal(ctx.localActivoEstaActivoPM19(locales, 'l1'), true);
  console.log('P03_PM19_SIN_ESTADO_COMPARTIDO_ENTRE_COMPROBACIONES=PASS');
}

console.log('PM19 P03 (traspaso local cerrado) — función pura: contrato OK');
