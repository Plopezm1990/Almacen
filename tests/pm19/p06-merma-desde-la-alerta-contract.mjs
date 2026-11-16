import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P06: "Registrar merma desde una alerta de caducidad" (ini-06), ejercitada de
// verdad en QA sembrando un lote que caduca en 3 dias.
//
// Lo que se midio, pulsando:
//   1. Con el lote recien recibido, confirmar la merma SI descuenta: stock 6 -> 0 y el
//      saldo de almacen baja 12,00 EUR. Correcto.
//   2. Volviendo a recibir el MISMO lote (mismo producto, mismo codigo de lote, misma
//      caducidad) y pulsando otra vez "Confirmar merma", no se descontaba nada -el motor
//      deduplica por movimientoId, que es justo lo que protege el contrato p04- pero el
//      dialogo se cerraba exactamente igual que cuando si descuenta. El stock seguia en
//      6, la alerta seguia ahi, y la pantalla no decia una palabra.
//   3. El resultado de registrarSalida se tiraba: tambien devuelve false con el almacen
//      congelado por un conteo en curso, y el dialogo se cerraba igual.
//   4. El dialogo no decia lo que iba a pasar: ni la fecha de caducidad -el boton sale ya
//      con 7 dias por delante, asi que normalmente se tira mercancia que aun esta buena-,
//      ni que el stock baja, ni lo que cuesta.
//
// Este contrato fija las tres cosas: que las cifras se vean antes, que un lote ya
// registrado se diga en vez de pasar por bueno, y que el dialogo cuente como acabo.

const src = fs.readFileSync('fuente.js', 'utf8');

function corte(desde, hasta) {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, 'no encuentro el ancla: ' + desde);
  const fin = src.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, 'no encuentro el final: ' + hasta);
  return src.slice(ini, fin);
}

// ---- Las dos ayudas de texto, ejecutadas de verdad. ----
{
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(corte('function fechaCortaPM19(', 'function crearMotorStock('), ctx);

  assert.equal(ctx.fechaCortaPM19('2026-11-19'), '19/11/2026', 'la fecha se dice como se lee en España');
  assert.equal(ctx.fechaCortaPM19(''), '', 'sin fecha no se inventa ninguna');
  assert.equal(ctx.fechaCortaPM19(null), '', 'ni con null');
  assert.equal(ctx.fechaCortaPM19('raro'), 'raro', 'lo que no es una fecha se deja tal cual, no se maquilla');

  assert.equal(ctx.cuandoCaducaPM19(3), 'caduca dentro de 3 días');
  assert.equal(ctx.cuandoCaducaPM19(1), 'caduca dentro de 1 día', 'un día, en singular');
  assert.equal(ctx.cuandoCaducaPM19(0), 'caduca hoy');
  assert.equal(ctx.cuandoCaducaPM19(-2), 'caducó hace 2 días');
  assert.equal(ctx.cuandoCaducaPM19(-1), 'caducó hace 1 día', 'un día, en singular, también en pasado');
  assert.equal(ctx.cuandoCaducaPM19('x'), '', 'sin número no se dice nada en vez de decir "NaN días"');

  console.log('P06_LAS_AYUDAS_DE_FECHA_DICEN_LA_VERDAD=PASS');
}

// ---- El dialogo de la alerta. ----
const dialogo = corte('confirmarMermaLote && (() => {', '})()));');

// 1. Antes de confirmar se ve la fecha, el stock y lo que cuesta.
{
  assert.match(dialogo, /fechaCortaPM19\(confirmarMermaLote\.caducidad\)/, 'el diálogo debe decir qué día caduca el lote');
  assert.match(dialogo, /cuandoCaducaPM19\(confirmarMermaLote\.dias\)/, 'y si ya caducó o cuánto le queda: el botón sale con 7 días por delante');
  assert.match(dialogo, /"El stock baja de ", .*fmt\(stockAntes\).*fmt\(stockDespues\)/, 'y que el stock baja, de cuánto a cuánto');
  assert.match(dialogo, /costeMerma > 0 \?/, 'y lo que pierde el almacén, cuando hay coste');
  assert.match(dialogo, /const costeMerma = \(prodMerma \? Number\(prodMerma\.costo\) \|\| 0 : 0\) \* \(Number\(confirmarMermaLote\.unidades\) \|\| 0\)/, 'el coste sale del coste real del producto por las unidades, no de un número suelto');
  assert.match(dialogo, /confirmarMermaLote\.parcial \?/, 'y cuando la cifra es un reparto aproximado, se dice: la lista ya avisa con "quedan aprox."');
  console.log('P06_EL_DIALOGO_ENSENA_LO_QUE_VA_A_PASAR=PASS');
}

