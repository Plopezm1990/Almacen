import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const [html, storageScript, fuente] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../index-storage-bootstrap.js", import.meta.url), "utf8"),
  readFile(new URL("../fuente.js", import.meta.url), "utf8"),
]);

assert.ok(
  html.includes('<script src="./index-storage-bootstrap.js"></script>'),
  "index.html no carga el adaptador de almacenamiento externo"
);

const loadStart = fuente.indexOf("function motivoFalloCargaPM16");
const loadEnd = fuente.indexOf("async function saveKey", loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, "No se pudo aislar loadKey PM16");
const loadScript = fuente.slice(loadStart, loadEnd);

function makeLocalStorage(initial = {}, options = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) {
      if (options.getError) throw options.getError;
      return data.has(k) ? data.get(k) : null;
    },
    setItem(k, v) {
      if (options.setError) throw options.setError;
      data.set(k, String(v));
    },
    removeItem(k) { data.delete(k); },
    clear() { data.clear(); },
  };
}

function makeContext(localStorage) {
  const events = [];
  class TestCustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  const context = {
    localStorage,
    navigator: { onLine: true },
    document: {
      getElementById() { return null; },
      createElement() { return { style: {}, textContent: "" }; },
      body: { appendChild() {} },
    },
    CustomEvent: TestCustomEvent,
    console: { log() {}, warn() {}, error() {} },
    setTimeout(fn) { fn(); return 0; },
    clearTimeout() {},
    Promise,
    JSON,
    Date,
    Error,
  };
  context.window = context;
  context.globalThis = context;
  context.__modoPruebasLocal = true;
  context.dispatchEvent = (event) => { events.push(event); return true; };
  vm.createContext(context);
  vm.runInContext(storageScript, context, { filename: "index-storage.js" });
  vm.runInContext(loadScript, context, { filename: "fuente-loadKey.js" });
  return { context, events };
}

function cloudClient({ data = null, error = null } = {}) {
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: "owner-test" } } } }) },
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data, error }) };
            },
          };
        },
      };
    },
  };
}

// 1) First-run limpio: ausencia local normal => fallback sin warning/reintento.
{
  const { context, events } = makeContext(makeLocalStorage());
  let calls = 0;
  const realGet = context.storage.get.bind(context.storage);
  context.storage.get = async (...args) => { calls += 1; return realGet(...args); };
  const fallback = [];
  const loaded = await context.loadKey("productos", fallback);
  assert.equal(loaded, fallback);
  assert.equal(calls, 1, "Una ausencia normal no debe provocar reintentos");
  assert.equal(events.filter((e) => e.type === "fallo-carga").length, 0);
}

// 2) Valor local existente sigue leyéndose y parseándose.
{
  const local = makeLocalStorage({ "almacen:productos": JSON.stringify([{ id: "p1" }]) });
  const { context, events } = makeContext(local);
  const loaded = await context.loadKey("productos", []);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), [{ id: "p1" }]);
  assert.equal(events.length, 0);
}

// 3) Cloud read válido sigue teniendo prioridad y actualiza la caché.
{
  const local = makeLocalStorage();
  const { context, events } = makeContext(local);
  context.__nubeActiva = true;
  context.__nubeCliente = cloudClient({ data: { value: [{ id: "cloud" }] } });
  const loaded = await context.loadKey("productos", []);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), [{ id: "cloud" }]);
  assert.equal(local.getItem("almacen:productos"), JSON.stringify([{ id: "cloud" }]));
  assert.equal(events.length, 0);
}

// 4) Ausencia en nube + ausencia local también es first-run normal.
{
  const { context, events } = makeContext(makeLocalStorage());
  context.__nubeActiva = true;
  context.__nubeCliente = cloudClient({ data: null, error: null });
  const loaded = await context.loadKey("productos", []);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), []);
  assert.equal(events.length, 0);
}

// 5) Error de acceso real de nube, sin caché local, debe seguir propagándose a loadKey.
{
  const { context, events } = makeContext(makeLocalStorage());
  context.__nubeActiva = true;
  context.__nubeCliente = cloudClient({ error: new Error("permiso denegado") });
  const loaded = await context.loadKey("productos", []);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), []);
  const fallo = events.find((e) => e.type === "fallo-carga");
  assert.ok(fallo, "Un error real de nube no debe ocultarse como almacenamiento vacío");
  assert.equal(fallo.detail.motivo, "acceso");
}

// 6) Error de acceso local real no se convierte en ausencia.
{
  const { context, events } = makeContext(makeLocalStorage({}, { getError: new Error("acceso local denegado") }));
  await context.loadKey("productos", []);
  const fallo = events.find((e) => e.type === "fallo-carga");
  assert.ok(fallo);
  assert.equal(fallo.detail.motivo, "acceso");
}

// 7) Cuota sigue clasificada como cuota.
{
  const { context, events } = makeContext(makeLocalStorage());
  const quota = new Error("quota");
  quota.name = "QuotaExceededError";
  context.storage.get = async () => { throw quota; };
  await context.loadKey("productos", []);
  const fallo = events.find((e) => e.type === "fallo-carga");
  assert.ok(fallo);
  assert.equal(fallo.detail.motivo, "cuota");
}

// 8) JSON corrupto conserva la señal específica de corrupción.
{
  const { context, events } = makeContext(makeLocalStorage());
  context.storage.get = async () => ({ key: "productos", value: "{", shared: false });
  await context.loadKey("productos", []);
  const fallo = events.find((e) => e.type === "fallo-carga");
  assert.ok(fallo);
  assert.equal(fallo.detail.motivo, "corrupcion");
}

// 9) Ledger PM08 vacío es estado válido de primer arranque, no fallo de acceso.
{
  const { context, events } = makeContext(makeLocalStorage());
  const loaded = await context.loadKey("arqueos", []);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), []);
  assert.equal(events.length, 0);
}

// Contratos estáticos: el fix debe ser estrecho y no abrir la barrera de sincronización.
assert.match(storageScript, /function leerLocalOpcional\(key\)/);
assert.match(storageScript, /e && e\.message === "no existe"/);
assert.match(storageScript, /__instalacionSyncPermitida !== true\) return;/);
assert.doesNotMatch(storageScript, /catch\s*\([^)]*\)\s*\{\s*return null;\s*\}/);

console.log("p1-empty-kv-first-run: OK");
