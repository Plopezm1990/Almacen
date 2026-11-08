import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// El ticket que sale al cobrar imprimia el IVA a cero. El servidor manda la
// linea del pedido con `base` e `impuestos` (importes) y sin porcentaje; el
// ticket buscaba el porcentaje bajo `ivaVentaAplicado`, `iva` o `iva_pct`,
// ninguno de los cuales existe, y caia a 0. Ademas tomaba `total / cantidad`
// como importe neto, con lo que el subtotal salia con el bruto.
//
// La misma venta reimpresa desde el historial salia bien, porque ese camino
// si despeja el porcentaje desde impuestos/base. Aqui se exige que los dos
// caminos coincidan.

const ficheros = ["../../fuente.js", "../../source-recovery/fuente-recuperado.js"];

for (const rel of ficheros) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

  test(`${rel}: ya no se cae silenciosamente a 0 % de IVA`, () => {
    assert.ok(
      !src.includes("Number(linea.ivaVentaAplicado ?? linea.iva ?? linea.iva_pct) || 0"),
      "la caida a 0 con `|| 0` debe haber desaparecido de los dos mapeos del ticket",
    );
  });

  test(`${rel}: existe el despeje desde importes`, () => {
    assert.match(src, /function ivaTicketDesdeImportes\(pctDeclarado, base, impuestos, pctProducto\)/);
    assert.match(src, /return Math\.round\(impuestos \/ base \* 1e4\) \/ 100;/);
  });

  test(`${rel}: el ayudante vive dentro de VentaRapida`, () => {
    const inicioComponente = src.indexOf("function VentaRapida(");
    const ayudante = src.indexOf("function ivaTicketDesdeImportes(");
    const usoC07D = src.indexOf("const ivaLinea = ivaTicketDesdeImportes(");
    const usoRapida = src.indexOf("const ivaLineaRapida = ivaTicketDesdeImportes(");
    assert.ok(inicioComponente > 0, "VentaRapida debe existir");
    for (const [nombre, pos] of [["ayudante", ayudante], ["uso C07D", usoC07D], ["uso venta rapida", usoRapida]]) {
      assert.ok(pos > inicioComponente, `${nombre} debe estar dentro de VentaRapida, no antes`);
    }
  });
}

// Replica exacta de la logica que quedo en el cliente.
function ivaTicketDesdeImportes(pctDeclarado, base, impuestos, pctProducto) {
  if (Number.isFinite(pctDeclarado) && pctDeclarado >= 0) return pctDeclarado;
  if (Number.isFinite(base) && base > 0 && Number.isFinite(impuestos)) {
    return Math.round(impuestos / base * 1e4) / 100;
  }
  if (Number.isFinite(pctProducto) && pctProducto >= 0) return pctProducto;
  return 0;
}

// Replica de desgloseIvaTicketVista.
function desglose(lineas) {
  const mapa = new Map();
  for (const l of lineas) {
    const base = Math.abs(l.cantidad) * Math.abs(l.ingresoUnitario);
    const pct = l.ivaVentaAplicado;
    const actual = mapa.get(pct) || { pct, base: 0, iva: 0 };
    actual.base += base;
    actual.iva += base * pct / 100;
    mapa.set(pct, actual);
  }
  return [...mapa.values()].sort((a, b) => a.pct - b.pct);
}

// Como el ticket mapea una linea tal y como la devuelve el servidor.
function mapearLineaServidor(linea) {
  const cantidad = Number(linea.cantidad) || 0;
  const totalLinea = Number(linea.total) || 0;
  const ingresoUnitario = Number(linea.ingresoUnitario ?? linea.precioUnitario ?? linea.precio_unitario);
  const baseLinea = Number(linea.base ?? linea.baseLinea);
  const impuestosLinea = Number(linea.impuestos ?? linea.impuestosLinea);
  const ivaLinea = ivaTicketDesdeImportes(
    Number(linea.ivaVentaAplicado ?? linea.iva ?? linea.iva_pct),
    baseLinea,
    impuestosLinea,
  );
  const netoUnitario = Number.isFinite(ingresoUnitario) && ingresoUnitario >= 0
    ? ingresoUnitario
    : Number.isFinite(baseLinea) && baseLinea >= 0 && cantidad > 0
      ? baseLinea / cantidad
      : cantidad > 0 ? totalLinea / cantidad / (1 + ivaLinea / 100) : 0;
  return { cantidad, ingresoUnitario: netoUnitario, ivaVentaAplicado: ivaLinea };
}

