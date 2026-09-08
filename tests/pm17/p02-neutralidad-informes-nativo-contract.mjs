import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM17 P02 (lote 2): la neutralización de puntuaciones/recomendaciones de IA en
// Prefiltros y Entrevistas dependía por completo de seleccion-neutral-patch.js, un
// archivo externo cargado por red en runtime (ver docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md).
// Este lote porta la MISMA lógica de clasificación (formato antiguo vs. campos
// neutrales) al código nativo, como funciones puras comprobables sin DOM ni red.
//
// LA-024 pide explícitamente "no reimplementar si el cambio existente ya está
// presente": estas dos funciones replican, deliberadamente, la misma clasificación que
// ya usaba el parche (parchearInformeEntrevista/parchearModalPrefiltro), solo que ahora
// decide qué renderiza React en vez de qué oculta un MutationObserver después.

const src = fs.readFileSync('fuente.js', 'utf8');

function extraerFuncion(nombre, hastaMarcador) {
  const ini = src.indexOf(`function ${nombre}(`);
  assert.ok(ini >= 0, `${nombre} no encontrada`);
  const fin = src.indexOf(hastaMarcador, ini);
  assert.ok(fin > ini, `no se pudo acotar ${nombre}`);
  return src.slice(ini, fin);
}

function nuevoContexto(codigo) {
  const ctx = { console, Object };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return ctx;
}

// ---- informeEntrevistaTieneCamposNeutralesPM17: positivo/negativo/replay ----
{
  const codigo = extraerFuncion('informeEntrevistaTieneCamposNeutralesPM17', 'function prefiltroEsFormatoAntiguoPM17(');
  const ctx = nuevoContexto(codigo);

  // Negativo: informe sin ningún campo neutral (el formato actual, generado hoy por la
  // Edge Function entrevista-personal) -- debe tratarse como "sin campos neutrales".
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({
    recomendacion_final: 'contratar', puntuaciones: { camarero: { puntuacion: 90 } }
  }), false, 'un informe solo con campos puntuados no tiene campos neutrales');
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17(null), false);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({}), false);

  // Positivo: cualquiera de los campos neutrales presente basta.
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ resumen: 'Buena actitud.' }), true);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ experiencia: 'Camarero 2 años.' }), true);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ disponibilidad: 'Fines de semana.' }), true);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ evidencias_aportadas: ['Trabajó en barra.'] }), true);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ situaciones_tratadas: ['Cliente enfadado.'] }), true);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ cuestiones_a_aclarar: ['Confirmar horario.'] }), true);

  // Replay: un array neutral vacío no cuenta como presente (no hay nada real que mostrar).
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ evidencias_aportadas: [] }), false);
  assert.equal(ctx.informeEntrevistaTieneCamposNeutralesPM17({ situaciones_tratadas: [], cuestiones_a_aclarar: [] }), false);

  console.log('P02_PM17_INFORME_TIENE_CAMPOS_NEUTRALES=PASS');
}

// ---- prefiltroEsFormatoAntiguoPM17: positivo/negativo/replay ----
{
  const codigo = extraerFuncion('prefiltroEsFormatoAntiguoPM17', 'function InformeEntrevistaNeutralPM17(');
  const ctx = nuevoContexto(codigo);

  // Positivo: cualquiera de las tres claves antiguas presente (aunque sea con valor
  // falsy/0) cuenta como formato antiguo -- es la MISMA regla que ya usaba el parche
  // (hasOwnProperty, no truthiness).
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17({ puntuacion_orientativa: 0 }), true);
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17({ recomendacion: '' }), true);
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17({ avisos: [] }), true);

  // Negativo: sin ninguna de esas tres claves, no es formato antiguo.
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17({ resumen: 'Buen perfil.' }), false);
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17(null), false);
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17(void 0), false);

  // Replay: un resumen que mezcla campos antiguos y neutrales sigue tratándose como
  // antiguo -- coherente con el dato real de hoy (la Edge Function todavía genera las
  // claves antiguas, así que nunca debe colarse una vista mixta a medio camino).
  assert.equal(ctx.prefiltroEsFormatoAntiguoPM17({ puntuacion_orientativa: 72, resumen: 'Buen perfil.' }), true);

  console.log('P02_PM17_PREFILTRO_FORMATO_ANTIGUO_CLASIFICADO=PASS');
}

console.log('PM17 P02 (neutralidad nativa) — clasificación de informes: contrato OK');
