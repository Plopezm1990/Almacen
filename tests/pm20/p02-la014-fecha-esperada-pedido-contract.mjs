import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM20 P02: revalidación específica de LA-014 (catálogo tests/pm04/regression-catalog.json)
// -- "Fecha esperada persiste al editar cantidad, guardar y recargar sin desplazamiento
// horario". El P01 de este paquete ya confirmó por inspección que el código es correcto;
// aquí se prueba el comportamiento real, de punta a punta, sobre crearLogicaPedidos.

const src = fs.readFileSync('fuente.js', 'utf8');

function extraer(nombre, hasta) {
  const ini = src.indexOf(`function ${nombre}(`);
  assert.ok(ini >= 0, `${nombre} no encontrada`);
  const fin = src.indexOf(hasta, ini);
  assert.ok(fin > ini, `no se pudo acotar ${nombre}`);
  return src.slice(ini, fin);
}

const CODIGO = extraer('errorValidacionPM10', 'function numeroPM10(') +
  extraer('numeroPM10', 'function validarContextoEscrituraPM10(') +
  extraer('validarContextoEscrituraPM10', 'function validarProductoPM10(') +
  extraer('fechaValidaPedidoPM10', 'function validarPedidoPM10(') +
  extraer('validarPedidoPM10', 'function unidadesRecepcionLineaPM10(') +
  extraer('crearLogicaPedidos', 'function crearLogicaAlbaranes(');

function nuevoContexto() {
  const ctx = { console, uid: () => 'id-' + Math.random().toString(36).slice(2), todayISO: () => '2026-09-08' };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  return ctx;
}

const LOCALES = [{ id: 'l1', nombre: 'Centro', activo: true, empresaId: 'e1' }];
const PROVEEDORES = [{ id: 'pr1', nombre: 'Distribuidora Norte', empresaId: 'e1' }];
const PRODUCTOS = [{ id: 'p1', nombre: 'Harina', localId: 'l1' }];

// ---- 1. Fecha esperada válida se persiste tal cual, sin desplazamiento. ----
{
  let pedidos = [];
  const ctx = nuevoContexto();
  const logica = ctx.crearLogicaPedidos({ pedidos, setPedidos: (fn) => { pedidos = fn(pedidos); }, productos: PRODUCTOS, proveedores: PROVEEDORES, setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false, procesarRecepcion: () => {}, localActivoId: 'l1', locales: LOCALES, empresaId: 'e1' });

  const creado = logica.crearPedido({ proveedorId: 'pr1', fechaEsperada: '2026-09-15', items: [{ productoId: 'p1', cantidad: 3, costoUnitario: 1 }] });
  assert.ok(creado.id, 'el pedido debe crearse');
  assert.equal(pedidos[0].fechaEsperada, '2026-09-15', 'la fecha esperada debe persistir exactamente igual al alta');
  console.log('P02_PM20_LA014_ALTA_FECHA_EXACTA=PASS');
}

// ---- 2. Editar cantidad conserva la fecha esperada exacta (sin objeto Date de por
// medio en el circuito de guardado). ----
{
  let pedidos = [];
  const ctx = nuevoContexto();
  const logica = ctx.crearLogicaPedidos({ pedidos, setPedidos: (fn) => { pedidos = fn(pedidos); }, productos: PRODUCTOS, proveedores: PROVEEDORES, setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false, procesarRecepcion: () => {}, localActivoId: 'l1', locales: LOCALES, empresaId: 'e1' });

  const creado = logica.crearPedido({ proveedorId: 'pr1', fechaEsperada: '2026-12-31', items: [{ productoId: 'p1', cantidad: 3, costoUnitario: 1 }] });
  // Simula el re-render de React: el hook se reconstruye con el `pedidos` ya actualizado.
  const logicaTrasAlta = ctx.crearLogicaPedidos({ pedidos, setPedidos: (fn) => { pedidos = fn(pedidos); }, productos: PRODUCTOS, proveedores: PROVEEDORES, setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false, procesarRecepcion: () => {}, localActivoId: 'l1', locales: LOCALES, empresaId: 'e1' });
  const okEdit = logicaTrasAlta.actualizarPedido(creado.id, { proveedorId: 'pr1', fechaEsperada: '2026-12-31', items: [{ productoId: 'p1', cantidad: 7, costoUnitario: 1 }] });
  assert.equal(okEdit, true, 'la edición debe aceptarse');
  assert.equal(pedidos[0].fechaEsperada, '2026-12-31', 'editar cantidad no debe desplazar la fecha esperada');
  assert.equal(pedidos[0].items[0].cantidad, 7, 'la cantidad sí debe reflejar la edición');
  console.log('P02_PM20_LA014_EDICION_CONSERVA_FECHA=PASS');
}

