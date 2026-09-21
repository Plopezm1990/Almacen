import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260916195500_p2_r03a_restore_pm08_pm09_post_reset.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const lower = sql.toLowerCase();

function check(name, ok) {
  console.log(`P2_R03A_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

function fn(name) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+(?:public|private)\\.${name}\\s*\\(`, 'i');
  const m = re.exec(sql);
  if (!m) throw new Error(`P2_R03A_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', m.index);
  const end = sql.indexOf('\n$$;', bodyStart);
  if (bodyStart < 0 || end < 0) throw new Error(`P2_R03A_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(m.index, end + 4);
}

const refund = fn('registrar_devolucion_venta');
const sale = fn('registrar_venta_stock_carrito_pm09');
const reverse = fn('revertir_venta_stock_carrito_pm09');
const caja = fn('registrar_movimiento_caja');
const arqueo = fn('registrar_arqueo_caja');

const tables = ['caja_operaciones','arqueos_caja','arqueos_caja_anulaciones','devoluciones_venta','devoluciones_proveedor'];
const publicRpcs = [
  'registrar_movimiento_caja','revertir_movimiento_caja','registrar_arqueo_caja','anular_arqueo_caja',
  'revertir_venta_stock_carrito','registrar_devolucion_venta','registrar_devolucion_proveedor',
  'registrar_venta_stock_carrito_pm09','revertir_venta_stock_carrito_pm09','registrar_devolucion_venta_pm09'
];

check('PREFLIGHT_FAIL_CLOSED', sql.includes('P2_R03A_PREFLIGHT_FALLO'));
check('FIVE_RUNTIME_TABLES', tables.every(t => lower.includes(`create table if not exists public.${t}`)));
check('RLS_ALL_TABLES', tables.every(t => lower.includes(`alter table public.${t} enable row level security`)));
check('RLS_TENANT_LOCAL', tables.every(t => lower.includes(`policy pm08_${t === 'caja_operaciones' ? 'caja' : t === 'arqueos_caja' ? 'arqueos' : t === 'arqueos_caja_anulaciones' ? 'arqueos_anulaciones' : t === 'devoluciones_venta' ? 'devoluciones_venta' : 'devoluciones_proveedor'}_select`)) && (lower.match(/using \(private\.la_tiene_local\(empresa_id,local_id\)\)/g)||[]).length === 5);
check('DIRECT_WRITES_REVOKED', tables.every(t => lower.includes(`revoke insert,update,delete on public.${t} from authenticated`)));
check('GLOBAL_TRIGGER_CAJA', lower.includes('create trigger g1_operation_id_global before insert on public.caja_operaciones'));
check('GLOBAL_TRIGGER_ARQUEO', lower.includes('create trigger g1_operation_id_global before insert on public.arqueos_caja'));
check('GLOBAL_TRIGGER_ARQUEO_ANULACION', lower.includes('create trigger g1_operation_id_global before insert on public.arqueos_caja_anulaciones'));
check('GLOBAL_REGISTRY_NOT_REDEFINED', !/create\s+table\s+(?:if\s+not\s+exists\s+)?private\.g1_operation_ids_global/i.test(sql) && !/create\s+or\s+replace\s+function\s+private\.g1_claim_operation_id/i.test(sql));

check('REFUND_SEPARATE_CAJA_ID', refund.includes("'refund:'||md5(v_operation_id)"));
check('REFUND_CAJA_ID_DISTINCT', refund.includes('v_caja_operation_id') && !refund.includes("values(v_operation_id,'REEMBOLSO'"));
check('REFUND_LINKED_TO_DEVOLUTION', refund.includes("'DEVOLUCION_CLIENTE',v_operation_id") && refund.includes('v_caja_operation_id'));
check('REFUND_REPLAY_USES_STORED_CAJA_ID', refund.includes('v_devolucion.caja_operation_id'));
check('REFUND_ATOMIC_SINGLE_RPC', refund.includes('update public.stock_ubicacion') && refund.includes('insert into public.caja_operaciones') && refund.includes('insert into public.devoluciones_venta') && !/\bcommit\b|\brollback\b/i.test(refund));
check('REFUND_CASH_CLOSED_PERIOD', refund.includes("v_medio='EFECTIVO'") && refund.includes("raise exception 'periodo_caja_cerrado'"));

check('PM09_SALE_WRAPPER', sale.includes('public.registrar_venta_stock_carrito') && sale.includes('fechaOperacion'));
check('PM09_REVERSE_WRAPPER', reverse.includes('public.revertir_venta_stock_carrito') && reverse.includes('fechaOperacion'));
check('CAJA_REPLAY_CONTRACT', caja.includes("'replayed',true") && caja.includes('operation_id_conflict'));
check('ARQUEO_SERVER_RECONCILIATION', arqueo.includes('private.pm09_resumen_caja_ventas') && arqueo.includes('v_reversos_efectivo'));

check('PUBLIC_RPCS_SECURITY_DEFINER', publicRpcs.every(name => fn(name).toLowerCase().includes('security definer')));
check('ANON_REVOKED', publicRpcs.every(name => lower.includes(`revoke all on function public.${name}`)));
check('AUTH_GRANTED', publicRpcs.every(name => lower.includes(`grant execute on function public.${name}`)));
check('LEGACY_ANULAR_TPV_STAYS_REVOKED', lower.includes("revoke all on function public.anular_venta_tpv(text,text) from public, anon, authenticated"));
check('LEGACY_DESCONTAR_STOCK_STAYS_REVOKED', lower.includes("revoke all on function public.descontar_stock(text,numeric,text,jsonb) from public, anon, authenticated"));
check('LEGACY_DESCONTAR_CARRITO_STAYS_REVOKED', lower.includes("revoke all on function public.descontar_stock_carrito(jsonb,text) from public, anon, authenticated"));
check('NO_LEGACY_GRANT', !/grant\s+execute\s+on\s+function\s+public\.(?:anular_venta_tpv|descontar_stock|descontar_stock_carrito)/i.test(sql));

if (process.exitCode) throw new Error('P2_R03A_CONTRACT_FAIL');
console.log('P2_R03A_CONTRACT_OK=1');
