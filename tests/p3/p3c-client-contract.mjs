import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const codigo = await readFile("index-storage-bootstrap.js", "utf8");
const puente = await readFile("ui-context-bridge.js", "utf8");
const base = [{ id: "p1", empresaId: "QA-EMP-A", localId: "QA-A1", nombre: "Agua", precioVenta: 1, costo: 0.4 }];
const textoBase = JSON.stringify(base);

function entorno(rpc) {
  const datos = new Map([["almacen:productos", textoBase]]);
  const localStorage = {
    getItem: k => datos.has(k) ? datos.get(k) : null,
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: k => datos.delete(k),
    key: i => [...datos.keys()][i] ?? null,
    get length() { return datos.size; }
  };
  const el = { style: {} };
  const document = {
    getElementById: () => el,
    createElement: () => ({ style: {} }),
    body: { appendChild() {} }
  };
  const subidasDirectas = [];
  const window = { dispatchEvent() {}, crypto: { randomUUID: () => "id-de-prueba" } };
  const cliente = {
    rpc,
    from(tabla) {
      assert.equal(tabla, "almacen_kv");
      return {
        select() { return { eq() { return { maybeSingle: async () => ({ data: { value: base }, error: null }) }; } }; },
        upsert: async fila => { subidasDirectas.push(fila); return { error: null }; }
      };
    }
  };
  vm.runInNewContext(codigo, {
    window, localStorage, document, CustomEvent: class {},
    setTimeout() { return 0; }, clearTimeout() {}, console, Promise, JSON, Date, Math
  }, { filename: "index-storage-bootstrap.js" });
  window.__nubeActiva = true;
  window.__nubeCliente = cliente;
  return { window, datos, subidasDirectas };
}

// El camino P3c envía referencia, lista y cambio humano en una única RPC.
{
  const llamadas = [];
  const e = entorno(async (nombre, args) => {
    llamadas.push({ nombre, args });
    return { data: { ok: true, catalogo_ya_sincronizado: true }, error: null };
  });
  const nuevo = [{ ...base[0], precioVenta: 1.5 }];
  const r = await e.window.storage.set("productos", JSON.stringify(nuevo), false, { venta: nuevo });
  assert.equal(r.catalogoYaSincronizado, true);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].nombre, "abc_productos_guardar_lista");
  assert.equal(JSON.stringify(llamadas[0].args.p_base), textoBase);
  assert.equal(JSON.stringify(llamadas[0].args.p_nuevo), JSON.stringify(nuevo));
  assert.equal(JSON.stringify(llamadas[0].args.p_venta), JSON.stringify(nuevo));
  assert.equal(e.subidasDirectas.length, 0);
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), false);
}

// Dos guardados del mismo dispositivo salen en fila. El segundo usa como base
// la versión confirmada por el primero, no una referencia antigua.
{
  const llamadas = [];
  let resolverPrimera;
  let primeraEntró;
  const primeraEntróP = new Promise(resolve => { primeraEntró = resolve; });
  const e = entorno((nombre, args) => {
    llamadas.push(args);
    if (llamadas.length === 1) {
      primeraEntró();
      return new Promise(resolve => { resolverPrimera = resolve; });
    }
    return Promise.resolve({ data: { ok: true, catalogo_ya_sincronizado: true }, error: null });
  });
  const primero = [{ ...base[0], precioVenta: 1.5 }];
  const segundo = [{ ...primero[0], costo: 0.7 }];
  const p1 = e.window.storage.set("productos", JSON.stringify(primero), false, { venta: primero });
  await primeraEntróP;
  const p2 = e.window.storage.set("productos", JSON.stringify(segundo), false, {});
  resolverPrimera({ data: { ok: true, catalogo_ya_sincronizado: true }, error: null });
  await Promise.all([p1, p2]);
  assert.equal(llamadas.length, 2);
  assert.equal(JSON.stringify(llamadas[1].p_base), JSON.stringify(primero));
  assert.equal(e.subidasDirectas.length, 0);
}

