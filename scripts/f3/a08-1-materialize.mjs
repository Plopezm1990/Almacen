import fs from "node:fs";

// A08.1: fuente canónica -> runtime publicado de la rama.
const recoveredPath = "source-recovery/fuente-recuperado.js";
const runtimePath = "fuente.js";
const recovered = fs.readFileSync(recoveredPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");
const lines = recovered.split("\n");

if (lines[0] !== "// FUENTE RECUPERADO DESDE EL BUNDLE CANDIDATO DE L&A SUITE.") {
  throw new Error("A08_1_BAD_RECOVERY_HEADER");
}
const body = lines.slice(14).join("\n");
const marker = "var C2 = {";
const first = runtime.indexOf(marker);
const second = runtime.indexOf(marker, first + 1);
if (first < 0 || second >= 0) throw new Error("A08_1_RUNTIME_BOUNDARY_AMBIGUOUS");

fs.writeFileSync(runtimePath, runtime.slice(0, first) + body);
console.log("A08_1_RUNTIME_MATERIALIZED=PASS");
