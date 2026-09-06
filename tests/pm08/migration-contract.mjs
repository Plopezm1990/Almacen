import fs from 'node:fs';

const path = 'supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql';
const sql = fs.readFileSync(path, 'utf8');
const lower = sql.toLowerCase();

function occurrences(text) {
  return (sql.match(new RegExp(text, 'gi')) || []).length;
}

function sqlFunction(name) {
  const startRe = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i');
  const match = startRe.exec(sql);
  if (!match) throw new Error(`PM08_SQL_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', match.index);
  const end = sql.indexOf('\n$$;', bodyStart);
  if (bodyStart < 0 || end < 0) throw new Error(`PM08_SQL_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(match.index, end + 4);
}

const altaCaja = sqlFunction('registrar_movimiento_caja');
const reversoCaja = sqlFunction('revertir_movimiento_caja');
const altaArqueo = sqlFunction('registrar_arqueo_caja');
const anularArqueo = sqlFunction('anular_arqueo_caja');
const devolverVenta = sqlFunction('registrar_devolucion_venta');
const devolverProveedor = sqlFunction('registrar_devolucion_proveedor');
const revertirCarrito = sqlFunction('revertir_venta_stock_carrito');
const revertirVenta = sqlFunction('revertir_venta_stock');

const tablas = ['caja_operaciones', 'arqueos_caja', 'arqueos_caja_anulaciones', 'devoluciones_venta', 'devoluciones_proveedor'];
const checks = {
  migracion_identificada_qa: sql.includes('Destino autorizado: Supabase QA'),
  cinco_tablas_presentes: tablas.every((table) => lower.includes(`create table if not exists public.${table}`)),
  rls_en_cinco_tablas: tablas.every((table) => lower.includes(`alter table public.${table} enable row level security`)),
  select_aislado_por_local: occurrences('using \\(private\\.la_tiene_local\\(empresa_id, local_id\\)\\)') === 5,
  escrituras_directas_revocadas: tablas.every((table) => lower.includes(`revoke insert, update, delete on public.${table} from authenticated`)),
  anon_sin_acceso_tablas: tablas.every((table) => lower.includes(`revoke all on public.${table} from anon`)),

  roles_caja_contrato: sql.includes("in ('Propietario','Encargado','Cajero/a')"),
  roles_correccion_contrato: sql.includes("in ('Propietario','Encargado')"),
  rol_proveedor_gestion_stock: devolverProveedor.includes('private.pm07_puede_gestionar_stock()'),
  todas_rpc_security_definer: [altaCaja, reversoCaja, altaArqueo, anularArqueo, devolverVenta, devolverProveedor, revertirCarrito, revertirVenta].every((block) => /security definer/i.test(block)),
  todas_rpc_auth_uid: [altaCaja, reversoCaja, altaArqueo, anularArqueo, devolverVenta, devolverProveedor, revertirCarrito, revertirVenta].every((block) => block.includes('auth.uid()')),
  search_path_explicito: [altaCaja, reversoCaja, altaArqueo, anularArqueo, devolverVenta, devolverProveedor, revertirCarrito, revertirVenta].every((block) => /set search_path\s*=/.test(block)),

  operation_id_formato: sql.includes("'^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'"),
  operation_id_bloqueo_atomico: sql.includes('pg_advisory_xact_lock') && [altaCaja, reversoCaja, altaArqueo, anularArqueo, devolverVenta, devolverProveedor, revertirCarrito, revertirVenta].every((block) => block.includes('pm08_bloquear_operation_id')),
  operation_id_conflicto: [altaCaja, reversoCaja, altaArqueo, anularArqueo, devolverVenta, devolverProveedor, revertirCarrito, revertirVenta].every((block) => block.includes('operation_id_conflict')),
  dinero_dos_decimales: sql.includes('if v <> p_importe then raise exception \'importe_precision_invalida\''),
  dinero_rango_limitado: sql.includes("raise exception 'importe_fuera_rango'"),
  json_auxiliar_objeto_limitado: lower.includes('create or replace function private.pm08_validar_json_objeto')
    && sql.includes("raise exception 'json_debe_ser_objeto'")
    && sql.includes("raise exception 'json_demasiado_grande'")
    && [altaCaja, devolverVenta, devolverProveedor].every((block) => block.includes('pm08_validar_json_objeto(p_datos,16384)'))
    && altaArqueo.includes('pm08_validar_json_objeto(p_snapshot,32768)'),
  helper_json_sin_execute_cliente: lower.includes('revoke all on function private.pm08_validar_json_objeto(jsonb,integer) from public, anon, authenticated'),
  metadatos_auditables_no_sobrescribibles: devolverVenta.includes('v_datos || jsonb_build_object(')
    && devolverProveedor.includes('v_datos || jsonb_build_object(')
    && !devolverVenta.includes(") || coalesce(p_datos,'{}'::jsonb)")
    && !devolverProveedor.includes(") || coalesce(p_datos,'{}'::jsonb)"),
  local_inactivo_identidad_exacta: lower.includes("and k.value->>'id' = p_local_id"),
  indice_reverso_venta: lower.includes('create index if not exists pm08_stock_operaciones_ref_reverso')
    && lower.includes("where tipo = 'reverso' and ref_operation_id is not null"),

  caja_tipos_canonicos: sql.includes("'ENTRADA', 'RETIRADA', 'REEMBOLSO'") && sql.includes("'REVERSO_ENTRADA', 'REVERSO_RETIRADA'"),
  caja_efecto_consistente: sql.includes('constraint pm08_caja_efecto_consistente'),
  caja_dia_cerrado_bloquea_alta: altaCaja.includes("raise exception 'periodo_caja_cerrado'"),
  caja_dia_cerrado_bloquea_reverso: reversoCaja.includes("raise exception 'periodo_caja_cerrado'"),
  caja_reverso_referencia_original: reversoCaja.includes('ref_operation_id') && reversoCaja.includes('-v_original.efecto_efectivo'),
  caja_sin_delete: !/delete\s+from\s+public\.caja_operaciones/i.test(sql),

  arqueo_alcance_dia: sql.includes("alcance text not null default 'DIA' check (alcance = 'DIA')"),
  arqueo_un_activo_dia_local: sql.includes('create unique index if not exists pm08_un_arqueo_activo_dia_local') && sql.includes("where estado = 'ACTIVO'"),
  arqueo_cero_admitido: sql.includes('efectivo_contado numeric(14,2) not null check (efectivo_contado >= 0)'),
  arqueo_esperado_servidor: altaArqueo.includes('sum(efecto_efectivo)') && altaArqueo.includes('v_base+v_efectos'),
  arqueo_anulacion_trazable: anularArqueo.includes('insert into public.arqueos_caja_anulaciones') && anularArqueo.includes("set estado='ANULADO'"),
  arqueo_sin_delete: !/delete\s+from\s+public\.arqueos_caja/i.test(sql),

  devolucion_bloquea_venta: devolverVenta.includes("tipo='VENTA' for update"),
  devolucion_bloquea_stock: devolverVenta.includes('from public.stock_ubicacion') && devolverVenta.includes('for update'),
  devolucion_limita_cantidad_acumulada: devolverVenta.includes('v_cantidad_devuelta+v_cantidad > v_linea.cantidad'),
  devolucion_limita_reembolso_acumulado: devolverVenta.includes('v_reembolsado+v_reembolso > v_tope_reembolso'),
  devolucion_stock_caja_misma_rpc: devolverVenta.includes('update public.stock_ubicacion') && devolverVenta.includes('insert into public.caja_operaciones') && devolverVenta.includes('insert into public.devoluciones_venta'),
  devolucion_efectivo_respeta_cierre: devolverVenta.includes("v_medio='EFECTIVO'") && devolverVenta.includes("raise exception 'periodo_caja_cerrado'"),
  devolucion_medio_coherente: sql.includes('constraint pm08_devolucion_reembolso_consistente'),
  devolucion_sin_control_transaccional_manual: !/\b(commit|rollback)\b/i.test(devolverVenta),

  proveedor_bloquea_stock: devolverProveedor.includes('from public.stock_ubicacion') && devolverProveedor.includes('for update'),
  proveedor_rechaza_deficit: devolverProveedor.includes("v_stock.almacen+v_stock.piso < v_cantidad") && devolverProveedor.includes("raise exception 'stock_insuficiente'"),
  proveedor_salida_repartida: devolverProveedor.includes('v_tomar_almacen := least') && devolverProveedor.includes('v_tomar_piso := v_cantidad-v_tomar_almacen'),
  proveedor_campos_acotados: devolverProveedor.includes("v_proveedor_id := left(nullif(btrim(coalesce(p_proveedor_id,'')),''),200)")
    && devolverProveedor.includes("v_proveedor_nombre := left(btrim(coalesce(p_proveedor_nombre,'')),300)"),
  venta_completa_bloqueada_si_hay_devolucion: revertirCarrito.includes('from public.devoluciones_venta') && revertirVenta.includes('from public.devoluciones_venta'),
  anulacion_y_devolucion_serializadas: revertirCarrito.includes("tipo='VENTA' for update") && revertirVenta.includes("tipo='VENTA' for update"),

  funciones_publicas_revocan_anon: occurrences('revoke all on function public\\.') >= 8 && occurrences('from public, anon') >= 8,
  funciones_publicas_solo_authenticated: occurrences('grant execute on function public\\.') >= 8,
  sin_grant_escritura_directa: !/grant\s+(insert|update|delete|all)\s+on\s+public\.(caja_operaciones|arqueos_caja|arqueos_caja_anulaciones|devoluciones_venta|devoluciones_proveedor)\s+to\s+authenticated/i.test(sql),
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`PM08_MIGRATION_${name.toUpperCase()}=${passed ? 1 : 0}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) throw new Error('PM08_MIGRATION_CONTRACT_FAIL');
console.log(`PM08_MIGRATION_CHECKS=${Object.keys(checks).length}`);
console.log('PM08_MIGRATION_CONTRACT_OK=1');
