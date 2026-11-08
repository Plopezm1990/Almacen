import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de la capa de configuración, PIEZA 4 (registro de equipos por local).
// Comprueba la forma de la migración y que no toca nada existente. No sustituye a cfg4-contract.sql (que se
// ejecuta contra una base real con ROLLBACK). MIGRACION_CFG4 (variable de entorno) permite probar variantes
// rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const mig = process.env.MIGRACION_CFG4
  ? await readFile(process.env.MIGRACION_CFG4, "utf8")
  : await read("supabase/migrations/20261002230000_abc_config_pieza4_equipos.sql");
const live = await read("tests/cfg/cfg4-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);

function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("$$;", texto.indexOf("as $$", i));
  assert.ok(j > i, "no termina la función " + cabecera);
  return texto.slice(i, j + 3);
}

// 1. Los cinco tipos de equipo son los mismos en la tabla y en la función (y no hay otros).
const tipos = "'IMPRESORA_TICKET','IMPRESORA_COCINA','CAJON_MONEDERO','DATAFONO','OTRO'";
assert.match(sql, new RegExp(`constraint abc_local_equipo_tipo check \\(tipo in \\(${tipos}\\)\\)`));
assert.match(funcion(sql, "create function public.abc_configurar_equipo_local("), new RegExp(`v_tipo not in \\(${tipos}\\)`));
assert.equal((sql.match(/'IMPRESORA_TICKET'/g) || []).length, 2, "los tipos solo aparecen en la tabla y en la función de alta");

// 2. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_CFG4_PREFLIGHT_FALLO:%/);
assert.match(mig, /ABC_CFG4_PREFLIGHT_FALLO: objetos de la pieza 4 ya existen/);
for (const dep of ["locales", "terminales_tpv", "abc_eventos", "abc_operacion_iniciar", "abc_operacion_completar", "la_tiene_local", "abc_config_puede_configurar", "abc_config_dia_evento", "auth.uid"])
  assert.ok(mig.includes(`'${dep}`), "el preflight comprueba " + dep);
assert.match(mig, /array\['empresa_id','local_id','id'\]/, "el preflight exige el índice único (empresa, local, id) de los terminales");
assert.match(mig, /if not exists\(\s+select 1 from pg_index i[\s\S]*?= array\['empresa_id','local_id','id'\]\s+\) then v_missing:=array_append\(v_missing,'indice único terminales_tpv\(empresa_id,local_id,id\)'\); end if;/,
  "la ausencia de ese índice detiene la migración");
assert.match(mig, /if cardinality\(v_missing\)>0 then\s+raise exception 'ABC_CFG4_PREFLIGHT_FALLO:%',array_to_string\(v_missing,','\);/);
assert.match(mig, /if to_regclass\('public\.abc_local_equipos'\) is not null\s+or to_regprocedure\('public\.abc_configurar_equipo_local\(text,text,text,uuid,text,text,text,uuid,boolean,text,text\)'\) is not null\s+or to_regprocedure\('public\.abc_listar_equipos_local\(text,text,boolean\)'\) is not null then\s+raise exception 'ABC_CFG4_PREFLIGHT_FALLO: objetos de la pieza 4 ya existen';/,
  "una segunda aplicación se rechaza si existe cualquiera de los tres objetos");
assert.match(sql, /set local lock_timeout = '10s';/, "falla rápido si no consigue los bloqueos de tabla");