const dosDecimales = (n) => Math.round(n * 100) / 100;

test("el croissant de la prueba en QA: base 1,20 e IVA 0,12 al 10 %", () => {
  // Exactamente la fila que dejo la venta V-20261107-22CF93 en pedido_lineas.
  const linea = mapearLineaServidor({
    cantidad: 1,
    base: 1.2,
    impuestos: 0.12,
    total: 1.32,
  });

  assert.equal(linea.ivaVentaAplicado, 10, "el porcentaje debe despejarse a 10, no quedarse en 0");
  assert.equal(dosDecimales(linea.ingresoUnitario), 1.2, "el neto unitario es la base, no el bruto");

  const [fila] = desglose([linea]);
  assert.equal(dosDecimales(fila.base), 1.2, "SUBTOTAL del ticket");
  assert.equal(dosDecimales(fila.iva), 0.12, "cuota de IVA del ticket");
  assert.equal(fila.pct, 10);
  assert.equal(dosDecimales(fila.base + fila.iva), 1.32, "base mas cuota debe dar el total cobrado");
});

test("un porcentaje declarado manda sobre el despeje", () => {
  const linea = mapearLineaServidor({ cantidad: 1, base: 1.2, impuestos: 0.12, total: 1.32, ivaVentaAplicado: 21 });
  assert.equal(linea.ivaVentaAplicado, 21);
});

test("una linea sin impuestos imprime 0 %, no un porcentaje inventado", () => {
  const linea = mapearLineaServidor({ cantidad: 1, base: 5, impuestos: 0, total: 5 });
  assert.equal(linea.ivaVentaAplicado, 0);
  const [fila] = desglose([linea]);
  assert.equal(dosDecimales(fila.base), 5);
  assert.equal(dosDecimales(fila.iva), 0);
});

test("varios tipos en el mismo ticket se agrupan por separado", () => {
  const lineas = [
    { cantidad: 1, base: 1.2, impuestos: 0.12, total: 1.32 },   // 10 %
    { cantidad: 2, base: 4, impuestos: 0.84, total: 4.84 },     // 21 %
    { cantidad: 1, base: 2, impuestos: 0.08, total: 2.08 },     //  4 %
  ].map(mapearLineaServidor);

  const filas = desglose(lineas);
  assert.deepEqual(filas.map((f) => f.pct), [4, 10, 21], "ordenadas por porcentaje");

  const base = dosDecimales(filas.reduce((a, f) => a + f.base, 0));
  const iva = dosDecimales(filas.reduce((a, f) => a + f.iva, 0));
  assert.equal(base, 7.2);
  assert.equal(iva, 1.04);
  assert.equal(dosDecimales(base + iva), 8.24, "debe cuadrar con la suma de los totales de linea");
});

test("varias unidades: el neto unitario sale de la base, no del bruto", () => {
  const linea = mapearLineaServidor({ cantidad: 3, base: 3.6, impuestos: 0.36, total: 3.96 });
  assert.equal(dosDecimales(linea.ingresoUnitario), 1.2);
  assert.equal(linea.ivaVentaAplicado, 10);
  const [fila] = desglose([linea]);
  assert.equal(dosDecimales(fila.base + fila.iva), 3.96);
});

test("sin base ni impuestos se reparte el bruto con el tipo del producto", () => {
  // Camino de respaldo: solo llega el total y el producto dice que es un 10 %.
  const cantidad = 1, total = 1.32;
  const iva = ivaTicketDesdeImportes(NaN, NaN, NaN, 10);
  const neto = total / cantidad / (1 + iva / 100);
  assert.equal(iva, 10);
  assert.equal(dosDecimales(neto), 1.2);
});

test("lo que imprimia antes del arreglo era otra cosa", () => {
  // Reproduce el mapeo viejo para dejar constancia de la diferencia.
  const linea = { cantidad: 1, base: 1.2, impuestos: 0.12, total: 1.32 };
  const viejoPct = Number(linea.ivaVentaAplicado ?? linea.iva ?? linea.iva_pct) || 0;
  const viejoNeto = linea.total / linea.cantidad;
  assert.equal(viejoPct, 0, "el codigo viejo imprimia 0 %");
  assert.equal(viejoNeto, 1.32, "y ponia el bruto como subtotal");

  const nuevo = mapearLineaServidor(linea);
  assert.notEqual(nuevo.ivaVentaAplicado, viejoPct);
  assert.notEqual(dosDecimales(nuevo.ingresoUnitario), viejoNeto);
});
