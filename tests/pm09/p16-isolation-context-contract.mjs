import fs from 'node:fs';

const source = fs.readFileSync('fuente.js','utf8');
const p15 = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql','utf8');
const p08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql','utf8');

function check(name, ok) {
  console.log(`PM09_P16_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

// "Todos los locales" es consolidación de lectura dentro de la empresa activa.
const usosFiltroEmpresa = (source.match(/localEsDeEmpresaInforme/g) || []).length;
check('INFORMES_IDS_LOCALES_EMPRESA', /idsLocalesEmpresaInforme\s*=\s*new Set\s*\(/.test(source));
check('INFORMES_HELPER_EMPRESA', /localEsDeEmpresaInforme\s*=\s*\(id\)\s*=>\s*!!id\s*&&\s*idsLocalesEmpresaInforme\.has\(id\)/.test(source));
check('INFORMES_FILTRO_EMPRESA_USADO', usosFiltroEmpresa >= 8);
check('PRODUCTOS_TODOS_ACOTADOS_EMPRESA', /productosInforme\s*=\s*localInformeId[\s\S]{0,500}?productos\.filter\([\s\S]{0,200}?localEsDeEmpresaInforme/.test(source));
check('MOVIMIENTOS_TODOS_ACOTADOS_EMPRESA', /movimientosInforme\s*=\s*localInformeId[\s\S]{0,700}?movimientos\.filter\([\s\S]{0,300}?localEsDeEmpresaInforme/.test(source));
check('RESULTADOS_LOOKUP_ACOTADO', /productoPorId\s*:\s*\(id\)\s*=>\s*productosInforme\.find/.test(source));

// Mutaciones económicas exigen un local concreto; no se opera sobre la consolidación.
check('TPV_EXIGE_LOCAL_EXPLICITO', source.includes('Selecciona un local para gestionar ventas del TPV.'));
check('VENTA_PM09_RECIBE_LOCAL', p15.includes('p_local_id text') && p15.includes('registrar_venta_stock_carrito_pm09'));
check('CAJA_FILTRA_EMPRESA_LOCAL', p15.includes('where m.empresa_id=p_empresa_id') && p15.includes('and m.local_id=p_local_id'));

// Devoluciones heredan la protección de contexto PM08.
check('DEVOLUCION_VALIDA_EMPRESA_LOCAL', p08.includes("if v_venta.empresa_id<>p_empresa_id or v_venta.local_id<>p_local_id then") && p08.includes("raise exception 'venta_fuera_de_contexto'"));
check('DEVOLUCION_BLOQUEA_LOCAL_INACTIVO', p08.includes("raise exception 'local_inactivo'"));

if (process.exitCode) throw new Error('PM09_P16_ISOLATION_CONTEXT_CONTRACT_FAIL');
console.log(`PM09_P16_FILTRO_EMPRESA_USOS=${usosFiltroEmpresa}`);
console.log('PM09_P16_ISOLATION_CONTEXT_CONTRACT_OK=1');
