import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const patchPath = 'supabase/migrations/20260914090000_pm27_c21_encargos_authorization_hardening.sql';
const historicalPath = 'supabase/migrations/20260908075655_pm14_p05_estado_devuelto_encargo.sql';
const bootstrapPath = 'supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql';
const patch = fs.readFileSync(patchPath, 'utf8');
const historical = fs.readFileSync(historicalPath, 'utf8');
const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');

function check(name, ok) {
  console.log(`PM27_C21_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

function extractFunction(sql, schema, name) {
  const rx = new RegExp(`create\\s+or\\s+replace\\s+function\\s+${schema}\\.${name}\\s*\\(`, 'i');
  const start = sql.search(rx);
  if (start < 0) throw new Error(`PM27_C21_FUNCION_AUSENTE=${schema}.${name}`);
  const tagMatch = sql.slice(start).match(/as\s+(\$[A-Za-z0-9_]*\$)/i);
  if (!tagMatch) throw new Error(`PM27_C21_DOLLAR_TAG_AUSENTE=${schema}.${name}`);
  const tag = tagMatch[1];
  const bodyStart = start + tagMatch.index + tagMatch[0].length;
  const end = sql.indexOf(tag, bodyStart);
  if (end < 0) throw new Error(`PM27_C21_FUNCION_INCOMPLETA=${schema}.${name}`);
  return sql.slice(start, end + tag.length + 1);
}

const registrar = extractFunction(patch, 'public', 'registrar_encargo');
const registrarHistorico = extractFunction(historical, 'public', 'registrar_encargo');

// 1) Reproducción estática de huecos históricos, contrastados además en vivo en Supabase.
check('DEFECTO_CLIENTE_CROSS_EMPRESA_REPRODUCIDO', !registrarHistorico.includes('cliente_otro_contexto'));
check('DEFECTO_SIN_LOCK_DOCUMENTO_REPRODUCIDO', !/where\s+id\s*=\s*p_id\s+for\s+update/i.test(registrarHistorico));
check('DEFECTO_SIN_MAQUINA_ESTADOS_REPRODUCIDO', !registrarHistorico.includes('transicion_encargo_invalida'));
check('DEFECTO_TABLA_MUTABLE_DIRECTA_REPRODUCIDO', !/revoke\s+insert\s*,\s*update[\s\S]*on\s+table\s+public\.encargos_empresa\s+from\s+authenticated/i.test(bootstrap + '\n' + historical));

// 2) Frontera de tabla: authenticated solo lee; mutaciones pasan por la RPC autoritativa.
check('ANON_SIN_TABLA', /revoke\s+all\s+on\s+table\s+public\.encargos_empresa\s+from\s+anon/i.test(patch));
check('AUTH_SIN_MUTACION_DIRECTA', /revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate\s*,\s*references\s*,\s*trigger\s+on\s+table\s+public\.encargos_empresa\s+from\s+authenticated/i.test(patch));
check('AUTH_LECTURA_RLS', /grant\s+select\s+on\s+table\s+public\.encargos_empresa\s+to\s+authenticated/i.test(patch));

// 3) Autorización y aislamiento de registrar_encargo.
check('SESSION_Y_ROL', registrar.includes('auth.uid() is null') && registrar.includes('private.pm08_puede_operar_caja()'));
check('TENANT_EMPRESA_LOCAL', registrar.includes('private.la_tiene_empresa(p_empresa_id)') && registrar.includes('private.la_tiene_local(p_empresa_id, p_local_id)'));
check('LOCAL_OPERABLE', registrar.includes('private.pm08_local_operable(p_empresa_id, p_local_id)'));
check('CLIENTE_REQUERIDO', registrar.includes("raise exception 'cliente_id_requerido'"));
check('CLIENTE_EXISTENTE_OTRA_EMPRESA_BLOQUEADO', registrar.includes('from public.clientes_empresa c') && registrar.includes('v_cliente_empresa is distinct from p_empresa_id') && registrar.includes("raise exception 'cliente_otro_contexto'"));
check('LEGACY_CLIENTE_NO_ESPEJADO_COMPATIBLE', registrar.includes('if found and v_cliente_empresa is distinct from p_empresa_id then'));

// 4) Máquina de estados, cierre trazable y saldo.
check('LOCK_DOCUMENTO', /from\s+public\.encargos_empresa[\s\S]*where\s+id\s*=\s*p_id[\s\S]*for\s+update/i.test(registrar));
check('CONTEXTO_DOCUMENTO_INMUTABLE', registrar.includes("raise exception 'encargo_referencia_otro_contexto'"));
check('TRANSICION_PENDIENTE', registrar.includes("v_estado_anterior = 'Pendiente' and v_estado not in ('Pendiente', 'Entregado', 'Cancelado')"));
check('TRANSICION_ENTREGADO', registrar.includes("v_estado_anterior = 'Entregado' and v_estado not in ('Entregado', 'Devuelto')"));
check('TERMINALES_NO_REVIVEN', registrar.includes("v_estado_anterior = 'Cancelado' and v_estado <> 'Cancelado'") && registrar.includes("v_estado_anterior = 'Devuelto' and v_estado <> 'Devuelto'"));
check('TRANSICION_INVALIDA_FAIL_CLOSED', registrar.includes("raise exception 'transicion_encargo_invalida'"));
check('SALDO_NETO_AUTORITATIVO', registrar.includes("when p.estado = 'CONFIRMADO' then p.importe") && registrar.includes("when p.estado = 'REVERSO' then -p.importe"));
check('NO_TOTAL_INFERIOR_PAGADO', registrar.includes("raise exception 'total_inferior_a_pagado'"));
check('CLIENTE_INMUTABLE_CON_COBROS', registrar.includes("raise exception 'encargo_con_cobros_cliente_inmutable'"));
check('CIERRE_IDENTIDAD_ESTABLE', registrar.includes("raise exception 'cierre_encargo_identidad_conflict'"));
check('TERMINAL_REPLAY_NO_REESCRIBE', registrar.includes("return jsonb_build_object('ok', true, 'replayed', true, 'encargo', to_jsonb(v_actual))") && registrar.includes("raise exception 'encargo_terminal_inmutable'"));
check('JSON_CONTEXTO_AUTORITATIVO', registrar.includes("'empresaId', p_empresa_id") && registrar.includes("'localId', p_local_id") && registrar.includes("'clienteId', p_cliente_id"));

// 5) Contrato SQL/ACL y límite de alcance C21.
check('TRANSACCION_EXPLICITA', /\nbegin;/.test(patch) && /\ncommit;\s*$/.test(patch));
check('PREFLIGHT', patch.includes("PREFLIGHT_FALLO: falta public.encargos_empresa") && patch.includes("PREFLIGHT_FALLO: falta public.clientes_empresa") && patch.includes("PREFLIGHT_FALLO: falta public.pagos_encargo"));
check('SECURITY_DEFINER_SEARCH_PATH', /security\s+definer/i.test(registrar) && /set\s+search_path\s+to\s+'public',\s*'auth',\s*'private',\s*'pg_temp'/i.test(registrar));
check('RPC_NO_ANON', /revoke\s+all\s+on\s+function\s+public\.registrar_encargo\(text,text,text,text,numeric,text,jsonb\)[\s\S]*from\s+public,\s*anon/i.test(patch));
check('RPC_AUTH', /grant\s+execute\s+on\s+function\s+public\.registrar_encargo\(text,text,text,text,numeric,text,jsonb\)[\s\S]*to\s+authenticated/i.test(patch));
check('NO_TOCAR_PAGOS_C21', !/create\s+or\s+replace\s+function\s+public\.(registrar_pago_encargo|revertir_pago_encargo)/i.test(patch));
check('NO_SEGUNDO_LEDGER', !patch.includes('g1_operation_ids_global') && !patch.includes('g1_claim_operation_id'));

// 6) Compatibilidad con el frontend PM14 ya cerrado.
check('FRONT_SYNC_RPC', fuente.includes('supabase.rpc("registrar_encargo"'));
check('FRONT_TODOS_FAIL_CLOSED', fuente.includes('function encargoEsDelLocalActivo(e2)') && fuente.includes('if (!localActivoId) return false;'));
check('FRONT_CLIENTE_OTRA_EMPRESA', fuente.includes('cliente.empresaId && cliente.empresaId !== empresaId'));
check('FRONT_CLIENTE_NUEVO_CON_EMPRESA', fuente.includes('const nuevo = { id: uid(), fechaAlta: todayISO(), ...data, empresaId };'));
check('FRONT_ENTREGA_ID_DETERMINISTA', fuente.includes('const operationId = `entrega-encargo:${actual.id}`;'));
check('RIESGO_BLOB_CONOCIDO_RESERVADO_C23', fuente.includes('loadKey("clientes", [])') && fuente.includes('loadKey("encargos", [])'));

// 7) Negativas deliberadas: el contrato detecta si se reabre cualquiera de los guards C21.
const sinRevoke = patch.replace(/revoke insert, update, delete, truncate, references, trigger\s+on table public\.encargos_empresa from authenticated;/i, '');
assert.notEqual(sinRevoke, patch, 'mutación negativa revoke sin efecto');
assert.equal(/revoke\s+insert\s*,\s*update[\s\S]*from\s+authenticated/i.test(sinRevoke), false);
console.log('PM27_C21_NEGATIVA_REVOKE_DIRECTO=PASS');

const sinCliente = registrar.replace("raise exception 'cliente_otro_contexto';", "raise exception 'cliente_aceptado';");
assert.notEqual(sinCliente, registrar, 'mutación negativa cliente sin efecto');
assert.equal(sinCliente.includes("raise exception 'cliente_otro_contexto'"), false);
console.log('PM27_C21_NEGATIVA_CLIENTE_CROSS_EMPRESA=PASS');

const sinTerminal = registrar.replace("raise exception 'encargo_terminal_inmutable';", "raise exception 'terminal_mutable';");
assert.notEqual(sinTerminal, registrar, 'mutación negativa terminal sin efecto');
assert.equal(sinTerminal.includes("raise exception 'encargo_terminal_inmutable'"), false);
console.log('PM27_C21_NEGATIVA_TERMINAL=PASS');

if (process.exitCode) throw new Error('PM27_C21_STATIC_CONTRACT_FAIL');

// Regresión funcional PM14 completa (solo contratos JS de raíz; DB queda fuera del gate
// porque C21 no escribe entornos remotos) y regresión acumulada C20 -> C19 -> C18...
const pm14 = fs.readdirSync('tests/pm14')
  .filter((name) => name.endsWith('.mjs'))
  .sort()
  .map((name) => `tests/pm14/${name}`);

for (const test of pm14) {
  console.log(`PM27_C21_RUN=${test}`);
  execFileSync(process.execPath, [test], { stdio: 'inherit' });
}

console.log('PM27_C21_RUN=tests/pm27/c20-inventarios-conteos.mjs');
execFileSync(process.execPath, ['tests/pm27/c20-inventarios-conteos.mjs'], { stdio: 'inherit' });

console.log('PM27_C21_ENCARGOS=PASS');
console.log('PM27_C21_CLIENTES=PASS');
console.log('PM27_C21_AUTORIZACION=PASS');
console.log('PM27_C21_ESTADOS=PASS');
console.log('PM27_C21_SALDO=PASS');
console.log('PM27_C21_RESULTADO=PASS');
