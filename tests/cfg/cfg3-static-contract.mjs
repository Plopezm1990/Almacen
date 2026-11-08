import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de la capa de configuración, PIEZA 3 (modalidades de cuenta habilitadas por local).
// Comprueba la forma de la migración y que no toca nada existente. No sustituye a cfg3-contract.sql (que se
// ejecuta contra una base real con ROLLBACK). MIGRACION_CFG3 (variable de entorno) permite probar variantes
// rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const m02a = await read("supabase/migrations/20260923220000_abc_f2_m02a_core_comercial_fiscal.sql");
const mig = process.env.MIGRACION_CFG3
  ? await readFile(process.env.MIGRACION_CFG3, "utf8")
  : await read("supabase/migrations/20261002220000_abc_config_pieza3_modalidades.sql");
const live = await read("tests/cfg/cfg3-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);

function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("$$;", texto.indexOf("as $$", i));
  assert.ok(j > i, "no termina la función " + cabecera);
  return texto.slice(i, j + 3);
}

// 1. Las modalidades son exactamente las que admite la tabla de cuentas (y en el mismo orden en toda la migración).
const lista = /\('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO'\)/;
assert.match(m02a, /modalidad in \('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO'\)/, "la tabla de cuentas admite estas cinco");
assert.match(sql, /constraint abc_local_modalidad_valor check \(modalidad in \('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO'\)\)/);
assert.equal((sql.match(/array\['BARRA','MESA','TERRAZA','TAKEAWAY','OTRO'\]/g) || []).length, 3, "la lista ordenada aparece en las tres funciones que la recorren");
assert.match(funcion(sql, "create function public.abc_configurar_modalidad_local("), /v_modalidad not in \('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO'\)/);

// 2. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_CFG3_PREFLIGHT_FALLO:%/);
assert.match(mig, /ABC_CFG3_PREFLIGHT_FALLO: objetos de la pieza 3 ya existen/);
for (const dep of ["abc_operacion_iniciar", "abc_operacion_completar", "la_tiene_local", "abc_config_puede_configurar", "abc_config_dia_evento", "abc_abrir_cuenta", "cuentas_comerciales", "abc_eventos"])
  assert.ok(mig.includes(`'${dep}`), "el preflight comprueba " + dep);
assert.match(sql, /set local lock_timeout = '10s';/, "falla rápido si no consigue los bloqueos de tabla");

// 3. Tabla: sin acceso directo y con sus restricciones.
assert.match(sql, /create table public\.abc_local_modalidades \(/);
assert.match(sql, /alter table public\.abc_local_modalidades enable row level security;/);
assert.match(sql, /revoke all on table public\.abc_local_modalidades from public,anon,authenticated,service_role;/);
assert.doesNotMatch(sql, /grant [^;]* on table/i, "ningún permiso de tabla");
assert.doesNotMatch(sql, /create policy/i, "sin políticas: nadie la lee ni escribe directamente");
assert.match(sql, /constraint abc_local_modalidad_local_fk foreign key \(empresa_id,local_id\)\s+references public\.locales\(empresa_id,id\) on delete restrict/);
assert.match(sql, /habilitada boolean not null,/, "sin valor por defecto: cada fila es una decisión explícita");
assert.match(sql, /constraint abc_local_modalidad_motivo check \(nullif\(btrim\(motivo\),''\) is not null\)/);
assert.match(sql, /constraint abc_local_modalidad_uq unique \(empresa_id,local_id,modalidad\)/);
assert.equal((sql.match(/create table/gi) || []).length, 1, "una única tabla nueva");
assert.equal((sql.match(/alter table/gi) || []).length, 1, "un único ALTER TABLE (activar RLS en la tabla nueva)");

// 4. Todas las funciones son SECURITY DEFINER con search_path vacío; las públicas solo para authenticated.
const cabeceras = [...sql.matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]);
assert.deepEqual(cabeceras.slice().sort(), [
  "private.abc_modalidad_guard_cuenta", "private.abc_modalidad_habilitada", "private.abc_modalidades_habilitadas",
  "public.abc_configurar_modalidad_local", "public.abc_obtener_modalidades_local",
], "la migración crea exactamente estas 5 funciones (ninguna existente se reemplaza)");
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
assert.deepEqual(concedidas.map((m) => m[1]).sort(), ["public.abc_configurar_modalidad_local", "public.abc_obtener_modalidades_local"],
  "solo las 2 funciones públicas reciben EXECUTE");
