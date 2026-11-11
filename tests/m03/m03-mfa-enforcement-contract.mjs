import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('fuente.js', 'utf8');
const bootstrap = readFileSync('owner-bootstrap-post-reset.js', 'utf8');
const appStart = source.indexOf('function AppConSesion()');
const appEnd = source.indexOf('var rutaHash', appStart);
assert.ok(appStart >= 0 && appEnd > appStart, 'M03_APP_SESSION_COMPONENT_NOT_FOUND');
const app = source.slice(appStart, appEnd);

assert.match(source, /const MFA_REQUIRED_FOR_ALL_LA_SUITE = true;/, 'M03_MFA_POLICY_NOT_MANDATORY');
assert.match(source, /auth\.mfa\.enroll\(\{ factorType: "totp"/, 'M03_ENROLL_FLOW_MISSING');
assert.match(source, /auth\.mfa\.listFactors\(\)/, 'M03_LIST_FACTORS_MISSING');
assert.match(source, /auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/, 'M03_AAL_CHECK_MISSING');
assert.match(source, /auth\.mfa\.challenge\(\{ factorId \}\)/, 'M03_CHALLENGE_FLOW_MISSING');
assert.match(source, /auth\.mfa\.verify\(\{ factorId, challengeId: challenge\.data\.id, code: codigoLimpio \}\)/, 'M03_VERIFY_FLOW_MISSING');
assert.match(app, /setFase\("mfa"\)/, 'M03_MFA_GATE_NOT_REACHED');
assert.match(app, /MfaGate/, 'M03_MFA_GATE_COMPONENT_NOT_RENDERED');
assert.match(app, /setFase\("dentro"\)/, 'M03_AUTHENTICATED_STATE_MISSING');
assert.doesNotMatch(app, /if \(data\.session\) \{\s*await window\.subirPendientes\(\);\s*setFase\("dentro"\);/, 'M03_SESSION_BYPASSES_MFA_GATE');
const terminarMfaStart = app.indexOf('async function terminarMfa()');
const terminarMfaEnd = app.indexOf('async function cerrarSesionDesdeMfa()', terminarMfaStart);
assert.ok(terminarMfaStart >= 0 && terminarMfaEnd > terminarMfaStart, 'M03_POST_VERIFY_HANDLER_NOT_FOUND');
const terminarMfa = app.slice(terminarMfaStart, terminarMfaEnd);
assert.match(terminarMfa, /auth\.getSession\(\)/, 'M03_POST_VERIFY_SESSION_NOT_REFRESHED');
assert.match(terminarMfa, /abrirSesionConMfa\(cliente, data\.session, true\)/, 'M03_POST_VERIFY_AAL_NOT_REEVALUATED');
assert.doesNotMatch(terminarMfa, /await window\.subirPendientes\(\)/, 'M03_POST_VERIFY_UPLOADS_BEFORE_AAL_CHECK');
assert.match(source, /inputMode: "numeric"/, 'M03_TOTP_INPUT_NOT_NUMERIC');
assert.match(source, /autoComplete: "one-time-code"/, 'M03_TOTP_INPUT_NOT_AUTOCOMPLETE');
assert.match(source, /Cerrar sesión/, 'M03_MFA_LOCKOUT_ACTION_MISSING');

assert.match(bootstrap, /function mfaAutorizadaParaAplicacion\(supabase\)/, 'M03_BOOTSTRAP_MFA_GATE_MISSING');
assert.match(bootstrap, /currentLevel === "aal2"/, 'M03_BOOTSTRAP_AAL2_CHECK_MISSING');
const bootstrapValidationStart = bootstrap.indexOf('async function validarSesion(supabase, sesion)');
const bootstrapPreparation = bootstrap.indexOf('window.__prepararSesionPostReset', bootstrapValidationStart);
const bootstrapMfaGate = bootstrap.indexOf('mfaAutorizadaParaAplicacion(supabase)', bootstrapValidationStart);
assert.ok(bootstrapValidationStart >= 0, 'M03_BOOTSTRAP_SESSION_VALIDATOR_NOT_FOUND');
assert.ok(bootstrapMfaGate > bootstrapValidationStart && bootstrapMfaGate < bootstrapPreparation, 'M03_BOOTSTRAP_CALLS_CONTEXT_BEFORE_MFA');
assert.match(bootstrap.slice(bootstrapMfaGate, bootstrapPreparation), /liberarVistaSinSesion\(\)/, 'M03_BOOTSTRAP_AAL1_MUST_LEAVE_MFA_VIEW_AVAILABLE');

console.log('M03_CONTRACT_PASS=1');
