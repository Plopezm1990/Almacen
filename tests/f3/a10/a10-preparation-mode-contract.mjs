import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20261029190000_abc_f3_a10_preparation_mode.sql", "utf8");
const source = await readFile("fuente.js", "utf8");
const bridge = await readFile("ui-context-bridge.js", "utf8");

assert.match(migration, /add column if not exists requiere_preparacion boolean not null default true/);
assert.match(migration, /create or replace function private\.abc_a10_requiere_preparacion\(/);
assert.match(migration, /coalesce\(\(\s*select c\.requiere_preparacion/);
assert.match(migration, /nullif\(v_item->>'requierePreparacion',''\)/);
assert.match(migration, /nullif\(v_item->>'requiere_preparacion',''\)/);
assert.match(migration, /requiere_preparacion=v_requiere_preparacion/);
assert.equal((migration.match(/abc_a10_requiere_preparacion\(n\.empresa_id,n\.local_id,l\.producto_id\)/g) || []).length, 2);

assert.match(source, /requierePreparacion: true/);
assert.match(source, /requierePreparacion: p22\.requierePreparacion !== false/);
assert.match(source, /Requiere preparación \/ comanda de cocina/);
assert.match(source, /checked: form\.requierePreparacion !== false/);
assert.match(source, /checked: editForm\.requierePreparacion !== false/);

assert.match(bridge, /boolNorm\(p\.requierePreparacion, true\)/);

console.log("a10-preparation-mode-contract: OK");
