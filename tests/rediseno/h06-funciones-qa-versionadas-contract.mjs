// Contrato de H-06 (auditoría del TPV, 25-27/11/2026): las funciones de QA sin migración están versionadas.
//
// En el servidor de QA había 14 funciones `abc_*` (y una privada) que no estaban en `supabase/migrations`, algunas
// simuladores de cobro y de cierre. Se volcó su definición viva a `supabase/qa-only/` (NO son migraciones, para que no
// lleguen a producción por esa vía) y este contrato mantiene tres promesas:
//   1. El volcado es fiel y completo: cada archivo coincide con el md5 del registro y define esa función.
//   2. Ninguna migración define ninguna de esas funciones: no se pueden aplicar a otro entorno sin decidirlo a propósito.
//      Si algún día una pasa a migración real (producto que se quiere en producción), hay que sacarla del registro.
//   3. Las de «solo QA» llevan su barrera (QA-EMP-A / QA-A1) y el cliente no llama a ninguna fuera de QA.
//
//   node tests/rediseno/h06-funciones-qa-versionadas-contract.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const raiz = new URL('../../', import.meta.url);
const ruta = (f) => new URL(f, raiz);
const leer = (f) => fs.readFileSync(ruta(f), 'utf8').replace(/\r\n/g, '\n');
const registro = JSON.parse(leer('supabase/qa-only/REGISTRO.json'));

assert.equal(registro.funciones.length, 16, 'el registro lista las 16 funciones (15 públicas y 1 privada de apoyo)');
const nombres = registro.funciones.map((f) => f.nombre);
assert.equal(new Set(nombres).size, nombres.length, 'sin nombres repetidos');

// 1. Fidelidad del volcado.
for (const f of registro.funciones) {
  const texto = leer('supabase/qa-only/' + f.archivo);
  assert.ok(texto.endsWith(';\n'), `${f.nombre}: el archivo termina en «;»`);
  const base = texto.slice(0, -2) + '\n';
  assert.equal(crypto.createHash('md5').update(base, 'utf8').digest('hex'), f.md5, `${f.nombre}: el archivo coincide con el md5 del registro (volcado de QA)`);
  const [esquema, corto] = f.nombre.split('.');
  assert.ok(texto.startsWith(`CREATE OR REPLACE FUNCTION ${esquema}.${corto}(`), `${f.nombre}: define exactamente esa función`);
  assert.equal((texto.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 1, `${f.nombre}: una sola función por archivo`);
  assert.ok(['solo_qa_barrera', 'solo_qa_sin_escritura', 'producto_sin_migracion'].includes(f.clase), `${f.nombre}: clase conocida`);
  assert.ok(f.nota && f.nota.length > 20, `${f.nombre}: lleva nota de seguridad`);
}
const archivos = fs.readdirSync(ruta('supabase/qa-only/funciones/')).sort();
assert.deepEqual(archivos, registro.funciones.map((f) => path.basename(f.archivo)).sort(), 'no hay funciones sueltas fuera del registro');

// 2. Ninguna migración las define.
const migraciones = fs.readdirSync(ruta('supabase/migrations/')).filter((f) => f.endsWith('.sql'));
const textoMigraciones = migraciones.map((f) => leer('supabase/migrations/' + f));
for (const f of registro.funciones) {
  const [esquema, corto] = f.nombre.split('.');
  const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+${esquema}\\.${corto}\\s*\\(`, 'i');
  const definidoEn = migraciones.filter((m, i) => re.test(textoMigraciones[i]));
  assert.deepEqual(definidoEn, [], `${f.nombre}: no la define ninguna migración (si pasa a migración real, se saca del registro): ${definidoEn.join(', ')}`);
}
// Las tablas sin migración siguen sin ella (si aparece, hay que actualizar el registro).
for (const t of registro.tablas_sin_migracion) {
  const corto = t.tabla.split('.')[1];
  const hay = textoMigraciones.some((m) => new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${corto}\\b`, 'i').test(m));
  assert.equal(hay, false, `${t.tabla}: ya tiene migración; actualiza supabase/qa-only/REGISTRO.json`);
  assert.ok(fs.existsSync(ruta('supabase/qa-only/' + t.referencia)), `${t.tabla}: existe su referencia`);
}

