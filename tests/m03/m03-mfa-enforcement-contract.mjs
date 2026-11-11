import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('fuente.js', 'utf8');
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
assert.match(source, /inputMode: "numeric"/, 'M03_TOTP_INPUT_NOT_NUMERIC');
assert.match(source, /autoComplete: "one-time-code"/, 'M03_TOTP_INPUT_NOT_AUTOCOMPLETE');
assert.match(source, /Cerrar sesión/, 'M03_MFA_LOCKOUT_ACTION_MISSING');

console.log('M03_CONTRACT_PASS=1');
