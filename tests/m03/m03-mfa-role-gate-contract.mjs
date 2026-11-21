// AVISO DE LECTURA: desde el 15/11/2026 la lista de tres cargos que este
// contrato comprueba ya NO es la regla; es el respaldo para cuando el servidor
// todavia no tiene aplicada la migracion de la politica opcional. La regla viva
// la fija tests/m03/m03-mfa-enforcement-contract.mjs y la prueba contra un
// Postgres de verdad tests/rediseno/p04-mfa-politica-pglite-contract.mjs. Lo
// que aqui se sigue exigiendo es el flujo de M-03 -desafio, inscripcion, orden
// de carga- y que el respaldo exista con esos tres cargos.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = readFileSync(resolve(root, 'edge-auth-patch.js'), 'utf8');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
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
  'PASSWORD_RECOVERY',
  'aria-modal'
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`M03 falta evidencia estática: ${token}`);
}

const patchScript = index.indexOf('src="./edge-auth-patch.js');
const bundleScript = index.indexOf('src="./fuente.js');
if (patchScript < 0 || bundleScript < 0 || patchScript > bundleScript) {
  throw new Error('M03: edge-auth-patch.js debe cargarse antes de fuente.js');
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

// La decision viva la toma el servidor. Si el overlay volviese a decidir solo
// con la lista local, la pantalla del Propietario dejaria de surtir efecto sin
// que nada mas se rompiera, asi que se fija aqui tambien.
if (!source.includes('mfaExigidaPorElServidor(supabase, rol)')) {
  throw new Error('M03: el overlay debe preguntar la exigencia al servidor, no decidirla con la lista local');
}
if (!source.includes('if (esFuncionInexistente(e)) return !!ROLES_MFA_OBLIGATORIA[rol];')) {
  throw new Error('M03: la lista local debe usarse solo como respaldo cuando la RPC no existe');
}

console.log('M03_MFA_ROLE_GATE_CONTRACT=PASS');