// Un conflicto deja el borrador local pendiente y no cae al upsert directo.
{
  const e = entorno(async () => ({ data: null, error: { code: "P0001", message: "abc_productos_conflicto_campo:p1:precioVenta" } }));
  const nuevo = [{ ...base[0], precioVenta: 2 }];
  const r = await e.window.storage.set("productos", JSON.stringify(nuevo), false, { venta: nuevo });
  assert.equal(r.catalogoBloqueado, true);
  assert.equal(e.subidasDirectas.length, 0);
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), true);
  assert.deepEqual(JSON.parse(e.datos.get("almacen__pendientes")), ["productos"]);
}

// Un corte de red conserva la base y la intención comercial para el reintento.
{
  const llamadas = [];
  let sinRed = true;
  const e = entorno(async (nombre, args) => {
    llamadas.push(args);
    if (sinRed) return { data: null, error: { code: "NETWORK", message: "sin red" } };
    return { data: { ok: true, catalogo_ya_sincronizado: true }, error: null };
  });
  const nuevo = [{ ...base[0], precioVenta: 1.8 }];
  const r = await e.window.storage.set("productos", JSON.stringify(nuevo), false, { venta: nuevo });
  assert.equal(r.catalogoBloqueado, true);
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), true);
  assert.equal(e.datos.has("almacen__productos_venta_pendiente_p3c"), true);
  sinRed = false;
  e.window.__instalacionSyncPermitida = true;
  await e.window.subirPendientes();
  assert.equal(JSON.stringify(llamadas[1].p_base), textoBase);
  assert.equal(JSON.stringify(llamadas[1].p_venta), JSON.stringify(nuevo));
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), false);
  assert.equal(e.datos.has("almacen__productos_venta_pendiente_p3c"), false);
  assert.equal(e.subidasDirectas.length, 0);
}

// Antes de instalar P3c, la ausencia de la RPC conserva el camino heredado.
{
  const e = entorno(async () => ({ data: null, error: { code: "PGRST202" } }));
  const nuevo = [{ ...base[0], costo: 0.7 }];
  const r = await e.window.storage.set("productos", JSON.stringify(nuevo), false, {});
  assert.equal(r.catalogoYaSincronizado, false);
  assert.equal(e.subidasDirectas.length, 1);
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), false);
}

// El puente solo marca como cambio comercial una edición humana reciente y
// omite la antigua RPC P3 cuando el servidor confirmó la transacción P3c.
{
  const llamadas = [];
  const eventos = new Map();
  const window = {
    __nubeActiva: true,
    __instalacionSyncPermitida: true,
    addEventListener(tipo, fn) { eventos.set(tipo, fn); },
    dispatchEvent() {},
    storage: {
      async get() { return { key: "productos", value: textoBase }; },
      async set(key, value, shared, opciones) {
        llamadas.push({ key, value, opciones });
        return { key, value, catalogoYaSincronizado: true };
      }
    }
  };
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  vm.runInNewContext(puente, {
    window, localStorage, console, Date, JSON, Math,
    setTimeout() { throw new Error("No debe programar la RPC P3 antigua"); },
    clearTimeout() {}, CustomEvent: class {}
  }, { filename: "ui-context-bridge.js" });
  await window.storage.get("productos");
  eventos.get("click")();
  const nuevo = [{ ...base[0], precioVenta: 1.5 }];
  await window.storage.set("productos", JSON.stringify(nuevo));
  assert.equal(llamadas.length, 1);
  assert.equal(JSON.stringify(llamadas[0].opciones.venta), JSON.stringify(nuevo));
  await window.storage.get("productos");
  // La carga reactiva sin nueva interacción no debe pedir una venta P3c.
  const carga = [{ ...base[0], precioVenta: 3 }];
  // El tiempo se avanza más de la ventana de interacción sin dormir.
  const fechaAntes = Date.now;
  Date.now = () => fechaAntes() + 4000;
  try { await window.storage.set("productos", JSON.stringify(carga)); }
  finally { Date.now = fechaAntes; }
  assert.equal(Array.isArray(llamadas[1].opciones.venta), false);
}

console.log("p3c-client-contract: OK");
