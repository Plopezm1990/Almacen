import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// per-24 y per-25: los prefiltros de candidato.
//
// El 16/11/2026, pulsando "Crear enlace" en QA con sesión de Propietario, la
// pantalla respondió "No se ha podido crear el enlace. Comprueba tu conexión e
// inténtalo otra vez." La conexión iba bien: la misma sesión acababa de leer
// esa tabla sin problema. Lo que fallaba era un permiso del servidor, 42501
// "permission denied for table prefiltros_candidatos". Con ese aviso delante,
// quien lo use reintentará para siempre, mirando donde no es.
//
// Las tres funciones devolvían null, [] y false, así que el motivo se perdía
// antes de llegar a la pantalla. Aquí se fija que suba entero.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function crearLogicaPrefiltros(');
assert.ok(ini >= 0, 'crearLogicaPrefiltros no encontrada');
const fin = src.indexOf('function BotonTema(', ini);
assert.ok(fin > ini, 'no se pudo acotar crearLogicaPrefiltros');

function montar(respuestas) {
  const auditado = [];
  const tabla = {
    insert: () => ({ ...respuestas.insert }),
    select: () => ({ order: () => ({ ...respuestas.select }) }),
    delete: () => ({ eq: () => ({ select: () => ({ ...respuestas.delete }) }) })
  };
  const ctx = {
    window: { getSupabaseClient: async () => ({ from: () => tabla }) },
    crypto: { randomUUID: () => '0123456789abcdef0123456789abcdef' },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);
  const api = ctx.crearLogicaPrefiltros({
    registrarAuditoria: (a, b) => auditado.push([a, b]),
    empresaId: 'emp-1',
    localId: 'loc-1'
  });
  return { api, auditado };
}

const OK_VACIO = { data: [], error: null };

// ---- El caso real: permiso denegado. No es la conexión y no puede decirlo. ----
{
  const denegado = { data: null, error: { code: '42501', message: 'permission denied for table prefiltros_candidatos' } };
  const { api, auditado } = montar({ insert: denegado, select: denegado, delete: denegado });

  const alta = await api.crearPrefiltro('QA Candidato');
  assert.equal(alta.ok, false);
  assert.match(alta.error, /No es tu conexión/, 'el alta no puede echarle la culpa a la conexión');
  assert.match(alta.error, /habla con quien lleve el programa/, 'y tiene que decir qué hacer');
  assert.equal(auditado.length, 0, 'un alta que no ocurrió no se audita');

  const lista = await api.listarPrefiltros();
  assert.equal(lista.ok, false, 'una lectura fallida no puede pasar por "no hay ninguno"');
  assert.equal(lista.lista.length, 0, 'y aun así devuelve una lista vacía manejable');
  assert.match(lista.error, /No es tu conexión/);

  const borrado = await api.eliminarPrefiltro('tok', 'QA Candidato');
  assert.equal(borrado.ok, false);
  assert.match(borrado.error, /No es tu conexión/);
  console.log('P09_PERMISO_DENEGADO_NO_SE_DISFRAZA_DE_CONEXION=PASS');
}

// ---- Tabla que no existe: tampoco es la conexión. ----
{
  const sinTabla = { data: null, error: { code: '42P01', message: 'relation "prefiltros_candidatos" does not exist' } };
  const { api } = montar({ insert: sinTabla, select: sinTabla, delete: sinTabla });
  const alta = await api.crearPrefiltro('QA');
  assert.match(alta.error, /Falta preparar esta parte del servidor/);
  assert.match(alta.error, /No es tu conexión/);
  console.log('P09_TABLA_QUE_FALTA_SE_DISTINGUE=PASS');
}

// ---- Borrado bloqueado por RLS: no da error, no borra nada. ----
//
// Es el caso que el propio código ya sabía detectar con .select(), y que la
// pantalla tiraba a la basura.
{
  const { api, auditado } = montar({ insert: OK_VACIO, select: OK_VACIO, delete: { data: [], error: null } });
  const r = await api.eliminarPrefiltro('tok', 'QA Candidato');
  assert.equal(r.ok, false, 'cero filas borradas no es un borrado');
  assert.match(r.error, /O ya no existía, o el servidor no deja borrarlo/);
  assert.equal(auditado.length, 0, 'un borrado que no ocurrió no se audita');
  console.log('P09_BORRADO_SIN_FILAS_NO_PASA_POR_BUENO=PASS');
}

