import fs from "node:fs";

const requiredFiles = ["fuente.js", "source-recovery/fuente-recuperado.js"];

for (const file of requiredFiles) {
  const source = fs.readFileSync(file, "utf8");
  const venta = source.indexOf("function VentaRapida(");
  if (venta < 0) throw new Error(`ETAPA6_PUENTE_SCOPE_FAIL: falta VentaRapida en ${file}`);

  const prefix = source.slice(0, venta);
  const helper = prefix.lastIndexOf("function leerConfigPuenteLA()");
  if (helper < 0) throw new Error(`ETAPA6_PUENTE_SCOPE_FAIL: falta helper global en ${file}`);
  if (source.slice(venta).includes("const [puenteLAConfig, setPuenteLAConfig] = (0, import_react4.useState)(() => leerConfigPuenteLA());") === false) {
    throw new Error(`ETAPA6_PUENTE_SCOPE_FAIL: VentaRapida no usa el helper esperado en ${file}`);
  }
}

console.log("ETAPA6_PUENTE_SCOPE_CONTRACT=PASS");
