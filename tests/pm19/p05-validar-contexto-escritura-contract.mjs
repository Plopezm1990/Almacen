import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P05 (paso previo): antes de sustituir nada, confirmar que validarContextoEscrituraPM10
// -- la función ya establecida y reutilizada en 7 puntos del proyecto (Personal, Productos,
// Pedidos, Encargos, Albaranes) -- cubre de verdad los 5 casos exigidos, en vez de asumirlo
// porque "ya se usa en otro sitio". Esta es la única autoridad que se generaliza en P05; no
// se crea ninguna función paralela.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function errorValidacionPM10(');
assert.ok(ini >= 0, 'errorValidacionPM10 no encontrada');
const finErr = src.indexOf('function numeroPM10(', ini);
const iniCtx = src.indexOf('function validarContextoEscrituraPM10(');
assert.ok(iniCtx >= 0, 'validarContextoEscrituraPM10 no encontrada');
const finCtx = src.indexOf('function validarProductoPM10(', iniCtx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src.slice(ini, finErr) + src.slice(iniCtx, finCtx), ctx);

const locales = [
  { id: 'l1', nombre: 'Centro', activo: true, empresaId: 'e1' },
  { id: 'l2', nombre: 'Norte', activo: false, empresaId: 'e1' },
  { id: 'l3', nombre: 'Fusionado', activo: true, fusionadoEn: 'l1', empresaId: 'e1' },
  { id: 'l4', nombre: 'Otra empresa', activo: true, empresaId: 'e2' }
];

// ---- 1. Ausencia de local activo (y por extensión "Todos los locales", que en esta app
// se representa exactamente como localActivoId null/ausente -- confirmado por inspección:
// setLocalActivoId solo se llama con null o un id real, nunca con un sentinela "todos"). ----
{
  const r = ctx.validarContextoEscrituraPM10({ localActivoId: null, locales, empresaId: 'e1' });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'contexto_no_autorizado');
  const r2 = ctx.validarContextoEscrituraPM10({ localActivoId: undefined, locales, empresaId: 'e1' });
  assert.equal(r2.ok, false);
  console.log('P05_PM19_RECHAZA_SIN_LOCAL_ACTIVO_TODOS=PASS');
}

// ---- 2. Local inactivo (desactivado). ----
{
  const r = ctx.validarContextoEscrituraPM10({ localActivoId: 'l2', locales, empresaId: 'e1' });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'local_inactivo');
  console.log('P05_PM19_RECHAZA_LOCAL_INACTIVO=PASS');
}

// ---- Local fusionado en otro (mismo criterio que inactivo). ----
{
  const r = ctx.validarContextoEscrituraPM10({ localActivoId: 'l3', locales, empresaId: 'e1' });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'local_inactivo');
  console.log('P05_PM19_RECHAZA_LOCAL_FUSIONADO=PASS');
}

// ---- 3. Empresa/local incompatibles. ----
{
  const r = ctx.validarContextoEscrituraPM10({ localActivoId: 'l4', locales, empresaId: 'e1' });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'referencia_otro_contexto');
  console.log('P05_PM19_RECHAZA_EMPRESA_LOCAL_INCOMPATIBLES=PASS');
}

// ---- Local que ya no existe (referencia eliminada). ----
{
  const r = ctx.validarContextoEscrituraPM10({ localActivoId: 'no-existe', locales, empresaId: 'e1' });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'referencia_inexistente');
  console.log('P05_PM19_RECHAZA_LOCAL_INEXISTENTE=PASS');
}

// ---- 4. Operación válida en un local activo y autorizado -- debe seguir funcionando. ----
{
  const r = ctx.validarContextoEscrituraPM10({ localActivoId: 'l1', locales, empresaId: 'e1' });
  assert.equal(r.ok, true);
  assert.equal(r.local.id, 'l1');
  console.log('P05_PM19_ACEPTA_LOCAL_ACTIVO_AUTORIZADO=PASS');
}

// ---- Replay: comprobar varias veces alternando resultados no deja estado compartido. ----
{
  assert.equal(ctx.validarContextoEscrituraPM10({ localActivoId: 'l1', locales, empresaId: 'e1' }).ok, true);
  assert.equal(ctx.validarContextoEscrituraPM10({ localActivoId: 'l2', locales, empresaId: 'e1' }).ok, false);
  assert.equal(ctx.validarContextoEscrituraPM10({ localActivoId: 'l1', locales, empresaId: 'e1' }).ok, true);
  console.log('P05_PM19_SIN_ESTADO_COMPARTIDO=PASS');
}

console.log('PM19 P05 (paso previo) — validarContextoEscrituraPM10 cubre los 5 casos exigidos: contrato OK');