for (const m of concedidas) assert.equal(m[2].trim(), "authenticated", "solo authenticated recibe EXECUTE: " + m[1]);

// 5. Sin fila, la modalidad está habilitada (el comportamiento de hoy no cambia hasta que un propietario decide).
const hab = funcion(sql, "create function private.abc_modalidad_habilitada(");
assert.match(hab, /m\.modalidad=p_modalidad\),\s+true\s+\)/, "habilitada por defecto");
assert.match(hab, /m\.empresa_id=p_empresa_id\s+and m\.local_id=p_local_id/, "la decisión es del local de la empresa");
const habs = funcion(sql, "create function private.abc_modalidades_habilitadas(");
assert.match(habs, /jsonb_agg\(t\.m order by t\.ord\)/, "en el orden fijo");
assert.match(habs, /where private\.abc_modalidad_habilitada\(p_empresa_id,p_local_id,t\.m\)/);

// 6. Configuración: solo el Propietario, idempotente, con motivo, mínimo una y auditoría.
const cfg = funcion(sql, "create function public.abc_configurar_modalidad_local(");
assert.match(cfg, /if auth\.uid\(\) is null\s+or not private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\) then\s+raise exception 'abc_config_no_autorizado';/);
for (const e of ["modalidad_invalida", "modalidad_estado_requerido", "modalidad_motivo_requerido", "modalidad_local_no_disponible", "modalidades_minimo_una"])
  assert.ok(cfg.includes(`raise exception '${e}'`), "falta el error " + e);