// ---- Y el camino bueno sigue siendo el de siempre. ----
{
  const { api, auditado } = montar({
    insert: { data: null, error: null },
    select: { data: [{ token: 't1', candidato_nombre: 'Ana' }], error: null },
    delete: { data: [{ token: 't1' }], error: null }
  });
  const alta = await api.crearPrefiltro('  Ana  ');
  assert.equal(alta.ok, true);
  assert.equal(typeof alta.token, 'string');
  assert.ok(alta.token.length >= 32, 'el token sigue siendo largo');

  const lista = await api.listarPrefiltros();
  assert.equal(lista.ok, true);
  assert.equal(lista.lista.length, 1);

  const borrado = await api.eliminarPrefiltro('t1', 'Ana');
  assert.equal(borrado.ok, true);
  assert.deepEqual(auditado.map((a) => a[0]), ['Crear prefiltro de candidato', 'Eliminar prefiltro de candidato']);
  assert.equal(auditado[0][1], 'Ana', 'el nombre se guarda sin los espacios de los lados');
  console.log('P09_EL_CAMINO_BUENO_NO_CAMBIA=PASS');
}

// ---- La pantalla tiene que usar lo que ahora recibe. ----
{
  assert.doesNotMatch(src, /No se ha podido crear el enlace\. Comprueba tu conexi\\xF3n/,
    'no se puede volver a culpar a la conexión sin saberlo');
  assert.match(src, /setError\("No se ha podido crear el enlace\. " \+ alta\.error\)/,
    'el alta enseña el motivo que le llega');

  // Una lectura fallida no puede salir como "no hay ninguno".
  assert.match(src, /cargandoPrefiltros \? null : errorPrefiltros \?/,
    'el aviso de lectura fallida va antes que el vacío');
  assert.match(src, /"No se ha podido leer la lista de prefiltros\. ", errorPrefiltros/);

  // Y el borrado deja de tirar su resultado.
  const iniB = src.indexOf('async function borrarPrefiltro()');
  const bloque = src.slice(iniB, src.indexOf('const activa = entrevistas.find', iniB));
  assert.match(bloque, /const r33 = await eliminarPrefiltro\(/, 'hay que quedarse con el resultado');
  assert.match(bloque, /if \(!r33\.ok\) \{\s*setErrorBorrarPrefiltro\(r33\.error\);\s*return;/,
    'si el servidor se niega, el diálogo se queda abierto y lo dice');
  console.log('P09_LA_PANTALLA_USA_EL_MOTIVO=PASS');
}

// ---- per-25: la confirmación dice qué se lleva por delante. ----
{
  const iniD = src.indexOf('confirmarEliminarPrefiltro && /* @__PURE__ */');
  assert.ok(iniD >= 0, 'no se encontró el diálogo de eliminar prefiltro');
  const dialogo = src.slice(iniD, iniD + 2200);
  assert.match(dialogo, /El enlace deja de funcionar/, 'tiene que decir que el enlace muere');
  assert.match(dialogo, /se borran tambi\\xE9n las respuestas que envi\\xF3/,
    'y que si ya respondió, las respuestas se van con él');
  assert.match(dialogo, /No se puede deshacer/, 'y que no hay vuelta atrás');
  assert.match(dialogo, /errorBorrarPrefiltro \? \/\* @__PURE__ \*\/ import_react4\.default\.createElement\("div", \{ className: "text-\[12px\] mb-3", role: "alert"/,
    'el aviso del servidor vive dentro del diálogo');
  console.log('P09_PER25_LA_CONFIRMACION_DICE_LAS_CONSECUENCIAS=PASS');
}

// ---- Una errata que estaba a la vista en esa misma pantalla. ----
{
  assert.doesNotMatch(src, /punt\\xFAar/, '"puntúar" no lleva tilde');
  assert.match(src, /No debe puntuar, clasificar ni decidir una contrataci\\xF3n\./);
  console.log('P09_SIN_LA_ERRATA_DE_PUNTUAR=PASS');
}

console.log('PM26 P09 — los prefiltros dicen por qué: contrato OK');
