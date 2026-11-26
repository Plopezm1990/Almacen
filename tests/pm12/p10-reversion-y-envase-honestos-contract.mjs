import fs from 'node:fs';
import assert from 'node:assert/strict';

// inv-16, inv-17 e inv-06: tres pantallas de confirmación del almacén, medidas
// pulsándolas en QA el 16/11/2026 con sesión de Propietario.
//
// Las tres compartían el mismo defecto de fondo, el que lleva todo el rediseño:
// la pantalla dice una cosa y el programa hace otra. Aquí se fija lo contrario.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---------------------------------------------------------------------------
// inv-16 — "Revertir aplicación duplicada"
// ---------------------------------------------------------------------------
//
// 1. No decía QUÉ conteo se iba a revertir. Decía "este conteo", y el diálogo
//    tapa la pantalla; en el historial de QA hay 231 conteos. Si abres el que
//    no era, el diálogo no te da forma de enterarte.
{
  const ini = src.indexOf('confirmarRevertirDuplicado && /* @__PURE__ */');
  assert.ok(ini >= 0, 'no se encontró el diálogo de revertir aplicación duplicada');
  const dialogo = src.slice(ini, src.indexOf('resultadoRevertir && ', ini));

  assert.match(dialogo, /"Conteo del ", activo\.fecha \|\| "\(sin fecha\)"/,
    'el diálogo tiene que nombrar el conteo que se va a revertir, con su fecha');
  assert.match(dialogo, /activo\.responsables && activo\.responsables\.contadoPor/,
    'y quién lo contó, que es lo que distingue dos conteos del mismo día');
  assert.match(dialogo, /activo\.ajustesAplicadosEn/,
    'y cuándo se aplicaron los ajustes que se van a deshacer');
  console.log('P10_INV16_EL_DIALOGO_DICE_QUE_CONTEO=PASS');

  // 2. Prometía un resultado que el programa no produce. Decía "Si se aplicó
  //    dos veces, la primera aplicación (la correcta) queda intacta", como si
  //    la reversión fuese a ocurrir. Con la aplicación conectada no ocurre
  //    nunca: revertirUltimaAplicacion se niega antes de tocar nada.
  assert.doesNotMatch(dialogo, /la primera aplicaci\\xF3n \(la correcta\) queda intacta/,
    'no se puede volver a prometer una reversión que el programa no hace');
  assert.match(dialogo, /el stock lo lleva el servidor/,
    'el diálogo tiene que decir, antes de pulsar, quién lleva el stock');
  assert.match(dialogo, /En ning\\xFAn caso se toca el stock desde aqu\\xED/,
    'y que pulsar aquí no mueve existencias');
  console.log('P10_INV16_NO_PROMETE_LO_QUE_NO_HACE=PASS');
}

// ---------------------------------------------------------------------------
// inv-17 — "No se pudo revertir"
// ---------------------------------------------------------------------------
//
// La negativa del duplicado estaba escrita en nuestro idioma: "Este ajuste
// antiguo requiere reconciliación antes de revertir stock." Ni dice qué pasó,
// ni si se tocó algo, ni qué hacer después.
{
  const ini = src.indexOf('function revertirUltimaAplicacion(');
  assert.ok(ini >= 0, 'revertirUltimaAplicacion no encontrada');
  const fin = src.indexOf('function aplicarAjustes(', ini);
  const logica = src.slice(ini, fin);

  assert.doesNotMatch(logica, /ajuste antiguo requiere reconciliaci\xF3n/,
    'el aviso no puede volver a estar escrito en jerga interna');

  const negativa = logica.match(/codigo: "duplicado_legacy_requiere_revision", error: "([^"]+)"/);
  assert.ok(negativa, 'no se encontró la negativa del duplicado');
  const texto = negativa[1];
  assert.match(texto, /No se ha tocado nada/, 'tiene que decir que no se tocó nada');
  assert.match(texto, /el stock lo lleva el servidor/, 'y por qué no se corrige desde aquí');
  assert.match(texto, /pide que se revise el duplicado/, 'y qué hacer a continuación');
  console.log('P10_INV17_LA_NEGATIVA_SE_ENTIENDE=PASS');

  // Las dos salidas que hay antes de tocar stock siguen antes de tocar stock:
  // es lo que hace que pulsar "Confirmar reversión" en QA sea inofensivo.
  const iLote = logica.indexOf('lotes.length < 2');
  const iRemoto = logica.indexOf('remotoAtomico()');
  const iStock = logica.indexOf('aplicarMovimientoStock(');
  assert.ok(iLote > 0 && iRemoto > iLote && iStock > iRemoto,
    'primero se descarta que no haya duplicado, luego que el stock sea del servidor, y solo después se tocaría stock');
  console.log('P10_INV17_NINGUNA_SALIDA_TOCA_STOCK=PASS');
}

// ---------------------------------------------------------------------------
// inv-06 — "Ojo: has cambiado el contenido del envase"
// ---------------------------------------------------------------------------
//
// El diálogo ofrece convertir las fichas de costo, pero no enseñaba en qué se
// quedan. Comprobado en QA: una ficha de 1,00 botella pasó a 2,00 y su coste
// de €2,00 a €4,00, con el margen de 70,27% a 40,54%, sin que el diálogo
// hubiera mostrado ninguna de esas cifras.
{
  const ini = src.indexOf('avisoContenido && /* @__PURE__ */');
  assert.ok(ini >= 0, 'no se encontró el aviso de cambio de envase');
  const dialogo = src.slice(ini, ini + 4000);

  assert.doesNotMatch(dialogo, /ficha\(s\) de costo que usan este producto/,
    '"1 ficha(s) ... que usan" no es como se habla');
  assert.match(dialogo, /avisoContenido\.fichas\.length === 1 \? "Hay 1 ficha de costo que usa este producto\."/,
    'con una ficha, en singular');

  assert.match(dialogo, /fmt\(cantAntes\), " \\u2192 ", fmt\(cantAntes \* factorAviso\)/,
    'cada ficha tiene que enseñar en qué cantidad se queda');
  assert.match(dialogo, /coste \\u20AC" \+ fmt\(costeAntes\) \+ " \\u2192 \\u20AC" \+ fmt\(costeAntes \* factorAviso\)/,
    'y en qué coste, que es lo que se mueve sin avisar');
  assert.match(dialogo, /repasa tambi\\xE9n su precio de compra/,
    'y advertir de que el precio sigue siendo por envase');
  console.log('P10_INV06_EL_AVISO_ENSENA_LAS_CIFRAS=PASS');

  // La cuenta es la de siempre: el factor que ya usaba convertirFichasAfectadas.
  assert.match(src, /const factor = avisoContenido\.contenidoAntes \/ avisoContenido\.contenidoAhora;/,
    'la conversión real no cambia');
  assert.match(dialogo, /const factorAviso = avisoContenido\.contenidoAntes \/ avisoContenido\.contenidoAhora;/,
    'y lo que se enseña se calcula con el mismo factor, no con otro');
  console.log('P10_INV06_LO_QUE_ENSENA_ES_LO_QUE_HARA=PASS');
}

console.log('PM12 P10 — reversión duplicada y cambio de envase honestos: contrato OK');
