// Contrato: cualquier cargo debe poder LEER la lista de los locales de su
// membresía, y ninguno que no lo tuviera antes debe poder escribirla.
//
// Lo que se midió, y por qué existe este contrato
// -----------------------------------------------
// El 20/11/2026, en el Deploy Preview #225 y con la cuenta de ensayo
// `qa.permisos.20261116@qa.invalid` —Camarero/a, membresía QA-A1 correcta—, la
// pantalla ofrecía un «Local principal» inventado por el navegador en lugar de
// «Local A1». El servidor estaba impecable: llamando a sus RPC con la sesión
// real de esa cuenta, `obtener_contexto_instalacion_ui` devuelve
// `locales: [QA-A1]` y `obtener_contexto_operativo` devuelve
// `rol: Camarero/a, localId: QA-A1`. Y el almacén del dispositivo también:
// `almacen:locales` contenía `[{"id":"QA-A1",…}]` de forma continua durante todo
// el arranque (medido por muestreo cada 100 ms, y sin un solo evento `storage`
// que lo borrara).
//
// La medida que lo cerró fue preguntarle a la propia vía de lectura de la
// aplicación, desde la página, a los dos segundos del arranque:
//
//     window.storage.get('locales')       ->  { value: "" }      <-- VACÍO
//     window.storage.get('localActivoId') ->  { value: "\"QA-A1\"" }
//     window.storage.get('empresas')      ->  { value: "[{\"id\":\"QA-EMP-A\",…}]" }
//
// Ese patrón —vacío solo en `locales`— corresponde exactamente a la tabla de
// autorización de `edge-auth-patch.js`:
//
//     edge-auth-patch.js:773   if (!puedeLeer(rol, key)) return respuestaVacia(key);
//
//   · `localActivoId` está en CLAVES_COMUNES, que vale para todos los cargos.
//   · `empresas` no está en ninguna lista, así que no es una clave controlada.
//   · `locales` está en CLAVES_ENCARGADO, y **Camarero/a no aparece en ninguna
//     de las cuatro listas de cargo**, así que solo recibe las comunes.
//
// Y un camarero necesita saber en qué local está: es lo primero que condiciona
// todo lo demás. Negárselo no protege nada —el servidor le da esa lista de buen
// grado, filtrada a su membresía— y en cambio desencadena esto:
//
//   1. la lectura responde vacío;
//   2. `fuente.js:101783` (`if (!res || !res.value) return fallback;`) lo
//      convierte en `[]` en el acto, sin reintento: el bucle de `loadKey`
//      reintenta tres veces, pero solo si la lectura LANZA, y un vacío no lanza;
//   3. `fuente.js:105556` lee «cero locales» como «instalación antigua de un
//      solo local» e INVENTA uno, con identificador generado en el navegador;
//   4. la aplicación opera sobre ese fantasma, y al intentar persistirlo el
//      puente lo rechaza —con razón— con «Local no autorizado para esta cuenta».
//
// Este contrato fija el primer eslabón, que es donde está la decisión
// equivocada. Los otros dos son defectos propios y quedan anotados en el acta.
//
// Nota sobre el alcance: se da permiso de LECTURA, no de escritura. Escribir la
// lista de locales sigue siendo del Propietario, y además el puente enruta esa
// escritura por una RPC reservada. El contrato comprueba las dos cosas.

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const edge = fs.readFileSync('edge-auth-patch.js', 'utf8');

// La tabla de autorización se evalúa aislada: desde `CLAVES_COMUNES` hasta justo
// antes del primer uso de cliente Supabase, que ya es otra cosa.
const ini = edge.indexOf('var CLAVES_COMUNES = [');
const fin = edge.indexOf('async function clienteSupabase', ini);
assert.ok(ini > 0 && fin > ini, 'no se encuentra la tabla de autorización por cargo');

const ctx = { Object, Array, String };
vm.createContext(ctx);
vm.runInContext(edge.slice(ini, fin), ctx, { filename: 'edge-auth-patch.js#autorizacion' });

const { puedeLeer, puedeEscribir } = ctx;
assert.equal(typeof puedeLeer, 'function', 'puedeLeer debe quedar definida');
assert.equal(typeof puedeEscribir, 'function', 'puedeEscribir debe quedar definida');

const CARGOS = ['Propietario', 'Encargado', 'Cajero/a', 'Churrero/a', 'Camarero/a'];

// --- 1. Todos los cargos leen sus locales. Éste es el arreglo. ---
for (const cargo of CARGOS) {
  assert.equal(
    puedeLeer(cargo, 'locales'),
    true,
    `«${cargo}» debe poder leer la lista de locales de su membresía: sin ella el cliente concluye que no tiene ninguno y se inventa uno`
  );
}

// --- 2. Y ninguno gana permiso de escritura que no tuviera ---
assert.equal(puedeEscribir('Propietario', 'locales'), true, 'el Propietario sigue escribiendo locales');
for (const cargo of ['Encargado', 'Cajero/a', 'Churrero/a', 'Camarero/a']) {
  const esperado = cargo === 'Encargado';
  assert.equal(
    puedeEscribir(cargo, 'locales'),
    esperado,
    `«${cargo}» no debe ganar permiso para escribir la lista de locales`
  );
}
assert.equal(puedeEscribir('Camarero/a', 'locales'), false,
  'dar lectura no puede abrir la escritura');

// --- 3. El resto de la tabla no se mueve ---
// Un cargo restringido sigue sin ver lo que no es suyo. Si alguien amplía la
// lista común de más, esto salta.
const AJENAS_AL_CAMARERO = [
  'proveedores', 'pedidos', 'conteos', 'fichasCosto', 'albaranes', 'arqueos',
  'turnos', 'movimientosCaja', 'devoluciones', 'registrosAppcc', 'puntosControl',
  'gastosGenerales', 'empleados', 'clientes', 'encargos', 'nominas', 'auditoria',
  'facturasDirectas', 'entrevistas', 'historialRespaldos', 'pinPropietario'
];
for (const clave of AJENAS_AL_CAMARERO) {
  assert.equal(puedeLeer('Camarero/a', clave), false,
    `«${clave}» no es de un Camarero/a y debe seguir negada`);
}

// Lo que sí es común para cualquier cargo, intacto.
for (const clave of ['productos', 'localActivoId', 'movimientos', 'fichajes']) {
  assert.equal(puedeLeer('Camarero/a', clave), true, `«${clave}» es común y debe seguir visible`);
}

// Y los demás cargos conservan lo suyo.
assert.equal(puedeLeer('Cajero/a', 'arqueos'), true);
assert.equal(puedeLeer('Cajero/a', 'proveedores'), false);
assert.equal(puedeLeer('Churrero/a', 'ordenesProduccion'), true);
assert.equal(puedeLeer('Churrero/a', 'arqueos'), false);
assert.equal(puedeLeer('Encargado', 'albaranes'), true);
assert.equal(puedeLeer('Encargado', 'nominas'), false);

// --- 4. La negativa sigue siendo un vacío, y el sitio donde se decide ---
// Si alguien mueve esta comprobación, que salte: es el punto exacto donde se
// medió el defecto.
assert.match(
  edge,
  /if \(!puedeLeer\(rol, key\)\) return respuestaVacia\(key\);/,
  'la decisión de lectura debe seguir pasando por puedeLeer en el get controlado'
);

console.log('LOCALES_VISIBLES_PARA_SU_CARGO=OK (4 bloques)');