// 2. Un lote ya registrado no se deja pasar por bueno.
{
  assert.match(dialogo, /const idMerma = movimientoIdMermaLotePM19\(confirmarMermaLote\);/, 'la identidad que se comprueba tiene que ser la MISMA con la que deduplica el motor');
  assert.match(dialogo, /const yaRegistrada = \(movimientos \|\| \[\]\)\.some\(\(m22\) => String\(m22\.id \|\| ""\) === idMerma\);/, 'y se comprueba mirando los movimientos que ya hay');
  assert.match(dialogo, /no descontar\\xEDa nada/, 'y se dice en castellano llano que confirmar no descontaría nada');
  assert.match(dialogo, /an\\xF3talo desde Mermas/, 'y se dice dónde sí se puede anotar');

  const ya = dialogo.slice(dialogo.indexOf('yaRegistrada ? ['), dialogo.indexOf('] : ['));
  assert.doesNotMatch(ya, /registrarSalida\(/, 'esa rama no debe ofrecer confirmar: no haría nada');
  console.log('P06_EL_LOTE_YA_REGISTRADO_NO_PASA_POR_BUENO=PASS');
}

// 3. El almacen congelado se dice antes de pulsar, no despues de no pasar nada.
{
  assert.match(src, /diagnosticoStock = \[\], registrarSalida, almacenCongelado = false, itemsPermitidos = null/, 'el panel tiene que recibir si el almacén está congelado');
  assert.match(src, /diagnosticoStock: diagnosticoStockInforme,\n      registrarSalida,\n      almacenCongelado\n    \}/, 'y quien lo monta tiene que pasárselo');
  assert.match(dialogo, /almacenCongelado \? \[/, 'y el diálogo tiene que mirarlo antes de ofrecer nada');
  assert.match(dialogo, /El almac\\xE9n est\\xE1 congelado por un conteo en curso/, 'con el motivo dicho');
  assert.match(dialogo, /Inventario ciego/, 'y dónde se arregla');

  const cong = dialogo.slice(dialogo.indexOf('almacenCongelado ? ['), dialogo.indexOf('yaRegistrada ? ['));
  assert.doesNotMatch(cong, /registrarSalida\(/, 'con el almacén congelado no se ofrece confirmar: registrarSalida devolvería false');
  console.log('P06_EL_ALMACEN_CONGELADO_SE_DICE_ANTES=PASS');
}

// 4. El resultado de la escritura ya no se tira, y el dialogo cuenta como acabo.
{
  assert.match(dialogo, /const hecho = await registrarSalida\(confirmarMermaLote\.productoId, confirmarMermaLote\.unidades, \{ motivo: "Merma \/ caducidad"/, 'hay que esperar al resultado de registrarSalida');
  assert.match(dialogo, /setResultadoMermaLote\(hecho\?\.ok \? \{ ok: true/, 'y contar el resultado, no cerrar y callar');
  assert.match(dialogo, /hecho\?\.error \|\| "No se pudo confirmar la merma\."/, 'y si la respuesta se pierde, no afirmar que el servidor no registró nada');
  assert.match(dialogo, /role: "status"/, 'el resultado se anuncia, no solo se ve');

  // La prueba de que ya no se cierra a ciegas: tras la llamada no hay ningun
  // setConfirmarMermaLote(null) que la siga sin mirar el resultado.
  const traslallamada = dialogo.slice(dialogo.indexOf('const hecho = await registrarSalida('));
  assert.doesNotMatch(traslallamada.slice(0, traslallamada.indexOf('setResultadoMermaLote(')), /setConfirmarMermaLote\(null\)/, 'el diálogo no puede cerrarse antes de saber si se descontó algo');
  console.log('P06_EL_RESULTADO_NO_SE_TIRA=PASS');
}

// 5. Ninguna de las salidas del dialogo toca el stock por su cuenta.
{
  const llamadas = dialogo.match(/registrarSalida\(/g) || [];
  assert.equal(llamadas.length, 1, 'el diálogo solo puede escribir en un sitio, el botón de confirmar');
  assert.match(dialogo, /movimientoId: movimientoIdMermaLotePM19\(confirmarMermaLote\)/, 'y esa escritura sigue llevando el id determinista que protege de descontar dos veces');
  console.log('P06_UNA_SOLA_PUERTA_AL_STOCK=PASS');
}

console.log('PM19 P06 (merma desde la alerta) — el diálogo dice lo que va a pasar y lo que pasó: contrato OK');
