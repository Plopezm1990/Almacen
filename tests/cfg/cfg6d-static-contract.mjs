import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de la capa de configuración, PIEZA 6d (parte de servidor: día operativo del cierre de caja).
// Comprueba la forma de la migración y que no toca nada existente. No sustituye a cfg6d-contract.sql (que se
// ejecuta contra una base real con ROLLBACK). MIGRACION_CFG6D (variable de entorno) permite probar variantes
// rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const mig = process.env.MIGRACION_CFG6D
  ? await readFile(process.env.MIGRACION_CFG6D, "utf8")
  : await read("supabase/migrations/20261002250000_abc_config_pieza6d_dia_operativo.sql");
const live = await read("tests/cfg/cfg6d-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);

function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("$$;", texto.indexOf("as $$", i));
  assert.ok(j > i, "no termina la función " + cabecera);
  return texto.slice(i, j + 3);
}

// 1. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_CFG6D_PREFLIGHT_FALLO:%/);
assert.match(mig, /ABC_CFG6D_PREFLIGHT_FALLO: objetos de la pieza 6d ya existen/);
for (const dep of ["locales", "abc_tiene_capacidad", "abc_config_dia_evento", "auth.uid"])
  assert.ok(mig.includes(`'${dep}`), "el preflight comprueba " + dep);
assert.match(mig, /to_regprocedure\('private\.abc_tiene_capacidad\(text,text,text\)'\) is null/);
assert.match(mig, /to_regprocedure\('private\.abc_config_dia_evento\(text,text\)'\) is null/);
assert.match(mig, /if cardinality\(v_missing\)>0 then\s+raise exception 'ABC_CFG6D_PREFLIGHT_FALLO:%',array_to_string\(v_missing,','\);/);
assert.match(mig, /if to_regprocedure\('public\.abc_obtener_dia_operativo_local\(text,text\)'\) is not null then\s+raise exception 'ABC_CFG6D_PREFLIGHT_FALLO: objetos de la pieza 6d ya existen';/,
  "una segunda aplicación se rechaza");
assert.match(sql, /set local lock_timeout = '10s';/);

// 2. Exactamente una función nueva; ninguna existente se reemplaza; ninguna tabla, trigger ni política.
const cabeceras = [...sql.matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\(/g)].map((m) => m[1]);
assert.deepEqual(cabeceras, ["public.abc_obtener_dia_operativo_local"], "la migración crea exactamente esta función");
assert.doesNotMatch(sql, /create or replace function/i, "no se reemplaza ninguna función existente");
for (const prohibido of [
  /create table/i, /alter table/i, /create (?:unique )?index/i, /create policy/i, /create trigger/i, /drop /i,
  /delete\s+from/i, /truncate/i, /insert\s+into/i, /update\s+[a-z_.]+\s+set/i,
])
  assert.doesNotMatch(sql, prohibido, "la migración es solo una lectura nueva; no debe contener " + prohibido);

// 3. La función: solo lectura, SECURITY DEFINER, search_path vacío, devuelve jsonb.
const f = funcion(sql, "create function public.abc_obtener_dia_operativo_local(");
const cab = f.slice(0, f.indexOf("as $$"));
assert.match(cab, /p_empresa_id text,\s+p_local_id text\s*\)/, "firma: (empresa, local)");
assert.match(cab, /returns jsonb/);
assert.match(cab, /language plpgsql/);
assert.match(cab, /\bstable\b/, "solo lectura");
assert.doesNotMatch(cab, /\bvolatile\b/);
assert.match(cab, /security definer/);
assert.match(cab, /set search_path=''/);

// 4. Autorización: quien opera la caja; nunca NULL; antes de revelar si el local existe.
assert.match(f, /if auth\.uid\(\) is null\s+or nullif\(btrim\(coalesce\(p_empresa_id,''\)\),''\) is null\s+or nullif\(btrim\(coalesce\(p_local_id,''\)\),''\) is null\s+or not coalesce\(private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\),false\) then\s+raise exception 'abc_caja_no_autorizado';/);
assert.match(f, /where l\.empresa_id=p_empresa_id and l\.id=p_local_id and l\.activo\s+\) then\s+raise exception 'dia_operativo_local_no_disponible';/,
  "el local existe, es de la empresa y está activo");
