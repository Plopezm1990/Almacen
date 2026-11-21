import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Desde el 15/11/2026 el segundo factor es voluntario: lo pone cada persona si
// quiere, y el Propietario puede exigirlo a un cargo concreto. Este contrato
// fija esa regla en los CINCO sitios que la deciden, porque si uno solo se
// queda con la regla antigua el resultado es una puerta que nadie entiende:
//   1. supabase/migrations/.../mfa_politica_opcional.sql  (private.la_usuario_activo)
//   2. fuente.js                                          (evaluarMfaSesion)
//   3. edge-auth-patch.js                                  (puerta de aplicacion)
//   4. edge-auth-patch.js                                  (overlay MfaGate)
//   5. owner-bootstrap-post-reset.js                       (arranque historico)
// Y fija lo que no puede perderse al hacerla voluntaria: que quien SI tiene un
// factor inscrito siga completando su desafio, y que si el servidor todavia no
// tiene la politica se siga exigiendo como en M-03 (fallar cerrado).

const source = readFileSync('fuente.js', 'utf8');
const bootstrap = readFileSync('owner-bootstrap-post-reset.js', 'utf8');
const edgeAuth = readFileSync('edge-auth-patch.js', 'utf8');
const politicaSql = readFileSync('supabase/migrations/20261115120000_mfa_politica_opcional.sql', 'utf8');

const appStart = source.indexOf('function AppConSesion()');
const appEnd = source.indexOf('var rutaHash', appStart);
assert.ok(appStart >= 0 && appEnd > appStart, 'M03_APP_SESSION_COMPONENT_NOT_FOUND');
const app = source.slice(appStart, appEnd);
const mfaGateStart = source.indexOf('function MfaGate');
const mfaGateEnd = source.indexOf('function AppConSesion()', mfaGateStart);
assert.ok(mfaGateStart >= 0 && mfaGateEnd > mfaGateStart, 'M03_MFA_GATE_SOURCE_NOT_FOUND');
const mfaGate = source.slice(mfaGateStart, mfaGateEnd);

function trozo(texto, desde, hasta, etiqueta) {
  const i = texto.indexOf(desde);
  assert.ok(i >= 0, `${etiqueta}_INICIO_NO_ENCONTRADO`);
  const j = texto.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `${etiqueta}_FIN_NO_ENCONTRADO`);
  return texto.slice(i, j);
}

