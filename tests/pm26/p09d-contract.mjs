import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const leer = (ruta) => readFileSync(ruta, 'utf8');

const p09b = leerJson('tests/pm26/p09b-compatibilidad-release-produccion/snapshot-saneado.json');
const manifiesto = leerJson('tests/pm26/p09d-cierre-transitivo/manifest-saneado.json');
const informe = leer('tests/pm26/P09D_CIERRE_TRANSITIVO_RELEASE_PRODUCCION.md');

assert.equal(p09b.resultado_esperado.relaciones_ausentes_produccion, 11);
assert.equal(p09b.resultado_esperado.rpc_incompatibles_produccion, 13);
assert.deepEqual(
  manifiesto.base.p09b_relaciones_ausentes,
  [
    'albaranes_empresa', 'arqueos_caja', 'caja_operaciones', 'clientes_empresa',
    'devoluciones_proveedor', 'devoluciones_venta', 'facturas_directas_empresa',
    'gastos_empresa', 'pagos_factura', 'proveedores_empresa', 'stock_estado'
  ]
);
assert.equal(manifiesto.base.rpc_candidatas, 13);
assert.deepEqual(manifiesto.cierre_directo_adicional.relaciones, ['arqueos_caja_anulaciones']);
assert.equal(manifiesto.cierre_directo_adicional.helpers_privados_ausentes.length, 9);
assert.equal(manifiesto.deriva_semantica_a_revisar.helpers_compartidos.length, 8);
assert.equal(manifiesto.resultado.migracion_productiva_lista, false);

for (const texto of [
  'DIAGNOSTICO AMPLIADO, SIN MIGRACION',
  'P09D_MIGRACION_PRODUCTIVA_LISTA=NO',
  'Sin escrituras en Supabase, QA, producción o TPV',
  'Sin cambios en'
]) assert.ok(informe.includes(texto), 'Falta límite o estado: ' + texto);

const prohibidos = /(service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|[a-z]{20}\.supabase\.co)/i;
assert.equal(prohibidos.test(informe), false, 'El informe no puede exponer secretos ni identificadores internos');
assert.equal(prohibidos.test(JSON.stringify(manifiesto)), false, 'El manifiesto no puede exponer secretos ni identificadores internos');

console.log('PM26_P09D_CIERRE_DIRECTO_VERIFICADO=PASS');
console.log('PM26_P09D_DERIVA_SEMANTICA_VERIFICADA=PASS');
console.log('PM26_P09D_SIN_MIGRACION=PASS');
