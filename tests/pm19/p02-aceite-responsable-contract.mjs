import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P02: "controles conservan responsable/fecha... históricos completos" aplicado a
// cambios y rellenos de aceite de freidoras. registrarCambio/registrarRelleno aceptaban
// responsable vacío (`responsable: responsable || ""`) sin validar nada -- este contrato
// prueba la función pura de validación compartida por ambos.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function validarResponsableRegistroAceitePM19(');
assert.ok(ini >= 0, 'validarResponsableRegistroAceitePM19 no encontrada');
const fin = src.indexOf('function crearLogicaAceite(', ini);
assert.ok(fin > ini, 'no se pudo acotar validarResponsableRegistroAceitePM19');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin), ctx);

// ---- Positivo: responsable presente, con y sin espacios sobrantes. ----
{
  assert.equal(ctx.validarResponsableRegistroAceitePM19('Juan').ok, true);
  assert.equal(ctx.validarResponsableRegistroAceitePM19('  Juan  ').responsable, 'Juan');
  console.log('P02_PM19_RESPONSABLE_ACEITE_ACEPTA_VALOR_REAL=PASS');
}

// ---- Negativo: vacío, solo espacios, undefined -- todos rechazados igual. ----
{
  assert.equal(ctx.validarResponsableRegistroAceitePM19('').ok, false);
  assert.equal(ctx.validarResponsableRegistroAceitePM19('   ').ok, false);
  assert.equal(ctx.validarResponsableRegistroAceitePM19(void 0).ok, false);
  assert.equal(ctx.validarResponsableRegistroAceitePM19(null).ok, false);
  console.log('P02_PM19_RESPONSABLE_ACEITE_RECHAZA_VACIO=PASS');
}

// ---- Replay: validar dos veces seguidas con entradas distintas no deja estado
// compartido entre llamadas. ----
{
  assert.equal(ctx.validarResponsableRegistroAceitePM19('Ana').ok, true);
  assert.equal(ctx.validarResponsableRegistroAceitePM19('').ok, false);
  assert.equal(ctx.validarResponsableRegistroAceitePM19('Ana').responsable, 'Ana');
  console.log('P02_PM19_RESPONSABLE_ACEITE_SIN_ESTADO_COMPARTIDO=PASS');
}

console.log('PM19 P02 (aceite responsable obligatorio) — función pura: contrato OK');
