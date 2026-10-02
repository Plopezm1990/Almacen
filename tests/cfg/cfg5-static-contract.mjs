import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Contrato estático de la capa de configuración, PIEZA 5 (permisos configurables, reabrir cierre D14 y retirada de
// roles). Comprueba la forma de la migración, que la plantilla por defecto coincide con las migraciones originales
// (B04 y A10, leídas del repositorio) y que las tres funciones que se reemplazan solo cambian lo previsto. No
// sustituye a cfg5-contract.sql (que se ejecuta contra una base real con ROLLBACK). MIGRACION_CFG5 (variable de
// entorno) permite probar variantes rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");

const b04 = lf(await read("supabase/migrations/20260929213000_abc_f4_b04_unknown_payment.sql"));
const a10 = lf(await read("supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql"));
const c04 = lf(await read("supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql"));
const mig = lf(process.env.MIGRACION_CFG5
  ? await readFile(process.env.MIGRACION_CFG5, "utf8")
  : await read("supabase/migrations/20261002240000_abc_config_pieza5_permisos.sql"));
const live = await read("tests/cfg/cfg5-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);

// Cuerpo (prosrc) de una función: lo que hay entre el primer $$ tras `as` y el siguiente $$.
function cuerpo(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const a = texto.indexOf("as $$", i) + "as $$".length;
  const b = texto.indexOf("$$", a);
  assert.ok(a > 4 && b > a, "no termina la función " + cabecera);
  return texto.slice(a, b);
}
function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("$$;", texto.indexOf("as $$", i));
  assert.ok(j > i, "no termina la función " + cabecera);
  return texto.slice(i, j + 3);
}
const md5 = (t) => createHash("md5").update(t).digest("hex");

// 1. Las huellas de la comprobación previa son las de las definiciones del repositorio (sin retorno de carro).
const cuerpoCap = cuerpo(b04, "create or replace function private.abc_tiene_capacidad(");
const cuerpoA10 = cuerpo(a10, "create function private.abc_a10_tiene_capacidad(");
const cuerpoReabrir = cuerpo(c04, "create function public.abc_reabrir_cierre_provisional(");
for (const [nombre, c] of [["abc_tiene_capacidad", cuerpoCap], ["abc_a10_tiene_capacidad", cuerpoA10], ["abc_reabrir_cierre_provisional", cuerpoReabrir]]) {
  assert.ok(mig.includes(`'${md5(c)}'`), `la comprobación previa de ${nombre} exige la huella ${md5(c)} (la de la migración original)`);
  assert.ok(mig.includes(`raise exception 'ABC_CFG5_PREFLIGHT_FALLO:funcion_distinta:${nombre}:%'`), "mensaje de función distinta para " + nombre);
}
assert.equal((mig.match(/md5\(replace\(p\.prosrc,chr\(13\),''\)\)/g) || []).length, 3, "tres huellas, sin el retorno de carro de Windows");

// 2. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_CFG5_PREFLIGHT_FALLO:%/);
assert.match(mig, /ABC_CFG5_PREFLIGHT_FALLO: objetos de la pieza 5 ya existen/);
for (const dep of ["empresas", "locales", "membresias_usuario", "abc_eventos", "abc_operacion_iniciar", "abc_operacion_completar", "la_tiene_local", "abc_config_puede_configurar", "abc_config_dia_evento",
  "abc_tiene_capacidad", "abc_a10_tiene_capacidad", "abc_reabrir_cierre_provisional", "auth.uid"])
  assert.ok(mig.includes(`'${dep}`), "el preflight comprueba " + dep);
assert.match(mig, /if to_regclass\('public\.abc_capacidades_rol'\) is not null\s+or to_regprocedure\('private\.abc_cap_catalogo\(\)'\) is not null\s+or to_regprocedure\('private\.abc_cap_efectiva\(text,text,text,text,text\)'\) is not null\s+or to_regprocedure\('public\.abc_configurar_capacidad_rol\(text,text,text,text,text,text,boolean,text\)'\) is not null\s+or to_regprocedure\('public\.abc_obtener_capacidades_rol\(text,text\)'\) is not null\s+or to_regprocedure\('public\.abc_listar_roles_retirados\(text,text\)'\) is not null\s+or exists\(select 1 from pg_trigger t where t\.tgrelid='public\.membresias_usuario'::regclass and t\.tgname='abc_f6_cfg5_guard_rol_retirado'\) then\s+raise exception 'ABC_CFG5_PREFLIGHT_FALLO: objetos de la pieza 5 ya existen';/,
  "una segunda aplicación se rechaza si existe cualquiera de los objetos principales");
assert.match(mig, /if cardinality\(v_missing\)>0 then\s+raise exception 'ABC_CFG5_PREFLIGHT_FALLO:%',array_to_string\(v_missing,','\);/);
assert.match(sql, /set local lock_timeout = '10s';/, "falla rápido si no consigue los bloqueos de tabla");

// 3. La plantilla por defecto es la de las migraciones originales (B04 para las generales, A10 para cocina).
function matrizOriginal(texto) {
  const m = new Map();
  for (const x of texto.matchAll(/when '(ABC_[A-Z_]+)' then v_rol in \(([^)]*)\)/g))
    m.set(x[1], new Set([...x[2].matchAll(/'([^']+)'/g)].map((y) => y[1])));
  return m;
}
const orig = new Map();
for (const [cap, roles] of matrizOriginal(cuerpoCap)) orig.set(cap, { familia: "GENERAL", roles });
for (const [cap, roles] of matrizOriginal(cuerpoA10)) orig.set(cap, { familia: "COMANDA", roles });
assert.equal(orig.size, 30, "las funciones originales conocen 30 capacidades (25 generales y 5 de cocina)");

const catSql = sql.slice(sql.indexOf("create function private.abc_cap_catalogo()"), sql.indexOf("create function private.abc_cap_techo_permite("));
const catalogo = [...catSql.matchAll(/\('(ABC_[A-Z_]+)','(GENERAL|COMANDA)',(true|false),(true|false),(true|false),(true|false),'(TODOS|ENCARGADO|PROPIETARIO)'\)/g)]
  .map((m) => ({ cap: m[1], familia: m[2], p: m[3] === "true", e: m[4] === "true", c: m[5] === "true", m: m[6] === "true", techo: m[7] }));
assert.equal(catalogo.length, 31, "el catálogo tiene 31 filas (30 de hoy + ABC_CIERRE_REABRIR)");
assert.equal(new Set(catalogo.map((f) => f.cap)).size, 31, "sin capacidades repetidas");
assert.equal((catSql.match(/\('ABC_/g) || []).length, 31, "ninguna fila del catálogo se escapa a la lectura");
for (const [cap, o] of orig) {
  const f = catalogo.find((x) => x.cap === cap);
  assert.ok(f, "falta en el catálogo " + cap);
  assert.equal(f.familia, o.familia, "familia de " + cap);
  assert.equal(f.p, o.roles.has("Propietario"), "Propietario en " + cap);
  assert.equal(f.e, o.roles.has("Encargado"), "Encargado en " + cap);
  assert.equal(f.c, o.roles.has("Cajero/a"), "Cajero/a en " + cap);
  assert.equal(f.m, o.roles.has("Camarero/a"), "Camarero/a en " + cap);
  for (const r of o.roles) assert.ok(["Propietario", "Encargado", "Cajero/a", "Camarero/a", "Churrero/a"].includes(r), "rol desconocido en " + cap + ": " + r);
}
const nueva = catalogo.filter((f) => !orig.has(f.cap));
assert.deepEqual(nueva.map((f) => f.cap), ["ABC_CIERRE_REABRIR"], "la única capacidad nueva es ABC_CIERRE_REABRIR");
assert.deepEqual([nueva[0].p, nueva[0].e, nueva[0].c, nueva[0].m, nueva[0].techo, nueva[0].familia], [true, false, false, false, "ENCARGADO", "GENERAL"], "D14: solo Propietario por defecto");
assert.ok(catalogo.every((f) => f.p), "el Propietario tiene todas");
const delicadas = ["ABC_CANCELACION_SENSIBLE", "ABC_CIERRE_REABRIR", "ABC_COBRO_RESOLVER_INCIERTO", "ABC_EMISOR_CAMBIAR", "ABC_REEMBOLSO_CONFIRMAR", "ABC_REEMBOLSO_SOLICITAR"];
assert.deepEqual(catalogo.filter((f) => f.techo === "ENCARGADO").map((f) => f.cap).sort(), delicadas, "techo en Encargado: dinero, documentos fiscales, cancelaciones sensibles y reabrir cierres");
assert.ok(catalogo.every((f) => f.techo === "TODOS" || f.techo === "ENCARGADO"), "ninguna capacidad con techo solo-Propietario (el Propietario ya es fijo)");
for (const f of catalogo) {
  if (f.techo === "ENCARGADO") assert.ok(!f.c && !f.m, "la plantilla respeta el techo en " + f.cap);
}
assert.ok(catalogo.some((f) => f.cap === "ABC_REEMBOLSO_SOLICITAR" && !f.c), "D13 queda sin permiso para el cajero (decisión de Pedro)");
const techoFn = funcion(sql, "create function private.abc_cap_techo_permite(");
assert.match(techoFn, /when 'TODOS' then p_rol in \('Propietario','Encargado','Cajero\/a','Camarero\/a'\)\s+when 'ENCARGADO' then p_rol in \('Propietario','Encargado'\)\s+when 'PROPIETARIO' then p_rol='Propietario'\s+else false/);

// 4. Roles: configurables y retirados, iguales en todos los sitios.
assert.match(funcion(sql, "create function private.abc_cap_rol_configurable("), /p_rol in \('Encargado','Cajero\/a','Camarero\/a'\)/);
assert.match(funcion(sql, "create function private.abc_cap_rol_retirado("), /p_rol in \('Churrero\/a','Básico','Estándar'\)/);
assert.equal((sql.match(/'Churrero\/a','Básico','Estándar'/g) || []).length, 3, "los tres roles retirados aparecen igual en la función, la lectura y el listado");
assert.match(sql, /constraint abc_cap_rol_rol check \(rol in \('Encargado','Cajero\/a','Camarero\/a'\)\)/);

// 5. Tabla: sin acceso directo y con sus restricciones.
assert.match(sql, /create table public\.abc_capacidades_rol \(/);
assert.match(sql, /alter table public\.abc_capacidades_rol enable row level security;/);
assert.match(sql, /revoke all on table public\.abc_capacidades_rol from public,anon,authenticated,service_role;/);
assert.doesNotMatch(sql, /grant [^;]* on table/i, "ningún permiso de tabla");
assert.doesNotMatch(sql, /create policy/i, "sin políticas: nadie la lee ni escribe directamente");
assert.match(sql, /constraint abc_cap_rol_empresa_fk foreign key \(empresa_id\)\s+references public\.empresas\(id\) on delete restrict/);
assert.match(sql, /constraint abc_cap_rol_local_fk foreign key \(empresa_id,local_id\)\s+references public\.locales\(empresa_id,id\) on delete restrict/);
assert.match(sql, /constraint abc_cap_rol_capacidad check \(capacidad ~ '\^ABC_\[A-Z_\]\{3,60\}\$'\)/);
assert.match(sql, /constraint abc_cap_rol_motivo check \(nullif\(btrim\(motivo\),''\) is not null\)/);
assert.match(sql, /constraint abc_cap_rol_version check \(version>=1\)/);
assert.match(sql, /\n  permitido boolean,\n/, "permitido admite nulo (heredar)");
assert.match(sql, /create unique index abc_cap_rol_uq\s+on public\.abc_capacidades_rol\(empresa_id,coalesce\(local_id,''\),rol,capacidad\);/, "una decisión por ámbito (el local nulo también cuenta)");
assert.equal((sql.match(/create table/gi) || []).length, 1, "una única tabla nueva");
assert.equal((sql.match(/alter table/gi) || []).length, 1, "un único ALTER TABLE (activar RLS en la tabla nueva)");

// 6. Funciones: nuevas y reemplazadas.
const cabeceras = [...sql.matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]);
assert.deepEqual(cabeceras.slice().sort(), [
  "private.abc_a10_tiene_capacidad", "private.abc_cap_catalogo", "private.abc_cap_efectiva", "private.abc_cap_rol_configurable", "private.abc_cap_rol_retirado",
  "private.abc_cap_techo_permite", "private.abc_cfg5_guard_rol_retirado", "private.abc_config_puede_configurar_empresa", "private.abc_tiene_capacidad",
  "public.abc_configurar_capacidad_rol", "public.abc_listar_roles_retirados", "public.abc_obtener_capacidades_rol", "public.abc_reabrir_cierre_provisional",
], "la migración crea o reemplaza exactamente estas 13 funciones");
const reemplazadas = [...sql.matchAll(/create or replace function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]).sort();
assert.deepEqual(reemplazadas, ["private.abc_a10_tiene_capacidad", "private.abc_tiene_capacidad", "public.abc_reabrir_cierre_provisional"], "solo se reemplazan las 3 previstas");
for (const f of cabeceras) {
  const i = sql.search(new RegExp(`create (?:or replace )?function ${f.replace(".", "\\.")}\\(`));
  const cab = sql.slice(i, sql.indexOf("as $$", i));
  assert.match(cab, /security definer/, f + " es SECURITY DEFINER");
  assert.match(cab, /set search_path=''/, f + " fija search_path vacío");
}
const revoca = [...sql.matchAll(/revoke all on function ([a-z_0-9.]+)\(/g)].map((m) => m[1]).sort();
assert.deepEqual(revoca, cabeceras.slice().sort(), "cada función revoca todo a public, anon, authenticated y service_role");
for (const m of sql.matchAll(/revoke all on function [^;]*?;/g))
  assert.match(m[0], /from public,anon,authenticated,service_role;/, "revoca a los cuatro: " + m[0].slice(0, 60));
const concedidas = [...sql.matchAll(/grant execute on function ([a-z_0-9.]+)\([^;]*?\)\s+to\s+([a-z_, ]+);/gi)];
assert.deepEqual(concedidas.map((m) => m[1]).sort(), ["public.abc_configurar_capacidad_rol", "public.abc_listar_roles_retirados", "public.abc_obtener_capacidades_rol", "public.abc_reabrir_cierre_provisional"],
  "solo las 3 funciones públicas nuevas y la de reabrir (que ya la tenía) reciben EXECUTE");
for (const m of concedidas) assert.equal(m[2].trim(), "authenticated", "solo authenticated recibe EXECUTE: " + m[1]);
assert.equal((sql.match(/\bgrant\b/gi) || []).length, 4, "no hay más concesiones que esas cuatro");

// 6b. Las funciones reemplazadas conservan EXACTAMENTE su inicio; solo cambia el final (o una capacidad).
const nuevoCap = funcion(sql, "create or replace function private.abc_tiene_capacidad(");
const prefijoOrigCap = cuerpoCap.slice(0, cuerpoCap.indexOf("  return case v_capacidad"));
assert.ok(prefijoOrigCap.length > 400, "prefijo original localizado");
assert.equal(cuerpo(nuevoCap, "create or replace function private.abc_tiene_capacidad("),
  prefijoOrigCap + "  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_capacidad,'GENERAL');\nend ",
  "abc_tiene_capacidad: igual que la original salvo el final");
const nuevoA10 = funcion(sql, "create or replace function private.abc_a10_tiene_capacidad(");
const prefijoOrigA10 = cuerpoA10.slice(0, cuerpoA10.indexOf("  return case v_cap"));
assert.ok(prefijoOrigA10.length > 400, "prefijo original de cocina localizado");
assert.equal(cuerpo(nuevoA10, "create or replace function private.abc_a10_tiene_capacidad("),
  prefijoOrigA10 + "  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_cap,'COMANDA');\nend ",
  "abc_a10_tiene_capacidad: igual que la original salvo el final");
for (const t of [nuevoCap, nuevoA10]) {
  assert.match(t, /returns boolean\nlanguage plpgsql\nstable\nsecurity definer\nset search_path=''/, "mismos atributos que la original");
}
const nuevoReabrir = funcion(sql, "create or replace function public.abc_reabrir_cierre_provisional(");
const origReabrir = funcion(c04, "create function public.abc_reabrir_cierre_provisional(");
assert.equal(nuevoReabrir, origReabrir.replace("create function public", "create or replace function public").replace("'ABC_CAJA_OPERAR'", "'ABC_CIERRE_REABRIR'"),
  "D14: la función de reabrir es la original con una sola diferencia (la capacidad que exige)");
assert.equal((origReabrir.match(/'ABC_CAJA_OPERAR'/g) || []).length, 1);
assert.match(nuevoReabrir, /not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CIERRE_REABRIR'\) then raise exception 'abc_caja_no_autorizado'/);

// 7. Resolución: local -> empresa -> plantilla, con techo y sin tocar al Propietario.
const efectiva = funcion(sql, "create function private.abc_cap_efectiva(");
assert.match(efectiva, /where c\.capacidad=p_capacidad and c\.familia=p_familia;\s+if not found then return false; end if;/);
assert.match(efectiva, /if not private\.abc_cap_rol_configurable\(p_rol\) then\s+return v_base;\s+end if;/, "Propietario y roles retirados: solo la plantilla");
assert.match(efectiva, /r\.empresa_id=p_empresa_id and r\.local_id=p_local_id\s+and r\.rol=p_rol and r\.capacidad=p_capacidad and r\.permitido is not null;\s+if v_dec is null then\s+select r\.permitido into v_dec[\s\S]*?r\.empresa_id=p_empresa_id and r\.local_id is null\s+and r\.rol=p_rol and r\.capacidad=p_capacidad and r\.permitido is not null;\s+end if;/,
  "primero la decisión del local, luego la de la empresa; una decisión nula no cuenta");
assert.match(efectiva, /return coalesce\(v_dec,v_base\) and private\.abc_cap_techo_permite\(v_cat\.techo,p_rol\);/, "el techo se aplica también al leer");
assert.match(efectiva, /\bstable\b/);
const empresaFn = funcion(sql, "create function private.abc_config_puede_configurar_empresa(");
assert.match(empresaFn, /m\.todos_locales=true\s+and m\.local_id is null\s+and m\.rol='Propietario'/, "para toda la empresa hace falta ser Propietario de todos los locales");
assert.match(empresaFn, /if not coalesce\(private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\),false\) then return false; end if;/);

// 8. Configurar: solo el Propietario, idempotente, con motivo, techo y auditoría.
const cfg = funcion(sql, "create function public.abc_configurar_capacidad_rol(");
assert.match(cfg, /if v_ambito='EMPRESA' then\s+v_autorizado:=coalesce\(private\.abc_config_puede_configurar_empresa\(p_empresa_id,p_local_id\),false\);\s+else\s+v_autorizado:=coalesce\(private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\),false\);\s+end if;\s+if auth\.uid\(\) is null or not v_autorizado then\s+raise exception 'abc_config_no_autorizado';/);
for (const e of ["capacidad_ambito_invalido", "capacidad_rol_invalido", "capacidad_invalida", "capacidad_fuera_de_techo", "capacidad_motivo_requerido", "capacidad_local_no_disponible"])
  assert.ok(cfg.includes(`raise exception '${e}'`), "falta el error " + e);
assert.match(cfg, /if not private\.abc_cap_rol_configurable\(v_rol\) then raise exception 'capacidad_rol_invalido'; end if;/);
assert.match(cfg, /if p_permitido is true and not private\.abc_cap_techo_permite\(v_cat\.techo,v_rol\) then\s+raise exception 'capacidad_fuera_de_techo';/, "solo se rechaza al dar; quitar y heredar siempre se puede");
assert.match(cfg, /l\.empresa_id=p_empresa_id and l\.id=p_local_id and l\.activo=true/);
assert.match(cfg, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_CAPACIDAD_ROL',v_request,null\s*\)/);
assert.match(cfg, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/);
assert.match(cfg, /perform pg_advisory_xact_lock\(hashtext\('abc_capacidades:'\|\|p_empresa_id\)\);/);
assert.match(cfg, /r\.local_id is not distinct from v_destino\s+for update;/);
assert.match(cfg, /v_destino:=case when v_ambito='EMPRESA' then null else p_local_id end;/);
assert.match(cfg, /v_cambio:=v_antes is distinct from p_permitido;/, "sin cambio real no hay versión ni evento");
assert.equal((cfg.match(/insert into public\.abc_eventos/g) || []).length, 1, "un único evento, solo en el cambio real");
assert.match(cfg, /'CAPACIDAD_ROL_CONFIGURADA'/);
assert.match(cfg, /'ambito',v_ambito,'local_destino',v_destino,'rol',v_rol,'capacidad',v_cap,\s+'anterior',v_antes,'nuevo',p_permitido,'version',v_version,'motivo',v_motivo,\s+'efectivo_antes',v_ef_antes,'efectivo_despues',v_ef_despues/);
assert.match(cfg, /perform private\.abc_operacion_completar\(p_operation_id,v_result\);/);
assert.doesNotMatch(cfg, /delete\s+from/i, "las decisiones no se borran: se heredan");

// 9. Lectura y listado.
const leer = funcion(sql, "create function public.abc_obtener_capacidades_rol(");
assert.match(leer, /or not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.match(leer, /'origen',case when r\.rol='Propietario' then 'fijo'\s+when lo\.permitido is not null then 'local'\s+when em\.permitido is not null then 'empresa'\s+else 'plantilla' end/);
assert.match(leer, /\bstable\b/, "la lectura no modifica nada");
const listar = funcion(sql, "create function public.abc_listar_roles_retirados(");
assert.match(listar, /not coalesce\(private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\),false\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.match(listar, /\(m\.local_id=p_local_id or \(m\.todos_locales=true and m\.local_id is null\)\)/);
assert.match(listar, /private\.abc_cap_rol_retirado\(m\.rol\)/);
assert.equal((sql.match(/la_tiene_local\(/g) || []).length, (sql.match(/coalesce\(private\.la_tiene_local\(/g) || []).length + 3,
  "toda llamada a la_tiene_local va dentro de coalesce(…,false), salvo las de los dos reemplazos y la del preflight");

// 10. Retirada de roles: un único trigger, que no toca a quien ya los tiene.
const guarda = funcion(sql, "create function private.abc_cfg5_guard_rol_retirado(");
assert.match(guarda, /if private\.abc_cap_rol_retirado\(new\.rol\) then\s+if tg_op='INSERT'\s+or new\.rol is distinct from old\.rol\s+or \(new\.activo=true and old\.activo is distinct from true\) then\s+raise exception 'rol_retirado:%',new\.rol;/);
assert.equal((sql.match(/create trigger/gi) || []).length, 1, "un único trigger");
assert.match(sql, /create trigger abc_f6_cfg5_guard_rol_retirado\s+before insert or update of rol,activo on public\.membresias_usuario\s+for each row execute function private\.abc_cfg5_guard_rol_retirado\(\);/);
assert.doesNotMatch(sql, /drop trigger/i, "no se borra ningún trigger");

// 11. Alcance: no se toca nada más (la función de reabrir, idéntica a la original salvo la capacidad, se comprueba arriba).
const sqlSinReabrir = sql.replace(nuevoReabrir, "");
assert.notEqual(sqlSinReabrir, sql);
for (const prohibido of [
  /delete\s+from/i, /truncate/i, /drop table/i, /drop function/i, /drop column/i,
  /update\s+public\.membresias_usuario/i, /update\s+public\.perfiles/i,
  /insert\s+into\s+(?!public\.abc_capacidades_rol|public\.abc_eventos)/i,
  /update\s+public\.(?!abc_capacidades_rol)/i,
  /create (?:or replace )?function [a-z_.]*abc_abrir_/i, /create (?:or replace )?function [a-z_.]*abc_cobrar/i, /create (?:or replace )?function [a-z_.]*abc_descuento/i,
])
  assert.doesNotMatch(sqlSinReabrir, prohibido, "la migración no debe contener " + prohibido);

// 12. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "M1.1 las 31 capacidades de la matriz", "M1.3 la plantilla nunca supera el techo", "M1.4 lo delicado", "M2.1 abc_tiene_capacidad no reconoce una capacidad de cocina",
  "M3.1 Churrero/a, Básico, Estándar y roles desconocidos no tienen ninguna capacidad", "M3.2 el Propietario tiene las 31",
  "C1.1 el Encargado no puede decidir", "C1.4 anon no puede", "C1.5 service_role no puede", "C1.6 el Propietario de un solo local no puede decidir para toda la empresa",
  "C2.2 el Propietario no se configura", "C2.3 un rol retirado no se configura", "C2.6 el cajero no puede solicitar devoluciones (techo)", "C2.9 sin motivo",
  "C2.11 local desactivado", "C2.12 los rechazos no dejaron decisiones ni operaciones", "C3.3 el Cajero/a de CFG-LA ya puede", "C3.4 en otro local (CFG-LA2) sigue sin poder",
  "C3.19 el replay devuelve el resultado original", "C3.20 mismo operation_id con otro contenido: conflicto", "C3.22 sin cambio: la versión no sube",
  "C3.25 el Cajero/a vuelve a no poder", "C3.27 versión 3, cambio, decisión nula", "C3.31 versión 0 y sin cambio",
  "C4.3 vale en todos los locales de la empresa", "C4.5 en CFG-LA2 no, en CFG-LD sí", "C4.11 CFG-LA2 vuelve a seguir a la empresa", "C4.17 todo vuelve a la plantilla",
  "C5.2 el Encargado de CFG-LA2 no", "C5.4 el Encargado ya no confirma devoluciones", "C5.10 quitar siempre se puede, también a un rol que está por encima del techo", "C6.2 aun así el Cajero/a no puede solicitar devoluciones",
  "C7.1 dieciséis cambios reales dejaron dieciséis eventos", "C7.2 el evento de quitar guarda", "C7.3 el evento de empresa queda en el local", "C8.1 la tabla no se puede leer directamente",
  "C8.3 la tabla tiene activada la seguridad por filas", "C8.7 la tabla rechaza una decisión de local repetida", "C8.8 la tabla rechaza una decisión de empresa repetida",
  "D2.1 el Cajero/a no puede reabrir", "D2.2 el Encargado tampoco, aunque opere caja", "D2.3 el Propietario supera el permiso", "D3.1 el cajero no se puede habilitar (techo)",
  "D3.3 ahora el Encargado supera el permiso", "D3.6 el Encargado ya no puede", "D3.9 el Propietario nunca lo pierde",
  "R1.0 el trigger de roles retirados existe y está activo", "R1.1 no se puede dar de alta a nadie como Churrero/a", "R1.4 no se puede cambiar el rol de una persona a Churrero/a",
  "R1.5 los demás cambios de rol siguen funcionando", "R2.3 el Encargado no puede", "R3.2 tres personas, ordenadas por rol", "R3.5 quien aún tiene Churrero/a no tiene ninguna capacidad ABC",
  "R3.6 no se puede reactivar un rol retirado", "R3.8 sí se puede reasignar a un rol normal", "R3.13 el trigger quedó activo otra vez",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");
assert.doesNotMatch(sinComentarios(live), /delete\s+from/i, "el contrato no borra nada (la herramienta de QA pide confirmación extra con borrados)");
for (const chunk of ["matriz", "config", "reabrir", "retirados"])
  assert.ok(live.includes(`-- ==== CHUNK: ${chunk} ====`), "falta el trozo " + chunk);

console.log("cfg5-static-contract: OK");
