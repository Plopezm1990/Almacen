import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const codigo = await readFile("index-storage-bootstrap.js", "utf8");
const autoridad = await readFile("server-authority-storage-bridge.js", "utf8");
const controlAcceso = await readFile("edge-auth-patch.js", "utf8");
const puente = await readFile("ui-context-bridge.js", "utf8");
const bundle = await readFile("fuente.js", "utf8");
const recuperado = await readFile("source-recovery/fuente-recuperado.js", "utf8");
const base = [{ id: "p1", empresaId: "QA-EMP-A", localId: "QA-A1", nombre: "Agua", precioVenta: 1, costo: 0.4 }];
const textoBase = JSON.stringify(base);

function entorno(rpc, leerRemoto = () => base) {
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
  const eventos = [];
  const window = { dispatchEvent(ev) { eventos.push(ev); }, crypto: { randomUUID: () => "id-de-prueba" } };
  const cliente = {
    rpc,
    from(tabla) {
      assert.equal(tabla, "almacen_kv");
      return {
        select() { return { eq() { return { maybeSingle: async () => ({ data: { value: leerRemoto() }, error: null }) }; } }; },
        upsert: async fila => { subidasDirectas.push(fila); return { error: null }; }
      };
    }
  };
  vm.runInNewContext(codigo, {
    window, localStorage, document, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    setTimeout() { return 0; }, clearTimeout() {}, console, Promise, JSON, Date, Math
  }, { filename: "index-storage-bootstrap.js" });
  vm.runInNewContext(autoridad, {
    window, localStorage, console, setInterval() { throw new Error("El puente debe instalarse de inmediato"); }
  }, { filename: "server-authority-storage-bridge.js" });
  window.__nubeActiva = true;
  window.__nubeCliente = cliente;
  return { window, datos, subidasDirectas, eventos };
}

// La barrera de acceso se carga después del puente de catálogo en la página.
// Debe transmitir las opciones P3c por todos los caminos permitidos.
assert.match(controlAcceso, /window\.storage\.set = async function \(key, value, shared, opcionesP3c\)/);
assert.equal([...controlAcceso.matchAll(/setOriginal\(key, value, shared, opcionesP3c\)/g)].length, 3);
for (const codigoUi of [bundle, recuperado]) {
  assert.match(codigoUi, /addEventListener\("productos-servidor-confirmados", onProductosServidor\)/);
  assert.match(codigoUi, /JSON\.stringify\(prev\) !== JSON\.stringify\(d3\.enviados\)/);
}

// El camino P3c envía referencia, lista y cambio humano en una única RPC.
{
  const llamadas = [];
  const e = entorno(async (nombre, args) => {
    llamadas.push({ nombre, args });
    return { data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: args.p_nuevo }, error: null };
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

// Después de un guardado terminado, la siguiente edición usa la lista
// confirmada como base, incluidos los campos recibidos del otro dispositivo.
{
  const llamadas = [];
  const e = entorno(async (nombre, args) => {
    llamadas.push(args);
    const confirmada = llamadas.length === 1
      ? [{ ...args.p_nuevo[0], costo: 0.7 }] : args.p_nuevo;
    return { data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: confirmada }, error: null };
  });
  const primero = [{ ...base[0], precioVenta: 1.5 }];
  await e.window.storage.set("productos", JSON.stringify(primero), false, { venta: primero });
  const segundo = [{ ...primero[0], costo: 0.7, nombre: "Agua nueva" }];
  await e.window.storage.set("productos", JSON.stringify(segundo), false, { venta: segundo });
  assert.equal(JSON.stringify(llamadas[1].p_base), JSON.stringify([{ ...primero[0], costo: 0.7 }]));
}

// Dos guardados del mismo dispositivo salen en fila. Si el segundo borrador
// nació mientras el primero subía, conserva la base original para que la RPC
// pueda detectar un conflicto en cualquier campo tocado durante esa espera.
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
    return Promise.resolve({ data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: args.p_nuevo }, error: null });
  });
  const primero = [{ ...base[0], precioVenta: 1.5 }];
  const segundo = [{ ...primero[0], costo: 0.7 }];
  const p1 = e.window.storage.set("productos", JSON.stringify(primero), false, { venta: primero });
  await primeraEntróP;
  const p2 = e.window.storage.set("productos", JSON.stringify(segundo), false, {});
  resolverPrimera({ data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: primero }, error: null });
  await Promise.all([p1, p2]);
  assert.equal(llamadas.length, 2);
  assert.equal(JSON.stringify(llamadas[1].p_base), textoBase);
  assert.equal(e.subidasDirectas.length, 0);
}

