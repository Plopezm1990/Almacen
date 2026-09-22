import fs from 'node:fs';
import assert from 'node:assert/strict';

const createAccount = fs.readFileSync('supabase/functions/crear-cuenta-empleado/index.ts', 'utf8');
const notify = fs.readFileSync('supabase/functions/enviar-notificacion/index.ts', 'utf8');
const prefiltro = fs.readFileSync('supabase/functions/prefiltro-candidato/index.ts', 'utf8');
const shared = fs.readFileSync('supabase/functions/_shared/tenant-scope.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('supabase/functions/edge-security-manifest.json', 'utf8'));

assert.equal(manifest.base_release, 'e8de01fbdad63bd7fbe57982e3ae978e06d1ca52');
assert.deepEqual(
  manifest.functions.map((x) => [x.slug, x.verify_jwt]),
  [
    ['crear-cuenta-empleado', true],
    ['enviar-notificacion', false],
    ['prefiltro-candidato', false],
  ],
);

for (const [name, source] of Object.entries({ createAccount, notify, prefiltro })) {
  assert.doesNotMatch(source, /https:\/\/[a-z]{20}\.supabase\.co/i, name + ' must not hardcode a Supabase project URL');
  assert.doesNotMatch(source, /sb_secret_|eyJ[a-zA-Z0-9_-]{20,}/, name + ' must not contain credential literals');
}

assert.match(createAccount, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(createAccount, /caller\.auth\.getUser\(\)/);
assert.match(createAccount, /\.from\("empleados"\)[\s\S]{0,300}\.select\("id,empresa_id,local_id,estado,nombre"\)/);
assert.match(createAccount, /\.from\("membresias_usuario"\)/);
assert.match(createAccount, /roles:\s*\["Propietario"\]/);
assert.match(createAccount, /empresaId:\s*empleado\.empresa_id/);
assert.match(createAccount, /localId:\s*empleado\.local_id/);
assert.match(createAccount, /pm11_finalizar_creacion_cuenta_empleado/);
assert.doesNotMatch(createAccount, /const\s*\{[^}]*empresaId[^}]*\}\s*=\s*await req\.json/s);

assert.match(notify, /x-notification-secret/);
assert.match(notify, /admin\.auth\.getUser\(match\[1\]\)/);
assert.match(notify, /\.from\("locales"\)[\s\S]{0,200}\.select\("id,empresa_id,activo"\)/);
assert.match(notify, /\.from\("membresias_usuario"\)/);
assert.match(notify, /filterRecipientSubscriptions/);
assert.match(notify, /const identified = \(subscriptions \|\| \[\]\)\.filter\(\(s\) => !!s\.user_id\)/);
assert.match(notify, /No se puede determinar una empresa única/);
assert.match(notify, /El local no pertenece a la empresa indicada/);
assert.doesNotMatch(notify, /rolDestino\s*=\s*"Propietario"/);

assert.match(prefiltro, /\.select\("estado,candidato_nombre,expira_en,empresa_id,local_id"\)/);
assert.match(prefiltro, /\$\{supabaseUrl\}\/functions\/v1\/enviar-notificacion/);
assert.match(prefiltro, /empresaId:\s*fila\.empresa_id/);
assert.match(prefiltro, /localId:\s*fila\.local_id/);
assert.match(prefiltro, /\.eq\("estado",\s*"pendiente"\)[\s\S]{0,120}\.select\("token"\)/);
assert.doesNotMatch(prefiltro, /flqercbgpgmmfaakrwkc/);

assert.match(shared, /membership\.empresa_id !== empresaId/);
assert.match(shared, /membership\.todos_locales === true/);
assert.match(shared, /if \(!s \|\| !s\.user_id \|\| !activeProfiles\.has\(s\.user_id\)\) return false/);

console.log('P2_EDGE_SECURITY_CONTRACT_OK=1');
