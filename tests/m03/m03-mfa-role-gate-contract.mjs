import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = readFileSync(resolve(root, 'edge-auth-patch.js'), 'utf8');
const serverMigration = readFileSync(resolve(root, 'supabase/migrations/20261110230000_m03_server_aal2_gate.sql'), 'utf8');

const required = [
  '__laM03MfaGateInstalada',
  'ROLES_MFA_OBLIGATORIA',
  '"Propietario": true',
  '"Encargado": true',
  '"Cajero/a": true',
  'from("perfiles").select("rol,activo")',
  'getAuthenticatorAssuranceLevel()',
  'listFactors()',
  'mfa.enroll({ factorType: "totp"',
  'mfa.challenge({ factorId: factorActual.id })',
  'mfa.verify({',
  'MFA_CHALLENGE_VERIFIED',
  'aria-modal'
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`M03 falta evidencia estática: ${token}`);
}

if (source.includes('localStorage.getItem("rol")')) {
  throw new Error('M03 no debe confiar en un rol guardado en localStorage');
}

const sensitiveRoles = source.match(/var ROLES_MFA_OBLIGATORIA = \{([\s\S]*?)\};/);
if (!sensitiveRoles || sensitiveRoles[1].split('"').filter(Boolean).length < 6) {
  throw new Error('M03 no declara los tres roles sensibles');
}

for (const token of [
  'create or replace function private.la_usuario_activo()',
  "m.rol in ('Propietario', 'Encargado', 'Cajero/a')",
  "auth.jwt()->>'aal'",
  "= 'aal2'",
]) {
  if (!serverMigration.includes(token)) throw new Error(`M03 falta guarda server-side: ${token}`);
}

console.log('M03_MFA_ROLE_GATE_CONTRACT=PASS');
