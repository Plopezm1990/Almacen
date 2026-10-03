import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático del historial de descuentos del TPV (A09), arreglo del 3/10/2026:
//  - la función del servidor `abc_listar_eventos_descuento_cuenta` (migración 20261003120000): solo lectura, SECURITY DEFINER, permisos solo de
//    `authenticated`, exige poder operar cuentas en el local, filtra por empresa, local, cuenta y tipo de evento, últimos 100, seis columnas;
//  - el historial la llama con los parámetros exactos y NO lee la tabla `abc_eventos` desde el navegador (no tiene permiso);
//  - los cargadores del panel de descuentos devuelven el error como TEXTO (con un objeto, la pantalla se rompe al dibujarlo);
//  - los dos errores nuevos están traducidos al español;
//  - el bloque es idéntico en `fuente.js` y en `source-recovery/fuente-recuperado.js`.
// CFG_A09EV_FUENTE_RECUPERADA / CFG_A09EV_FUENTE_BUNDLE / CFG_A09EV_MIGRACION permiten probar variantes rotas en las comprobaciones de mutantes.
// La conducta del cliente la prueba tests/cfg/a09-eventos-ui-runtime.mjs y la del servidor tests/cfg/a09-eventos-contract.sql.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");
const recuperado = lf(process.env.CFG_A09EV_FUENTE_RECUPERADA ? await readFile(process.env.CFG_A09EV_FUENTE_RECUPERADA, "utf8") : await read("source-recovery/fuente-recuperado.js"));
const bundle = lf(process.env.CFG_A09EV_FUENTE_BUNDLE ? await readFile(process.env.CFG_A09EV_FUENTE_BUNDLE, "utf8") : await read("fuente.js"));
const mig = lf(process.env.CFG_A09EV_MIGRACION ? await readFile(process.env.CFG_A09EV_MIGRACION, "utf8") : await read("supabase/migrations/20261003120000_abc_a09_eventos_descuento_cuenta.sql"));

function entre(texto, ini, fin, nombre) {
  assert.equal(texto.split(ini).length, 2, `${nombre}: una única aparición de «${ini.slice(0, 60)}»`);
  const i = texto.indexOf(ini);
  const j = texto.indexOf(fin, i + ini.length);
  assert.ok(j > i, `${nombre}: no se encuentra el final «${fin.slice(0, 50)}»`);
  return texto.slice(i, j);
}

// 1. El bloque de los cargadores del panel es idéntico en los dos archivos.
const bloque = (t, n) => entre(t, "  async function listarDescuentosAplicadosA09() {", "  function agruparDescuentosAplicadosA09(rows) {", n);
const R = bloque(recuperado, "fuente recuperado");
const B = bloque(bundle, "bundle");
assert.equal(R, B, "los cargadores del panel de descuentos son idénticos en el bundle y en el fuente recuperado");

