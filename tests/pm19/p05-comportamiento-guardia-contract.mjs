import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P05: prueba de comportamiento real (no solo estática) de la guardia de contexto en
// una función representativa de cada uno de los cinco módulos -- positivo (local activo y
// autorizado: la mutación llega a ejecutarse) y negativo (sin local activo/"Todos"/local
// inactivo: la mutación NUNCA se invoca, cero cambios parciales). La cobertura de que
// validarContextoEscrituraPM10 en sí clasifica bien los 5 casos exigidos ya está en
// p05-validar-contexto-escritura-contract.mjs; aquí se prueba la INTEGRACIÓN real de cada
// módulo con esa única autoridad.

const src = fs.readFileSync('fuente.js', 'utf8');

function extraer(nombre, hasta) {
  const ini = src.indexOf(`function ${nombre}(`);
  assert.ok(ini >= 0, `${nombre} no encontrada`);
  const fin = src.indexOf(hasta, ini);
  assert.ok(fin > ini, `no se pudo acotar ${nombre}`);
  return src.slice(ini, fin);
}

const FN_CONTEXTO = extraer('errorValidacionPM10', 'function numeroPM10(') +
  extraer('validarContextoEscrituraPM10', 'function validarProductoPM10(');

const LOCALES = [{ id: 'l1', nombre: 'Centro', activo: true, empresaId: 'e1' }];

function nuevoContexto(codigoExtra) {
  const llamadas = { mutaciones: 0 };
  const ctx = {
    console,
    llamadas,
    crearMotorStock: () => ({ aplicarMovimientoStock: () => { llamadas.mutaciones++; return { ok: true, movimiento: { stockPosterior: 0 } }; } }),
    uid: () => 'id-' + Math.random().toString(36).slice(2),
    todayISO: () => '2026-01-01',
    ivaDe: () => 0,
    precioNeto: () => 0,
    MOTIVOS_MERMA: ['Merma / caducidad']
  };
  vm.createContext(ctx);
  vm.runInContext(FN_CONTEXTO + (codigoExtra || ''), ctx);
  return ctx;
}

// ---- 1. Productos (deleteProducto): borrado lógico real vs. bloqueado. ----
{
  const codigo = extraer('crearLogicaProductos', 'function fechaValidaPedidoPM10(');
  const ctxNeg = nuevoContexto(codigo);
  const productosNeg = [{ id: 'p1', nombre: 'Harina', localId: 'l1', activo: true }];
  const setProductosNeg = (fn) => { llamadasSetProductos.push(fn); };
  const llamadasSetProductos = [];
  const logicaNeg = ctxNeg.crearLogicaProductos({ productos: productosNeg, setProductos: setProductosNeg, movimientos: [], setMovimientos: () => {}, registrarAuditoria: () => {}, almacenCongelado: false, addGasto: null, localActivoId: null, locales: LOCALES });
  logicaNeg.deleteProducto('p1');
  assert.equal(llamadasSetProductos.length, 0, 'sin local activo (Todos), deleteProducto no debe mutar nada');

  const ctxPos = nuevoContexto(codigo);
  const productosPos = [{ id: 'p1', nombre: 'Harina', localId: 'l1', activo: true }];
  const llamadasSetProductosPos = [];
  const logicaPos = ctxPos.crearLogicaProductos({ productos: productosPos, setProductos: (fn) => llamadasSetProductosPos.push(fn), setMovimientos: () => {}, movimientos: [], registrarAuditoria: () => {}, almacenCongelado: false, addGasto: null, localActivoId: 'l1', locales: LOCALES });
  logicaPos.deleteProducto('p1');
  assert.equal(llamadasSetProductosPos.length, 1, 'con local activo real, deleteProducto debe ejecutar el borrado lógico');
  console.log('P05_PM19_COMPORTAMIENTO_PRODUCTOS_DELETEPRODUCTO=PASS');
}

