// Contrato de H-38b, parte de pantalla (auditoría del TPV, 26/11/2026): la pantalla de cierre lista las
// ventas cobradas sin documento fiscal y permite emitir cada documento pendiente.
//
// El servidor ya bloquea el cierre definitivo con VENTAS_SIN_DOCUMENTO (migración 20261126140000) y expone
// la lista (20261126150000). Aquí se fija lo que hace la pantalla:
//   · lee la lista del servidor para la sesión y el terminal reales (no la deduce del historial local);
//   · «Emitir documento pendiente» usa la emisión de siempre, con el checkout de esa venta (misma operación
//     idempotente que el cobro: si el documento ya existía no se duplica);
//   · al emitir, recarga la lista y descarta el ensayo anterior (ya no vale);
//   · el bloqueo se explica con una frase, no con «Pendiente operativo».
//
//   node tests/rediseno/h38b-emitir-documento-pendiente-contract.mjs
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

const logicas = [];
const componentes = [];
for (const [nombre, codigo] of fuentes) {
  // 1. Lógica.
  const logica = bloque(codigo, 'async function listarVentasSinDocumentoH38b()', '\n  async function registrarDiferenciaCajaA10', nombre);
  logicas.push(logica);
  assert.match(logica, /rpc\("abc_c04_listar_ventas_sin_documento", \{\s*p_empresa_id: contexto\.empresaId,\s*p_local_id: contexto\.localId,\s*p_session_id: contexto\.sessionId\s*\}\)/,
    `${nombre}: la lista sale del servidor para la sesión real`);
  assert.match(logica, /contextoCierreA10\(\{ conDia: false \}\)/, `${nombre}: usa la sesión y el terminal del servidor`);
  assert.match(logica, /emitirCheckoutFiscalC07D\(cuentaId, \{ checkoutId, tipoDocumento: "FACTURA", codigoSerie: "TPV" \}\)/,
    `${nombre}: emite con la emisión de siempre y el checkout de esa venta (operación idempotente)`);
  assert.match(logica, /if \(!cuentaId \|\| !checkoutId\) return \{ ok: false/, `${nombre}: sin cuenta y checkout no emite`);
  assert.match(logica, /if \(!emitido\?\.ok\) return \{ ok: false, error: emitido\?\.error/, `${nombre}: el error de la emisión se devuelve tal cual`);
  assert.equal((codigo.match(/listarEstacionesA10\.listarVentasSinDocumentoH38b = listarVentasSinDocumentoH38b;/g) || []).length, 2, `${nombre}: se expone en los dos puntos de registro`);
  assert.equal((codigo.match(/listarEstacionesA10\.emitirDocumentoPendienteH38b = emitirDocumentoPendienteH38b;/g) || []).length, 2, `${nombre}: la emisión se expone en los dos puntos de registro`);

  // 2. Pantalla.
  const comp = bloque(codigo, 'async function cargarVentasSinDocumento()', '\n  async function refrescarSesionCajaC01', nombre);
  componentes.push(comp);
  assert.match(comp, /setVentasSinDocumento\(r2\?\.ok \? r2\.ventas : null\)/, `${nombre}: sin lectura del servidor no se inventa una lista`);
  assert.match(comp, /emitirDocumentoPendiente\(\{ cuentaId: venta\.cuenta_id, checkoutId: venta\.checkout_id \}\)/, `${nombre}: emite la venta pulsada`);
  assert.match(comp, /setEnsayoCierre\(null\);\s*await cargarVentasSinDocumento\(\);/, `${nombre}: tras emitir descarta el ensayo y recarga la lista`);
  assert.match(comp, /if \(procesando \|\| typeof emitirDocumentoPendiente !== "function"\) return;/, `${nombre}: no emite dos veces a la vez`);
  assert.match(comp, /\[gestionCocinaVisible, requiereApertura, estadoCierre, local\?\.id, configEmpresa\?\.id\]/, `${nombre}: recarga al cambiar el estado del cierre`);
  assert.match(codigo, /"data-h38b-ventas-sin-documento": String\(ventasSinDocumento\.length\)/, `${nombre}: el panel existe`);
  assert.match(codigo, /"Emitir documento pendiente"/, `${nombre}: el botón se llama «Emitir documento pendiente»`);
  assert.match(codigo, /El cierre definitivo no se puede completar hasta emitir el documento de cada una\./, `${nombre}: el panel explica por qué`);
  assert.match(codigo, /VENTAS_SIN_DOCUMENTO: "Hay ventas cobradas sin documento fiscal\. Emite los documentos pendientes\."/, `${nombre}: el ensayo C12 lo explica`);
  assert.match(codigo, /bloqueo === "VENTAS_SIN_DOCUMENTO" \? "Hay ventas cobradas sin documento fiscal\. Emite los documentos pendientes\."/, `${nombre}: los bloqueos del cierre provisional lo explican`);
}
assert.equal(logicas[0], logicas[1], 'la lógica mantiene paridad con la recuperación');
assert.equal(componentes[0], componentes[1], 'la pantalla mantiene paridad con la recuperación');

console.log('H-38b contrato de la pantalla «Emitir documento pendiente» OK');
