import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

const p02 = read('supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql');
const p05 = read('supabase/migrations/20260908075655_pm14_p05_estado_devuelto_encargo.sql');
const globalLedger = read('supabase/migrations/20260912120000_pm26_p09f_b3_pagos_encargo_operation_id_global.sql');
const c22 = read('supabase/migrations/20260914103000_pm27_c22_pagos_reembolsos_operation_id_hardening.sql');

const compact = (s) => s.replace(/\s+/g, ' ');
const oldPayments = compact(`${p02}\n${p05}`);
const hardening = compact(c22);

function mustMatch(text, regex, message) {
  assert.match(text, regex, message);
}

function mustNotMatch(text, regex, message) {
  assert.doesNotMatch(text, regex, message);
}

// ---------------------------------------------------------------------------
// 1. Reproduccion estatica del hueco historico C22-D1/D2/D3.
// ---------------------------------------------------------------------------
mustMatch(
  oldPayments,
  /revierte_pago_id text references public\.pagos_encargo\(id\)/i,
  'PM14 debe contener la FK historica de revierte_pago_id',
);
mustNotMatch(
  oldPayments,
  /create unique index[^;]*revierte_pago_id/i,
  'El paquete historico no deberia contener ya la unicidad que C22 viene a aportar',
);
mustNotMatch(
  oldPayments,
  /check\s*\([^)]*estado[^)]*revierte_pago_id|check\s*\([^)]*revierte_pago_id[^)]*estado/i,
  'El paquete historico no deberia contener ya el CHECK estado/enlace de C22',
);
mustMatch(
  oldPayments,
  /where id = p_pago_id and estado = 'CONFIRMADO' for update/i,
  'El RPC historico debe serializar el pago original durante el reverso',
);
mustMatch(
  oldPayments,
  /where revierte_pago_id = p_pago_id and estado = 'REVERSO' limit 1/i,
  'El RPC historico debe comprobar un reverso previo',
);
mustMatch(
  oldPayments,
  /original\.encargo_id, original\.empresa_id, original\.local_id/i,
  'El RPC historico debe copiar el contexto del pago original',
);
mustMatch(
  oldPayments,
  /original\.concepto, original\.importe/i,
  'El RPC historico debe copiar concepto e importe del pago original',
);

// La defensa RPC es correcta para el camino normal, pero no equivale a una invariante
// de tabla frente a futuros/escritores privilegiados. C22 debe materializarla en DDL.

// ---------------------------------------------------------------------------
// 2. El ledger global PM26 sigue siendo el unico motor de operation_id.
// ---------------------------------------------------------------------------
mustMatch(globalLedger, /private\.g1_operation_ids_global/i, 'Debe existir el ledger global PM26');
mustMatch(globalLedger, /private\.g1_claim_operation_id\(\)/i, 'Debe existir el helper global PM26');
mustMatch(globalLedger, /g1_operation_id_global/i, 'PM26 debe instalar el trigger global en pagos_encargo');

mustMatch(c22, /private\.g1_operation_ids_global/i, 'C22 debe verificar/reutilizar el ledger global');
mustMatch(c22, /private\.g1_claim_operation_id\(\)/i, 'C22 debe verificar/reutilizar el helper global');
mustNotMatch(c22, /create\s+table/i, 'C22 no puede crear un segundo ledger ni tablas nuevas');
mustNotMatch(c22, /create\s+(?:or\s+replace\s+)?function\s+private\.g1_claim_operation_id/i, 'C22 no puede redefinir el motor global');
mustNotMatch(c22, /create\s+(?:unique\s+)?index[^;]*operation_id/i, 'C22 no debe crear una idempotencia paralela por operation_id');

// ---------------------------------------------------------------------------
// 3. Preflight: no se sanea silenciosamente un ledger economico incoherente.
// ---------------------------------------------------------------------------
mustMatch(c22, /lock table public\.pagos_encargo in share row exclusive mode/i, 'Falta lock estable para el preflight/DDL');
mustMatch(c22, /lock table private\.g1_operation_ids_global in share row exclusive mode/i, 'Falta lock del ledger global durante validacion');
mustMatch(c22, /having count\(\*\) > 1/i, 'Falta preflight de reversos duplicados');
mustMatch(c22, /estado = 'REVERSO' and revierte_pago_id is null/i, 'Falta preflight REVERSO sin origen');
mustMatch(c22, /estado = 'CONFIRMADO' and revierte_pago_id is not null/i, 'Falta preflight CONFIRMADO con enlace de reverso');
mustMatch(c22, /r\.empresa_id is distinct from o\.empresa_id/i, 'Falta preflight cross-empresa');
mustMatch(c22, /r\.local_id is distinct from o\.local_id/i, 'Falta preflight cross-local');
mustMatch(c22, /r\.encargo_id is distinct from o\.encargo_id/i, 'Falta preflight cross-encargo');
mustMatch(c22, /r\.importe is distinct from o\.importe/i, 'Falta preflight de importe del reverso');
mustMatch(c22, /g\.ledger is distinct from 'pagos_encargo'/i, 'Falta verificar que el claim global pertenece a pagos_encargo');
mustMatch(c22, /g\.ledger = 'pagos_encargo'[\s\S]*p\.operation_id is null/i, 'Falta detectar claims globales huerfanos');

