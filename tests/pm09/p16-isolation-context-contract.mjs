import fs from 'node:fs';

const source = fs.readFileSync('fuente.js','utf8');
const p15 = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql','utf8');
const p08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql','utf8');

function check(name, ok) {
  console.log(`PM09_P16_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

// "Todos los locales" es consolidación de lectura dentro de la empresa activa.
check('INFORMES_IDS_LOCALES_EMPRESA', source.includes('const idsLocalesEmpresaInforme = new Set(locales.filter((l2) => l2 && l2.empresaId === empresaDelLocalActivo?.id)'));
check('INFORMES_HELPER_EMPRESA', source.includes('const localEsDeEmpresaInforme = (id) => !!id && idsLocalesEmpresaInforme.has(id);'));
check('PRODUCTOS_TODOS_ACOTADOS_EMPRESA', source.includes(': productos.filter((p2) => localEsDeEmpresaInforme(p2.localId));'));
check('MOVIMIENTOS_TODOS_ACOTADOS_EMPRESA', source.includes(': movimientos.filter((m2) => localEsDeEmpresaInforme(m2.localId || localPorProductoInforme.get(m2.productoId) || null));'));
check('RESULTADOS_LOOKUP_ACOTADO', source.includes('productoPorId: (id) => productosInforme.find((p2) => p2.id === id)'));

// Mutaciones económicas exigen un local concreto; no se opera sobre la consolidación.
check('TPV_EXIGE_LOCAL_EXPLICITO', source.includes('Selecciona un local para gestionar ventas del TPV.'));
check('VENTA_PM09_RECIBE_LOCAL', p15.includes('p_local_id text') && p15.includes('registrar_venta_stock_carrito_pm09'));
check('CAJA_FILTRA_EMPRESA_LOCAL', p15.includes('where m.empresa_id=p_empresa_id') && p15.includes('and m.local_id=p_local_id'));

// Devoluciones heredan la protección de contexto PM08.
check('DEVOLUCION_VALIDA_EMPRESA_LOCAL', p08.includes("if v_venta.empresa_id<>p_empresa_id or v_venta.local_id<>p_local_id then") && p08.includes("raise exception 'venta_fuera_de_contexto'"));
check('DEVOLUCION_BLOQUEA_LOCAL_INACTIVO', p08.includes("raise exception 'local_inactivo'"));

if (process.exitCode) throw new Error('PM09_P16_ISOLATION_CONTEXT_CONTRACT_FAIL');
console.log('PM09_P16_ISOLATION_CONTEXT_CONTRACT_OK=1');
