import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de ABC P3. Comprueba la forma de la migración y su compatibilidad con A03/A04.
// No sustituye a p3-catalogo-contract.sql (que se ejecuta contra una base real con ROLLBACK).
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const mig = await read("supabase/migrations/20261002150000_abc_p3_catalogo_autoritativo.sql");
const a03 = await read("supabase/migrations/20260924010000_abc_f3_a03_server_authority.sql");
const a04 = await read("supabase/migrations/20260924020000_abc_f3_a04_variants_modifiers.sql");
const live = await read("tests/p3/p3-catalogo-contract.sql");
const bridge = await read("ui-context-bridge.js");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);

function cuerpo(texto, nombre) {
  const i = texto.indexOf("function " + nombre + "(");
  assert.ok(i >= 0, "no existe " + nombre);
  const j = texto.indexOf("as $$", i);
  const k = texto.indexOf("end $$;", j);
  return texto.slice(j + 5, k);
}

// 1. Aditiva: una columna nullable, una restricción, ninguna escritura de datos existentes.
assert.match(sql, /alter table public\.catalogo_tpv_productos\s+add column precio_con_impuesto numeric\(24,8\);/);
assert.doesNotMatch(sql, /precio_con_impuesto numeric\(24,8\) not null/i, "la columna debe ser nullable (NULL = semántica anterior)");
assert.match(sql, /add constraint abc_catalogo_precio_con_impuesto check/);
assert.match(sql, /abs\(precio_unitario-round\(precio_con_impuesto\/\(1\+impuesto_pct\/100\),8\)\)<=0\.00000001/);
assert.doesNotMatch(sql, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+(table|column|function)\b/i, "la migración no borra nada");
assert.doesNotMatch(sql, /\bupdate\s+public\.catalogo_tpv_productos\b[\s\S]{0,200}\bwhere\s+true\b/i);

// 2. Con NULL el cálculo A03 y A04 es el de siempre (mismo texto que la migración original).
const nuevo03 = cuerpo(sql, "private.abc_calcular_linea_tpv");
const orig03 = cuerpo(sinComentarios(a03), "private.abc_calcular_linea_tpv");
for (const linea of [
  "v_bruto:=round(v_cantidad*v_catalog.precio_unitario,8);",
  "v_base:=(v_bruto-v_descuento)::numeric(24,8);",
  "v_impuestos:=round(v_base*v_catalog.impuesto_pct/100,8);",
  "v_total:=round(v_base+v_impuestos,8);",
]) {
  assert.ok(orig03.includes(linea) && nuevo03.includes(linea), "A03 conserva la fórmula original: " + linea);
}
assert.match(nuevo03, /if v_catalog\.precio_con_impuesto is null then[\s\S]*else[\s\S]*v_total:=round\(v_cantidad\*v_catalog\.precio_con_impuesto,8\);[\s\S]*v_base:=round\(v_total\/\(1\+v_catalog\.impuesto_pct\/100\),8\);[\s\S]*v_impuestos:=round\(v_total-v_base,8\);/);

const nuevo04 = cuerpo(sql, "private.abc_calcular_linea_tpv_configurada");
const orig04 = cuerpo(sinComentarios(a04), "private.abc_calcular_linea_tpv_configurada");
for (const linea of [
  "v_base_product_base:=round(v_cantidad*v_catalog.precio_unitario,8);",
  "v_base_product_tax:=round(v_base_product_base*v_catalog.impuesto_pct/100,8);",
  "v_base:=round(v_base_product_base+v_option_base,8);",
  "v_impuestos:=round(v_base_product_tax+v_option_tax,8);",
  "v_total:=round(v_base+v_impuestos,8);",
]) {
  assert.ok(orig04.includes(linea) && nuevo04.includes(linea), "A04 conserva la fórmula original: " + linea);
}
assert.match(nuevo04, /v_base_product_total:=round\(v_cantidad\*v_catalog\.precio_con_impuesto,8\);/);
assert.match(nuevo04, /v_base_product_tax:=round\(v_base_product_total-v_base_product_base,8\);/);
// Las opciones conservan su propia base de cálculo (la RPC no las gestiona).
assert.match(nuevo04, /v_component_base:=round\(\s*v_cantidad\*\(v_sel->>'cantidad'\)::integer\*v_opt\.delta_precio,8\s*\);/);

