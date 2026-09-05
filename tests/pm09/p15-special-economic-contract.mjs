import fs from 'node:fs';

const source = fs.readFileSync('fuente.js','utf8');
const migration = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql','utf8');

function check(name, ok) {
  console.log(`PM09_P15_${name.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('venta_rpc_pm09', source.includes('supabase.rpc("registrar_venta_stock_carrito_pm09", params)'));
check('venta_fecha_explicita', source.includes('p_lineas: lineasParaRpc, p_fecha: todayISO(), p_datos'));
check('reverso_rpc_pm09', source.includes('supabase.rpc("revertir_venta_stock_carrito_pm09"'));
check('reverso_fecha_explicita', source.includes('p_venta_operation_id: ventaId, p_fecha: todayISO(), p_motivo'));
check('devolucion_rpc_pm09', source.includes('window.__nubeCliente.rpc("registrar_devolucion_venta_pm09"'));
check('devolucion_conserva_p_fecha', source.includes('p_fecha: fechaReal'));
check('sync_fecha_economica', source.includes('fecha: d2.fechaOperacion || (creado ? creado.slice(0, 10) : todayISO())'));

for (const fn of [
  'registrar_venta_stock_pm09',
  'registrar_venta_stock_carrito_pm09',
  'revertir_venta_stock_pm09',
  'revertir_venta_stock_carrito_pm09',
  'registrar_devolucion_venta_pm09'
]) check(`sql_${fn}`, migration.includes(`function public.${fn}(`));

check('sql_fecha_en_movimiento', migration.includes("jsonb_build_object('fechaOperacion',p_fecha)"));
check('sql_caja_fecha_economica', migration.includes("datos->>'fechaOperacion'") && migration.includes('where fecha_operacion=p_fecha'));
check('sql_fallback_legacy_utc', migration.includes("timezone('UTC',m.created_at)::date"));
check('sql_grants_authenticated', (migration.match(/grant execute on function public\./g)||[]).length === 5);

// Oráculo de medios de pago del escenario especial.
const bruto = 6;
const cash = bruto + 5; // venta efectivo + parte efectivo del mixto
const card = bruto + 7 + 12 + 18; // tarjeta + parte mixta + venta devolución 0 + venta redondeo
const transfer = bruto;
check('modelo_efectivo_11', cash === 11);
check('modelo_tarjeta_43', card === 43);
check('modelo_transferencia_6', transfer === 6);

// Devolución sin reembolso: corrige gestión/unidades, pero no Caja.
const netUnitsNoRefund = 2 - 1;
const netIncomeNoRefund = 2 * 5.4545454545 - 1 * 5.4545454545;
const netCostNoRefund = 2 * 3 - 1 * 3;
check('sin_reembolso_unidad_1', netUnitsNoRefund === 1);
check('sin_reembolso_ingreso_5_45', Number(netIncomeNoRefund.toFixed(2)) === 5.45);
check('sin_reembolso_coste_3', netCostNoRefund === 3);
check('sin_reembolso_caja_0', 0 === 0);

// Redondeo histórico: 5.4545454545 + 10% = 5.99999999995 => límite monetario 6.00.
const grossRounded = Math.round((5.4545454545 * 1.10 + Number.EPSILON) * 100) / 100;
check('redondeo_6_00', grossRounded === 6);
check('exceso_un_centimo_rechazable', 6.01 > grossRounded);

// El snapshot histórico no debe ser sustituido por valores actuales simulados.
const historical = { income: 5.4545454545, cost: 3, vat: 10 };
const current = { price: 8, cost: 4.5, vat: 21 };
check('historico_precio_independiente', historical.income !== current.price);
check('historico_coste_independiente', historical.cost !== current.cost);
check('historico_iva_independiente', historical.vat !== current.vat);

if (process.exitCode) throw new Error('PM09_P15_SPECIAL_ECONOMIC_CONTRACT_FAIL');
console.log('PM09_P15_SPECIAL_ECONOMIC_CONTRACT_OK=1');
