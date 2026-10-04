import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Contrato estático de ABC P3b (espejo de la lista heredada `productos` en almacen_kv).
// Comprueba la forma de la migración y que NO cambia nada de la RPC de P3 salvo lo previsto.
// No sustituye a p3b-espejo-contract.sql (que se ejecuta contra una base real con ROLLBACK).
// MIGRACION_P3B (variable de entorno) permite probar variantes rotas en las comprobaciones de mutantes.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const p3 = await read("supabase/migrations/20261002150000_abc_p3_catalogo_autoritativo.sql");
const mig = process.env.MIGRACION_P3B
  ? await readFile(process.env.MIGRACION_P3B, "utf8")
  : await read("supabase/migrations/20261002170000_abc_p3b_espejo_lista_nube.sql");
const live = await read("tests/p3/p3b-espejo-contract.sql");

const sinComentarios = (t) => t.replace(/--[^\n]*/g, "");
const sql = sinComentarios(mig);

function funcion(texto, cabecera) {
  const i = texto.indexOf(cabecera);
  assert.ok(i >= 0, "no existe " + cabecera);
  const j = texto.indexOf("end $$;", i);
  assert.ok(j > i, "no termina la función");
  return texto.slice(i, j + "end $$;".length);
}

const orig = sinComentarios(funcion(p3, "create function public.abc_catalogo_guardar_productos("));
const nueva = sinComentarios(funcion(mig, "create or replace function public.abc_catalogo_guardar_productos("));

// 1. La función de P3b es la de P3 más cuatro añadidos exactos y nada más.
const AÑADIDOS = [
  // declaraciones
  /  v_espejo jsonb:='\{\}'::jsonb;\n  v_patch jsonb;\n  v_kv jsonb;\n  v_kv_nuevo jsonb;\n  v_lista text;\n/,
  // espejo dentro del bucle
  /    if v_estado is not null and v_estado<>'OMITIDO' then\n      if v_activo then\n[\s\S]*?      v_espejo:=v_espejo\|\|jsonb_build_object\(v_id,v_patch\);\n    end if;\n\n/,
  // espejo posterior al bucle
  /  v_lista:='sin_productos';\n  if v_espejo<>'\{\}'::jsonb then\n[\s\S]*?  end if;\n\n(?=  v_result:=)/,
  // resultado
  /,\n    'lista_nube',v_lista\n/,
];
let sinAñadidos = nueva.replace("create or replace function", "create function");
for (const a of AÑADIDOS) {
  assert.match(sinAñadidos, a, "falta un añadido esperado: " + a);
  sinAñadidos = sinAñadidos.replace(a, a === AÑADIDOS[3] ? "\n" : "");
}
const norm = (t) => t.replace(/[ \t]+\n/g, "\n").replace(/\n+/g, "\n");
assert.equal(norm(sinAñadidos), norm(orig),
  "la RPC de P3b solo difiere de la de P3 en los añadidos del espejo");

// 2. Seguridad de la función (CREATE OR REPLACE conserva permisos, pero se reafirman).
assert.match(sql, /create or replace function public\.abc_catalogo_guardar_productos\(/);
assert.doesNotMatch(sql, /create function public\.abc_catalogo_guardar_productos/, "no se recrea (se perderían los ACL)");
assert.match(nueva, /security definer\s+set search_path=''/);
assert.match(sql, /revoke all on function public\.abc_catalogo_guardar_productos\(text,text,text,text,jsonb\)\s+from public,anon,authenticated,service_role;/);
const destinatarios = [...sql.matchAll(/grant execute on function [^;]*?\)\s+to\s+([a-z_, ]+);/gi)].map((m) => m[1].trim());
assert.deepEqual(destinatarios, ["authenticated"], "solo authenticated recibe EXECUTE");

// 3. El espejo toca solo lo previsto en almacen_kv.
assert.equal((sql.match(/public\.almacen_kv/g) || []).length, 2, "solo se nombra almacen_kv en el select con bloqueo y en el update");
assert.doesNotMatch(sql, /insert\s+into\s+public\.almacen_kv/i, "no crea filas en almacen_kv");
assert.doesNotMatch(sql, /delete\s+from\s+public\.almacen_kv/i, "no borra filas de almacen_kv");
assert.match(nueva, /update public\.almacen_kv set value=v_kv_nuevo, updated_at=now\(\) where key='productos';/);
assert.equal((nueva.match(/update public\.almacen_kv/g) || []).length, 1, "un único update sobre almacen_kv");
assert.match(nueva, /where k\.key='productos' and k\.empresa_id=p_empresa_id and jsonb_typeof\(k\.value\)='array'\s+for update;/,
  "fila de la empresa de la llamada, solo si es una lista, con bloqueo de fila");
assert.match(nueva, /coalesce\(nullif\(btrim\(coalesce\(t\.e->>'localId',''\)\),''\),p_local_id\)=p_local_id/, "solo elementos del local de la llamada");
assert.match(nueva, /if v_kv_nuevo is distinct from v_kv then/, "no reescribe la fila si no cambia nada");
assert.match(nueva, /order by t\.ord\),'\[\]'::jsonb\)/, "conserva el orden de los elementos");
assert.match(nueva, /'lista_nube',v_lista/);

// Solo campos de venta: ninguna otra clave se escribe en la lista de la nube.
const claves = new Set();
for (const bloque of nueva.matchAll(/v_patch:=[\s\S]*?;\n/g)) {
  for (const k of bloque[0].matchAll(/'([A-Za-z]+)'\s*,/g)) claves.add(k[1]);
}
assert.deepEqual([...claves].sort(), ["activo", "fraccionable", "ivaVenta", "nombre", "precioVenta", "precisionCantidad", "unidad"].sort(),
  "el espejo solo escribe campos de venta (nunca stock, coste, código…)");

// 4. Preflight y rechazo de doble aplicación.
assert.match(mig, /ABC_P3B_PREFLIGHT_FALLO: falta abc_catalogo_guardar_productos/);
assert.match(mig, /ABC_P3B_PREFLIGHT_FALLO: P3b ya aplicada/);
assert.match(mig, /like '%lista_nube%'/);
// Efecto colateral conocido, documentado.
assert.match(mig, /pm07_bootstrap_stock_desde_productos_kv/);

// 5. El contrato vivo existe y cubre los casos exigidos.
for (const marca of [
  "1.1 Cajero/a de A1 no puede",
  "1.4 anon no puede ejecutar la RPC",
  "2.2 catálogo sin cambios y lista de la nube actualizada",
  "2.3 la lista de la nube muestra 1,00 como número",
  "2.4 los otros 29 elementos quedan idénticos",
  "2.12 la fecha de la fila no se mueve sin cambios",
  "3.3 el servidor cobra 3 x 1,50 = 4,50",
  "3.18 catálogo CREADO; la lista de la nube sigue con 30 elementos",
  "3.20 OMITIDO local_distinto",
  "3.25c la lectura con RLS devuelve 1,1",
  "3.26 el stock existente de la base de datos no cambió",
  "4.2 lista_nube = sin_fila",
  "4.4 lista_nube = sin_fila y la fila queda como estaba",
]) assert.ok(live.includes(marca), "falta el caso vivo: " + marca);
assert.match(live, /rollback/i, "el contrato vivo documenta que se ejecuta con ROLLBACK");

console.log("p3b-espejo-static-contract: OK");