// Mismas firmas y mismos privilegios que las originales (CREATE OR REPLACE conserva los ACL).
assert.match(sql, /create or replace function private\.abc_calcular_linea_tpv\(\s*p_empresa_id text,\s*p_local_id text,\s*p_producto_id text,\s*p_currency_code text,\s*p_cantidad numeric\s*\)/);
assert.match(sql, /create or replace function private\.abc_calcular_linea_tpv_configurada\(/);
assert.doesNotMatch(sql, /create function private\.abc_calcular_linea_tpv/, "no se recrean (se perderían los ACL)");

// 3. RPC: SECURITY DEFINER, search_path vacío, permiso por local, operation_id, solo authenticated.
const rpc = cuerpo(sql, "public.abc_catalogo_guardar_productos");
assert.match(sql, /create function public\.abc_catalogo_guardar_productos\([\s\S]*?security definer\s+set search_path=''/);
assert.match(rpc, /private\.abc_catalogo_puede_gestionar\(p_empresa_id,p_local_id\)/);
assert.match(rpc, /raise exception 'abc_catalogo_no_autorizado'/);
assert.match(rpc, /private\.abc_operacion_iniciar\(\s*p_operation_id,p_empresa_id,p_local_id,'ABC_CATALOGO_GUARDAR_PRODUCTOS',v_request,null\s*\)/);
assert.match(rpc, /private\.abc_operacion_completar\(p_operation_id,v_result\)/);
assert.match(rpc, /for update;/, "bloquea la fila del catálogo antes de comparar");
assert.match(rpc, /order by e->>'id'/, "orden estable para no bloquearse entre sincronizaciones");
assert.match(rpc, /on conflict \(empresa_id,local_id,producto_id\) do nothing/, "el stock inicial nunca pisa el existente");
assert.doesNotMatch(rpc, /update public\.stock_ubicacion/i, "la RPC no modifica el stock vivo");
assert.match(rpc, /v_n>200 then raise exception 'catalogo_productos_demasiados'/);
assert.match(rpc, /catalogo_contexto_fiscal_ausente/);
assert.match(rpc, /catalogo_contexto_fiscal_ambiguo/);
assert.doesNotMatch(rpc, /insert into public\.(entidades_fiscales|entidad_fiscal_locales|entidad_fiscal_monedas)/i, "no inventa contexto fiscal");
// Ausente en el lote no se desactiva; solo lo recibido se toca.
assert.doesNotMatch(rpc, /not in \(select[\s\S]{0,80}jsonb_array_elements\(p_productos\)/i);
// La versión solo sube si algo de venta cambió.
assert.match(rpc, /v_row\.precio_con_impuesto is distinct from round\(v_precio,8\)/);
assert.match(rpc, /version=version\+1, snapshot_origen=v_snapshot/);

assert.match(sql, /revoke all on function public\.abc_catalogo_guardar_productos\(text,text,text,text,jsonb\)\s+from public,anon,authenticated,service_role;/);
assert.match(sql, /grant execute on function public\.abc_catalogo_guardar_productos\(text,text,text,text,jsonb\)\s+to authenticated;/);
const destinatarios = [...sql.matchAll(/grant execute on function [^;]*?\)\s+to\s+([a-z_, ]+);/gi)].map((m) => m[1].trim());
assert.deepEqual(destinatarios, ["authenticated"], "solo authenticated recibe EXECUTE");
assert.match(sql, /revoke all on function private\.abc_catalogo_puede_gestionar\(text,text\)\s+from public,anon,authenticated,service_role;/);
assert.match(sql, /revoke all on function private\.abc_catalogo_numero\(text\)\s+from public,anon,authenticated,service_role;/);

// Permisos: solo Propietario y Encargado, con la misma lógica de membresía que abc_tiene_capacidad.
const permiso = cuerpo(sql, "private.abc_catalogo_puede_gestionar");
assert.match(permiso, /in \('Propietario','Encargado'\)/);
assert.match(permiso, /private\.la_tiene_local\(p_empresa_id,p_local_id\)/);

// Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_P3_PREFLIGHT_FALLO: objetos P3 ya existen/);

// 4. El contrato vivo existe y cubre los casos exigidos por D31 y por el plan.
for (const marca of [
  "1.1 Cajero/a de A1 no puede guardar catálogo",
  "1.4 anon no puede ejecutar la RPC",
  "2.4 base, impuestos y total idénticos a los de antes",
  "2.7 mismo operation_id con otro contenido: conflicto",
  "2.10 las versiones no suben sin cambios reales",
  "3.6 7 x 1,99 con 21 % = total 13,93 exacto",
  "5.1 cuadrícula de",
  "5.2 la restricción rechaza un precio base incoherente",
  "6.3 motivos de omisión correctos",
  "6.12 local sin contexto fiscal (B1)",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");

// 5. El puente vive en un archivo ya publicado (sin ampliar la frontera de publicación).
assert.match(bridge, /abc_catalogo_guardar_productos/);
assert.match(bridge, /window\.__laCatalogoTpvBridgeV1/);

// La comprobación específica de promoción debe poder ejecutarse sin escribir ni
// devolver el contenido de la lista heredada de productos.
const preflight = await read("docs/plan-abc/F7_P3_P3B_PREFLIGHT_SOLO_LECTURA_2026-10-04.sql");
const consultas = preflight.replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''");
const sentencias = consultas.split(";").map((s) => s.trim()).filter(Boolean);
assert.equal(sentencias.length, 9, "se esperan nueve consultas de solo lectura");
for (const sentencia of sentencias) assert.match(sentencia, /^(select|with)\b/i);
assert.doesNotMatch(consultas, /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|copy|call|execute|do|set|lock|begin|commit|rollback)\b/i);
assert.doesNotMatch(consultas, /\bselect\s+(?:\w+\.)?value\b/i, "no se devuelve la lista de productos");
for (const bloque of ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7"]) {
  assert.ok(preflight.includes(`-- ${bloque} ·`), `falta el bloque ${bloque}`);
}

console.log("p3-catalogo-static-contract: OK");