// ---- 2. Producción (producir): solo con local desactivado se bloquea antes de tocar
// stock; con local activo, la producción llega hasta aplicarMovimientoStock. ----
{
  const codigo = extraer('crearLogicaProduccion', 'function sincronizarCobroSe\\u00F1al(');
  const localesConInactivo = [...LOCALES, { id: 'l2', nombre: 'Norte', activo: false, empresaId: 'e1' }];
  const ficha = { id: 'f1', nombre: 'Bizcocho', productoVinculadoId: 'p1', rendimiento: 1 };
  const elaborado = { id: 'p1', nombre: 'Bizcocho', localId: 'l1', stock: 0, costo: 0 };

  const ctxNeg = nuevoContexto(codigo);
  const logicaNeg = ctxNeg.crearLogicaProduccion({ fichasCosto: [ficha], productos: [elaborado], setProductos: () => {}, movimientos: [], setMovimientos: () => {}, setOrdenesProduccion: () => {}, registrarAuditoria: () => {}, localActivoId: 'l2', locales: localesConInactivo });
  const resNeg = logicaNeg.producir({ fichaId: 'f1', unidadesDeseadas: 1, unidadesBuenas: 1, ingredientesReales: [], empaqueReal: 0, manoObraReal: 0, gastosGeneralesReal: 0, notas: '' });
  assert.equal(resNeg.ok, false);
  assert.equal(ctxNeg.llamadas.mutaciones, 0, 'con local desactivado, producir no debe tocar stock');

  const ctxPos = nuevoContexto(codigo);
  const logicaPos = ctxPos.crearLogicaProduccion({ fichasCosto: [ficha], productos: [elaborado], setProductos: () => {}, movimientos: [], setMovimientos: () => {}, setOrdenesProduccion: () => {}, registrarAuditoria: () => {}, localActivoId: 'l1', locales: LOCALES });
  const resPos = logicaPos.producir({ fichaId: 'f1', unidadesDeseadas: 1, unidadesBuenas: 1, ingredientesReales: [], empaqueReal: 0, manoObraReal: 0, gastosGeneralesReal: 0, notas: '' });
  assert.equal(resPos.ok, true, resPos.error);
  assert.ok(ctxPos.llamadas.mutaciones > 0, 'con local activo real, producir debe llegar a tocar stock');
  console.log('P05_PM19_COMPORTAMIENTO_PRODUCCION_PRODUCIR=PASS');
}

// ---- 3. Fichas de coste (addFichaCosto): alta bloqueada vs. real. ----
{
  const codigo = extraer('crearLogicaFichasCosto', 'function crearLogicaConteos(');
  const llamadasNeg = [];
  const ctxNeg = nuevoContexto(codigo);
  const logicaNeg = ctxNeg.crearLogicaFichasCosto({ productos: [], setFichasCosto: (fn) => llamadasNeg.push(fn), localActivoId: null, locales: LOCALES });
  logicaNeg.addFichaCosto({ nombre: 'Receta' });
  assert.equal(llamadasNeg.length, 0, 'sin local activo (Todos), addFichaCosto no debe crear nada');

  const llamadasPos = [];
  const ctxPos = nuevoContexto(codigo);
  const logicaPos = ctxPos.crearLogicaFichasCosto({ productos: [], setFichasCosto: (fn) => llamadasPos.push(fn), localActivoId: 'l1', locales: LOCALES });
  logicaPos.addFichaCosto({ nombre: 'Receta' });
  assert.equal(llamadasPos.length, 1, 'con local activo real, addFichaCosto debe crear la ficha');
  console.log('P05_PM19_COMPORTAMIENTO_FICHAS_ADDFICHACOSTO=PASS');
}

