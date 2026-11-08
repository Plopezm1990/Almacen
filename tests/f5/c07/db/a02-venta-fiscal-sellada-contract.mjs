// A-02 — al saldar la cuenta, su venta fiscal queda cerrada y sellada.
//
// `ventas_fiscales` admite ABIERTA / BLOQUEADA / CERRADA / CANCELADA y tiene
// `abc_venta_lock`, que exige `locked_at` cuando el estado es CERRADA o
// BLOQUEADA. El esquema preveía el sello de inmutabilidad, pero nada lo
// usaba: medido el 2026-11-08, ninguna función ni disparador escribía
// `ventas_fiscales.estado` ni `locked_at` en ningún entorno. Producción tenía
// 8 ventas, las 8 ABIERTA; QA 61, las 61 ABIERTA, incluidas las cobradas ese
// mismo día con la cuenta ya cerrada.
//
// Requiere una URL de Postgres real en C07D_A02_TEST_DATABASE_URL, apuntando
// a una base desechable donde ya se hayan cargado, en este orden:
//   1) tests/f5/c07/db/fixtures-a02.sql
//   2) supabase/migrations/20261108170000_a02_cerrar_y_sellar_venta_fiscal.sql
//
// No crea ni destruye la base.
import pg from 'pg';

const DB_URL = process.env.C07D_A02_TEST_DATABASE_URL;
if (!DB_URL) {
  console.error('Falta C07D_A02_TEST_DATABASE_URL. Ver cabecera de este archivo.');
  process.exit(1);
}

const UID = '00000000-0000-4000-8000-0000000000a1';
const TERMINAL = '00000000-0000-4000-8000-0000000000b1';
const SESION = '00000000-0000-4000-8000-0000000000c1';
const CUENTA = '00000000-0000-4000-8000-00000000c001';
const CHECKOUT = '00000000-0000-4000-8000-00000000c002';
const VENTA = '00000000-0000-4000-8000-00000000c003';
const CUENTA_AJENA = '00000000-0000-4000-8000-00000000c005';
const CHECKOUT_AJENO = '00000000-0000-4000-8000-00000000c006';
const VENTA_AJENA = '00000000-0000-4000-8000-00000000c004';
const HOY = new Date().toISOString().slice(0, 10);

let pruebas = 0;
let fallos = 0;
const comprobar = (nombre, condicion, detalle) => {
  pruebas += 1;
  if (condicion) console.log(`ok ${pruebas} - ${nombre}`);
  else { fallos += 1; console.log(`not ok ${pruebas} - ${nombre}${detalle ? ' -> ' + detalle : ''}`); }
};

const cliente = new pg.Client({ connectionString: DB_URL });
const fila = async (sql, params) => (await cliente.query(sql, params)).rows[0];

async function sembrar(cuenta, checkout, venta, sufijo) {
  await cliente.query(
    `insert into public.cuentas_comerciales(id, empresa_id, local_id, estado, version, currency_code, created_at)
     values ($1,'EMP-A','A1','ABIERTA',1,'EUR',now())`, [cuenta]);
  await cliente.query(
    `insert into public.checkouts(id, empresa_id, local_id, cuenta_id, currency_code, estado, version, created_at, operating_day, completed_at)
     values ($1,'EMP-A','A1',$2,'EUR','COMPLETADO',1,now(),current_date,now())`, [checkout, cuenta]);
  await cliente.query(
    `insert into public.ventas_fiscales(id, empresa_id, local_id, cuenta_id, currency_code, estado, version,
       subtotal, descuento_total, impuestos_total, total, created_at, created_operating_day)
     values ($1,'EMP-A','A1',$2,'EUR','ABIERTA',1,10,0,0,10,now(),current_date)`, [venta, cuenta]);
  await cliente.query(
    `insert into public.checkout_ventas(id, empresa_id, local_id, checkout_id, venta_fiscal_id, currency_code, importe_objetivo, created_at)
     values (gen_random_uuid(),'EMP-A','A1',$1,$2,'EUR',10,now())`, [checkout, venta]);
  const intento = `00000000-0000-4000-8000-0000000009${sufijo}`;
  await cliente.query(
    `insert into public.pago_intentos(id, empresa_id, local_id, estado, started_at, resolved_at)
     values ($1,'EMP-A','A1','CONFIRMADO',now(),now())`, [intento]);
  await cliente.query(
    `insert into public.pago_aplicaciones(id, empresa_id, local_id, intento_id, venta_fiscal_id, sale_amount)
     values (gen_random_uuid(),'EMP-A','A1',$1,$2,10)`, [intento, venta]);
}