// ---------------------------------------------------------------- 1. servidor
assert.match(politicaSql, /create table if not exists private\.mfa_politica/, 'P04_POLICY_TABLE_MISSING');
assert.match(politicaSql, /exigida boolean not null default false/, 'P04_POLICY_DEFAULT_MUST_BE_VOLUNTARY');
assert.match(politicaSql, /create or replace function private\.mfa_exigida_para_uid\(\)/, 'P04_POLICY_PREDICATE_MISSING');
assert.match(politicaSql, /create or replace function private\.la_usuario_activo\(\)/, 'P04_MASTER_GATE_NOT_REWRITTEN');
assert.match(politicaSql, /not private\.mfa_exigida_para_uid\(\)/, 'P04_MASTER_GATE_MUST_ASK_THE_POLICY');
// La regla vieja era una lista de cargos escrita a mano dentro de la puerta
// maestra. Si reaparece ahi, la politica deja de mandar.
const puertaMaestra = trozo(politicaSql, 'create or replace function private.la_usuario_activo()', '$function$;', 'P04_MASTER_GATE');
assert.doesNotMatch(puertaMaestra, /m\.rol in \('Propietario'/, 'P04_MASTER_GATE_MUST_NOT_HARDCODE_ROLES');
assert.match(politicaSql, /create or replace function public\.mfa_politica_leer\(\)/, 'P04_READ_API_MISSING');
assert.match(politicaSql, /create or replace function public\.mfa_politica_guardar\(/, 'P04_WRITE_API_MISSING');
// Escribir la politica es cosa del Propietario; leerla la puede leer cualquiera
// porque necesita saber si a el se le exige.
const guardar = trozo(politicaSql, 'create or replace function public.mfa_politica_guardar(', '\n$$;', 'P04_WRITE_API');
assert.match(guardar, /Propietario/, 'P04_WRITE_API_MUST_CHECK_OWNER');
for (const fn of ['mfa_politica_leer', 'mfa_politica_guardar']) {
  assert.match(politicaSql, new RegExp(`revoke all on function public\\.${fn}\\s*\\([^)]*\\) from public, anon`), `P04_${fn}_NOT_REVOKED`);
  assert.match(politicaSql, new RegExp(`grant execute on function public\\.${fn}\\s*\\([^)]*\\) to authenticated`), `P04_${fn}_NOT_GRANTED`);
}

// ------------------------------------------------------------- 2. fuente.js
// Fallar cerrado: mientras `mfa_politica_leer` no exista en el servidor se
// mantiene la conducta de M-03. Si esta constante pasa a false, un despliegue
// del cliente adelantado a la migracion deja sin segundo factor justo a quien
// hoy lo tiene.
assert.match(source, /const MFA_EXIGIDA_SIN_POLITICA = true;/, 'M03_FAIL_CLOSED_CONSTANT_MISSING');
assert.doesNotMatch(source, /MFA_REQUIRED_FOR_ALL_LA_SUITE/, 'M03_OLD_MANDATORY_FLAG_STILL_PRESENT');
const politicaCliente = trozo(source, 'function mfaPoliticaExigidaParaMi(cliente)', '\nfunction evaluarMfaSesion', 'M03_CLIENT_POLICY');
assert.match(politicaCliente, /cliente\.rpc\("mfa_politica_leer"\)/, 'M03_CLIENT_MUST_ASK_THE_SERVER');
assert.match(politicaCliente, /could not find the function\|PGRST202\|HTTP 404/, 'M03_CLIENT_MUST_DETECT_UNMIGRATED_SERVER');
assert.match(politicaCliente, /return MFA_EXIGIDA_SIN_POLITICA;/, 'M03_CLIENT_MUST_FAIL_CLOSED');
const evaluar = trozo(source, 'function evaluarMfaSesion(cliente)', '\nfunction ', 'M03_EVALUAR');
// Un desafio pendiente se atiende SIEMPRE y antes de preguntar nada: quien se
// puso el factor quiere que se le pida, exija o no la politica.
assert.match(evaluar, /if \(aal\.data\?\.nextLevel === "aal2" && aal\.data\?\.currentLevel !== "aal2"\) return \{ modo: "challenge" \};/, 'M03_PENDING_CHALLENGE_MUST_ALWAYS_BE_HONOURED');
assert.ok(
  evaluar.indexOf('modo: "challenge"') < evaluar.indexOf('mfaPoliticaExigidaParaMi'),
  'M03_PENDING_CHALLENGE_MUST_COME_BEFORE_THE_POLICY'
);
// Tener factor verificado basta para pasar; sin factor, solo se obliga a
// inscribirse si la politica lo exige.
assert.match(evaluar, /if \(verificados\.length > 0\) return \{ modo: null \};/, 'M03_VERIFIED_FACTOR_MUST_PASS');
assert.match(evaluar, /return \{ modo: await mfaPoliticaExigidaParaMi\(cliente\) \? "enroll" : null \};/, 'M03_ENROLL_MUST_DEPEND_ON_THE_POLICY');

// ------------------------------------------- pantalla: ponerla y quitarla
// Esto es el nucleo del cambio: sin un sitio donde una persona la quite, hacerla
// opcional no sirve de nada.
const miCuenta = trozo(source, 'function MfaMiCuenta()', '\nfunction MfaPoliticaCargos()', 'M03_MI_CUENTA');
assert.match(miCuenta, /auth\.mfa\.enroll\(\{ factorType: "totp"/, 'M03_SELF_ENROLL_MISSING');

// El nombre que la persona ve en su aplicacion de autenticacion lo pone el
// emisor. Si no se pasa, Supabase usa la Site URL del proyecto: en QA el
// apunte salia como "localhost:3000", que no le dice nada a nadie y se
// confunde con cualquier otro. Se fija en las tres altas que existen.
for (const [archivo, texto] of [['fuente.js', source], ['edge-auth-patch.js', edgeAuth]]) {
  const altas = texto.match(/mfa\.enroll\(\{[^}]*\}/g) || [];
  assert.ok(altas.length > 0, `M03_NO_HAY_ALTAS_DE_FACTOR_EN_${archivo}`);
  for (const alta of altas) {
    assert.match(alta, /issuer: "L&A Suite"/, `M03_ALTA_SIN_EMISOR_EN_${archivo}: ${alta.slice(0, 90)}`);
  }
}
assert.match(miCuenta, /auth\.mfa\.unenroll\(\{ factorId: f22\.id \}\)/, 'M03_SELF_REMOVAL_MISSING');
assert.match(miCuenta, /rpc\("mfa_politica_leer"\)/, 'M03_SELF_SCREEN_MUST_READ_THE_POLICY');
// Quitarse el segundo factor baja la proteccion de la cuenta: se confirma antes.
assert.match(miCuenta, /confirmarQuitar/, 'M03_SELF_REMOVAL_MUST_CONFIRM');
assert.ok(
  miCuenta.indexOf('setConfirmarQuitar(true)') < miCuenta.indexOf('onClick: quitar'),
  'M03_SELF_REMOVAL_CONFIRMATION_MUST_COME_FIRST'
);
// Y no se puede quitar lo que el Propietario exige.
assert.match(miCuenta, /tengoFactor && !exigidaParaMi && !confirmarQuitar \? h\(Btn, \{ variant: "danger"/, 'M03_SELF_REMOVAL_MUST_RESPECT_THE_POLICY');
assert.match(miCuenta, /setExigidaParaMi\(true\);/, 'M03_SELF_SCREEN_MUST_FAIL_CLOSED');

const politicaCargos = trozo(source, 'function MfaPoliticaCargos()', '\nfunction BotonSeguridadCuenta()', 'M03_POLITICA_CARGOS');
assert.match(politicaCargos, /rpc\("mfa_politica_guardar", \{ p_rol: rol, p_exigida: exigida \}\)/, 'M03_OWNER_SCREEN_MUST_WRITE_THE_POLICY');
assert.match(politicaCargos, /!soyPropietario/, 'M03_OWNER_SCREEN_MUST_CHECK_OWNER');

// La parte personal la tiene que alcanzar CUALQUIER rol. La pantalla de
// Configuracion es solo del Propietario, asi que el boton vive en la barra
// superior, junto al de tema, y no mira el rol.
const boton = trozo(source, 'function BotonSeguridadCuenta()', '\nfunction ConfigMfa(', 'M03_BOTON');
assert.doesNotMatch(boton, /esPropietario/, 'M03_SELF_SCREEN_MUST_NOT_BE_OWNER_ONLY');
assert.match(boton, /h\(MfaMiCuenta, null\)/, 'M03_BOTON_MUST_OPEN_THE_SELF_SCREEN');
assert.equal(
  (source.match(/createElement\(BotonSeguridadCuenta, null\)/g) || []).length,
  2,
  'M03_BOTON_MUST_BE_IN_BOTH_CHROMES'
);
assert.match(source, /h\(BotonSeguridadCuenta, null\),/, 'M03_BOTON_MISSING_IN_CABECERA_CLARO');
const configMfa = trozo(source, 'function ConfigMfa({ esPropietario = false })', '\nfunction ', 'M03_CONFIG_MFA');
assert.match(configMfa, /esPropietario \? h\(MfaPoliticaCargos, null\) : null/, 'M03_OWNER_SCREEN_MUST_BE_OWNER_ONLY');

// --------------------------------------------- flujo de desafio de M-03 intacto
assert.match(source, /auth\.mfa\.listFactors\(\)/, 'M03_LIST_FACTORS_MISSING');
assert.match(source, /auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/, 'M03_AAL_CHECK_MISSING');
assert.match(source, /auth\.mfa\.challenge\(\{ factorId \}\)/, 'M03_CHALLENGE_FLOW_MISSING');
assert.match(source, /auth\.mfa\.verify\(\{ factorId, challengeId: challenge\.data\.id, code: codigoLimpio \}\)/, 'M03_VERIFY_FLOW_MISSING');
assert.match(app, /setFase\("mfa"\)/, 'M03_MFA_GATE_NOT_REACHED');
assert.match(app, /MfaGate/, 'M03_MFA_GATE_COMPONENT_NOT_RENDERED');
assert.match(app, /setFase\("dentro"\)/, 'M03_AUTHENTICATED_STATE_MISSING');
assert.doesNotMatch(app, /if \(data\.session\) \{\s*await window\.subirPendientes\(\);\s*setFase\("dentro"\);/, 'M03_SESSION_BYPASSES_MFA_GATE');
const terminarMfa = trozo(app, 'async function terminarMfa()', 'async function cerrarSesionDesdeMfa()', 'M03_POST_VERIFY');
assert.match(terminarMfa, /auth\.getSession\(\)/, 'M03_POST_VERIFY_SESSION_NOT_REFRESHED');
assert.match(terminarMfa, /abrirSesionConMfa\(cliente, data\.session, true\)/, 'M03_POST_VERIFY_AAL_NOT_REEVALUATED');
assert.doesNotMatch(terminarMfa, /await window\.subirPendientes\(\)/, 'M03_POST_VERIFY_UPLOADS_BEFORE_AAL_CHECK');
assert.match(source, /inputMode: "numeric"/, 'M03_TOTP_INPUT_NOT_NUMERIC');
assert.match(source, /autoComplete: "one-time-code"/, 'M03_TOTP_INPUT_NOT_AUTOCOMPLETE');
assert.match(source, /Cerrar sesión/, 'M03_MFA_LOCKOUT_ACTION_MISSING');
assert.match(mfaGate, /const factores = await cliente\.auth\.mfa\.listFactors\(\);[\s\S]*?const factorPendiente =/, 'M03_ENROLL_MUST_LIST_EXISTING_FACTORS');
assert.match(mfaGate, /factores\.data\?\.all \|\| \[\]/, 'M03_ENROLL_MUST_INSPECT_ALL_FACTORS');
assert.match(mfaGate, /factor\.factor_type === "totp" && factor\.status === "unverified" && factor\.friendly_name === "L&A Suite"/, 'M03_ENROLL_MUST_RECOGNIZE_PENDING_FACTOR');
// 17/11/2026. Hasta hoy esto exigía REUTILIZAR el factor pendiente y pedir «el código de la
// aplicación autenticadora que vinculaste anteriormente». Medido en QA: quien cierra la pestaña
// sin llegar a escanear el QR no vinculó nada, así que se quedaba sin QR, sin secreto y sin
// salida. Un factor sin verificar no da acceso a nada, de modo que ahora se retira y se empieza
// de cero. Lo que el contrato sigue defendiendo es lo mismo: que el factor pendiente se
// RECONOZCA y no se llame a enroll() a ciegas, que es lo que Supabase rechaza.
assert.match(mfaGate, /const retirado = await cliente\.auth\.mfa\.unenroll\(\{ factorId: factorPendiente\.id \}\);/, 'M03_ENROLL_MUST_RETIRE_PENDING_FACTOR');
assert.match(mfaGate, /if \(retirado\?\.error\) pendienteIrretirable = factorPendiente;/, 'M03_ENROLL_RETIRE_FAILURE_MUST_FALL_BACK');
assert.match(mfaGate, /setFactorId\(pendienteIrretirable\.id\)/, 'M03_ENROLL_FALLBACK_MUST_REUSE_PENDING_FACTOR');
assert.doesNotMatch(mfaGate, /Usa el c\\xF3digo de la aplicaci\\xF3n autenticadora que vinculaste anteriormente/, 'M03_ENROLL_MUST_NOT_CLAIM_A_LINK_THAT_MAY_NOT_EXIST');

// --------------------------------------- 5. arranque historico (bootstrap)
assert.match(bootstrap, /function mfaAutorizadaParaAplicacion\(supabase, sesion\)/, 'M03_BOOTSTRAP_MFA_GATE_MISSING');
const puertaBootstrap = trozo(bootstrap, 'async function mfaAutorizadaParaAplicacion(supabase, sesion)', 'async function mfaExigidaPorElServidorBootstrap', 'M03_BOOTSTRAP_GATE');
assert.match(puertaBootstrap, /if \(hayFactorVerificado\) return aal && aal\.data && aal\.data\.currentLevel === "aal2";/, 'M03_BOOTSTRAP_VERIFIED_FACTOR_MUST_STILL_CHALLENGE');
assert.match(puertaBootstrap, /return !\(await mfaExigidaPorElServidorBootstrap\(sesion\)\);/, 'M03_BOOTSTRAP_MUST_ASK_THE_POLICY');
const politicaBootstrap = trozo(bootstrap, 'async function mfaExigidaPorElServidorBootstrap(sesion)', '\n  async function rpcP4', 'M03_BOOTSTRAP_POLICY');
assert.match(politicaBootstrap, /rpcP4\("mfa_politica_leer", sesion, \{\}\)/, 'M03_BOOTSTRAP_POLICY_RPC_MISSING');
assert.match(politicaBootstrap, /could not find the function\|PGRST202\|HTTP 404/, 'M03_BOOTSTRAP_MUST_DETECT_UNMIGRATED_SERVER');
assert.match(politicaBootstrap, /\) return true;/, 'M03_BOOTSTRAP_MUST_FAIL_CLOSED');
const bootstrapValidationStart = bootstrap.indexOf('async function validarSesion(supabase, sesion)');
const bootstrapPreparation = bootstrap.indexOf('window.__prepararSesionPostReset', bootstrapValidationStart);
const bootstrapMfaGate = bootstrap.indexOf('mfaAutorizadaParaAplicacion(supabase, sesion)', bootstrapValidationStart);
assert.ok(bootstrapValidationStart >= 0, 'M03_BOOTSTRAP_SESSION_VALIDATOR_NOT_FOUND');
assert.ok(bootstrapMfaGate > bootstrapValidationStart && bootstrapMfaGate < bootstrapPreparation, 'M03_BOOTSTRAP_CALLS_CONTEXT_BEFORE_MFA');
assert.match(bootstrap.slice(bootstrapMfaGate, bootstrapPreparation), /liberarVistaSinSesion\(\)/, 'M03_BOOTSTRAP_AAL1_MUST_LEAVE_MFA_VIEW_AVAILABLE');

// ------------------------------- 3. puerta de aplicacion de edge-auth-patch
assert.match(edgeAuth, /function mfaAutorizadaParaAplicacion\(supabase, sesion\)/, 'M03_EDGE_AUTH_MFA_GATE_MISSING');
const puertaEdge = trozo(edgeAuth, 'async function mfaAutorizadaParaAplicacion(supabase, sesion)', 'async function mfaExigidaPorElServidorEdge', 'M03_EDGE_GATE');
assert.match(puertaEdge, /if \(hayFactorVerificado\) return aal && aal\.data && aal\.data\.currentLevel === "aal2";/, 'M03_EDGE_AUTH_VERIFIED_FACTOR_MUST_STILL_CHALLENGE');
assert.match(puertaEdge, /return !\(await mfaExigidaPorElServidorEdge\(supabase, sesion\)\);/, 'M03_EDGE_AUTH_MUST_ASK_THE_POLICY');
const politicaEdge = trozo(edgeAuth, 'async function mfaExigidaPorElServidorEdge(supabase, sesion)', '\n  async function prepararSesionPostReset', 'M03_EDGE_POLICY');
assert.match(politicaEdge, /supabase\.rpc\("mfa_politica_leer"\)/, 'M03_EDGE_AUTH_POLICY_RPC_MISSING');
assert.match(politicaEdge, /could not find the function\|PGRST202\|HTTP 404/, 'M03_EDGE_AUTH_MUST_DETECT_UNMIGRATED_SERVER');
assert.match(politicaEdge, /\) return true;/, 'M03_EDGE_AUTH_MUST_FAIL_CLOSED');
const edgeValidationStart = edgeAuth.indexOf('async function validar(sesion)');
const edgePreparation = edgeAuth.indexOf('prepararSesionPostReset(supabase, sesion)', edgeValidationStart);
const edgeMfaGate = edgeAuth.indexOf('mfaAutorizadaParaAplicacion(supabase, sesion)', edgeValidationStart);
assert.ok(edgeValidationStart >= 0, 'M03_EDGE_AUTH_VALIDATOR_NOT_FOUND');
assert.ok(edgeMfaGate > edgeValidationStart && edgeMfaGate < edgePreparation, 'M03_EDGE_AUTH_CALLS_CONTEXT_BEFORE_MFA');
assert.match(edgeAuth.slice(edgeMfaGate, edgePreparation), /__instalacionSyncPermitida = false/, 'M03_EDGE_AUTH_AAL1_MUST_KEEP_SYNC_CLOSED');

// --------------------------------- 4. overlay MfaGate de edge-auth-patch
const overlayEdge = trozo(edgeAuth, 'async function mfaExigidaPorElServidor(cliente, rol)', '\n  var overlay = null;', 'M03_EDGE_OVERLAY_POLICY');
assert.match(overlayEdge, /cliente\.rpc\("mfa_politica_leer"\)/, 'M03_EDGE_OVERLAY_POLICY_RPC_MISSING');
// Aqui el respaldo es la lista de M-03 en vez de un `true` a secas, porque el
// overlay conoce el cargo y puede reproducir exactamente la conducta anterior.
assert.match(overlayEdge, /if \(esFuncionInexistente\(e\)\) return !!ROLES_MFA_OBLIGATORIA\[rol\];/, 'M03_EDGE_OVERLAY_MUST_FAIL_CLOSED_AS_M03');
const decisionOverlay = trozo(edgeAuth, 'var exigida = await mfaExigidaPorElServidor(supabase, rol);', 'limpiarOverlay();', 'M03_EDGE_OVERLAY_DECISION');
assert.match(decisionOverlay, /if \(!exigida\)/, 'M03_EDGE_OVERLAY_MUST_STAND_DOWN_WHEN_NOT_REQUIRED');
// Durante el alta el QR vive en el overlay actual. Una comprobación concurrente
// no debe crear un segundo modal por encima y dejar el QR/campo inaccesibles.
assert.match(edgeAuth, /var enrolamientoEnCurso = false;/, 'M03_ENROLL_BUSY_STATE_MISSING');
assert.match(edgeAuth, /if \(enrolamientoEnCurso && overlay\) return;/, 'M03_ENROLL_MUST_KEEP_CURRENT_OVERLAY');
assert.match(edgeAuth, /enrolamientoEnCurso = true;/, 'M03_ENROLL_MUST_MARK_BUSY_BEFORE_ENROLL');
assert.match(edgeAuth, /function mfaGateReactActivo\(\)/, 'M03_REACT_MFA_GATE_DETECTION_MISSING');
assert.match(edgeAuth, /if \(mfaGateReactActivo\(\)\) \{[\s\S]*?if \(overlay\) limpiarOverlay\(\);[\s\S]*?return;/, 'M03_EDGE_GATE_MUST_NOT_COVER_REACT_MFA');

assert.match(source, /const localPersistidoValido = !!localActivoFinal[\s\S]*?if \(!localPersistidoValido && idsLocalesHuerfanos\.length === 1/, 'M03_OLD_FOREIGN_PRODUCT_MUST_NOT_REPLACE_VALID_LOCAL');

console.log('M03_CONTRACT_PASS=1');
