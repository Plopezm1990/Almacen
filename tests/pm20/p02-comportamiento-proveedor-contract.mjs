import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM20 P02: prueba de comportamiento real (no solo estática) de la corrección de LA-016 --
// validarProveedorPM10 y su integración en crearLogicaProveedores (addProveedor/
// updateProveedor). Positivo (datos válidos: se crea/actualiza) y negativo (email
// inválido, días negativos: se rechaza sin mutación).

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
  extraer('validarProveedorPM10', 'function crearLogicaProveedores(') +
  extraer('crearLogicaProveedores', 'function validarEmpleadoPM10(');

function nuevoContexto() {
  const ctx = { console, uid: () => 'id-' + Math.random().toString(36).slice(2) };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  return ctx;
}

// ---- Positivo: datos válidos crean el proveedor. ----
{
  const ctx = nuevoContexto();
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.addProveedor({ nombre: 'Distribuidora Norte', email: 'pedidos@proveedor.com', leadTime: '5', diasPago: '45' });
  assert.equal(res.ok, true, res.error);
  assert.equal(llamadas.length, 1, 'con datos válidos, addProveedor debe crear el proveedor');
  console.log('P02_PM20_PROVEEDOR_ALTA_VALIDA=PASS');
}

// ---- Negativo: email con formato inválido rechaza el alta sin mutación. ----
{
  const ctx = nuevoContexto();
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.addProveedor({ nombre: 'Distribuidora Norte', email: 'no-es-un-correo', leadTime: '5', diasPago: '45' });
  assert.equal(res.ok, false);
  assert.equal(res.campo, 'email');
  assert.equal(llamadas.length, 0, 'email inválido no debe crear nada');
  console.log('P02_PM20_PROVEEDOR_EMAIL_INVALIDO_RECHAZADO=PASS');
}

// ---- Negativo: días de entrega negativos rechazan el alta sin mutación. ----
{
  const ctx = nuevoContexto();
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.addProveedor({ nombre: 'Distribuidora Norte', email: '', leadTime: '-3', diasPago: '45' });
  assert.equal(res.ok, false);
  assert.equal(res.campo, 'leadTime');
  assert.equal(llamadas.length, 0, 'días de entrega negativos no deben crear nada');
  console.log('P02_PM20_PROVEEDOR_LEADTIME_NEGATIVO_RECHAZADO=PASS');
}

// ---- Negativo: días de pago negativos rechazan el alta sin mutación. ----
{
  const ctx = nuevoContexto();
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.addProveedor({ nombre: 'Distribuidora Norte', email: '', leadTime: '5', diasPago: '-1' });
  assert.equal(res.ok, false);
  assert.equal(res.campo, 'diasPago');
  assert.equal(llamadas.length, 0, 'días de pago negativos no deben crear nada');
  console.log('P02_PM20_PROVEEDOR_DIASPAGO_NEGATIVO_RECHAZADO=PASS');
}

// ---- Positivo: campos opcionales vacíos siguen permitiendo el alta (no se vuelven
// obligatorios por la corrección). ----
{
  const ctx = nuevoContexto();
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.addProveedor({ nombre: 'Distribuidora Norte', email: '', leadTime: '', diasPago: '' });
  assert.equal(res.ok, true, res.error);
  assert.equal(llamadas.length, 1, 'email/leadTime/diasPago vacíos deben seguir permitiendo el alta');
  console.log('P02_PM20_PROVEEDOR_CAMPOS_OPCIONALES_VACIOS=PASS');
}

// ---- Negativo en edición: updateProveedor rechaza email inválido sin mutar y devuelve
// {ok,error} en vez de fallar en silencio (contrato nuevo). ----
{
  const ctx = nuevoContexto();
  const existente = { id: 'p1', nombre: 'Distribuidora Norte', email: 'valido@proveedor.com', empresaId: 'e1' };
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [existente], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.updateProveedor('p1', { nombre: 'Distribuidora Norte', email: 'roto@@x', leadTime: '', diasPago: '' });
  assert.equal(res.ok, false);
  assert.equal(llamadas.length, 0, 'updateProveedor con email inválido no debe mutar nada');
  console.log('P02_PM20_PROVEEDOR_EDICION_EMAIL_INVALIDO_RECHAZADA=PASS');
}

// ---- Positivo en edición: updateProveedor con datos válidos devuelve {ok:true} y muta. ----
{
  const ctx = nuevoContexto();
  const existente = { id: 'p1', nombre: 'Distribuidora Norte', email: 'valido@proveedor.com', empresaId: 'e1' };
  const llamadas = [];
  const logica = ctx.crearLogicaProveedores({ proveedores: [existente], setProveedores: (fn) => llamadas.push(fn), registrarAuditoria: () => {}, empresaId: 'e1' });
  const res = logica.updateProveedor('p1', { nombre: 'Distribuidora Norte', email: 'nuevo@proveedor.com', leadTime: '7', diasPago: '30' });
  assert.equal(res.ok, true, res.error);
  assert.equal(llamadas.length, 1, 'updateProveedor con datos válidos debe mutar');
  console.log('P02_PM20_PROVEEDOR_EDICION_VALIDA=PASS');
}

console.log('PM20 P02 — LA-016 corregida: validación real de email/días en proveedores: contrato OK');
