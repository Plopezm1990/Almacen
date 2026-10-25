import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const archivos = [
  path.join(root, "fuente.js"),
  path.join(root, "source-recovery", "fuente-recuperado.js")
];

for (const archivo of archivos) {
  const fuente = fs.readFileSync(archivo, "utf8");
  const nombre = path.basename(archivo);

  assert.match(fuente, /const \[seccionTpv, setSeccionTpv\]/, `${nombre}: falta el estado de panel del TPV`);
  assert.match(fuente, /tpv-section-nav/, `${nombre}: falta la navegación interna del TPV`);
  assert.match(fuente, /role: "tab"/, `${nombre}: los paneles del TPV no son navegables como pestañas`);
  assert.match(fuente, /panelTpv\("caja"/, `${nombre}: falta el panel de caja`);

  for (const [id, funcion] of [
    ["sala", "renderSalaA07"],
    ["reparto", "renderRepartoProductosA08"],
    ["operativo", "renderPedidoOperativoA05"],
    ["descuento", "renderDescuentoCuentaA09"],
    ["cobro", "renderCobroF4"]
  ]) {
    assert.match(fuente, new RegExp(`seccionTpv !== "${id}"`), `${nombre}: falta el selector de ${id}`);
    assert.match(fuente, new RegExp(`function ${funcion}`), `${nombre}: falta el bloque ${funcion}`);
  }

  assert.match(fuente, /\["venta", "Venta"\]/, `${nombre}: falta el panel de venta`);
  assert.match(fuente, /\["caja", "Caja"\]/, `${nombre}: falta el acceso visible a caja`);
  assert.match(fuente, /renderMovimientosCajaTpv\(\)/, `${nombre}: se ha perdido el bloque operativo de caja`);
}

console.log("DOCUMENTO2_FASE2_REHOME_BLOCKS=PASS");
