import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

const inicio = fuente.indexOf('const empleadosIdentidadKeyPM11 =');
const fin = fuente.indexOf('const localesEmpresaActiva =', inicio);
assert.ok(inicio > 0 && fin > inicio, 'no se encontró el efecto de enriquecimiento de cuentas');
const bloque = fuente.slice(inicio, fin);

assert.match(bloque, /const controlador = typeof AbortController === "function"/);
assert.match(bloque, /const claveContextoPM11 = `\$\{empresaContexto\}:\:\$\{localContexto\}`/);
assert.match(bloque, /window\.__pm11CuentaContexto = claveContextoPM11/);
assert.match(bloque, /const esContextoVigentePM11 = \(\) => activo && window\.__pm11CuentaContexto === claveContextoPM11/);
assert.match(bloque, /consulta\.abortSignal\(controlador\.signal\)/);
assert.match(bloque, /supabase\.rpc\("pm11_estado_cuentas_empleados"/);
assert.match(bloque, /p_empresa_id: empresaContexto/);
assert.match(bloque, /p_local_id: localContexto/);
assert.match(bloque, /p_empleado_ids: idsEmpleadosContexto/);
assert.doesNotMatch(bloque, /\.in\("empleado_id", idsEmpleadosContexto\)/);
assert.match(bloque, /if \(error \|\| !esContextoVigentePM11\(\) \|\| controlador\?\.signal\.aborted/);
assert.match(bloque, /const enContexto = empleadoLocal === localContexto/);
assert.match(bloque, /if \(!enContexto\) return empleado;/);
assert.match(bloque, /if \(controlador\) controlador\.abort\(\);/);
assert.match(bloque, /\[ready, miPerfil, localActivoId, empresas, locales, empleadosIdentidadKeyPM11\]/);
assert.match(bloque, /setEstadoCuentasPM11/);
assert.match(bloque, /\[id, "cargando"\]/);
assert.match(bloque, /\[id, "error"\]/);
assert.match(bloque, /const incoherentes = new Set\(\)/);
assert.match(bloque, /incoherentes\.has\(id\) \? "incoherente"/);
assert.match(bloque, /respuesta\?\.ok === true && Array\.isArray\(respuesta\.cuentas\)/);
assert.match(bloque, /const estados = Object\.fromEntries/);
assert.match(bloque, /\["activa", "suspendida", "sin_cuenta", "incoherente"\]\.includes\(estado\)/);
assert.match(bloque, /if \(estado === "error"\) return empleado;/);
assert.match(bloque, /if \(estado === "incoherente"\) return \{ \.\.\.empleado, tieneCuenta: false, cuentaActiva: false, rolCuenta: "" \};/);
assert.match(bloque, /if \(!esContextoVigentePM11\(\)\) return;/);
assert.match(bloque, /if \(!esContextoVigentePM11\(\)\) return actuales;/);
assert.match(bloque, /cuentaActiva: estado === "activa"/);

const uiInicio = fuente.indexOf('function Personal({');
const uiFin = fuente.indexOf('function Turnos({', uiInicio);
assert.ok(uiInicio > 0 && uiFin > uiInicio, 'no se encontró la UI de Personal');
const ui = fuente.slice(uiInicio, uiFin);
assert.match(ui, /estadoCuenta === "cargando"/);
assert.match(ui, /estadoCuenta === "error"/);
assert.match(ui, /estadoCuenta === "incoherente"/);
assert.match(ui, /e2\.pin &&[\s\S]{0,260}"PIN configurado"/);
assert.match(ui, /estadoCuenta === "activa"[\s\S]{0,260}"cuenta: ", e2\.rolCuenta/);
assert.match(ui, /estadoCuenta === "suspendida"[\s\S]{0,220}"cuenta suspendida"/);
assert.match(ui, /estadoCuenta === "error"[\s\S]{0,220}"cuenta no disponible"/);
assert.match(ui, /estadoCuenta === "incoherente"[\s\S]{0,220}"vínculo incoherente"/);
assert.match(ui, /crearCuentaEmpleado && estadoCuenta === "sin_cuenta" && !e2\.tieneCuenta/);
assert.equal((ui.match(/crearCuentaEmpleado &&/g) || []).length, 1, 'la acción de alta solo debe existir en la condición de sin_cuenta');

const inicioRec = recuperada.indexOf('const empleadosIdentidadKeyPM11 =');
const finRec = recuperada.indexOf('const localesEmpresaActiva =', inicioRec);
assert.ok(inicioRec > 0 && finRec > inicioRec, 'la fuente recuperada no conserva el bloque');
assert.equal(
  recuperada.slice(inicioRec, finRec).replaceAll('\r\n', '\n'),
  bloque.replaceAll('\r\n', '\n'),
  'la fuente recuperada debe mantener paridad exacta'
);

console.log('P12_ACCOUNT_ENRICHMENT_RACE=PASS');
