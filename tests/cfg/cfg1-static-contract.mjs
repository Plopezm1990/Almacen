import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Contrato estático de la capa de configuración, PIEZA 1 (corte del día, ajustes por local, límite de cajas).
// Comprueba la forma de la migración y que el parche de `abc_abrir_sesion_caja` solo añade lo previsto sobre
// la versión M04a. No sustituye a cfg1-contract.sql (que se ejecuta contra una base real con ROLLBACK).
// MIGRACION_CFG1 (variable de entorno) permite probar variantes rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const m04a = await read("supabase/migrations/20260924001000_abc_f2_m04a_caja_sesiones.sql");
const mig = process.env.MIGRACION_CFG1
  ? await readFile(process.env.MIGRACION_CFG1, "utf8")
  : await read("supabase/migrations/20261002190000_abc_config_pieza1_dia_cajas.sql");
const live = await read("tests/cfg/cfg1-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);
const norm = (t) => t.replace(/[ \t]+\n/g, "\n").replace(/\n+/g, "\n");

function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("end $$;", i);
  assert.ok(j > i, "no termina la función " + cabecera);
  return texto.slice(i, j + "end $$;".length);
}

// 1. El parche de abc_abrir_sesion_caja es la versión M04a más dos añadidos exactos y nada más.
const orig = sinComentarios(funcion(m04a, "create function public.abc_abrir_sesion_caja("));
const nueva = sinComentarios(funcion(mig, "create or replace function public.abc_abrir_sesion_caja("));
const AÑADIDOS = [
  // cerrojo por local (serializa aperturas simultáneas del mismo local)
  /  perform pg_advisory_xact_lock\(hashtext\('abc_cajas_abiertas:'\|\|p_empresa_id\|\|'\/'\|\|p_local_id\)\);\n\n/,
  // comprobación del límite, tras la de «caja ocupada»
  /  if \(\n    select count\(\*\)\n      from public\.caja_sesiones s\n     where s\.empresa_id=p_empresa_id\n       and s\.local_id=p_local_id\n       and s\.estado in \('PREPARANDO_APERTURA','ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL'\)\n  \) >= private\.abc_ajuste_cajas_max\(p_empresa_id,p_local_id\) then\n    raise exception 'caja_limite_sesiones_alcanzado';\n  end if;\n\n/,
];
let sinAñadidos = nueva.replace("create or replace function", "create function");
for (const a of AÑADIDOS) {
  assert.match(sinAñadidos, a, "falta un añadido esperado: " + a);
  sinAñadidos = sinAñadidos.replace(a, "");
}
assert.equal(norm(sinAñadidos), norm(orig), "abc_abrir_sesion_caja solo difiere de M04a en el cerrojo y la comprobación del límite");
// El límite se comprueba DESPUÉS de «caja ocupada» (el error de siempre manda sobre el nuevo) y con el cerrojo antes de todo.
const posLock = nueva.indexOf("pg_advisory_xact_lock");
const posCajaFis = nueva.indexOf("from public.cajas_fisicas");
const posOcupada = nueva.indexOf("caja_con_sesion_activa");
const posLimite = nueva.indexOf("caja_limite_sesiones_alcanzado");
const posTerminal = nueva.indexOf("from public.terminales_tpv");
assert.ok(posLock > 0 && posLock < posCajaFis && posCajaFis < posOcupada && posOcupada < posLimite && posLimite < posTerminal,
  "orden: cerrojo, caja física, caja ocupada, límite, terminal");
// La huella que exige el preflight es la del cuerpo de M04a del repositorio.
const cuerpo = (f) => f.slice(f.indexOf("as $$") + 5, f.lastIndexOf("$$"));
const huella = createHash("md5").update(cuerpo(funcion(m04a, "create function public.abc_abrir_sesion_caja("))).digest("hex");
assert.ok(mig.includes(`<> '${huella}'`), "el preflight compara con la huella del cuerpo de M04a: " + huella);