// 3. Tabla: sin acceso directo y con sus restricciones.
assert.match(sql, /create table public\.abc_local_equipos \(/);
assert.match(sql, /alter table public\.abc_local_equipos enable row level security;/);
assert.match(sql, /revoke all on table public\.abc_local_equipos from public,anon,authenticated,service_role;/);
assert.doesNotMatch(sql, /grant [^;]* on table/i, "ningún permiso de tabla");
assert.doesNotMatch(sql, /create policy/i, "sin políticas: nadie la lee ni escribe directamente");
assert.match(sql, /id uuid primary key,/, "el identificador lo aporta quien llama");
assert.match(sql, /activo boolean not null default true,/);
assert.match(sql, /version bigint not null default 1,/);
assert.match(sql, /constraint abc_local_equipo_local_fk foreign key \(empresa_id,local_id\)\s+references public\.locales\(empresa_id,id\) on delete restrict/);
assert.match(sql, /constraint abc_local_equipo_terminal_fk foreign key \(empresa_id,local_id,terminal_id\)\s+references public\.terminales_tpv\(empresa_id,local_id,id\) on delete restrict/,
  "el terminal asociado tiene que ser del mismo local");
assert.match(sql, /constraint abc_local_equipo_nombre check \(char_length\(btrim\(nombre\)\) between 1 and 80\)/);
assert.match(sql, /constraint abc_local_equipo_referencia check \(referencia is null or char_length\(btrim\(referencia\)\) between 1 and 120\)/);
assert.match(sql, /constraint abc_local_equipo_notas check \(notas is null or char_length\(btrim\(notas\)\) between 1 and 500\)/);
assert.match(sql, /constraint abc_local_equipo_version check \(version>=1\)/);
assert.match(sql, /create unique index abc_local_equipo_nombre_uq\s+on public\.abc_local_equipos\(empresa_id,local_id,lower\(btrim\(nombre\)\)\);/,
  "el nombre no se repite dentro de un local, sin distinguir mayúsculas");
assert.equal((sql.match(/create table/gi) || []).length, 1, "una única tabla nueva");
assert.equal((sql.match(/alter table/gi) || []).length, 1, "un único ALTER TABLE (activar RLS en la tabla nueva)");
assert.equal((sql.match(/create (?:unique )?index/gi) || []).length, 2, "dos índices, ambos de la tabla nueva");

// 4. Las dos funciones son SECURITY DEFINER con search_path vacío; solo authenticated las ejecuta.
const cabeceras = [...sql.matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]);
assert.deepEqual(cabeceras.slice().sort(), ["public.abc_configurar_equipo_local", "public.abc_listar_equipos_local"],
  "la migración crea exactamente estas 2 funciones (ninguna existente se reemplaza)");
assert.doesNotMatch(sql, /create or replace function/i, "no se reemplaza ninguna función existente");
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
assert.deepEqual(concedidas.map((m) => m[1]).sort(), cabeceras.slice().sort(), "solo las 2 funciones públicas reciben EXECUTE");
for (const m of concedidas) assert.equal(m[2].trim(), "authenticated", "solo authenticated recibe EXECUTE: " + m[1]);
assert.equal((sql.match(/\bgrant\b/gi) || []).length, 2, "no hay más concesiones que esas dos");

// 5. Configuración: solo el Propietario, idempotente, con motivo, sin borrar y con auditoría.
const cfg = funcion(sql, "create function public.abc_configurar_equipo_local(");
assert.match(cfg, /if auth\.uid\(\) is null\s+or not private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\) then\s+raise exception 'abc_config_no_autorizado';/);
for (const e of ["equipo_id_requerido", "equipo_tipo_invalido", "equipo_nombre_invalido", "equipo_referencia_invalida", "equipo_notas_invalidas", "equipo_estado_requerido",
  "equipo_motivo_requerido", "equipo_local_no_disponible", "equipo_terminal_no_disponible", "equipo_id_en_uso", "equipo_nombre_duplicado", "equipo_tipo_inmutable"])
  assert.ok(cfg.includes(`raise exception '${e}'`), "falta el error " + e);
