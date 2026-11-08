import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Contrato estático de la capa de configuración, PIEZA 2 (diferencia de caja: umbral, motivo, aprobación).
// Comprueba la forma de la migración y que no toca nada de C04/C12. No sustituye a cfg2-contract.sql (que se
// ejecuta contra una base real con ROLLBACK). MIGRACION_CFG2 (variable de entorno) permite probar variantes
// rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const pieza1 = await read("supabase/migrations/20261002190000_abc_config_pieza1_dia_cajas.sql");
const c04 = await read("supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql");
const mig = process.env.MIGRACION_CFG2
  ? await readFile(process.env.MIGRACION_CFG2, "utf8")
  : await read("supabase/migrations/20261002210000_abc_config_pieza2_diferencia_caja.sql");
const live = await read("tests/cfg/cfg2-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);
const plano = (t) => t.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("end $$;", i);
  assert.ok(j > i, "no termina la función " + cabecera);
  return texto.slice(i, j + "end $$;".length);
}
const cuerpo = (f) => f.slice(f.indexOf("as $$") + 5, f.lastIndexOf("$$"));
const md5 = (t) => createHash("md5").update(t).digest("hex");

// 1. Solo se reemplazan las dos funciones de la pieza 1 tal y como quedaron (huella del cuerpo comprobada).
for (const f of ["public.abc_configurar_ajuste(", "public.abc_obtener_ajustes("]) {
  const h = md5(cuerpo(funcion(pieza1, "create function " + f)));
  assert.ok(mig.includes(`<> '${h}'`), "el preflight compara con la huella de la pieza 1 de " + f + ": " + h);
}

// 2. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_CFG2_PREFLIGHT_FALLO:%/);
assert.match(mig, /ABC_CFG2_PREFLIGHT_FALLO: abc_configurar_ajuste no coincide con la versión de la pieza 1/);
assert.match(mig, /ABC_CFG2_PREFLIGHT_FALLO: abc_obtener_ajustes no coincide con la versión de la pieza 1/);
assert.match(mig, /ABC_CFG2_PREFLIGHT_FALLO: objetos de la pieza 2 ya existen/);
for (const dep of ["abc_operacion_iniciar", "abc_operacion_completar", "abc_tiene_capacidad", "abc_config_puede_configurar",
  "abc_config_dia_evento", "abc_c04_guard_final_session", "abc_finalizar_cierre_sesion_caja", "caja_conteos", "caja_cierres"])
  assert.ok(mig.includes(`'${dep}`), "el preflight comprueba " + dep);
assert.match(sql, /set local lock_timeout = '10s';/, "falla rápido si no consigue los bloqueos de tabla");

