import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM20 P02: confirma, por inspección estática, que el componente Proveedores lee de
// verdad el resultado {ok,error} de addProveedor/updateProveedor -- ya no ignora un
// rechazo del backend como hacía antes de la corrección de LA-016.

const src = fs.readFileSync('fuente.js', 'utf8');

{
  const ini = src.indexOf('function Proveedores({');
  assert.ok(ini >= 0, 'componente Proveedores no encontrado');
  const fin = src.indexOf('var DIAS_REPARTO', ini) > ini ? src.indexOf('function ', src.indexOf('var DIAS_REPARTO', ini)) : -1;
  const cuerpo = src.slice(ini, ini + 6000);

  assert.match(cuerpo, /const res = addProveedor\(form\);/, 'submit debe leer el resultado real de addProveedor');
  assert.match(cuerpo, /if \(!res\.ok\) \{\s*setError\(res\.error\);/, 'un alta rechazada debe mostrar el error, no fallar en silencio');
  assert.match(cuerpo, /const res = updateProveedor\(editFor, editForm\);/, 'submitEdit debe leer el resultado real de updateProveedor');
  assert.match(cuerpo, /if \(!res\.ok\) \{\s*setEditError\(res\.error\);/, 'una edición rechazada debe mostrar el error, no fallar en silencio');
  console.log('P02_PM20_WIRING_PROVEEDORES_UI_LEE_RESULTADO_REAL=PASS');
}

{
  const ini = src.indexOf('function crearLogicaProveedores(');
  const fin = src.indexOf('function validarEmpleadoPM10(', ini);
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /const validacion = validarProveedorPM10\(data\);/, 'addProveedor debe validar con validarProveedorPM10');
  assert.match(cuerpo, /return \{ ok: true \};/, 'updateProveedor debe devolver {ok:true} en éxito (contrato nuevo)');
  console.log('P02_PM20_WIRING_PROVEEDORES_LOGICA_VALIDA=PASS');
}

console.log('PM20 P02 (wiring Proveedores) — UI conectada al contrato real: contrato OK');