assert.match(cfg, /v_tipo text:=upper\(btrim\(coalesce\(p_tipo,''\)\)\);/);
assert.match(cfg, /v_nombre text:=nullif\(btrim\(coalesce\(p_nombre,''\)\),''\);/);
assert.match(cfg, /l\.empresa_id=p_empresa_id and l\.id=p_local_id and l\.activo=true/, "el local existe y está activo");
assert.match(cfg, /t\.empresa_id=p_empresa_id and t\.local_id=p_local_id and t\.id=p_terminal_id and t\.activo=true/, "el terminal es del mismo local y está activo");
assert.match(cfg, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_EQUIPO_LOCAL',v_request,null\s*\)/);
assert.match(cfg, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/);
assert.match(cfg, /perform pg_advisory_xact_lock\(hashtext\('abc_equipos:'/);
assert.match(cfg, /where e\.empresa_id=p_empresa_id and e\.local_id=p_local_id and e\.id=p_equipo_id\s+for update;/);
assert.match(cfg, /if not v_found and exists\(select 1 from public\.abc_local_equipos e where e\.id=p_equipo_id\) then\s+raise exception 'equipo_id_en_uso';/,
  "un identificador de otro local no se reutiliza");
assert.match(cfg, /lower\(btrim\(e\.nombre\)\)=lower\(v_nombre\) and e\.id<>p_equipo_id/, "nombre único por local sin distinguir mayúsculas");
assert.match(cfg, /if v_prev\.tipo<>v_tipo then raise exception 'equipo_tipo_inmutable'; end if;/);
assert.match(cfg, /v_cambio:=v_anterior is distinct from v_nuevo;/, "sin cambio real no hay versión ni evento");
assert.match(cfg, /nombre=v_nombre,referencia=v_ref,terminal_id=p_terminal_id,activo=p_activo,notas=v_notas,\s+version=version\+1/);
assert.equal((cfg.match(/insert into public\.abc_eventos/g) || []).length, 2, "un evento en el alta y otro en el cambio real");
assert.match(cfg, /'EQUIPO_LOCAL_REGISTRADO'/);
assert.match(cfg, /'EQUIPO_LOCAL_ACTUALIZADO'/);
assert.match(cfg, /jsonb_build_object\('equipo',v_nuevo,'version',1,'motivo',v_motivo\)/);
assert.match(cfg, /jsonb_build_object\('anterior',v_anterior,'nuevo',v_nuevo,'version',v_version,'motivo',v_motivo\)/);
assert.match(cfg, /perform private\.abc_operacion_completar\(p_operation_id,v_result\);/);
assert.doesNotMatch(cfg, /delete\s+from/i, "los equipos no se borran: se desactivan");

// 6. Lectura: cualquier miembro del local; nunca NULL en la comprobación de acceso.
const leer = funcion(sql, "create function public.abc_listar_equipos_local(");
assert.match(leer, /or not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.match(leer, /\(coalesce\(p_incluir_inactivos,false\) or e\.activo\)/, "por defecto solo los activos");
assert.match(leer, /e\.empresa_id=p_empresa_id and e\.local_id=p_local_id/);
assert.match(leer, /order by e\.tipo,lower\(btrim\(e\.nombre\)\),e\.id/, "orden fijo");
assert.match(leer, /\bstable\b/, "la lectura no modifica nada");
assert.equal((sql.match(/la_tiene_local\(/g) || []).length, (sql.match(/coalesce\(private\.la_tiene_local\(/g) || []).length + 1,
  "toda llamada a la_tiene_local va dentro de coalesce(…,false) (salvo la del preflight)");

// 7. Alcance: solo registro; no se toca ningún flujo, ningún permiso ni ningún dato existente.
for (const prohibido of [
  /create trigger/i, /drop trigger/i,
  /create (?:or replace )?function [a-z_.]*abc_abrir_/i,
  /create (?:or replace )?function [a-z_.]*abc_cobrar/i,
  /create (?:or replace )?function [a-z_.]*abc_tiene_capacidad/i,
  /delete\s+from/i, /truncate/i, /drop table/i, /drop function/i,
  /insert\s+into\s+(?!public\.abc_local_equipos|public\.abc_eventos)/i,
  /update\s+public\.(?!abc_local_equipos)/i,
])
  assert.doesNotMatch(sql, prohibido, "la migración no debe contener " + prohibido);

// 8. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "A1.2 lista vacía", "A1.3 el Propietario de otra empresa no puede leer", "A1.5 service_role no puede leer", "A2.1 el Encargado no puede configurar",
  "A2.3 el Propietario de otra empresa no puede", "A2.4 anon no puede", "A2.5 service_role no puede", "A3.1 sin identificador", "A3.2 tipo inexistente",
  "A3.8 sin motivo", "A3.9 local inexistente", "A3.9b local desactivado", "A3.10 terminal de otro local", "A3.12 terminal inactivo", "A3.13 los rechazos no crearon nada",
  "A4.2 creado, versión 1, con sus datos recortados", "A5.1 replay del mismo operation_id", "A5.3 mismo operation_id con otro contenido",
  "A5.5 sin cambio: la versión no sube", "A6.2 versión 2", "A7.1 otro equipo con el mismo nombre en el mismo local", "A7.2 el mismo nombre en otro local sí se admite",
  "A7.4 el identificador de un equipo de otro local no se reutiliza", "A8.1 el tipo no cambia una vez creado", "A9.2 se desactiva el datáfono (no se borra)",
  "A9.5 solo la impresora de cocina", "A9.7 datáfono antes que impresora de cocina", "A10.1 tres altas en el local", "A10.2 cuatro cambios reales",
  "A10.4 la actualización guarda el valor anterior y el nuevo", "A11.3 la tabla rechaza un nombre repetido en el local aunque cambien las mayúsculas",
  "A11.4 la tabla rechaza un terminal de otro local", "A12.1 la tabla no se puede leer directamente", "A12.4 la tabla tiene activada la seguridad por filas",
  "A12.6 por defecto activo y versión 1",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");
assert.doesNotMatch(sinComentarios(live), /delete\s+from/i, "el contrato no borra nada (la herramienta de QA pide confirmación extra con borrados)");
assert.ok(live.includes("-- ==== CHUNK: equipos ===="), "falta el trozo equipos");

console.log("cfg4-static-contract: OK");
