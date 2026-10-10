import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Defecto: al guardar la edición de un producto la pantalla mostraba «No se pudo actualizar el
// producto.» aunque el cambio sí se guardaba, porque updateProducto no devolvía nada cuando iba
// bien y submitEdit trata «sin resultado» como fallo. Este contrato ejecuta la función real.
const root = new URL("../../", import.meta.url);
const ARCHIVOS = ["fuente.js", "source-recovery/fuente-recuperado.js"];

function cargar(archivo) {
  const src = readFileSync(new URL(archivo, root), "utf8").replace(/\r\n/g, "\n");
  const ini = src.indexOf("function errorValidacionPM10");
  const fin = src.indexOf("function fechaValidaPedidoPM10", ini);
  assert.ok(ini >= 0 && fin > ini, archivo + ": bloque de productos presente");
  return { src, bloque: src.slice(ini, fin) };
}

function entorno(bloque, { productos, localActivoId = "L1", locales = [{ id: "L1" }] } = {}) {
  const estado = { productos: productos.map((p) => ({ ...p })), movimientos: [], llamadasStock: [] };
  const ctx = {
    uid: () => "uid-fijo",
    console,
    crearMotorStock: () => ({
      aplicarMovimientoStock: (m) => { estado.llamadasStock.push(m); return { ok: true }; },
    }),
  };
  vm.createContext(ctx);
  vm.runInContext(bloque, ctx);
  const setProductos = (f) => { estado.productos = typeof f === "function" ? f(estado.productos) : f; };
  const logica = ctx.crearLogicaProductos({
    productos: estado.productos, setProductos, movimientos: [], setMovimientos: () => {},
    registrarAuditoria: () => {}, almacenCongelado: false, addGasto: () => {}, localActivoId, locales,
  });
  return { estado, logica };
}

const base = () => [
  { id: "A", localId: "L1", nombre: "Agua", costo: 0.3, stockMinimo: 0, precioVenta: 0.99, ivaVenta: 10, stock: 10 },
  { id: "Z", localId: "L2", nombre: "Otro local", costo: 1, stockMinimo: 0, precioVenta: 2, ivaVenta: 10, stock: 3 },
];

for (const archivo of ARCHIVOS) {
  const { src, bloque } = cargar(archivo);

  // 1) Un cambio válido (precio) se guarda y el resultado indica éxito: la pantalla no avisa de error.
  {
    const { estado, logica } = entorno(bloque, { productos: base() });
    const r = logica.updateProducto("A", { nombre: "Agua", costo: 0.3, stockMinimo: 0, precioVenta: 1, ivaVenta: 10 });
    assert.ok(r && r.ok === true, archivo + ": updateProducto devuelve { ok: true } al guardar bien");
    assert.equal(estado.productos.find((p) => p.id === "A").precioVenta, 1, archivo + ": el cambio se aplicó");
    // Es justo lo que submitEdit evalúa para mostrar el cartel.
    assert.equal(!r || r.ok === false, false, archivo + ": el cartel de error no se mostraría");
  }

  // 2) Un cambio de stock también devuelve éxito y registra el movimiento.
  {
    const { estado, logica } = entorno(bloque, { productos: base() });
    const r = logica.updateProducto("A", { nombre: "Agua", costo: 0.3, stockMinimo: 0, stock: 12 });
    assert.equal(r && r.ok, true);
    assert.equal(estado.llamadasStock.length, 1, "se ajustó el stock una vez");
    assert.equal(estado.llamadasStock[0].cantidad, 2);
  }

  // 3) Los fallos reales siguen siendo fallos (no se ocultan con el arreglo).
  {
    const { estado, logica } = entorno(bloque, { productos: base() });
    const r = logica.updateProducto("A", { nombre: "Agua", costo: 0.3, stockMinimo: 0, precioVenta: -1 });
    assert.equal(r.ok, false);
    assert.equal(r.campo, "precioVenta");
    assert.equal(estado.productos.find((p) => p.id === "A").precioVenta, 0.99, "un dato inválido no cambia nada");
  }
  {
    const { estado, logica } = entorno(bloque, { productos: base() });
    const r = logica.updateProducto("Z", { nombre: "Otro local", costo: 1, stockMinimo: 0, precioVenta: 5 });
    assert.equal(r.ok, false, "producto de otro local: rechazado");
    assert.equal(r.codigo, "contexto_no_autorizado");
    assert.equal(estado.productos.find((p) => p.id === "Z").precioVenta, 2);
  }
  {
    const { logica } = entorno(bloque, { productos: base() });
    const r = logica.updateProducto("no-existe", { nombre: "X", costo: 1, stockMinimo: 0 });
    assert.equal(r.ok, false, "producto inexistente: rechazado");
  }

  // 4) submitEdit sigue tratando «sin resultado» o ok:false como fallo (se corrige la causa, no el aviso).
  assert.match(src, /const actualizado = updateProducto\(editFor, editForm\);\s*if \(!actualizado \|\| actualizado\.ok === false\) \{\s*setEditError\(actualizado\?\.error \|\| "No se pudo actualizar el producto\."\);/);
}

// 5) Las dos copias del bloque son idénticas (fuente.js se mantiene en paralelo con source-recovery).
const bloqueFn = (archivo) => {
  const { src } = cargar(archivo);
  const i = src.indexOf("function updateProducto(");
  return src.slice(i, src.indexOf("function deleteProducto(", i));
};
assert.equal(bloqueFn(ARCHIVOS[0]), bloqueFn(ARCHIVOS[1]), "updateProducto idéntico en fuente.js y source-recovery");
assert.match(bloqueFn(ARCHIVOS[0]), /\n    return \{ ok: true \};\n  \}\n\s*$/, "el éxito se devuelve al final de la función");

console.log("p3-actualizar-producto-resultado: OK");