// 2. El historial pide los eventos a la función del servidor, con los parámetros de su firma, y no lee abc_eventos.
const firma = mig.match(/create function public\.abc_listar_eventos_descuento_cuenta\(([\s\S]*?)\)\s*returns jsonb/);
assert.ok(firma, "la migración crea la función");
const params = firma[1].split(",").map((p) => p.trim().split(/\s+/)[0]);
assert.deepEqual(params, ["p_empresa_id", "p_local_id", "p_cuenta_id"], "firma de la función");
const auditoria = entre(R, "  async function listarAuditoriaDescuentosA09() {", "  async function listarEfectosCajaA09() {", "cargador de la auditoría");
const llamada = auditoria.match(/supabase\.rpc\("abc_listar_eventos_descuento_cuenta", \{([\s\S]*?)\n\s+\}\)/);
assert.ok(llamada, "el historial llama a abc_listar_eventos_descuento_cuenta");
assert.deepEqual([...llamada[1].matchAll(/\b(p_[a-z_0-9]+):/g)].map((k) => k[1]), params, "parámetros exactos y en su orden");
assert.match(llamada[1], /p_empresa_id: empresaId,\s+p_local_id: localId,\s+p_cuenta_id: contexto\.cuentaId/, "con la empresa, el local y la cuenta del contexto");
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  assert.equal(t.split('.from("abc_eventos")').length - 1, 0, nombre + ": ninguna lectura directa de abc_eventos desde el navegador");
}
assert.match(auditoria, /eventos: Array\.isArray\(eventos\.data\) \? eventos\.data : \[\]/, "los eventos son lo que devuelve el servidor (lista vacía si no llega una lista)");
assert.match(auditoria, /for \(const response of \[autorizaciones, intentos, eventos\]\) \{\s+if \(response\.error\) throw response\.error;/, "un error del servidor corta el historial (no se muestra a medias)");
assert.match(auditoria, /\.from\("abc_descuento_autorizaciones"\)/, "las solicitudes se siguen leyendo de su tabla (con permiso)");
assert.match(auditoria, /\.from\("abc_descuento_aprobacion_intentos"\)/, "los intentos de aprobación se siguen leyendo de su tabla (con permiso)");

// 3. Los cargadores del panel de descuentos devuelven el error como texto.
const cargadores = [
  ["listarDescuentosAplicadosA09", "  async function listarAuditoriaDescuentosA09() {", R],
  ["listarAuditoriaDescuentosA09", "  async function listarEfectosCajaA09() {", R],
  ["listarEfectosCajaA09", "  async function listarEfectosStockA09() {", R],
  ["listarEfectosStockA09", "  async function listarFiscalizacionA09() {", R]
];
for (const [nombre, siguiente, t] of cargadores) {
  const cuerpo = entre(t, `  async function ${nombre}() {`, siguiente, nombre);
  assert.ok(cuerpo.includes("return { ok: false, error: respuestaErrorA06(error).error };"), nombre + ": devuelve el error como texto");
  assert.ok(!cuerpo.includes("error: respuestaErrorA06(error) }"), nombre + ": no devuelve el objeto de error");
}
const fiscal = entre(recuperado, "  async function listarFiscalizacionA09() {", "  function agruparDescuentosAplicadosA09(rows) {", "listarFiscalizacionA09");
assert.ok(fiscal.includes("return { ok: false, error: respuestaErrorA06(error).error };") && !fiscal.includes("error: respuestaErrorA06(error) }"), "listarFiscalizacionA09: devuelve el error como texto");
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  const cuerpo = entre(t, "  async function listarAutorizacionesDescuentoA09() {", "  async function ", nombre + " listarAutorizacionesDescuentoA09");
  assert.ok(cuerpo.includes("return { ok: false, error: respuestaErrorA06(error).error };") && !cuerpo.includes("error: respuestaErrorA06(error) }"), nombre + ": listarAutorizacionesDescuentoA09 devuelve el error como texto");
}
// la pantalla dibuja esos errores tal cual (por eso tienen que ser texto)
assert.match(recuperado, /"⚠ ", errorAuditoriaDescuentosA09\) : null/, "la pantalla dibuja el error del historial directamente");
assert.match(recuperado, /"⚠ ", errorDescuentoA09\) : null/, "la pantalla dibuja el error del descuento directamente");

// 4. Errores nuevos traducidos al español (antes del genérico «no autorizado»).
for (const [nombre, t] of [["fuente recuperado", recuperado], ["bundle", bundle]]) {
  const a = 'if (msg.includes("descuento_eventos_no_autorizado")) return "Tu perfil no tiene permiso para ver el historial de descuentos de esta cuenta.";';
  const b = 'if (msg.includes("descuento_eventos_parametros_invalidos")) return "No se pudo identificar la cuenta para mostrar su historial de descuentos.";';
  assert.equal(t.split(a).length - 1, 1, nombre + ": traducción del permiso");
  assert.equal(t.split(b).length - 1, 1, nombre + ": traducción de la cuenta no identificada");
  assert.ok(t.indexOf(a) < t.indexOf('if (msg.includes("contexto_no_autorizado") || msg.includes("no_autorizad"))'), nombre + ": la traducción va antes del mensaje genérico");
}

