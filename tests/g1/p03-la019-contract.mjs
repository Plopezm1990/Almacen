import fs from 'node:fs';
import assert from 'node:assert/strict';

const pm08Path = 'supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql';
const pm09Path = 'supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql';
const evidencePath = 'tests/g1/P03_LA019_EVIDENCIA.md';

for (const path of [pm08Path, pm09Path, evidencePath]) {
  assert.equal(fs.existsSync(path), true, `Falta archivo requerido: ${path}`);
}

const pm08 = fs.readFileSync(pm08Path, 'utf8');
const pm09 = fs.readFileSync(pm09Path, 'utf8');
const evidence = fs.readFileSync(evidencePath, 'utf8');

function sqlFunction(sql, name) {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
  assert.ok(start >= 0, `Función ausente: ${name}`);
  const bodyStart = sql.indexOf('as $$', start);
  const end = sql.indexOf('\n$$;', bodyStart);
  assert.ok(bodyStart >= 0 && end >= 0, `Función incompleta: ${name}`);
  return sql.slice(start, end + 4);
}

const refund = sqlFunction(pm08, 'registrar_devolucion_venta');
const refundPm09 = sqlFunction(pm09, 'registrar_devolucion_venta_pm09');

const checks = {
  negativo_validado_antes_del_bloqueo: refund.includes('pm08_validar_dinero(p_reembolso,true,false)')
    && refund.indexOf('pm08_validar_dinero(p_reembolso,true,false)') < refund.indexOf('pm08_bloquear_operation_id'),
  venta_serializada: refund.includes("tipo='VENTA' for update"),
  stock_bloqueado: refund.includes('from public.stock_ubicacion') && refund.includes('for update'),
  limite_cantidad_acumulado: refund.includes('v_cantidad_devuelta+v_cantidad > v_linea.cantidad')
    && refund.includes("raise exception 'devolucion_supera_cantidad_pendiente'"),
  limite_reembolso_acumulado: refund.includes('v_reembolsado+v_reembolso > v_tope_reembolso')
    && refund.includes("raise exception 'reembolso_supera_importe_pendiente'"),
  replay_idempotente: refund.includes("v_operacion_existente.tipo='DEVOLUCION_CLIENTE'")
    && refund.includes("'replayed',true"),
  payload_conflictivo: refund.includes("raise exception 'operation_id_conflict'"),
  mutaciones_en_una_rpc: refund.includes('insert into public.stock_operaciones')
    && refund.includes('update public.stock_ubicacion')
    && refund.includes('insert into public.movimientos_stock')
    && refund.includes('insert into public.caja_operaciones')
    && refund.includes('insert into public.devoluciones_venta'),
  sin_commit_manual: !/\b(commit|rollback)\b/i.test(refund),
  wrapper_pm09_delega_base: refundPm09.includes('public.registrar_devolucion_venta(')
    && refundPm09.includes("tipo='DEVOLUCION_CLIENTE'"),
  evidencia_7_de_7: evidence.includes('7/7 PASS'),
  evidencia_limpieza_cero: ['stock_operaciones', 'movimientos_stock', 'devoluciones_venta', 'caja_operaciones']
    .every((name) => evidence.includes('- `' + name + '` con prefijo G1-P03: **0**')),
  decision_explicita: evidence.includes('G1_P03_LA019=PASS')
    && evidence.includes('SIGUIENTE=G1.4_REVALIDAR_LA023')
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`G1_P03_${name.toUpperCase()}=${passed ? 1 : 0}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) throw new Error('G1_P03_LA019_CONTRACT_FAIL');
console.log(`G1_P03_CHECKS=${Object.keys(checks).length}`);
console.log('G1_P03_LA019_CONTRACT_OK=1');