// ---------------------------------------------------------------------------
// 4. D1/D2: constraints durables, no solo comprobaciones del RPC.
// ---------------------------------------------------------------------------
mustMatch(
  hardening,
  /add constraint pm27_c22_pagos_encargo_estado_reverso_ck check \( \(estado = 'CONFIRMADO' and revierte_pago_id is null\) or \(estado = 'REVERSO' and revierte_pago_id is not null\) \) not valid/i,
  'Falta CHECK estado <-> revierte_pago_id',
);
mustMatch(c22, /validate constraint pm27_c22_pagos_encargo_estado_reverso_ck/i, 'El CHECK debe quedar validado');
mustMatch(
  hardening,
  /create unique index pm27_c22_pagos_encargo_un_reverso_por_pago on public\.pagos_encargo \(revierte_pago_id\) where revierte_pago_id is not null/i,
  'Falta unicidad parcial: un original, como maximo un reverso',
);

// ---------------------------------------------------------------------------
// 5. D3: integridad cross-row + ledger append-only.
// ---------------------------------------------------------------------------
mustMatch(c22, /create or replace function private\.pm27_c22_validar_pago_encargo_integridad\(\)/i, 'Falta funcion de integridad C22');
mustMatch(c22, /where id = new\.revierte_pago_id[\s\S]*for key share/i, 'El reverso debe bloquear/leer su original');
mustMatch(c22, /original\.estado <> 'CONFIRMADO'/i, 'El original de un reverso debe ser CONFIRMADO');
for (const field of ['empresa_id', 'local_id', 'encargo_id', 'importe', 'concepto', 'medio_pago']) {
  mustMatch(
    c22,
    new RegExp(`new\\.${field} is distinct from original\\.${field}`, 'i'),
    `El reverso debe conservar ${field}`,
  );
}
mustMatch(c22, /tg_op in \('UPDATE', 'DELETE'\)[\s\S]*pagos_encargo_append_only/i, 'UPDATE/DELETE deben quedar bloqueados');
mustMatch(c22, /tg_op = 'TRUNCATE'[\s\S]*pagos_encargo_append_only/i, 'TRUNCATE debe quedar bloqueado por trigger');
mustMatch(c22, /before insert or update or delete on public\.pagos_encargo/i, 'Falta trigger row-level de integridad');
mustMatch(c22, /before truncate on public\.pagos_encargo/i, 'Falta trigger anti-TRUNCATE');

// ---------------------------------------------------------------------------
// 6. Minimo privilegio: RLS ya existia; C22 elimina grants directos de escritura.
// ---------------------------------------------------------------------------
mustMatch(
  hardening,
  /revoke insert, update, delete, truncate, references, trigger on table public\.pagos_encargo from anon, authenticated/i,
  'Falta retirar privilegios directos de escritura innecesarios',
);
mustMatch(c22, /has_function_privilege\('authenticated', 'public\.registrar_pago_encargo/i, 'Debe preservarse EXECUTE del RPC de pago');
mustMatch(c22, /has_function_privilege\('authenticated', 'public\.revertir_pago_encargo/i, 'Debe preservarse EXECUTE del RPC de reverso');

// ---------------------------------------------------------------------------
// 7. Operabilidad segura / no despliegue.
// ---------------------------------------------------------------------------
mustMatch(c22, /^begin;/mi, 'La migracion debe ser transaccional');
mustMatch(c22, /set local lock_timeout = '5s'/i, 'Falta lock_timeout');
mustMatch(c22, /set local statement_timeout = '30s'/i, 'Falta statement_timeout');
mustMatch(c22, /commit;/i, 'Falta COMMIT explicito');
mustNotMatch(c22, /supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy|curl\s+https?:\/\//i, 'Una migracion versionada no debe desplegar por si misma');

console.log('PM27_C22_PAGOS_REEMBOLSOS_OPERATION_ID=PASS');
