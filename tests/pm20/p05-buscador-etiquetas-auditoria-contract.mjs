import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM20 P05: "Buscador, etiquetas y catálogo" + Auditoría -- "filtros y salidas excluyen
// contextos no autorizados". Ninguno de estos módulos tenía ficha propia (P01). No se
// encontró ningún defecto: este punto verifica y fija con prueba lo que antes era
// solo una suposición razonable.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- 1. BusquedaGlobal: los datos de ámbito LOCAL (productos, personal) llegan ya
// filtrados al local activo; proveedores/clientes/fichasCosto son de ámbito EMPRESA por
// diseño establecido (mismo criterio que crearLogicaProveedores/crearLogicaClientes, no
// una inconsistencia nueva) -- no se filtran por local porque no les corresponde. ----
{
  assert.match(src, /createElement\(BusquedaGlobal, \{ productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab: cambiarTabPM15 \}\)/, 'BusquedaGlobal debe recibir productos/fichasCosto/empleados ya filtrados por local activo');
  console.log('P05_PM20_BUSQUEDA_GLOBAL_ALCANCE_CORRECTO=PASS');
}

// ---- 2. EtiquetasCatalogo: productos y fichasCosto llegan ya filtrados al local
// activo -- no puede imprimir etiquetas ni catálogo de otro local. ----
{
  assert.match(src, /createElement\(EtiquetasCatalogo, \{ productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha \}\)/, 'EtiquetasCatalogo debe recibir productos/fichasCosto ya filtrados por local activo');
  console.log('P05_PM20_ETIQUETAS_CATALOGO_ALCANCE_CORRECTO=PASS');
}

// ---- 3. Auditoría: acceso de LECTURA restringido a Propietario -- ningún rol de
// empleado (ni los reales: Camarero/a, Cajero/a, Churrero/a, Encargado; ni el legado
// "Estándar"/ITEMS_EMPLEADO) incluye "auditoria". Por eso la vista sin filtrar por local
// (empresa completa) es correcta por diseño: solo la ve el propietario del negocio,
// igual que el Panel de dirección/Tesorería -- no es una fuga de aislamiento entre
// locales de empleados de distintos locales. ----
{
  const iniRoles = src.indexOf('var ITEMS_EMPLEADO = [');
  const finRoles = src.indexOf('var NOMBRES_ROLES', iniRoles);
  const cuerpoRoles = src.slice(iniRoles, finRoles);
  assert.doesNotMatch(cuerpoRoles, /"auditoria"/, 'ningún rol de empleado (real o legado) debe incluir la pestaña auditoria');
  console.log('P05_PM20_AUDITORIA_SIN_ROL_EMPLEADO=PASS');
}
{
  // Redirección real: si un empleado (modoEmpleado) queda en una pestaña que su rol no
  // permite, se le saca al dashboard -- no puede quedarse viendo auditoría por accidente
  // de navegación.
  assert.match(src, /if \(modoEmpleado && !itemsPermitidosEmpleado\.includes\(tab\)\) setTab\("dashboard"\);/, 'debe existir la redirección real fuera de pestañas no permitidas para el rol activo');
  console.log('P05_PM20_AUDITORIA_REDIRECCION_ROL_VERIFICADA=PASS');
}
{
  // Capa de sincronización (PM17, inlined edge-auth-patch): solo Propietario puede LEER
  // la colección de auditoría; el resto de roles no aparece en ninguna lista que
  // conceda lectura de "auditoria".
  const ini = src.indexOf('var CLAVES_SOLO_PROPIETARIO = [');
  const fin = src.indexOf('function mapaDe(', ini);
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /"auditoria"/, 'CLAVES_SOLO_PROPIETARIO debe incluir auditoria');
  const iniLeer = src.indexOf('function puedeLeer(rol, key) {');
  const finLeer = src.indexOf('function puedeEscribir(', iniLeer);
  const cuerpoLeer = src.slice(iniLeer, finLeer);
  assert.doesNotMatch(cuerpoLeer, /CLAVES_ENCARGADO,\s*key\)\s*&&.*auditoria|CLAVES_CAJERO.*auditoria|CLAVES_CHURRERO.*auditoria/, 'ningún rol de empleado debe tener una vía de lectura de auditoria en la capa de sincronización');
  console.log('P05_PM20_AUDITORIA_SYNC_SOLO_PROPIETARIO_LEE=PASS');
}

// ---- 4. Comportamiento real: puedeLeer("Propietario","auditoria") es true; para
// cualquier otro rol conocido, es false. ----
{
  const iniConst = src.indexOf('var CLAVES_COMUNES');
  const finConst = src.indexOf('async function clienteSupabase(', iniConst);
  const codigo = src.slice(iniConst, finConst);
  const { puedeLeer } = new Function(codigo + '\nreturn { puedeLeer, puedeEscribir };')();
  assert.equal(puedeLeer('Propietario', 'auditoria'), true, 'el propietario debe poder leer auditoria');
  for (const rol of ['Encargado', 'Cajero/a', 'Churrero/a', 'Camarero/a']) {
    assert.equal(puedeLeer(rol, 'auditoria'), false, `${rol} no debe poder leer auditoria`);
  }
  console.log('P05_PM20_AUDITORIA_PUEDELEER_COMPORTAMIENTO_VERIFICADO=PASS');
}

console.log('PM20 P05 — Buscador/Etiquetas/Auditoría: alcance verificado, sin fuga de contexto: contrato OK');