// 3a. Las de «solo QA» llevan su barrera.
for (const f of registro.funciones.filter((x) => x.clase === 'solo_qa_barrera')) {
  const texto = leer('supabase/qa-only/' + f.archivo);
  // La barrera es propia (literales QA-EMP-A / QA-A1) o delegada en la privada abc_qa_c04_propietario, que la tiene.
  const propia = /'QA-EMP-A'/.test(texto) && /'QA-A1'/.test(texto);
  const delegada = f.nombre !== 'private.abc_qa_c04_propietario' && texto.includes('private.abc_qa_c04_propietario(');
  assert.ok(propia || delegada, `${f.nombre}: lleva su barrera QA-EMP-A / QA-A1 (propia o delegada)`);
}
// 3b. La que no tiene barrera no escribe nada.
for (const f of registro.funciones.filter((x) => x.clase === 'solo_qa_sin_escritura')) {
  const texto = leer('supabase/qa-only/' + f.archivo);
  assert.doesNotMatch(texto, /\b(insert\s+into|update\s+\w|delete\s+from|perform\s+set_config)\b/i, `${f.nombre}: no escribe`);
  assert.doesNotMatch(texto, /SECURITY DEFINER/, `${f.nombre}: no es SECURITY DEFINER`);
}
// 3c. El cliente: ninguna función abc_qa_* se llama desde la aplicación, y las de ticket fiscal y Bizum de QA solo bajo el
//     interruptor de QA.
const fuente = leer('fuente.js');
// Salvo las dos del simulador de tarjeta (H-27, 27/11/2026), que solo se llaman desde resolverTarjetaSimuladaQa, y esa
// función empieza por la barrera del interruptor de QA.
const SIMULADOR_TARJETA = ['abc_qa_confirmar_pago_simulado', 'abc_qa_rechazar_pago_simulado'];
// Los comentarios que explican por qué existen no cuentan como llamadas.
const codigo = (s) => s.split(String.fromCharCode(10)).filter((l) => !/^\s*\/\//.test(l)).join(String.fromCharCode(10));
const fuenteCodigo = codigo(fuente);
const iniSim = fuente.indexOf('async function resolverTarjetaSimuladaQa(');
const finSim = fuente.indexOf('async function cerrarCuentaPagadaF4(', iniSim);
assert.ok(iniSim > 0 && finSim > iniSim, 'existe resolverTarjetaSimuladaQa');
const cuerpoSim = codigo(fuente.slice(iniSim, finSim));
assert.match(cuerpoSim.slice(0, 400), /if \(!c07dActivoEnEntornoQa\(\)\) return \{ ok: false/, 'resolverTarjetaSimuladaQa empieza por la barrera del interruptor de QA');
for (const f of registro.funciones.filter((x) => /^public\.abc_qa_/.test(x.nombre))) {
  const corto = f.nombre.split('.')[1];
  const veces = fuenteCodigo.split(corto).length - 1;
  if (SIMULADOR_TARJETA.includes(corto)) {
    assert.equal(veces, cuerpoSim.split(corto).length - 1, `${f.nombre}: la aplicación solo la llama desde resolverTarjetaSimuladaQa (bajo el interruptor de QA)`);
    assert.ok(veces >= 1, `${f.nombre}: el simulador de tarjeta la usa`);
  } else {
    assert.equal(veces, 0, `${f.nombre}: la aplicación no la llama (solo se usa a mano en QA)`);
  }
}
const ini = fuente.indexOf('async function prepararTicketFiscalQa(');
assert.ok(ini > 0, 'existe prepararTicketFiscalQa');
assert.match(fuente.slice(ini, ini + 300), /if \(!c07dActivoEnEntornoQa\(\)\) return \{ ok: false/, 'abc_preparar_ticket_fiscal_qa solo se prepara bajo el interruptor de QA');

console.log('H-06 contrato de las funciones de QA versionadas OK (16 funciones)');
