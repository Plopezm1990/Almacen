// PLATAFORMA F1b — contrato de la función de servidor «plataforma-crear-propietario».
// Parte pura (validación de la petición) probada en Node; parte de servidor comprobada por orden
// y por presencia de las comprobaciones de seguridad (no se ejecuta Deno ni Supabase aquí).
import fs from 'node:fs';
import assert from 'node:assert/strict';

const COMPARTIDO = process.env.PLATAFORMA_P02_COMPARTIDO || 'supabase/functions/_shared/plataforma-propietario.js';
const FUNCION = process.env.PLATAFORMA_P02_FUNCION || 'supabase/functions/plataforma-crear-propietario/index.ts';
const fuenteCompartida = fs.readFileSync(COMPARTIDO, 'utf8');
const fuenteFuncion = fs.readFileSync(FUNCION, 'utf8');

// --- 1. Validación pura -------------------------------------------------------
const modulo = new Function(
  fuenteCompartida.replace(/\bexport\s+(const|function)\b/g, '$1') +
  '\nreturn { validarNuevoPropietario, motivoContrasenaDebil, limpiar, EMPRESA_ID_RE };'
)();
const { validarNuevoPropietario: validar, motivoContrasenaDebil: debil } = modulo;

const base = { empresaId: 'empresa-0123456789abcdef', nombre: 'Ana Dueña', email: 'Ana.Duena@Cliente.es', password: 'Clave2026segura' };
const ok = validar(base);
assert.equal(ok.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(ok.datos)), { empresaId: 'empresa-0123456789abcdef', nombre: 'Ana Dueña', email: 'ana.duena@cliente.es', password: 'Clave2026segura' }, 'el correo se normaliza y los datos se recortan');
assert.equal(validar({ ...base, nombre: '  Ana Dueña  ', empresaId: ' empresa-0123456789abcdef ' }).ok, true, 'espacios sobrantes se recortan');

for (const [campo, malo, esperado] of [
  ['empresaId', '', 'Faltan datos'],
  ['empresaId', 'empresa con espacios', 'empresa indicada'],
  ['empresaId', '../etc', 'empresa indicada'],
  ['empresaId', "x'; drop table empresas;--", 'empresa indicada'],
  ['nombre', '', 'Faltan datos'],
  ['nombre', 'A', 'nombre'],
  ['email', '', 'Faltan datos'],
  ['email', 'sin-arroba', 'correo'],
  ['email', 'a@b', 'correo'],
  ['email', 'con espacio@x.es', 'correo'],
  ['password', '', 'Faltan datos'],
]) {
  const r = validar({ ...base, [campo]: malo });
  assert.equal(r.ok, false, `${campo}=${JSON.stringify(malo)} debía rechazarse`);
  assert.equal(r.status, 400);
  assert.ok(r.error.toLowerCase().includes(esperado.toLowerCase()), `${campo}: «${r.error}» no menciona «${esperado}»`);
}
assert.equal(validar(null).ok, false);
assert.equal(validar(undefined).ok, false);
assert.equal(validar({ ...base, password: 12345678901234 }).ok, false, 'una contraseña que no es texto se rechaza');
assert.equal(validar({ ...base, empresaId: 'e'.repeat(121) }).ok, false, 'un identificador de empresa demasiado largo se rechaza, no se recorta');
assert.equal(validar({ ...base, empresaId: 'e'.repeat(120) }).ok, true, 'el máximo válido (120) se acepta');

// Contraseña inicial: más exigente que la de un empleado
assert.ok(debil('Corta1', 'a@b.es'), 'menos de 10 caracteres');
assert.ok(debil('soloLetrasSinNumeros', 'a@b.es'), 'sin números');
assert.ok(debil('12345678901234', 'a@b.es'), 'sin letras');
assert.ok(debil('xAna.duena2026', 'ana.duena@cliente.es'), 'contiene la parte local del correo');
assert.equal(debil('Clave2026segura', 'ana.duena@cliente.es'), null);
assert.ok(debil('a'.repeat(201) + '1', 'a@b.es'), 'demasiado larga');

// --- 2. Orden y comprobaciones de la función de servidor -----------------------
const pos = (texto) => {
  const i = fuenteFuncion.indexOf(texto);
  assert.ok(i >= 0, `falta en la función: ${texto}`);
  return i;
};
const orden = [
  'caller.auth.getUser()',
  'caller.rpc("plataforma_estado")',
  'estado?.es_admin !== true',
  'await req.json()',
  'validarNuevoPropietario(body)',
  '.from("empresas")',
  'empresa.activo !== true',
  'admin.auth.admin.createUser(',
  'caller.rpc("plataforma_asignar_propietario"',
  'admin.auth.admin.deleteUser(nuevoUserId)',
];
const posiciones = orden.map(pos);
assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b), 'el orden de las comprobaciones debe ser: sesión → administrador → validación → empresa → crear cuenta → asignar → deshacer');

assert.match(fuenteFuncion, /import \{ validarNuevoPropietario \} from "\.\.\/_shared\/plataforma-propietario\.js";/);
assert.match(fuenteFuncion, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(fuenteFuncion, /return json\(req, \{ ok: false, error: "Solo el administrador de la plataforma puede hacer esto\." \}, 403\);/);
assert.match(fuenteFuncion, /p_user_id: nuevoUserId/);
assert.match(fuenteFuncion, /p_empresa_id: empresaId/);
assert.match(fuenteFuncion, /debe_cambiar_contrasena: true/);
assert.match(fuenteFuncion, /ban_duration: "876000h"/, 'si no se puede borrar la cuenta a medias, se bloquea');
assert.match(fuenteFuncion, /email_confirm: true/);
assert.match(fuenteFuncion, /if \(req\.method !== "POST"\) return json\(req, \{ ok: false, error: "Método no permitido\." \}, 405\);/);
assert.match(fuenteFuncion, /if \(!origenPermitido\(origen\)\) return json\(req, \{ ok: false, error: "Origen no permitido\." \}, 403\);/);
assert.match(fuenteFuncion, /const SITE_HOST = "chic-entremet-9107cf\.netlify\.app";/);

// El alcance nunca lo decide el cliente: la empresa solo se usa tras validar y comprobar en servidor, y la pertenencia la crea la función SQL.
assert.doesNotMatch(fuenteFuncion, /const\s*\{[^}]*empresaId[^}]*\}\s*=\s*await req\.json/s);
assert.doesNotMatch(fuenteFuncion, /\.from\("membresias_usuario"\)\s*\.(insert|upsert|update)/, 'la función no escribe membresías directamente');
assert.doesNotMatch(fuenteFuncion, /\.from\("perfiles"\)\s*\.(insert|upsert)/, 'la función no crea perfiles directamente (lo hace la función SQL)');

// Sin secretos ni URLs del proyecto
for (const [nombre, fuente] of [['función', fuenteFuncion], ['compartido', fuenteCompartida]]) {
  assert.doesNotMatch(fuente, /https:\/\/[a-z]{20}\.supabase\.co/i, nombre + ' no debe llevar la URL del proyecto');
  assert.doesNotMatch(fuente, /sb_secret_|eyJ[a-zA-Z0-9_-]{20,}/, nombre + ' no debe llevar credenciales');
  assert.doesNotMatch(fuente, /console\.(log|error|info|debug)\([^)]*password/i, nombre + ' no debe registrar contraseñas');
}

console.log('PLATAFORMA_P02_CREAR_PROPIETARIO=PASS');
