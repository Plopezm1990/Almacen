import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const texto = (ruta) => readFileSync(ruta, 'utf8');
const p09d = json('tests/pm26/p09d-cierre-transitivo/manifest-saneado.json');
const manifiesto = json('tests/pm26/p09e-diseno-seguro/manifest-saneado.json');
const informe = texto('tests/pm26/P09E_DISENO_SEGURO_COMPATIBILIDAD_PRODUCCION.md');

assert.equal(p09d.resultado.migracion_productiva_lista, false);
assert.equal(manifiesto.estado, 'DISENO_PREVIO_SIN_MIGRACION');
assert.equal(manifiesto.dependencias_confirmadas.relaciones_visibles_ausentes, 11);
assert.equal(manifiesto.dependencias_confirmadas.helpers_privados_ausentes, 9);
assert.equal(manifiesto.dependencias_confirmadas.helpers_compartidos_con_deriva, 8);
assert.equal(manifiesto.dependencias_confirmadas.rpc_candidatas, 13);
assert.deepEqual(manifiesto.dominios, [
  'catalogos_y_finanzas', 'caja_y_arqueos', 'stock_y_devoluciones', 'auditoria_y_contrato_cliente'
]);
assert.deepEqual(manifiesto.autorizaciones_posteriores, [
  'aplicar_ensayo_qa', 'aplicar_migracion_produccion', 'publicar_cliente_release'
]);

for (const esperado of [
  'DISEÑO PREVIO, SIN MIGRACIÓN NI DESPLIEGUE',
  'no añade ejecución para',
  'anónimos ni confía en datos del navegador',
  'preflight confirma que no existen filas',
  'autorizaciones independientes',
  'PM26_P09E_AUTORIZACION_PRODUCCION=NO'
]) assert.ok(informe.includes(esperado), 'Falta salvaguarda: ' + esperado);

const prohibidos = /(service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|[a-z]{20}\.supabase\.co)/i;
assert.equal(prohibidos.test(informe), false);
assert.equal(prohibidos.test(JSON.stringify(manifiesto)), false);

console.log('PM26_P09E_DISENO_DOMINIOS=PASS');
console.log('PM26_P09E_PRECHECK_Y_ROLLBACK=PASS');
console.log('PM26_P09E_SIN_AUTORIZACION_PRODUCCION=PASS');