// 2. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_CFG1_PREFLIGHT_FALLO:%/);
assert.match(mig, /ABC_CFG1_PREFLIGHT_FALLO: abc_abrir_sesion_caja no coincide con la versión M04a esperada/);
assert.match(mig, /ABC_CFG1_PREFLIGHT_FALLO: objetos de la pieza 1 ya existen/);
for (const dep of ["abc_operacion_iniciar", "abc_operacion_completar", "abc_resolver_operating_day_contexto", "la_tiene_local", "abc_operating_day_reglas"])
  assert.ok(mig.includes(`'${dep}'`), "el preflight comprueba " + dep);

// 3. Tabla de ajustes: sin acceso directo, restricciones de datos y de clave.
assert.match(sql, /create table public\.abc_config_ajustes \(/);
assert.match(sql, /alter table public\.abc_config_ajustes enable row level security;/);
assert.match(sql, /revoke all on table public\.abc_config_ajustes from public,anon,authenticated,service_role;/);
assert.doesNotMatch(sql, /grant [^;]* on table public\.abc_config_ajustes/i, "ningún permiso de tabla");
assert.doesNotMatch(sql, /create policy/i, "sin políticas: nadie la lee ni escribe directamente");
assert.match(sql, /constraint abc_config_ajuste_local_fk foreign key \(empresa_id,local_id\)\s+references public\.locales\(empresa_id,id\)/);
assert.match(sql, /constraint abc_config_ajuste_clave check \(clave in \('cajas_abiertas_max'\)\)/);
assert.match(sql, /between 1 and 10/, "rango 1..10");
assert.match(sql, /=trunc\(\(valor#>>'\{\}'\)::numeric\)/, "solo enteros");
assert.match(sql, /constraint abc_config_ajuste_uq unique \(empresa_id,local_id,clave\)/);
assert.match(sql, /constraint abc_config_ajuste_motivo check \(nullif\(btrim\(motivo\),''\) is not null\)/);

// 4. Todas las funciones son SECURITY DEFINER con search_path vacío; las públicas solo para authenticated.
const cabeceras = [...sql.matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]);
assert.deepEqual(cabeceras.sort(), [
  "private.abc_ajuste_cajas_max", "private.abc_config_dia_evento", "private.abc_config_puede_configurar",
  "public.abc_abrir_sesion_caja", "public.abc_configurar_ajuste", "public.abc_configurar_dia_operativo", "public.abc_obtener_ajustes",
].sort(), "la migración crea o reemplaza exactamente estas 7 funciones");
for (const f of cabeceras) {
  const i = sql.search(new RegExp(`create (?:or replace )?function ${f.replace(".", "\\.")}\\(`));
  const cuerpoCab = sql.slice(i, sql.indexOf("as $$", i));
  assert.match(cuerpoCab, /security definer/, f + " es SECURITY DEFINER");
  assert.match(cuerpoCab, /set search_path=''/, f + " fija search_path vacío");
}
assert.doesNotMatch(sql, /search_path\s*=\s*public/i, "ninguna función usa search_path público");
const revoca = [...sql.matchAll(/revoke all on function ([a-z_.]+)\(/g)].map((m) => m[1]).sort();
assert.deepEqual(revoca, cabeceras.slice().sort(), "cada función revoca todo a public, anon, authenticated y service_role");
for (const m of sql.matchAll(/revoke all on function [^;]*?;/g))
  assert.match(m[0], /from public,anon,authenticated,service_role;/, "revoca a los cuatro: " + m[0].slice(0, 60));
const concedidas = [...sql.matchAll(/grant execute on function ([a-z_.]+)\([^;]*?\)\s+to\s+([a-z_, ]+);/gi)];
assert.deepEqual(concedidas.map((m) => m[1]).sort(),
  ["public.abc_abrir_sesion_caja", "public.abc_configurar_ajuste", "public.abc_configurar_dia_operativo", "public.abc_obtener_ajustes"],
  "solo las 4 funciones públicas reciben EXECUTE");
for (const m of concedidas) assert.equal(m[2].trim(), "authenticated", "solo authenticated recibe EXECUTE: " + m[1]);

// 5. Quién puede configurar: solo el Propietario con acceso al local; la comprobación no puede dar NULL.
const puede = funcion(sql, "create function private.abc_config_puede_configurar(");
assert.match(puede, /if auth\.uid\(\) is null then return false; end if;/);
assert.match(puede, /if not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\) then return false; end if;/);
assert.match(puede, /return coalesce\(v_rol,''\)='Propietario';/);
assert.match(puede, /m\.empresa_id=p_empresa_id/, "la membresía se busca en la empresa pedida");
assert.match(puede, /m\.activo=true/);
const aj = funcion(sql, "create function public.abc_configurar_ajuste(");
const dia = funcion(sql, "create function public.abc_configurar_dia_operativo(");
const leer = funcion(sql, "create function public.abc_obtener_ajustes(");
for (const f of [aj, dia]) assert.match(f, /if auth\.uid\(\) is null\s+or not private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.match(leer, /or not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.equal((sql.match(/la_tiene_local\(/g) || []).length, (sql.match(/coalesce\(private\.la_tiene_local\(/g) || []).length + 1,
  "toda llamada a la_tiene_local va dentro de coalesce(…,false) (salvo la del preflight)");

// 6. Ajustes: validaciones, idempotencia, auditoría y versión.
for (const e of ["ajuste_clave_invalida", "ajuste_valor_invalido", "ajuste_valor_fuera_de_rango", "ajuste_motivo_requerido"])
  assert.ok(aj.includes(`raise exception '${e}'`), "falta el error " + e);
assert.match(aj, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_AJUSTE',v_request,null\s*\)/);
assert.match(aj, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/);
assert.match(aj, /perform private\.abc_operacion_completar\(p_operation_id,v_result\);/);
assert.match(aj, /perform pg_advisory_xact_lock\(hashtext\('abc_ajuste:'/);
assert.match(aj, /set valor=to_jsonb\(v_valor::integer\), version=version\+1/, "cada cambio real sube la versión");
assert.match(aj, /if v_found and \(v_prev\.valor#>>'\{\}'\)::numeric=v_valor then/, "mismo valor: sin cambio ni evento");
assert.equal((aj.match(/insert into public\.abc_eventos/g) || []).length, 1, "un único evento, solo en el cambio real");
assert.match(aj, /'AJUSTE_CONFIGURADO'/);
assert.match(aj, /'anterior',case when v_found then v_prev\.valor else null end,\s+'nuevo',to_jsonb\(v_valor::integer\),\s+'version',v_version,\s+'motivo',v_motivo/);
assert.match(aj, /auth\.uid\(\),null,now\(\),private\.abc_config_dia_evento\(p_empresa_id,p_local_id\)/, "el actor del evento es quien llama");

// 7. Día operativo: reglas versionadas, nunca se reescribe el pasado ni se borra.
for (const e of ["dia_operativo_motivo_requerido", "dia_operativo_timezone_invalida", "dia_operativo_corte_fuera_de_rango",
  "dia_operativo_local_no_disponible", "dia_operativo_vigencia_pasada", "dia_operativo_vigencia_incoherente"])
  assert.ok(dia.includes(`raise exception '${e}'`), "falta el error " + e);
assert.match(dia, /coalesce\(nullif\(btrim\(coalesce\(p_timezone_name,''\)\),''\),'Europe\/Madrid'\)/, "zona por defecto Europe/Madrid");
assert.match(dia, /coalesce\(p_cutoff_time,time '00:00'\)/, "corte por defecto 00:00 (D06)");
assert.match(dia, /if v_cutoff>time '12:00' then raise exception 'dia_operativo_corte_fuera_de_rango'; end if;/);
assert.match(dia, /pg_catalog\.pg_timezone_names/);
assert.match(dia, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_DIA_OPERATIVO',v_request,null\s*\)/);
assert.match(dia, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/);
assert.match(dia, /if v_prev\.timezone_name=v_tz and v_prev\.cutoff_time=v_cutoff then/, "sin cambio real: no se crea versión");
assert.match(dia, /\(\(now\(\) at time zone v_prev\.timezone_name\)::date\+1\)::timestamp at time zone v_prev\.timezone_name/, "por defecto rige desde la próxima medianoche local");
assert.match(dia, /if v_desde<=now\(\) then raise exception 'dia_operativo_vigencia_pasada'; end if;/);
assert.match(dia, /if v_desde<=v_prev\.vigente_desde then raise exception 'dia_operativo_vigencia_incoherente'; end if;/);
assert.match(dia, /timestamp with time zone '2000-01-01 00:00:00\+00'/, "la primera regla de un local rige desde 2000-01-01");
assert.equal((dia.match(/update private\.abc_operating_day_reglas/g) || []).length, 1, "un único update sobre las reglas");
assert.match(dia, /update private\.abc_operating_day_reglas set vigente_hasta=v_desde where id=v_prev\.id;/, "el update solo cierra la regla vigente");
assert.equal((dia.match(/insert into private\.abc_operating_day_reglas/g) || []).length, 1);
assert.doesNotMatch(sql, /delete\s+from/i, "la migración no borra nada");
assert.doesNotMatch(sql, /truncate/i);
assert.match(dia, /'DIA_OPERATIVO_REGLA_CAMBIADA'/);
assert.equal((dia.match(/insert into public\.abc_eventos/g) || []).length, 1);
assert.match(dia, /created_by|auth\.uid\(\)/);

// 8. Lectura de ajustes: valor por defecto 10 y regla vigente del día.
assert.match(leer, /jsonb_build_object\('valor',10,'origen','defecto','version',0\)/);
assert.match(leer, /'dia_operativo',\s+\(select jsonb_build_object\(/);
assert.match(leer, /r\.vigente_hasta is null\)/);
assert.match(funcion(sql, "create function private.abc_ajuste_cajas_max("), /\),\s+10\s+\)/, "10 por defecto");

// 9. Alcance: la migración NO toca lo que no debe (resolver del día, permisos, descuentos, otras tablas).
for (const prohibido of [
  /create (?:or replace )?function [a-z_.]*abc_resolver_operating_day/i,
  /create (?:or replace )?function [a-z_.]*abc_tiene_capacidad/i,
  /create (?:or replace )?function [a-z_.]*abc_descuento/i,
  /create (?:or replace )?function [a-z_.]*la_tiene_local/i,
  /alter table (?!public\.abc_config_ajustes)/i,
  /insert\s+into\s+(?!private\.abc_operating_day_reglas|public\.abc_config_ajustes|public\.abc_eventos|public\.caja_sesion|public\.caja_operaciones)/i,
  /\bpublic\.almacen_kv\b/,
])
  assert.doesNotMatch(sql, prohibido, "la migración no debe contener " + prohibido);
assert.equal((sql.match(/alter table/gi) || []).length, 1, "un único ALTER TABLE (activar RLS en la tabla nueva)");
assert.equal((sql.match(/create table/gi) || []).length, 1, "una única tabla nueva");

// 10. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "A1.1 el Encargado del local no puede", "A1.3 el Propietario de otra empresa no puede", "A1.4 anon no puede", "A1.5 service_role no puede",
  "A2.3 corte a las 13:00", "A3.4 dos reglas", "A4.1 antes del cambio", "A4.2 después del cambio", "A5.3 mismo operation_id con otro contenido",
  "A6.1 vigencia en el pasado", "A7.1 queda un evento de auditoría", "A8.1 otro local de la misma empresa", "A9.4 un local sin regla sigue fallando",
  "B0.5 el Propietario de otra empresa no puede leer", "B1.1 el Encargado no puede configurar", "B2.2 valor 11", "B2.4 valor escrito como texto",
  "B3.5 la tabla no se puede leer directamente", "B3.6 ni escribir directamente", "B4.5 la sesión 3 supera el límite",
  "B4.7 una caja ocupada sigue dando su error de siempre", "B5.1b cada cambio real sube la versión", "B6.2 se permite (versión 3)",
  "B6.4 con una sola sesión en", "B7.2b versión 4", "B8.5 la undécima se rechaza", "B9.3 cuatro cambios reales",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");
assert.doesNotMatch(live, /set estado = 'CERRADA_FINAL'/, "el contrato no fuerza CERRADA_FINAL (lo impide el guarda C04)");

console.log("cfg1-static-contract: OK");