try {
  await cliente.connect();
  await cliente.query("select set_config('a02.uid', $1, false)", [UID]);
  await sembrar(CUENTA, CHECKOUT, VENTA, '01');

  comprobar('la venta arranca ABIERTA y sin sellar',
    (await fila('select estado, locked_at is null as sin_sello from public.ventas_fiscales where id=$1', [VENTA])).estado === 'ABIERTA');

  // La restricción del esquema existe y muerde: cerrar sin sellar es imposible.
  let mordio = false;
  try {
    await cliente.query("update public.ventas_fiscales set estado='CERRADA' where id=$1", [VENTA]);
  } catch (error) {
    mordio = /abc_venta_lock/.test(error.message || '');
  }
  comprobar('no se puede cerrar una venta sin sellarla', mordio);

  const r = await fila(
    'select public.abc_cerrar_cuenta_pagada($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',
    ['op-a02-contrato-1', 'EMP-A', 'A1', CUENTA, CHECKOUT, 1, TERMINAL, SESION, HOY]);
  comprobar('el cierre de cuenta responde ok', r.r && r.r.ok === true, JSON.stringify(r.r));
  comprobar('e informa de cuantas ventas ha sellado', r.r && r.r.ventas_selladas === 1, JSON.stringify(r.r && r.r.ventas_selladas));

  const v = await fila('select estado, locked_at is not null as sellada, version from public.ventas_fiscales where id=$1', [VENTA]);
  comprobar('la venta queda CERRADA', v.estado === 'CERRADA', v.estado);
  comprobar('y sellada con locked_at', v.sellada === true);
  comprobar('y sube de version', Number(v.version) === 2, String(v.version));

  comprobar('la cuenta sigue cerrandose como antes',
    (await fila('select estado from public.cuentas_comerciales where id=$1', [CUENTA])).estado === 'CERRADA');

  const evento = await fila(
    "select payload->>'ventas_selladas' as n from public.abc_eventos where event_type='CUENTA_CERRADA_PAGADA' order by occurred_at limit 1");
  comprobar('el evento deja constancia del sellado', evento && evento.n === '1', String(evento && evento.n));

  // Una venta de otra cuenta no se toca.
  await sembrar(CUENTA_AJENA, CHECKOUT_AJENO, VENTA_AJENA, '02');
  const ajena = await fila('select estado, locked_at is null as sin_sello from public.ventas_fiscales where id=$1', [VENTA_AJENA]);
  comprobar('una venta de otra cuenta sigue abierta y sin sellar',
    ajena.estado === 'ABIERTA' && ajena.sin_sello === true);

  // Repetir el cierre no vuelve a sellar ni pisa el sello.
  const selloAntes = (await fila('select locked_at from public.ventas_fiscales where id=$1', [VENTA])).locked_at;
  let repetido = null;
  try {
    repetido = await fila('select public.abc_cerrar_cuenta_pagada($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',
      ['op-a02-contrato-2', 'EMP-A', 'A1', CUENTA, CHECKOUT, 2, TERMINAL, SESION, HOY]);
  } catch (error) {
    repetido = { error: error.message };
  }
  comprobar('cerrar dos veces no revienta ni vuelve a sellar',
    repetido && (repetido.error
      ? /cuenta_ya_cerrada|cuenta_no_cerrable/.test(repetido.error)
      : repetido.r.ventas_selladas === 0),
    repetido && (repetido.error || JSON.stringify(repetido.r && repetido.r.ventas_selladas)));

  const selloDespues = (await fila('select locked_at from public.ventas_fiscales where id=$1', [VENTA])).locked_at;
  comprobar('el sello original no se pisa', String(selloAntes) === String(selloDespues));
} catch (error) {
  fallos += 1;
  console.log(`not ok - error inesperado -> ${error && error.message ? error.message : error}`);
} finally {
  await cliente.end().catch(() => {});
}

console.log(`1..${pruebas}`);
console.log(`C07D_A02_PRUEBAS=${pruebas} C07D_A02_FALLOS=${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