// ---- 4. APPCC (registrarAppcc): registro bloqueado vs. real. ----
{
  const codigoBase = extraer('validarRegistroAppccPM19', 'function prepararCancelacionAppccPM19(') +
    extraer('prepararCancelacionAppccPM19', 'function crearLogicaAppcc(') +
    extraer('crearLogicaAppcc', 'function crearLogicaFichaje(');

  const llamadasNeg = [];
  const ctxNeg = nuevoContexto(codigoBase);
  const logicaNeg = ctxNeg.crearLogicaAppcc({ puntosControl: [], registrosAppcc: [], setPuntosControl: () => {}, setRegistrosAppcc: (fn) => llamadasNeg.push(fn), localActivoId: null, registrarAuditoria: () => {}, locales: LOCALES });
  const resNeg = logicaNeg.registrarAppcc({ responsable: 'Ana' });
  assert.equal(resNeg.ok, false);
  assert.equal(llamadasNeg.length, 0, 'sin local activo (Todos), registrarAppcc no debe crear nada');

  const llamadasPos = [];
  const ctxPos = nuevoContexto(codigoBase);
  const logicaPos = ctxPos.crearLogicaAppcc({ puntosControl: [], registrosAppcc: [], setPuntosControl: () => {}, setRegistrosAppcc: (fn) => llamadasPos.push(fn), localActivoId: 'l1', registrarAuditoria: () => {}, locales: LOCALES });
  const resPos = logicaPos.registrarAppcc({ responsable: 'Ana' });
  assert.equal(resPos.ok, true, resPos.error);
  assert.equal(llamadasPos.length, 1, 'con local activo real, registrarAppcc debe crear el registro');
  console.log('P05_PM19_COMPORTAMIENTO_APPCC_REGISTRARAPPCC=PASS');
}

// ---- 5. Aceite (registrarRelleno): relleno bloqueado vs. real. ----
{
  const codigoBase = extraer('litrosPorUnidadDeStock', 'function validarResponsableRegistroAceitePM19(') +
    extraer('validarResponsableRegistroAceitePM19', 'function crearLogicaAceite(') +
    extraer('crearLogicaAceite', 'function crearLogicaFacturasDirectas(');

  const freidora = { id: 'fr1', nombre: 'Freidora 1', localId: 'l1', productoAceiteId: 'ac1', rellenoHabitual: 5 };
  const aceite = { id: 'ac1', nombre: 'Aceite de girasol', localId: 'l1', stock: 100, costo: 1 };

  const ctxNeg = nuevoContexto(codigoBase);
  const llamadasNeg = [];
  const logicaNeg = ctxNeg.crearLogicaAceite({ freidoras: [freidora], setFreidoras: () => {}, registrosAceite: [], setRegistrosAceite: (fn) => llamadasNeg.push(fn), productos: [aceite], setProductos: () => {}, movimientos: [], setMovimientos: () => {}, registrarAuditoria: () => {}, localActivoId: null, locales: LOCALES });
  const resNeg = logicaNeg.registrarRelleno({ freidoraId: 'fr1', litros: 5, responsable: 'Ana' });
  assert.equal(resNeg.ok, false);
  assert.equal(llamadasNeg.length, 0, 'sin local activo (Todos), registrarRelleno no debe tocar stock ni registrar nada');
  assert.equal(ctxNeg.llamadas.mutaciones, 0);

  const ctxPos = nuevoContexto(codigoBase);
  const llamadasPos = [];
  const logicaPos = ctxPos.crearLogicaAceite({ freidoras: [freidora], setFreidoras: () => {}, registrosAceite: [], setRegistrosAceite: (fn) => llamadasPos.push(fn), productos: [aceite], setProductos: () => {}, movimientos: [], setMovimientos: () => {}, registrarAuditoria: () => {}, localActivoId: 'l1', locales: LOCALES });
  const resPos = logicaPos.registrarRelleno({ freidoraId: 'fr1', litros: 5, responsable: 'Ana' });
  assert.equal(resPos.ok, true, resPos.error);
  assert.equal(llamadasPos.length, 1, 'con local activo real, registrarRelleno debe registrar el relleno');
  assert.ok(ctxPos.llamadas.mutaciones > 0, 'con local activo real, registrarRelleno debe descontar aceite');
  console.log('P05_PM19_COMPORTAMIENTO_ACEITE_REGISTRARRELLENO=PASS');
}

console.log('PM19 P05 — comportamiento real de la guardia en los 5 módulos (positivo/negativo): contrato OK');
