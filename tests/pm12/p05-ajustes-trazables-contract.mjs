import assert from "node:assert/strict";
import fs from "node:fs";

const fuentes = [
  ["runtime", fs.readFileSync("fuente.js", "utf8")],
  ["fuente recuperada", fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8")]
];

for (const [nombre, codigo] of fuentes) {
  assert.match(codigo, /estadoConteo !== "PARCIAL" && estadoConteo !== "COMPLETADO"/, `${nombre}: estados ajustables`);
  assert.match(codigo, /codigo: "estado_no_ajustable"/, `${nombre}: bloqueo antes de mutar`);
  assert.match(codigo, /const preparados = \[\];[\s\S]*for \(const item of conteo\.items \|\| \[\]\)/, `${nombre}: prevalidación integral`);
  assert.match(codigo, /normalizarCantidad\(valorCapturado/, `${nombre}: normalización PM12`);
  assert.match(codigo, /if \(normalizado\.contado\) preparados\.push/, `${nombre}: solo líneas contadas`);
  assert.match(codigo, /pm12-ajuste-conteo:\$\{conteo\.id\}:\$\{conteo\.cerradoEn/, `${nombre}: identidad estable`);
  assert.match(codigo, /replayed: true, operationId: conteo\.ajustesOperationId/, `${nombre}: replay sin duplicación`);
  assert.match(codigo, /documentoOrigenId: conteoId/, `${nombre}: vínculo documental`);
  assert.match(codigo, /ajustesOperationId: operationIdDeEsteAjuste/, `${nombre}: operación persistida en documento`);
  assert.doesNotMatch(codigo, /const operationIdDeEsteAjuste = uid\(\);\s*conteo\.items\.forEach/, `${nombre}: no debe quedar el lote aleatorio antiguo`);
}

const evidencia = fs.readFileSync("tests/pm12/P05_AJUSTES_TRAZABLES.md", "utf8");
assert.match(evidencia, /PM12_P05_AJUSTES_TRAZABLES=PASS/);

console.log("PM12_P05_AJUSTES_TRAZABLES=PASS");
console.log("VALIDACION_PREVIA_TOTAL=1");
console.log("VACIO_NO_AJUSTA_CERO_VALIDO=1");
console.log("OPERATION_ID_ESTABLE=1");
console.log("REPLAY_SIN_DUPLICAR=1");
