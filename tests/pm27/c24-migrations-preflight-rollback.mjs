import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base = '6733894915eadaf26f10b65f32e6e296b41a4311';
const manifestPath = 'tests/pm27/pm27-c24-migration-manifest.json';
const preflightPath = 'supabase/qa-solo/pm27_c24_preflight_migraciones.sql';
const postflightPath = 'supabase/qa-solo/pm27_c24_postflight_migraciones.sql';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const preflight = fs.readFileSync(preflightPath, 'utf8');
const postflight = fs.readFileSync(postflightPath, 'utf8');

function check(name, ok) {
  console.log(`PM27_C24_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function atBase(path) {
  return execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' });
}

const migrations = manifest.migrations;
check('MANIFEST_CHECKPOINT', manifest.checkpoint === 'PM27-C24');
check('MANIFEST_BASE_EXACTA', manifest.baseCertifiedCommit === base);
check('MIGRACIONES_OCHO', Array.isArray(migrations) && migrations.length === 8);

// C24-D1: cinco candidatos certificados hasta C23 no acotaban esperas SQL.
const sinTimeoutEnC23 = [
  'supabase/migrations/20260913190500_pm27_c13_security_definer_tenant_guard.sql',
  'supabase/migrations/20260913193500_pm27_c13_private_helper_hardening.sql',
  'supabase/migrations/20260914064500_pm27_c18_stock_sale_operation_id_hardening.sql',
  'supabase/migrations/20260914071000_pm27_c19_transfer_operation_id_hardening.sql',
  'supabase/migrations/20260914080000_pm27_c20_inventory_count_replay_hardening.sql',
];
for (const path of sinTimeoutEnC23) {
  const old = atBase(path);
  check(`D1_REPRODUCIDO_${path.split('/').pop().replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
    !old.includes("set local lock_timeout = '5s'")
    && !old.includes("set local statement_timeout = '30s'"));
}

// Orden de aplicación determinista por timestamp de nombre.
const names = migrations.map((m) => m.path.split('/').pop());
const sorted = [...names].sort();
check('ORDEN_CRONOLOGICO', JSON.stringify(names) === JSON.stringify(sorted));
check('ORDEN_C13_A_C23',
  names[0].includes('_c13_') && names[1].includes('_c13_')
  && names.at(-1).includes('_c23_'));

// Integridad byte a byte y seguridad operativa homogénea.
for (const m of migrations) {
  assert.ok(fs.existsSync(m.path), `migración ausente: ${m.path}`);
  const actualBlob = git('hash-object', m.path);
  check(`BLOB_${m.path.split('/').pop().replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`, actualBlob === m.gitBlobSha);

  const sql = fs.readFileSync(m.path, 'utf8');
  check(`TRANSACCION_${names[migrations.indexOf(m)].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
    /\bbegin;[\s\S]*\bcommit;\s*$/i.test(sql));
  check(`LOCK_TIMEOUT_${names[migrations.indexOf(m)].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
    sql.includes("set local lock_timeout = '5s'"));
  check(`STATEMENT_TIMEOUT_${names[migrations.indexOf(m)].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
    sql.includes("set local statement_timeout = '30s'"));
  check(`NO_DEPLOY_${names[migrations.indexOf(m)].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
    !/supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy/i.test(sql));
}

// El preflight agregado es deliberadamente de solo lectura y rechaza tanto
// instalación incompleta como re-aplicación/parcial y datos incompatibles.
check('PREFLIGHT_READ_ONLY',
  /begin;[\s\S]*set local transaction read only;[\s\S]*rollback;/i.test(preflight));
check('PREFLIGHT_TIMEOUTS',
  preflight.includes("set local lock_timeout = '5s'")
  && preflight.includes("set local statement_timeout = '30s'"));
check('PREFLIGHT_DEPENDENCIAS',
  preflight.includes('falta public.perfiles')
  && preflight.includes('faltan tablas base de stock')
  && preflight.includes('faltan tablas base PM14')
  && preflight.includes('falta ledger global operation_id'));
check('PREFLIGHT_REAPLICACION_FAIL_CLOSED',
  preflight.includes('PM27_C24_PREFLIGHT_REAPLICACION_RECHAZADA')
  && preflight.includes('C13_contexto')
  && preflight.includes('C18_venta')
  && preflight.includes('C19_interno')
  && preflight.includes('C20_bases_replay')
  && preflight.includes('C21_encargos')
  && preflight.includes('C22_ledger_hardening')
  && preflight.includes('C23_cart_replay_metadata'));
check('PREFLIGHT_DATOS_C13', preflight.includes('perfil/membresía incompatible para C13'));
check('PREFLIGHT_DATOS_C21',
  preflight.includes('encargos con estado histórico incompatible')
  && preflight.includes('encargo referencia cliente de otra empresa'));
check('PREFLIGHT_DATOS_C22',
  preflight.includes('pago estado/revierte_pago_id incoherente')
  && preflight.includes('un pago tiene más de un reverso')
  && preflight.includes('pago sin claim global correcto'));

// El postflight también es de solo lectura y comprueba C13-C23, incluido el
// caso de RPC legacy opcional sin llamar has_function_privilege sobre firma ausente.
check('POSTFLIGHT_READ_ONLY',
  /begin;[\s\S]*set local transaction read only;[\s\S]*rollback;/i.test(postflight));
check('POSTFLIGHT_TIMEOUTS',
  postflight.includes("set local lock_timeout = '5s'")
  && postflight.includes("set local statement_timeout = '30s'"));
check('POSTFLIGHT_LEGACY_OID_PRIMERO',
  postflight.indexOf("to_regprocedure('public.descontar_stock_carrito(jsonb,text)')")
    < postflight.indexOf("has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE')")
  && postflight.indexOf("to_regprocedure('public.anular_venta_tpv(text,text)')")
    < postflight.indexOf("has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE')"));
check('POSTFLIGHT_C13_C23',
  postflight.includes('C13 contexto no instalado')
  && postflight.includes('C18 venta sin guard global')
  && postflight.includes('C19 traslado interno sin guard global')
  && postflight.includes('C20 identidad de bases ausente')
  && postflight.includes('C21 incompleto')
  && postflight.includes('C22 CHECK ausente/no validado')
  && postflight.includes('C23 identidad de metadatos de línea ausente'));

// El manifest no debe confundirse con un aplicador. C24 prepara y certifica;
// la aplicación remota queda para el rollout autorizado de C25.
const c24Text = [preflight, postflight, fs.readFileSync(manifestPath, 'utf8')].join('\n');
check('C24_NO_APLICADOR_REMOTO',
  !/supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy/i.test(c24Text));

if (process.exitCode) throw new Error('PM27_C24_STATIC_CONTRACT_FAIL');

// La regresión C23 arrastra C17-C22 y PM12-P08; si C24 cambia bytes de migración
// de forma funcional, este contrato debe detectarlo antes del cierre.
console.log('PM27_C24_RUN=tests/pm27/c23-concurrencia-replay-atomicidad.mjs');
execFileSync(process.execPath, ['tests/pm27/c23-concurrencia-replay-atomicidad.mjs'], { stdio: 'inherit' });

console.log('PM27_C24_PREFLIGHT=PASS');
console.log('PM27_C24_REAPLICACION=PASS');
console.log('PM27_C24_TIMEOUTS=PASS');
console.log('PM27_C24_ORDEN_DEPENDENCIAS=PASS');
console.log('PM27_C24_POSTFLIGHT=PASS');
console.log('PM27_C24_RESULTADO=PASS');
