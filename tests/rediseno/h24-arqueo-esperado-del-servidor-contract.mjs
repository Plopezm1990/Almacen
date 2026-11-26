// Contrato de H-24 (auditoría del TPV, 26/11/2026): «Arqueo de caja» muestra el efectivo esperado del
// servidor, no una cifra reconstruida con el historial local.
//
// Defecto: con el efectivo neto de la sesión en 0,00 € y el servidor esperando 0,00 €, la pantalla mostró
// «Efectivo esperado 1,00 €» (base 2,65 − anulaciones 1,65, sin los dos reembolsos en efectivo). La pantalla
// sumaba `resumenMediosVentaCajaPM09` (movimientos locales) y los movimientos de caja del día, mientras que el
// arqueo que se guarda (`abc_registrar_arqueo_caja`) usa las operaciones de caja de la SESIÓN en el servidor:
// un descuadre falso al cerrar el día.
//
// Corrección: con la cuenta sincronizada la pantalla pide el esperado a `abc_previsualizar_arqueo_caja` (mismo
// cálculo que guarda el arqueo: fondo inicial + entradas − salidas de la sesión). Si no puede obtenerlo, no
// enseña ninguna cifra estimada. En modo local sin servidor se conserva el cálculo local.
//
//   node tests/rediseno/h24-arqueo-esperado-del-servidor-contract.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const leer = (f) => fs.readFileSync(new URL(f, root), 'utf8').replace(/\r\n/g, '\n');
const fuentes = [['fuente.js', leer('fuente.js')], ['fuente-recuperado.js', leer('source-recovery/fuente-recuperado.js')]];

function bloque(codigo, inicio, fin, nombre) {
  const i = codigo.indexOf(inicio);
  assert.ok(i > 0, `${nombre}: existe «${inicio}»`);
  const f = codigo.indexOf(fin, i + inicio.length);
  assert.ok(f > i, `${nombre}: termina en «${fin}»`);
  return codigo.slice(i, f);
}

const arqueos = [];
const consultas = [];
for (const [nombre, codigo] of fuentes) {
  // 1. La consulta al servidor.
  const consulta = bloque(codigo, 'async function consultarEsperadoCajaA24()', '\n  async function registrarDiferenciaCajaA10', nombre);
  consultas.push(consulta);
  assert.match(consulta, /rpc\("abc_previsualizar_arqueo_caja"/, `${nombre}: el esperado sale de abc_previsualizar_arqueo_caja`);
  assert.match(consulta, /expected_amount/, `${nombre}: lee el esperado del servidor`);
  assert.match(consulta, /contextoCierreA10\(\{ conDia: false \}\)/, `${nombre}: usa la sesión y el terminal del servidor`);
  assert.match(consulta, /return \{ ok: false, error: errorRpcA02\(error\) \}/, `${nombre}: un error del servidor se devuelve, no se disimula`);
  assert.match(codigo, /listarEstacionesA10, abrirSesionCajaA10, consultarEsperadoCajaA24, consultarSesionCajaC01/, `${nombre}: la lógica la expone`);
  assert.match(codigo, /const \{ abrirSesionCajaA10, consultarEsperadoCajaA24 \} = crearLogicaVenta\(/, `${nombre}: la pantalla la recibe`);
  assert.match(codigo, /consultarEsperadoServidor: modoSincronizadoPM08\(\) \? consultarEsperadoCajaA24 : null/, `${nombre}: solo con la cuenta sincronizada`);

  // 2. La pantalla.
  const arqueo = bloque(codigo, 'function ArqueoCaja({', '\nvar PLANTILLAS_TURNO', nombre);
  arqueos.push(arqueo);
  assert.match(arqueo, /abrirSesionCajaA10, consultarEsperadoServidor \}\) \{/, `${nombre}: ArqueoCaja recibe la consulta`);
  assert.match(arqueo,
    /const efectivoEsperado = esperadoDelServidor \? esperadoServidor\.estado === "ok" \? redondearDineroPM08\(esperadoServidor\.esperado\) : null : efectivoEsperadoLocal;/,
    `${nombre}: con el servidor, el esperado es el suyo y, si no lo da, NO hay cifra (no cae al cálculo local)`);
  assert.match(arqueo, /const diferencia = Number\.isFinite\(contadoNumero\) && efectivoEsperado !== null \?/,
    `${nombre}: la diferencia no se calcula sin esperado`);
  assert.match(arqueo, /efectivoEsperado === null \? esperadoServidor\.estado === "cargando" \? "Calculando\\u2026" : "No disponible"/,
    `${nombre}: sin esperado se dice «Calculando…» o «No disponible», nunca un importe`);
  assert.match(arqueo, /Calculado por el servidor para la sesión de caja abierta: fondo inicial/,
    `${nombre}: la pantalla explica de dónde sale la cifra`);
  assert.match(arqueo, /No se muestra ninguna cifra estimada/, `${nombre}: el error del servidor se muestra tal cual`);
  assert.match(arqueo, /\["\\u20AC", fmt\(efectivoEsperado\)\]/, `${nombre}: el importe mostrado es el esperado resuelto`);

  // 3. Lo que ya no puede pasar: que la cifra mostrada salga solo del historial local cuando hay servidor.
  const lineas = arqueo.split('\n').filter((l) => /fmt\(efectivoEsperadoLocal\)|efectivoEsperadoLocal\)/.test(l));
  assert.equal(lineas.length, 0, `${nombre}: el esperado local no se pinta en ningún sitio`);
  assert.equal((arqueo.match(/efectivoEsperadoLocal/g) || []).length, 2, `${nombre}: el esperado local solo se declara y se usa como respaldo del modo local`);
}
assert.equal(arqueos[0], arqueos[1], 'ArqueoCaja mantiene paridad con la recuperación');
assert.equal(consultas[0], consultas[1], 'la consulta mantiene paridad con la recuperación');

console.log('H-24 contrato del esperado del arqueo desde el servidor OK');
