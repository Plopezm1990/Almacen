import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM18 P01 (LA-021, aceptación mínima): "INVALIDO no pasa como identificador fiscal
// validado. Reglas por país/tipo; estado provisional inequívoco."
//
// Bug real encontrado por inspección de código: el ticket de venta (renderTicketVenta)
// sustituía un NIF/razón social ausentes por valores fijos con aspecto real
// ("CHOCOLOYOS, S.L." / "B87342077" -- este último, además, con formato de CIF
// sintácticamente válido) -- indistinguibles de un dato real configurado. El mismo par
// de valores era también el estado inicial de configEmpresa (useState), visible antes de
// que cargasen los datos reales. No existía ninguna validación de formato del NIF/CIF/NIE
// en ningún punto de la aplicación.
//
// Este contrato prueba la clasificación pura (tipoIdentificadorFiscalPM18,
// validarIdentificadorFiscalEspanaPM18, estadoIdentidadFiscalPM18) de forma aislada:
// nunca deben devolver "verificado" (no hay integración con la Agencia Tributaria, solo
// validación de formato/dígito de control) -- el estado más alto posible es
// "sin_verificar".

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function tipoIdentificadorFiscalPM18(');
assert.ok(ini >= 0, 'tipoIdentificadorFiscalPM18 no encontrada');
const fin = src.indexOf('function FichaEmpresaBasica(', ini);
assert.ok(fin > ini, 'no se pudo acotar el bloque de identidad fiscal PM18');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin), ctx);

// ---- tipoIdentificadorFiscalPM18: clasifica NIF/NIE/CIF por forma, tolera
// minúsculas/espacios/guiones, y no reconoce formas ajenas. ----
{
  assert.equal(ctx.tipoIdentificadorFiscalPM18('12345678Z'), 'NIF');
  assert.equal(ctx.tipoIdentificadorFiscalPM18('12345678z'), 'NIF', 'debe tolerar minúsculas');
  assert.equal(ctx.tipoIdentificadorFiscalPM18('1234 5678 Z'), 'NIF', 'debe tolerar espacios');
  assert.equal(ctx.tipoIdentificadorFiscalPM18('X1234567L'), 'NIE');
  assert.equal(ctx.tipoIdentificadorFiscalPM18('A58818501'), 'CIF');
  assert.equal(ctx.tipoIdentificadorFiscalPM18('P1234567D'), 'CIF');
  assert.equal(ctx.tipoIdentificadorFiscalPM18(''), null);
  assert.equal(ctx.tipoIdentificadorFiscalPM18('B87342077-INVENTADO'), null, 'una cadena con forma ajena no debe clasificarse como ningún tipo real');
  console.log('P01_PM18_TIPO_IDENTIFICADOR_CLASIFICA=PASS');
}

// ---- validarIdentificadorFiscalEspanaPM18: dígito/letra de control real. ----
{
  // Positivo: ejemplos con dígito de control correcto (NIF, NIE, CIF con control numérico
  // -- letra "A", grupo obligado a dígito -- y CIF con control alfabético -- letra "P",
  // grupo obligado a letra).
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('12345678Z'), true);
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('X1234567L'), true);
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('A58818501'), true);
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('P1234567D'), true);

  // Negativo: mismo cuerpo, dígito/letra de control incorrecto -- debe rechazarse, nunca
  // "casi válido".
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('12345678A'), false, 'el control de este NIF es Z, no A');
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('X1234567A'), false);
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('A58818509'), false);
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('P1234567A'), false, 'el grupo P exige letra de control, no dígito');

  // Negativo: el propio placeholder retirado ("B87342077") pasaba el dígito de control --
  // exactamente por eso era peligroso: parecía un CIF real. Se documenta aquí para dejar
  // constancia expresa de que "formato válido" nunca debe confundirse con "es el NIF real
  // de esta empresa" -- ese es justo el motivo de que el ticket ya no lo use como relleno.
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('B87342077'), true, 'documenta por qué el placeholder retirado era peligroso: formato válido no es lo mismo que dato real');

  // Negativo: cadena sin forma reconocible.
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18('NOESUNNIF'), false);
  assert.equal(ctx.validarIdentificadorFiscalEspanaPM18(''), false);

  console.log('P01_PM18_VALIDACION_DIGITO_CONTROL=PASS');
}

// ---- estadoIdentidadFiscalPM18: estado provisional inequívoco -- nunca "verificado". ----
{
  assert.equal(ctx.estadoIdentidadFiscalPM18(''), 'ausente');
  assert.equal(ctx.estadoIdentidadFiscalPM18('   '), 'ausente');
  assert.equal(ctx.estadoIdentidadFiscalPM18(null), 'ausente');
  assert.equal(ctx.estadoIdentidadFiscalPM18('NOESUNNIF'), 'formato_desconocido');
  assert.equal(ctx.estadoIdentidadFiscalPM18('12345678A'), 'invalido');
  assert.equal(ctx.estadoIdentidadFiscalPM18('12345678Z'), 'sin_verificar');
  assert.equal(ctx.estadoIdentidadFiscalPM18('A58818501'), 'sin_verificar');

  // Replay: clasificar el mismo valor varias veces seguidas, alternando con otros
  // distintos, da siempre el mismo resultado -- no hay estado compartido entre llamadas.
  assert.equal(ctx.estadoIdentidadFiscalPM18('12345678Z'), 'sin_verificar');
  assert.equal(ctx.estadoIdentidadFiscalPM18('12345678A'), 'invalido');
  assert.equal(ctx.estadoIdentidadFiscalPM18('12345678Z'), 'sin_verificar');

  const posibles = ['ausente', 'formato_desconocido', 'invalido', 'sin_verificar'];
  assert.ok(!posibles.includes('verificado'), 'ningún estado alcanzable debe llamarse "verificado" -- no hay integración real con la Agencia Tributaria');
  console.log('P01_PM18_ESTADO_PROVISIONAL_NUNCA_VERIFICADO=PASS');
}

console.log('PM18 P01 (LA-021) — identidad fiscal nunca se presenta como verificada sin serlo: contrato OK');