assert.ok(f.indexOf("abc_caja_no_autorizado") < f.indexOf("dia_operativo_local_no_disponible"),
  "primero la autorización: quien no la tiene no averigua si el local existe");
assert.equal((sql.match(/abc_tiene_capacidad\(/g) || []).length, 2, "una comprobación de capacidad en la función y otra en el preflight");

// 5. El día sale SOLO del cálculo del servidor que ya usan los eventos de configuración.
assert.match(f, /return jsonb_build_object\(\s+'ok',true,\s+'operating_day',private\.abc_config_dia_evento\(p_empresa_id,p_local_id\)\s+\);/);
assert.doesNotMatch(f, /current_date|current_timestamp|now\(\)|clock_timestamp|statement_timestamp/i, "el día no se calcula aquí con el reloj");
assert.doesNotMatch(f, /perform|pg_advisory|set_config/i, "sin efectos");

// 6. ACL: solo authenticated.
assert.match(sql, /revoke all on function public\.abc_obtener_dia_operativo_local\(text,text\)\s+from public,anon,authenticated,service_role;/);
const concedidas = [...sql.matchAll(/grant execute on function ([a-z_0-9.]+)\(([^)]*)\)\s+to\s+([a-z_, ]+);/gi)];
assert.equal(concedidas.length, 1, "una única concesión");
assert.equal(concedidas[0][1], "public.abc_obtener_dia_operativo_local");
assert.equal(concedidas[0][3].trim(), "authenticated", "solo authenticated recibe EXECUTE");
assert.equal((sql.match(/\bgrant\b/gi) || []).length, 1, "no hay más concesiones");

// 7. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "A1.1 el Propietario puede leer el día operativo", "A1.2 el Encargado del local puede", "A1.3 el Cajero/a del local puede",
  "A1.4 quien es Camarero/a en el local no opera la caja y no puede", "A1.5 el Propietario de otra empresa no puede", "A1.6 el Encargado sin acceso a ese local no puede",
  "A1.7 anon no puede ejecutar la función", "A1.8 service_role no puede ejecutar la función", "A1.9 authenticated sin sesión (sin sub) no puede",
  "A1.10 empresa vacía", "A1.11 local vacío", "A1.12 local inexistente", "A1.12b local inexistente: un Encargado simplemente no está autorizado", "A1.12c local desactivado",
  "A1.14 el local de otra empresa pedido con la empresa propia",
  "B1.2 el día es el de hace 12 horas en Madrid", "B2.2 el día es la fecha de hoy en Madrid", "B3.2 usa la zona de la regla, no una fija",
  "B4.2 cae al día de Madrid", "B8.2 el día operativo es el anterior a la fecha de hoy en Madrid", "B8.4 usa la fecha de esa zona", "B8.6 usa la fecha de esa zona", "B8.7 a esta hora al menos una de las dos zonas", "B5.1 coincide con private.abc_config_dia_evento (corte 12:00)", "B5.2 coincide con private.abc_config_dia_evento (otra zona)",
  "B6.2 solo ok y operating_day", "B7.3 las dos llamadas dan lo mismo", "B7.4 no escribe eventos, operaciones ni ajustes", "B7.5 la función es de solo lectura (STABLE)",
  "C1.2 el Cajero/a ya no puede leer el día en CFG-LB", "C1.3 el Encargado sigue pudiendo en CFG-LB", "C1.4 en otro local (CFG-LA) el Cajero/a sigue pudiendo",
  "C2.2 el Cajero/a vuelve a poder", "C3.2 el Encargado ya no puede", "C3.3 el Propietario siempre puede",
  "D1.1 es SECURITY DEFINER con search_path vacío", "D1.2 solo authenticated puede ejecutarla",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");
assert.doesNotMatch(sinComentarios(live), /delete\s+from/i, "el contrato no borra nada (la herramienta de QA pide confirmación extra con borrados)");
for (const chunk of ["permisos", "calculo", "capacidades", "acl"]) assert.ok(live.includes(`-- ==== CHUNK: ${chunk} ====`), "falta el trozo " + chunk);

console.log("cfg6d-static-contract: OK");