// Dos dispositivos parten de la misma lista. El otro cambia el coste y este
// cambia el precio: el navegador adopta la fusión realmente confirmada.
{
  const remoto = [{ ...base[0], costo: 0.7 }];
  const fusion = [{ ...remoto[0], precioVenta: 1.5 }];
  const llamadas = [];
  const e = entorno(async (nombre, args) => {
    llamadas.push(args);
    return { data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: fusion }, error: null };
  });
  const nuevo = [{ ...base[0], precioVenta: 1.5 }];
  const r = await e.window.storage.set("productos", JSON.stringify(nuevo), false, { venta: nuevo });
  assert.equal(r.productosConfirmados, true);
  assert.equal(JSON.stringify(r.listaConfirmada), JSON.stringify(fusion));
  assert.equal(e.datos.get("almacen:productos"), JSON.stringify(fusion));
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), false);
  assert.equal(e.eventos[0].type, "productos-servidor-confirmados");
  assert.equal(JSON.stringify(e.eventos[0].detail.confirmados), JSON.stringify(fusion));
  assert.equal(JSON.stringify(llamadas[0].p_base), textoBase);
  assert.equal(e.subidasDirectas.length, 0);
}

// Una instalación con la primera RPC solo devuelve contadores. La lectura
// posterior al guardado proporciona la lista fusionada.
{
  const fusion = [{ ...base[0], precioVenta: 1.5, costo: 0.7 }];
  const e = entorno(async () => ({ data: { ok: true, catalogo_ya_sincronizado: true }, error: null }), () => fusion);
  const nuevo = [{ ...base[0], precioVenta: 1.5 }];
  await e.window.storage.set("productos", JSON.stringify(nuevo), false, { venta: nuevo });
  assert.equal(e.datos.get("almacen:productos"), JSON.stringify(fusion));
  assert.equal(e.eventos[0].type, "productos-servidor-confirmados");
}

// Durante la primera subida hay otra edición local. No se reemplaza ese
// borrador ni se adelanta su base; la segunda RPC fusiona ambos cambios.
{
  const llamadas = [];
  let resolverPrimera;
  let resolverSegunda;
  let primeraEntro;
  const primeraEntroP = new Promise(resolve => { primeraEntro = resolve; });
  const e = entorno((nombre, args) => {
    llamadas.push(args);
    if (llamadas.length === 1) {
      primeraEntro();
      return new Promise(resolve => { resolverPrimera = resolve; });
    }
    return new Promise(resolve => { resolverSegunda = resolve; });
  });
  const primero = [{ ...base[0], precioVenta: 1.5 }];
  const segundo = [{ ...primero[0], nombre: "Agua nueva" }];
  const p1 = e.window.storage.set("productos", JSON.stringify(primero), false, { venta: primero });
  await primeraEntroP;
  const p2 = e.window.storage.set("productos", JSON.stringify(segundo), false, { venta: segundo });
  const fusionPrimera = [{ ...primero[0], costo: 0.7 }];
  resolverPrimera({ data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: fusionPrimera }, error: null });
  const r1 = await p1;
  assert.equal(r1.productosConfirmados, false);
  assert.equal(e.datos.get("almacen:productos"), JSON.stringify(segundo));
  assert.equal(e.datos.get("almacen__productos_base_pendiente_p3c"), textoBase);
  const fusionFinal = [{ ...segundo[0], costo: 0.7 }];
  resolverSegunda({ data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: fusionFinal }, error: null });
  await p2;
  assert.equal(JSON.stringify(llamadas[1].p_base), textoBase);
  assert.equal(e.datos.get("almacen:productos"), JSON.stringify(fusionFinal));
  assert.equal(e.datos.has("almacen__productos_base_pendiente_p3c"), false);
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
    return { data: { ok: true, catalogo_ya_sincronizado: true, lista_confirmada: args.p_nuevo }, error: null };
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

// Tras adoptar la fusión, el puente compara la siguiente edición con la
// lista confirmada y no interpreta un nombre remoto como edición humana.
{
  const eventos = new Map();
  const llamadas = [];
  const window = {
    __nubeActiva: true,
    __instalacionSyncPermitida: true,
    addEventListener(tipo, fn) { eventos.set(tipo, fn); },
    dispatchEvent(ev) { eventos.get(ev.type)?.(ev); },
    storage: {
      async get() { return { key: "productos", value: textoBase }; },
      async set(key, value, shared, opciones) {
        llamadas.push({ value, opciones });
        if (llamadas.length === 1) {
          const enviados = JSON.parse(value);
          const confirmados = [{ ...enviados[0], nombre: "Agua remota" }];
          window.dispatchEvent(new CustomEvent("productos-servidor-confirmados", { detail: { enviados, confirmados } }));
          return { key, value, catalogoYaSincronizado: true, productosConfirmados: true, listaConfirmada: confirmados };
        }
        return { key, value, catalogoYaSincronizado: true };
      }
    }
  };
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  vm.runInNewContext(puente, {
    window, localStorage, console, Date, JSON, Math, CustomEvent,
    setTimeout() { return 0; }, clearTimeout() {}
  }, { filename: "ui-context-bridge.js" });
  await window.storage.get("productos");
  eventos.get("click")();
  const primero = [{ ...base[0], precioVenta: 1.5 }];
  await window.storage.set("productos", JSON.stringify(primero));
  const segundo = [{ ...primero[0], nombre: "Agua remota", costo: 0.8 }];
  eventos.get("click")();
  await window.storage.set("productos", JSON.stringify(segundo));
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[1].opciones.venta.length, 0);
}

console.log("p3c-client-contract: OK");
