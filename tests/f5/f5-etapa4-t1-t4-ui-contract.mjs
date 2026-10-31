import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const fuentes = [
  ["fuente.js", await readFile(new URL("fuente.js", root), "utf8")],
  ["source-recovery/fuente-recuperado.js", await readFile(new URL("source-recovery/fuente-recuperado.js", root), "utf8")]
];

for (const [nombre, source] of fuentes) {
  assert.match(source, /tpv-shell/, `${nombre}: el TPV tiene contenedor propio`);
  assert.match(source, /tpv-toolbar/, `${nombre}: barra superior del TPV`);
  assert.match(source, /"Zona"/, `${nombre}: muestra la zona`);
  assert.match(source, /"Tarifa"/, `${nombre}: muestra la tarifa`);
  assert.match(source, /tpv-keybar/, `${nombre}: barra de teclas de función`);
  assert.match(source, /"F2 Buscar"/);
  assert.match(source, /"F4 Vaciar"/);
  assert.match(source, /"F9 Guardar"/);
  assert.match(source, /tpv-product-zone/);
  assert.match(source, /tpv-ticket-zone/);
  assert.doesNotMatch(source, /A02\/A04 guardan la cuenta y el pedido/);
  assert.doesNotMatch(source, /No registra cobro, tique fiscal ni movimiento de stock/);

  // T2: catálogo visual, destacados, agotados y cantidades rápidas.
  assert.match(source, /fotoProducto/);
  assert.match(source, /Más vendido/);
  assert.match(source, /sin stock/);
  assert.match(source, /agregarCantidadRapidaA04/);
  assert.match(source, /"×" \+ cantidad/);

  // T3/T4: la base existente de opciones y cocina sigue cableada.
  assert.match(source, /function confirmarConfiguracionA04\(\)/);
  assert.match(source, /function CocinaA10\(/);
  assert.match(source, /comandas/);
  assert.match(source, /configuracionA04/);
  assert.match(source, /Nota para cocina/);
  assert.match(source, /Alérgenos del producto/);
  assert.match(source, /abc_actualizar_nota_linea/);
}

console.log("F5 Etapa 4 T1-T4 UI: contrato OK");