assert.match(cfg, /v_modalidad text:=upper\(btrim\(coalesce\(p_modalidad,''\)\)\);/);
assert.match(cfg, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_MODALIDAD_LOCAL',v_request,null\s*\)/);
assert.match(cfg, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/);
assert.match(cfg, /perform pg_advisory_xact_lock\(hashtext\('abc_modalidades:'/);
assert.match(cfg, /v_cambio:=v_antes<>p_habilitada;/, "sin cambio real no hay versión ni evento");
assert.match(cfg, /v_antes:=case when v_found then v_prev\.habilitada else true end;/, "sin fila cuenta como habilitada");
assert.match(cfg, /if not p_habilitada then\s+select count\(\*\) into v_restantes[\s\S]*?t\.m<>v_modalidad\s+and private\.abc_modalidad_habilitada\(p_empresa_id,p_local_id,t\.m\);\s+if v_restantes=0 then raise exception 'modalidades_minimo_una'; end if;/,
  "siempre queda al menos una modalidad habilitada");
assert.match(cfg, /set habilitada=p_habilitada, version=version\+1, motivo=v_motivo/);
assert.match(cfg, /c\.modalidad=v_modalidad and c\.estado='ABIERTA'/, "informa de las cuentas abiertas en esa modalidad");
assert.equal((cfg.match(/insert into public\.abc_eventos/g) || []).length, 1, "un único evento, solo en el cambio real");
assert.match(cfg, /'MODALIDAD_LOCAL_CONFIGURADA'/);
assert.match(cfg, /'anterior',v_antes,\s+'nuevo',p_habilitada,\s+'version',v_version,\s+'motivo',v_motivo,\s+'cuentas_abiertas',v_abiertas/);
assert.match(cfg, /perform private\.abc_operacion_completar\(p_operation_id,v_result\);/);
assert.doesNotMatch(cfg, /update public\.cuentas_comerciales|delete\s+from/i, "deshabilitar no toca las cuentas abiertas");

// 7. Lectura: cualquier miembro del local; nunca NULL en la comprobación de acceso.
const leer = funcion(sql, "create function public.abc_obtener_modalidades_local(");
assert.match(leer, /or not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.match(leer, /'origen',case when r\.id is null then 'defecto' else 'local' end/);
assert.match(leer, /'habilitada',coalesce\(r\.habilitada,true\)/);
assert.equal((sql.match(/la_tiene_local\(/g) || []).length, (sql.match(/coalesce\(private\.la_tiene_local\(/g) || []).length + 1,
  "toda llamada a la_tiene_local va dentro de coalesce(…,false) (salvo la del preflight)");

// 8. Guarda: altas y cambios de modalidad; nunca otras actualizaciones.
const guarda = funcion(sql, "create function private.abc_modalidad_guard_cuenta(");
assert.match(guarda, /if tg_op='INSERT' or new\.modalidad is distinct from old\.modalidad then/);
assert.match(guarda, /if not private\.abc_modalidad_habilitada\(new\.empresa_id,new\.local_id,new\.modalidad\) then\s+raise exception 'modalidad_no_habilitada:%',new\.modalidad;/);
assert.equal((sql.match(/create trigger/gi) || []).length, 1, "un único trigger");
assert.match(sql, /create trigger abc_f6_cfg3_guard_modalidad_cuenta\s+before insert or update of modalidad on public\.cuentas_comerciales\s+for each row execute function private\.abc_modalidad_guard_cuenta\(\);/);
assert.doesNotMatch(sql, /drop trigger/i, "no se borra ningún trigger");

// 9. Alcance: no se toca la apertura de cuentas, la sala, los permisos ni las cuentas.
for (const prohibido of [
  /create (?:or replace )?function [a-z_.]*abc_abrir_cuenta/i,
  /create (?:or replace )?function [a-z_.]*abc_asignar_cuenta_mesa/i,
  /create (?:or replace )?function [a-z_.]*abc_mover_cuenta_mesa/i,
  /create (?:or replace )?function [a-z_.]*abc_tiene_capacidad/i,
  /delete\s+from/i, /truncate/i, /drop table/i, /drop function/i,
  /insert\s+into\s+(?!public\.abc_local_modalidades|public\.abc_eventos)/i,
  /update\s+public\.(?!abc_local_modalidades)/i,
])
  assert.doesNotMatch(sql, prohibido, "la migración no debe contener " + prohibido);

// 10. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "A1.2 las cinco modalidades habilitadas por defecto", "A1.3 el Propietario de otra empresa no puede leer", "A2.1 el Encargado no puede configurar",
  "A2.3 el Propietario de otra empresa no puede", "A2.4 anon no puede", "A2.5 service_role no puede", "A3.1 modalidad inexistente",
  "A3.3 sin motivo", "A3.4 local inexistente", "A4.2 cambio, versión 1, TERRAZA deshabilitada", "A5.3 mismo operation_id con otro contenido",
  "A5.5 sin cambio: la versión no sube", "A5.7 sin cambio y sin crear fila", "A6.2 versión 2", "A7.6 no se puede deshabilitar la última",
  "A8.1 ocho cambios reales dejaron ocho eventos", "A9.3 la tabla rechaza una decisión duplicada", "A10.1 la tabla no se puede leer directamente",
  "A11.2 las cinco habilitadas", "B1.2 abierta en BARRA", "B2.2 una cuenta nueva en MESA se rechaza", "B2.3 no quedó ninguna cuenta ni operación a medias",
  "B3.3 la cuenta abierta en BARRA no se toca", "B3.5 incluso reescribiendo la misma modalidad", "B3.6 la repetición idempotente",
  "B3.8 una cuenta nueva en BARRA se rechaza", "B4.1 cambiar la modalidad de una cuenta existente", "B4.5 un alta directa en una modalidad deshabilitada",
  "B5.2 ahora una cuenta en MESA se abre", "B6.1 otro local de la misma empresa no se ve afectado",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");
assert.doesNotMatch(sinComentarios(live), /delete\s+from/i, "el contrato no borra nada (la herramienta de QA pide confirmación extra con borrados)");
for (const chunk of ["config", "guarda"])
  assert.ok(live.includes(`-- ==== CHUNK: ${chunk} ====`), "falta el trozo " + chunk);

console.log("cfg3-static-contract: OK");
