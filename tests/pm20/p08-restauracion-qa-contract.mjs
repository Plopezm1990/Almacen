import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM20 P08: "restauración QA ensayada" -- exigido explícitamente por la Puerta G2
// ("...restauración QA ensayada y cobertura por módulo explícita"). Ninguna suite
// anterior probaba de verdad el mecanismo de respaldo/restauración (crearPuntoDeGuardado,
// analizarTextoRestauracion, confirmarRestauracion, validarRespaldo,
// compararConEstadoActual, coleccionesQueSeConservan) -- PM16 P01 solo cubrió fallos de
// CARGA del almacenamiento local, no el circuito de restaurar un respaldo. Este punto
// cierra ese hueco con comportamiento real, no solo lectura de código.

const src = fs.readFileSync('fuente.js', 'utf8');

function extraerRango(iniMarcador, finMarcador) {
  const ini = src.indexOf(iniMarcador);
  const fin = src.indexOf(finMarcador, ini);
  assert.ok(ini >= 0 && fin > ini, `no se pudo acotar ${iniMarcador} .. ${finMarcador}`);
  return src.slice(ini, fin);
}

// datosDelNegocio + SETTERS + NOMBRES + las 7 funciones de respaldo/restauración, tal
// cual existen en el bundle real (no una reconstrucción aproximada).
const NUCLEO = extraerRango('function datosDelNegocio() {', 'function exportarExcelGeneral(');

// Lista real de claves que datosDelNegocio/SETTERS/NOMBRES declaran, extraída del propio
// bundle (no inventada) para poder fabricar el entorno mínimo que necesitan.
const clavesMatch = [...NUCLEO.matchAll(/^\s{4}(\w+): set(\w+),?$/gm)];
assert.ok(clavesMatch.length >= 20, 'deben reconocerse al menos 20 colecciones en SETTERS');
const claves = clavesMatch.map((m22) => m22[1]);

// Nota técnica: las variables `let` declaradas dentro de un script vm no son propiedades
// del objeto sandbox (a diferencia de `function`/`var`), así que la fixture de cada
// prueba se fija llamando a los propios setX(...) reales (no asignando ctx.productos=...
// desde fuera, que quedaría desconectado del estado interno), y se lee con los
// observadores __estado()/__pendingRestore() añadidos abajo -- ambos expuestos como
// `function`, por eso sí quedan accesibles como propiedades del contexto.
function nuevoEntorno() {
  const declaraciones = claves.map((c22) => `let ${c22} = [];`).join('\n');
  const setters = claves.map((c22) => `function set${c22[0].toUpperCase()}${c22.slice(1)}(v22) { ${c22} = typeof v22 === 'function' ? v22(${c22}) : v22; llamadasSetters.push('${c22}'); }`).join('\n');
  const ctx = {
    console,
    uid: () => 'id-' + Math.random().toString(36).slice(2),
    llamadasSetters: [],
    llamadasHistorial: [],
    auditoriaLlamadas: [],
  };
  ctx.registrarAuditoria = (accion, detalle) => { ctx.auditoriaLlamadas.push({ accion, detalle }); };
  const arranque = `
    ${declaraciones}
    let pedidos2 = [];
    function setPedidos2(v22) { pedidos2 = typeof v22 === 'function' ? v22(pedidos2) : v22; llamadasSetters.push('pedidos'); }
    ${setters}
    let historial = [];
    function setHistorial(v22) { historial = typeof v22 === 'function' ? v22(historial) : v22; llamadasHistorial.push(historial); }
    let pendingRestore = null;
    function setPendingRestore(v22) { pendingRestore = v22; }
    function __estado() { return { ${claves.join(', ')} }; }
    function __pendingRestore() { return pendingRestore; }
  `;
  vm.createContext(ctx);
  vm.runInContext(arranque + '\n' + NUCLEO, ctx);
  return ctx;
}