// 5. La función del servidor.
assert.match(mig, /returns jsonb\nlanguage plpgsql\nstable\nsecurity definer\nset search_path=''\nas \$\$/, "solo lectura (STABLE), SECURITY DEFINER y search_path vacío");
assert.match(mig, /if auth\.uid\(\) is null\s+or not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR'\) then\s+raise exception 'descuento_eventos_no_autorizado';/, "sin sesión o sin poder operar cuentas en el local: no autorizado");
assert.match(mig, /if p_cuenta_id is null then\s+raise exception 'descuento_eventos_parametros_invalidos';/, "sin cuenta: parámetros inválidos");
assert.match(mig, /where x\.empresa_id=p_empresa_id\s+and x\.local_id=p_local_id\s+and x\.aggregate_type='CUENTA'\s+and x\.aggregate_id=p_cuenta_id::text\s+and x\.event_type='CUENTA_DESCUENTO_APLICADO'\s+order by x\.occurred_at desc,x\.id desc\s+limit 100/, "solo los descuentos de esa cuenta, de esa empresa y ese local, los 100 más recientes");
assert.match(mig, /'operation_id',e\.operation_id,\s+'event_type',e\.event_type,\s+'payload',e\.payload,\s+'actor_user_id',e\.actor_user_id,\s+'occurred_at',e\.occurred_at,\s+'operating_day',e\.operating_day\s+\) order by e\.occurred_at desc,e\.id desc\),'\[\]'::jsonb\)/, "las seis columnas de siempre, del más reciente al más antiguo, y lista vacía si no hay");
assert.match(mig, /revoke all on function public\.abc_listar_eventos_descuento_cuenta\(text,text,uuid\)\s+from public,anon,authenticated,service_role;\s+grant execute on function public\.abc_listar_eventos_descuento_cuenta\(text,text,uuid\)\s+to authenticated;/, "permisos: se quitan a todos y solo se da a authenticated");
assert.match(mig, /if to_regprocedure\('public\.abc_listar_eventos_descuento_cuenta\(text,text,uuid\)'\) is not null then\s+raise exception 'ABC_A09_EVENTOS_PREFLIGHT_FALLO: RPC ya existe';/, "no pisa una función que ya exista");
assert.match(mig, /comment on function public\.abc_listar_eventos_descuento_cuenta\(text,text,uuid\) is/, "documentada");
// migración aditiva: no toca nada más
assert.doesNotMatch(mig.replace(/--[^\n]*/g, ""), /create or replace|alter table|drop |grant select|update public\.|insert into|delete from/i, "migración aditiva: una función nueva y nada más");
// los códigos que lanza la función son los que traduce la pantalla
for (const c of ["descuento_eventos_no_autorizado", "descuento_eventos_parametros_invalidos"]) assert.ok(mig.includes(`raise exception '${c}'`), "la migración lanza " + c);

// 6. El contrato A09 anterior ya no exige la lectura directa, y los contratos de ejecución existen y cubren los casos exigidos.
const viejo = await read("tests/f3/a09/discount-command.test.mjs");
assert.ok(viejo.includes("abc_listar_eventos_descuento_cuenta") && !/from\\\(\\"abc_eventos\\"\\\)\[\\s\\S\]\*\?CUENTA_DESCUENTO_APLICADO/.test(viejo), "el contrato A09.2.5 exige la función y no la lectura directa");
const vivo = await read("tests/cfg/a09-eventos-ui-runtime.mjs");
for (const marca of ["A1 el historial carga", "A5 los eventos se piden a la función del servidor", "A6 el navegador no consulta ninguna tabla sin permiso", "C1 sin descuentos aplicados", "C2 si el servidor no manda lista", "D1 sin permiso para ver el historial",
  "D2 cuenta no identificada", "D3 un error cualquiera del servidor", "D5 el error siempre es un TEXTO", "F1 ", "E1 sin cuenta guardada", "E2 sin conexión"])
  assert.ok(vivo.includes(marca), "falta el caso de ejecución: " + marca);
const sql = await read("tests/cfg/a09-eventos-contract.sql");
for (const marca of ["A1 es SECURITY DEFINER", "A5 no hay concesión a PUBLIC", "A6 el navegador sigue sin poder leer abc_eventos", "L3 del más reciente al más antiguo", "L4 cada elemento trae exactamente las seis columnas", "L11 en L2 con el mismo id de cuenta",
  "L17 salen como mucho 100", "R2 el Propietario de otra empresa", "R3 el Encargado con la membresía de L2 desactivada", "R5b y no ve nada de la empresa 1", "R8 sin cuenta", "R9 el rol anon", "R10 el rol service_role"])
  assert.ok(sql.includes(marca), "falta el caso del contrato vivo: " + marca);

console.log("a09-eventos-static-contract: OK");
