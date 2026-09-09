import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM23 P03: confirma que el documento y el resultado registran los cuatro
// casos (última unidad, duplicado simultáneo en pago/ajuste/devolución) con
// su resultado real correcto, y que no publican ningún identificador interno
// ni secreto.

const doc = fs.readFileSync('tests/pm23/P03_ULTIMA_UNIDAD_Y_DUPLICADOS.md', 'utf8');
const resultado = JSON.parse(fs.readFileSync('tests/pm23/p03-resultado.json', 'utf8'));

assert.match(doc, /mismo caso observable/);
assert.match(doc, /Última unidad/);
assert.match(doc, /stock_insuficiente/);
assert.match(doc, /PM23_CIERRE_FORMAL=PASS/);

assert.equal(resultado.ultimaUnidad.exitos, 1);
assert.equal(resultado.ultimaUnidad.rechazos, 2);
assert.equal(resultado.ultimaUnidad.filasVentaEnBackend, 1);
assert.equal(resultado.ultimaUnidad.correcto, true);
assert.equal(Number(resultado.ultimaUnidad.stockFinal.almacen) + Number(resultado.ultimaUnidad.stockFinal.piso), 0);

for (const clave of ['duplicadoPago', 'duplicadoAjuste', 'duplicadoDevolucion']) {
  const bloque = resultado[clave];
  assert.equal(bloque.filasFinales, 1, `${clave} debe terminar con exactamente 1 fila`);
  assert.equal(bloque.correcto, true, `${clave} debe registrarse como correcto`);
  const replays = [bloque.respuestaA.replayed, bloque.respuestaB.replayed].sort();
  assert.deepEqual(replays, [false, true], `${clave} debe tener exactamente una respuesta replayed:false y otra replayed:true`);
}

assert.match(doc, /PM23_P03_ULTIMA_UNIDAD=CORRECTO/);
assert.match(doc, /PM23_P03_DUPLICADOS_SIMULTANEOS=CORRECTO/);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto en el documento: ' + secreto);
  assert.doesNotMatch(JSON.stringify(resultado), secreto, 'no debe publicarse un identificador interno o secreto en el resultado: ' + secreto);
}

console.log('PM23_P03_DOC_VERIFICADO=PASS');
console.log('PM23_P03_RESULTADO_CONSISTENTE=PASS');
console.log('PM23_P03_SIN_SECRETOS=PASS');
console.log('PM23 P03 — última unidad y duplicados simultáneos: contrato OK');