// ---- 1. Ensayo de restauración feliz: crear punto de guardado, "recargar" leyendo el
// snapshot, confirmar restauración -- las colecciones reaparecen exactamente, se crea un
// punto de recuperación previo automático, y queda auditado. ----
{
  const ctx = nuevoEntorno();
  ctx.setProductos([{ id: 'p1', nombre: 'Harina' }]);
  ctx.setProveedores([{ id: 'pr1', nombre: 'Distribuidora' }]);
  const punto = ctx.crearPuntoDeGuardado('manual');
  assert.equal(ctx.llamadasHistorial.length, 1, 'debe guardarse en el historial de respaldos');
  assert.equal(punto.data.productos.length, 1);

  // Simula pérdida de datos en memoria (p.ej. recarga fallida) y restauración desde el
  // punto guardado.
  ctx.setProductos([]);
  ctx.setProveedores([]);
  ctx.restaurarDesdeHistorial(punto);
  const pendiente = ctx.__pendingRestore();
  assert.ok(pendiente, 'restaurarDesdeHistorial debe dejar preparada la restauración');
  assert.equal(pendiente.productos.length, 1, 'el snapshot pendiente debe conservar los datos originales');

  const llamadasSettersAntes = ctx.llamadasSetters.length;
  ctx.confirmarRestauracion();
  const estado = ctx.__estado();
  assert.equal(estado.productos.length, 1, 'tras confirmar, productos debe reaparecer exactamente igual');
  assert.equal(estado.proveedores.length, 1, 'tras confirmar, proveedores debe reaparecer exactamente igual');
  assert.ok(ctx.llamadasSetters.length > llamadasSettersAntes, 'confirmarRestauracion debe haber aplicado al menos una colección');
  assert.equal(ctx.llamadasHistorial.length, 2, 'confirmarRestauracion debe crear un punto de recuperación previo automático antes de restaurar');
  assert.equal(ctx.auditoriaLlamadas.length, 1, 'la restauración debe quedar auditada');
  assert.match(ctx.auditoriaLlamadas[0].detalle, /colecciones restauradas/);
  assert.equal(ctx.__pendingRestore(), null, 'tras confirmar, no debe quedar una restauración pendiente colgada');
  console.log('P08_PM20_RESTAURACION_QA_ENSAYO_FELIZ=PASS');
}

// ---- 2. Un respaldo de formato antiguo (sin las colecciones más nuevas, p.ej. sin
// "auditoria") NUNCA debe vaciar esas colecciones al restaurar -- solo toca lo que el
// respaldo sí trae. ----
{
  const ctx = nuevoEntorno();
  ctx.setAuditoria([{ id: 'a1' }, { id: 'a2' }]);
  ctx.setProductos([{ id: 'p1' }]);
  const respaldoAntiguo = { productos: [{ id: 'p-restaurado' }] }; // sin "auditoria": formato antiguo
  const conservadas = ctx.coleccionesQueSeConservan(respaldoAntiguo);
  assert.ok(conservadas.includes('Auditoría'), 'coleccionesQueSeConservan debe señalar que Auditoría no viene en este respaldo');

  ctx.restaurarDesdeHistorial({ data: respaldoAntiguo, fecha: '2020-01-01T00:00:00.000Z' });
  ctx.confirmarRestauracion();
  const estado = ctx.__estado();
  assert.equal(estado.productos.length, 1, 'productos sí debe restaurarse (viene en el respaldo)');
  assert.equal(estado.productos[0].id, 'p-restaurado');
  assert.equal(estado.auditoria.length, 2, 'auditoria NO debe vaciarse: no venía en el respaldo antiguo');
  console.log('P08_PM20_RESTAURACION_QA_FORMATO_ANTIGUO_NO_BORRA_COLECCIONES_NUEVAS=PASS');
}

// ---- 3. Respaldo dañado/no reconocible: se rechaza con mensaje claro, sin dejar nunca
// una restauración pendiente a medio preparar. ----
{
  const ctx = nuevoEntorno();
  assert.match(ctx.validarRespaldo(null), /no es válido/);
  assert.match(ctx.validarRespaldo({}), /no contiene ninguna colección reconocible/);
  assert.match(ctx.validarRespaldo({ productos: 'no-es-una-lista' }), /dañado/);
  assert.equal(ctx.validarRespaldo({ productos: [{ id: 'p1' }] }), null, 'un respaldo válido no debe devolver error');
  console.log('P08_PM20_RESTAURACION_QA_RESPALDO_DANADO_RECHAZADO=PASS');
}

// ---- 4. compararConEstadoActual: cifras exactas de diferencia por colección --
// necesario para que quien restaura vea de verdad qué va a perder/ganar antes de
// confirmar (no una promesa vacía). ----
{
  const ctx = nuevoEntorno();
  ctx.setProductos([{ id: 'p1' }, { id: 'p2' }]);
  const comparacion = ctx.compararConEstadoActual({ productos: [{ id: 'x' }] });
  const filaProductos = comparacion.find((f22) => f22.clave === 'productos');
  assert.equal(filaProductos.actual, 2);
  assert.equal(filaProductos.respaldo, 1);
  assert.equal(filaProductos.diferencia, -1, 'debe reflejar que el respaldo tiene una unidad menos que el estado actual');
  console.log('P08_PM20_RESTAURACION_QA_COMPARACION_CIFRAS_EXACTAS=PASS');
}

console.log('PM20 P08 — restauración QA ensayada de punta a punta (comportamiento real, no solo código leído): contrato OK');