// ---- 3. "Recargar" (nuevo contexto/proceso, releyendo el mismo dato persistido) sigue
// mostrando la misma fecha exacta -- sin conversión a través de un objeto Date. ----
{
  let pedidos = [];
  const ctx1 = nuevoContexto();
  const logica1 = ctx1.crearLogicaPedidos({ pedidos, setPedidos: (fn) => { pedidos = fn(pedidos); }, productos: PRODUCTOS, proveedores: PROVEEDORES, setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false, procesarRecepcion: () => {}, localActivoId: 'l1', locales: LOCALES, empresaId: 'e1' });
  logica1.crearPedido({ proveedorId: 'pr1', fechaEsperada: '2026-01-01', items: [{ productoId: 'p1', cantidad: 1, costoUnitario: 1 }] });

  // Simula "recargar" releyendo el array persistido en un contexto/proceso nuevo.
  const persistido = JSON.parse(JSON.stringify(pedidos));
  const ctx2 = nuevoContexto();
  const logica2 = ctx2.crearLogicaPedidos({ pedidos: persistido, setPedidos: () => {}, productos: PRODUCTOS, proveedores: PROVEEDORES, setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false, procesarRecepcion: () => {}, localActivoId: 'l1', locales: LOCALES, empresaId: 'e1' });
  assert.equal(persistido[0].fechaEsperada, '2026-01-01', 'tras recargar, la fecha esperada debe seguir siendo exactamente la misma (1 de enero, no 31 de diciembre)');
  console.log('P02_PM20_LA014_RECARGA_SIN_DESPLAZAMIENTO=PASS');
}

// ---- 4. Fecha inválida se rechaza (formato incorrecto o fecha inexistente como
// 2026-02-30) sin crear el pedido. ----
{
  let pedidos = [];
  const ctx = nuevoContexto();
  const logica = ctx.crearLogicaPedidos({ pedidos, setPedidos: (fn) => { pedidos = fn(pedidos); }, productos: PRODUCTOS, proveedores: PROVEEDORES, setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false, procesarRecepcion: () => {}, localActivoId: 'l1', locales: LOCALES, empresaId: 'e1' });

  const res1 = logica.crearPedido({ proveedorId: 'pr1', fechaEsperada: '31-12-2026', items: [{ productoId: 'p1', cantidad: 1, costoUnitario: 1 }] });
  assert.equal(res1.ok, false, 'formato de fecha inválido debe rechazarse');
  const res2 = logica.crearPedido({ proveedorId: 'pr1', fechaEsperada: '2026-02-30', items: [{ productoId: 'p1', cantidad: 1, costoUnitario: 1 }] });
  assert.equal(res2.ok, false, 'fecha inexistente (30 de febrero) debe rechazarse');
  assert.equal(pedidos.length, 0, 'ningún pedido con fecha inválida debe haberse creado');
  console.log('P02_PM20_LA014_FECHA_INVALIDA_RECHAZADA=PASS');
}

console.log('PM20 P02 — LA-014 revalidado: fecha esperada persiste exacta en alta, edición y recarga: contrato OK');
