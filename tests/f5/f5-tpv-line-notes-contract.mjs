import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const migration = await readFile(new URL("supabase/migrations/20261022130000_abc_f5_tpv_line_notes.sql", root), "utf8");
const fuentes = [
  ["fuente.js", await readFile(new URL("fuente.js", root), "utf8")],
  ["source-recovery/fuente-recuperado.js", await readFile(new URL("source-recovery/fuente-recuperado.js", root), "utf8")]
];

assert.match(migration, /add column if not exists nota text not null default ''/);
assert.match(migration, /abc_actualizar_nota_linea/);
assert.match(migration, /abc_f5_copiar_nota_comanda/);
assert.match(migration, /abc_f5_comanda_linea_copia_nota/);
assert.match(migration, /char_length\(nota\) <= 500/);
for (const [nombre, source] of fuentes) {
  assert.match(source, /nota: String\(l22\.nota \|\| ""\)\.trim\(\)\.slice\(0, 500\)/, `${nombre}: la nota se normaliza`);
  assert.match(source, /abc_actualizar_nota_linea/, `${nombre}: la nota usa RPC idempotente`);
  assert.match(source, /Nota para cocina/, `${nombre}: existe control visible de nota`);
}

console.log("F5 notas TPV: contrato OK");