// 3. Ajuste nuevo: clave, rango y decimales (la clave de la pieza 1 se conserva).
assert.match(sql, /add constraint abc_config_ajuste_clave check \(clave in \('cajas_abiertas_max','caja_diferencia_umbral'\)\)/);
assert.match(sql, /when 'cajas_abiertas_max' then[\s\S]*?between 1 and 10[\s\S]*?=trunc\(\(valor#>>'\{\}'\)::numeric\)/);
assert.match(sql, /when 'caja_diferencia_umbral' then[\s\S]*?between 0 and 10000[\s\S]*?=round\(\(valor#>>'\{\}'\)::numeric,2\)/);
assert.match(sql, /else false\s+end\s+\);/, "cualquier otra clave sigue siendo inválida");
assert.equal((sql.match(/alter table/gi) || []).length, 2, "solo dos ALTER TABLE: las restricciones de abc_config_ajustes y la RLS de la tabla nueva");
assert.match(sql, /alter table public\.abc_config_ajustes\s+drop constraint abc_config_ajuste_clave,\s+drop constraint abc_config_ajuste_valor,/);
const umbral = funcion(sql, "create function private.abc_ajuste_caja_umbral(");
assert.match(umbral, /a\.local_id=p_local_id\s+and a\.clave='caja_diferencia_umbral'\),\s+0\s+\)/, "umbral del local y 0 por defecto");
const aj = funcion(sql, "create or replace function public.abc_configurar_ajuste(");
assert.match(aj, /if v_clave not in \('cajas_abiertas_max','caja_diferencia_umbral'\) then raise exception 'ajuste_clave_invalida'; end if;/);
assert.match(aj, /if v_valor<0 or v_valor>10000 or v_valor<>round\(v_valor,2\) then raise exception 'ajuste_valor_fuera_de_rango'; end if;/);
assert.match(aj, /if v_valor<>trunc\(v_valor\) or v_valor<1 or v_valor>10 then raise exception 'ajuste_valor_fuera_de_rango'; end if;/);
assert.match(aj, /if auth\.uid\(\) is null\s+or not private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\) then\s+raise exception 'abc_config_no_autorizado';/);
assert.match(aj, /set valor=v_valor_json, version=version\+1/, "cada cambio real sube la versión");
assert.match(aj, /if v_found and \(v_prev\.valor#>>'\{\}'\)::numeric=v_valor then/, "mismo valor: sin cambio");
assert.equal((aj.match(/insert into public\.abc_eventos/g) || []).length, 1);
const leer = funcion(sql, "create or replace function public.abc_obtener_ajustes(");
assert.match(leer, /jsonb_build_object\('valor',0,'origen','defecto','version',0\)/, "umbral 0 por defecto");
assert.match(leer, /jsonb_build_object\('valor',10,'origen','defecto','version',0\)/, "cajas 10 por defecto (pieza 1)");
assert.match(leer, /or not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\) then\s+raise exception 'abc_config_no_autorizado';/);

// 4. Tabla de diferencias: sin acceso directo y con sus restricciones.
assert.match(sql, /create table public\.caja_cierre_diferencias \(/);
assert.match(sql, /alter table public\.caja_cierre_diferencias enable row level security;/);
assert.match(sql, /revoke all on table public\.caja_cierre_diferencias from public,anon,authenticated,service_role;/);
assert.doesNotMatch(sql, /grant [^;]* on table/i, "ningún permiso de tabla");
assert.doesNotMatch(sql, /create policy/i, "sin políticas: nadie la lee ni escribe directamente");
assert.match(sql, /cierre_id uuid not null references public\.caja_cierres\(id\) on delete restrict/);
assert.match(sql, /constraint abc_cierre_dif_sesion_fk foreign key \(empresa_id,local_id,session_id\)\s+references public\.caja_sesiones\(empresa_id,local_id,id\) on delete restrict/);
assert.match(sql, /constraint abc_cierre_dif_uq unique \(cierre_id\)/);
assert.match(sql, /constraint abc_cierre_dif_importe check \(difference<>0 and umbral_aplicado>=0\)/);
assert.match(sql, /constraint abc_cierre_dif_motivo check \(char_length\(btrim\(motivo\)\) between 1 and 500\)/);
assert.match(sql, /constraint abc_cierre_dif_estado check \(estado in \('REGISTRADA','APROBADA','RECHAZADA'\)\)/);
assert.match(sql, /\(estado='REGISTRADA' and decidido_por is null and decidido_at is null and decision_motivo is null\)\s+or \(estado in \('APROBADA','RECHAZADA'\) and requiere_aprobacion\s+and decidido_por is not null and decidido_at is not null\s+and char_length\(btrim\(coalesce\(decision_motivo,''\)\)\) between 1 and 500\)/,
  "una decisión exige quién, cuándo y motivo");
assert.match(sql, /motivo_por uuid not null references auth\.users\(id\) on delete restrict/);

// 5. Todas las funciones son SECURITY DEFINER con search_path vacío; las públicas solo para authenticated.
const cabeceras = [...sql.matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]);
assert.deepEqual(cabeceras.slice().sort(), [
  "private.abc_ajuste_caja_umbral", "private.abc_cfg2_diferencia_estado", "private.abc_cfg2_guard_diferencia_caja",
  "public.abc_configurar_ajuste", "public.abc_decidir_diferencia_caja", "public.abc_obtener_ajustes",
  "public.abc_obtener_diferencia_caja", "public.abc_registrar_diferencia_caja",
], "la migración crea o reemplaza exactamente estas 8 funciones");
for (const f of cabeceras) {
  const i = sql.search(new RegExp(`create (?:or replace )?function ${f.replace(".", "\\.")}\\(`));
  const cab = sql.slice(i, sql.indexOf("as $$", i));
  assert.match(cab, /security definer/, f + " es SECURITY DEFINER");
  assert.match(cab, /set search_path=''/, f + " fija search_path vacío");
}
assert.doesNotMatch(sql, /search_path\s*=\s*public/i);
const revoca = [...sql.matchAll(/revoke all on function ([a-z_0-9.]+)\(/g)].map((m) => m[1]).sort();
assert.deepEqual(revoca, cabeceras.slice().sort(), "cada función revoca todo a public, anon, authenticated y service_role");
for (const m of sql.matchAll(/revoke all on function [^;]*?;/g))
  assert.match(m[0], /from public,anon,authenticated,service_role;/, "revoca a los cuatro: " + m[0].slice(0, 60));
const concedidas = [...sql.matchAll(/grant execute on function ([a-z_0-9.]+)\([^;]*?\)\s+to\s+([a-z_, ]+);/gi)];
assert.deepEqual(concedidas.map((m) => m[1]).sort(), [
  "public.abc_configurar_ajuste", "public.abc_decidir_diferencia_caja", "public.abc_obtener_ajustes",
  "public.abc_obtener_diferencia_caja", "public.abc_registrar_diferencia_caja",
], "solo las 5 funciones públicas reciben EXECUTE");
for (const m of concedidas) assert.equal(m[2].trim(), "authenticated", "solo authenticated recibe EXECUTE: " + m[1]);

// 6. Alcance: no se toca ninguna función de cierre de C04 ni de C12, ni la apertura de caja, ni los permisos.
for (const prohibido of [
  /create (?:or replace )?function [a-z_.]*abc_(?:iniciar|confirmar|finalizar|reabrir)_cierre/i,
  /create (?:or replace )?function [a-z_.]*abc_c04_/i,
  /create (?:or replace )?function [a-z_.]*abc_c12_/i,
  /create (?:or replace )?function [a-z_.]*abc_abrir_sesion_caja/i,
  /create (?:or replace )?function [a-z_.]*abc_tiene_capacidad/i,
  /create (?:or replace )?function [a-z_.]*abc_descuento/i,
  /create (?:or replace )?function [a-z_.]*la_tiene_local/i,
  /delete\s+from/i, /truncate/i, /drop table/i, /drop function/i,
  /insert\s+into\s+(?!public\.caja_cierre_diferencias|public\.abc_config_ajustes|public\.abc_eventos)/i,
  /update\s+public\.(?!caja_cierre_diferencias|abc_config_ajustes)/i,
])
  assert.doesNotMatch(sql, prohibido, "la migración no debe contener " + prohibido);
assert.equal((sql.match(/create trigger/gi) || []).length, 1, "un único trigger");
assert.match(sql, /create trigger abc_f6_cfg2_guard_diferencia_caja\s+before update of estado on public\.caja_sesiones\s+for each row execute function private\.abc_cfg2_guard_diferencia_caja\(\);/);
assert.equal((sql.match(/create table/gi) || []).length, 1, "una única tabla nueva");

// 7. Guarda: solo en el paso a CERRADA_FINAL desde CIERRE_PROVISIONAL, con los bloqueos del estado.
const guarda = funcion(sql, "create function private.abc_cfg2_guard_diferencia_caja(");
assert.match(guarda, /if new\.estado='CERRADA_FINAL' and old\.estado='CIERRE_PROVISIONAL' then/);
assert.match(guarda, /private\.abc_cfg2_diferencia_estado\(new\.empresa_id,new\.local_id,new\.id\)->'bloqueos'/);
assert.match(guarda, /raise exception 'cierre_definitivo_diferencia_pendiente:%',v_bloq::text;/);

// 8. Estado de la diferencia: mismo cálculo que el cierre de C04 y reglas de bloqueo.
const estado = funcion(sql, "create function private.abc_cfg2_diferencia_estado(");
assert.match(estado, /and c\.estado in \('PROVISIONAL','FINAL'\)\s+order by c\.started_at desc, c\.created_at desc\s+limit 1;/,
  "el cierre vigente incluye FINAL: el guarda corre cuando el cierre ya se marcó FINAL");
const esperadoC04 = plano(funcion(c04, "create function public.abc_finalizar_cierre_sesion_caja(")).match(/v_expected:=round\(coalesce\(\(select sum\(coalesce\(co\.efecto_efectivo,0\)\) from public\.caja_operaciones co where co\.empresa_id=p_empresa_id and co\.local_id=p_local_id and co\.session_id=p_session_id and upper\(coalesce\(co\.currency_code,v_currency\)\)=v_currency\),0\),8\)::numeric\(24,8\);/);
assert.ok(esperadoC04, "C04 calcula el esperado así");
assert.ok(plano(cuerpo(estado)).includes(esperadoC04[0]), "el esperado se calcula exactamente igual que en el cierre de C04");
assert.match(estado, /v_diff:=\(v_counted-v_expected\)::numeric\(24,8\);/);
assert.match(estado, /v_req:=abs\(v_diff\)>v_umbral;/, "se aprueba solo lo que SUPERA el umbral, en valor absoluto");
assert.match(estado, /order by cc\.numero desc\s+limit 1;/, "el último conteo");
for (const b of ["DIFERENCIA_SIN_MOTIVO", "DIFERENCIA_CAMBIADA", "DIFERENCIA_RECHAZADA", "DIFERENCIA_PENDIENTE_APROBACION"])
  assert.ok(estado.includes(`'${b}'`), "falta el bloqueo " + b);
assert.match(estado, /if v_diff<>0 then\s+if not v_found then[\s\S]*?DIFERENCIA_SIN_MOTIVO[\s\S]*?elsif v_reg\.difference<>v_diff then[\s\S]*?DIFERENCIA_CAMBIADA[\s\S]*?elsif v_reg\.estado='RECHAZADA' then[\s\S]*?DIFERENCIA_RECHAZADA[\s\S]*?elsif v_reg\.estado='REGISTRADA' and v_req then[\s\S]*?DIFERENCIA_PENDIENTE_APROBACION/);

// 9. Registrar el motivo: quien opera la caja; motivo obligatorio; solo con cierre provisional y diferencia.
const reg = funcion(sql, "create function public.abc_registrar_diferencia_caja(");
assert.match(reg, /if auth\.uid\(\) is null or not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\) then\s+raise exception 'abc_caja_no_autorizado';/);
for (const e of ["diferencia_caja_parametros_requeridos", "diferencia_caja_motivo_requerido", "diferencia_caja_motivo_invalido",
  "cierre_provisional_no_encontrado", "sesion_no_provisional", "diferencia_caja_inexistente", "diferencia_caja_ya_decidida"])
  assert.ok(reg.includes(`raise exception '${e}'`), "registrar: falta el error " + e);
assert.match(reg, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_REGISTRAR_DIFERENCIA_CAJA',\s*jsonb_build_object\('session_id',p_session_id,'motivo',v_motivo\),null\s*\)/);
assert.match(reg, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/);
assert.match(reg, /if v_found and v_prev\.estado in \('APROBADA','RECHAZADA'\) then raise exception 'diferencia_caja_ya_decidida'; end if;/);
assert.match(reg, /perform private\.abc_operacion_completar\(p_operation_id,v_result\);/);
assert.match(reg, /'CAJA_DIFERENCIA_REGISTRADA'/);
assert.equal((reg.match(/insert into public\.abc_eventos/g) || []).length, 1);
assert.match(reg, /'motivo',v_motivo,/);
// Orden de bloqueo igual que C04 (primero el cierre, luego la sesión): evita interbloqueos con el cierre definitivo.
assert.ok(reg.indexOf("from public.caja_cierres c") < reg.indexOf("from public.caja_sesiones s"), "registrar bloquea primero el cierre y luego la sesión");

// 10. Decidir: solo el Propietario; solo sobre el umbral; una sola vez; nunca sobre una diferencia que cambió.
const dec = funcion(sql, "create function public.abc_decidir_diferencia_caja(");
assert.match(dec, /if auth\.uid\(\) is null or not private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\) then\s+raise exception 'abc_diferencia_caja_no_autorizada';/);
for (const e of ["diferencia_caja_parametros_requeridos", "diferencia_caja_decision_invalida", "diferencia_caja_motivo_requerido",
  "diferencia_caja_motivo_invalido", "cierre_provisional_no_encontrado", "sesion_no_provisional", "diferencia_caja_sin_registro",
  "diferencia_caja_ya_decidida", "diferencia_caja_cambiada", "diferencia_caja_no_requiere_aprobacion"])
  assert.ok(dec.includes(`raise exception '${e}'`), "decidir: falta el error " + e);
assert.match(dec, /if v_decision not in \('APROBAR','RECHAZAR'\) then raise exception 'diferencia_caja_decision_invalida'; end if;/);
assert.match(dec, /if v_reg\.estado<>'REGISTRADA' then raise exception 'diferencia_caja_ya_decidida'; end if;/);
assert.match(dec, /if v_diff is null or v_diff<>v_reg\.difference then raise exception 'diferencia_caja_cambiada'; end if;/);
assert.match(dec, /if not \(abs\(v_diff\)>v_umbral\) then raise exception 'diferencia_caja_no_requiere_aprobacion'; end if;/);
assert.match(dec, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_DECIDIR_DIFERENCIA_CAJA',\s*jsonb_build_object\('session_id',p_session_id,'decision',v_decision,'motivo',v_motivo\),null\s*\)/);
assert.match(dec, /decidido_por=auth\.uid\(\),decidido_at=now\(\),decision_motivo=v_motivo/);
assert.match(dec, /case v_decision when 'APROBAR' then 'CAJA_DIFERENCIA_APROBADA' else 'CAJA_DIFERENCIA_RECHAZADA' end/);
assert.match(dec, /'motivo_diferencia',v_reg\.motivo,\s+'motivo_decision',v_motivo/);
assert.equal((dec.match(/insert into public\.abc_eventos/g) || []).length, 1);
assert.ok(dec.indexOf("from public.caja_cierres c") < dec.indexOf("from public.caja_sesiones s"), "decidir bloquea primero el cierre y luego la sesión");

// 11. Lectura: quien opera la caja del local.
const obt = funcion(sql, "create function public.abc_obtener_diferencia_caja(");
assert.match(obt, /if auth\.uid\(\) is null or not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\) then\s+raise exception 'abc_caja_no_autorizado';/);
assert.match(obt, /private\.abc_cfg2_diferencia_estado\(p_empresa_id,p_local_id,p_session_id\)\s+\|\| jsonb_build_object\('session_estado'/);
assert.match(obt, /s\.empresa_id=p_empresa_id and s\.local_id=p_local_id and s\.id=p_session_id/, "la sesión se busca en el local pedido");

// 12. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "A1.2 umbral 0 por defecto", "A2.1 el Encargado no puede configurar el umbral", "A3.2 umbral por encima de 10000", "A3.3 tres decimales",
  "A5.3 mismo operation_id con otro contenido", "A7.2 valor entero (JSON 4)", "A9.1 la tabla rechaza un umbral de 10001",
  "A10.1 la tabla de diferencias no se puede leer directamente",
  "B2.3 finalizar sin registrar el motivo se rechaza", "B3.1 el Cajero/a registra el motivo", "B4.1 decidir una diferencia dentro del umbral no procede",
  "B6.2 cerrada definitivamente con diferencia -3", "B7.2 con diferencia, esperado, contado, umbral, motivo y actor",
  "C1.3 finalizar sin la aprobación se rechaza", "C2.1 el Encargado no puede decidir", "C2.3 el Propietario de otra empresa no puede decidir",
  "C2.4 anon no puede ejecutar la RPC", "C3.6 no se decide dos veces", "C3.7 ni se cambia el motivo después de decidir", "C5.1 cinta de auditoría",
  "D1.3 RECHAZADA y bloqueado", "D1.4 no se puede finalizar un cierre rechazado", "D2.2 la sesión vuelve a ABIERTA",
  "D2.11 la fila del cierre cancelado se conserva", "E1.2 diferencia +10", "E1.5 ya no requiere aprobación", "E2.5 bloqueo DIFERENCIA_CAMBIADA",
  "E2.7 el propietario no puede aprobar una diferencia que ya cambió", "E3.2 no requiere aprobación y no hay bloqueos", "E4.2 requiere aprobación y queda pendiente",
  "E5.3 requiere aprobación", "F1.1 el paso directo a CERRADA_FINAL", "F1.4 con el motivo pero sin aprobación", "F2.2 de ABIERTA no se pasa a CERRADA_FINAL",
  "F3.1b sin umbral configurado rige el valor por defecto 0", "F3.3 el Propietario de otra empresa no puede leer", "F4.1 el Encargado sin acceso a ese local no puede registrar",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");
for (const chunk of ["ajustes", "flujo_dentro_umbral", "flujo_aprobacion", "rechazo_reapertura", "umbral_y_cambios", "guarda_y_aislamiento"])
  assert.ok(live.includes(`-- ==== CHUNK: ${chunk} ====`), "falta el trozo " + chunk);

console.log("cfg2-static-contract: OK");
