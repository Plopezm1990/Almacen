import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const storageScript = await readFile(new URL("../index-storage-bootstrap.js", import.meta.url), "utf8");
const H = 60 * 60 * 1000;

function makeLocalStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { data.set(k, String(v)); },
    removeItem(k) { data.delete(k); },
    clear() { data.clear(); },
  };
}

// Nube simulada: cada operación de escritura (upsert) devuelve el resultado que se configure.
function makeCloud(mode) {
  const calls = { upsert: [], lecturaKv: 0 };
  const errorFor = () => {
    if (mode.value === "acepta") return null;
    if (mode.value === "rls") return { code: "42501", message: 'new row violates row-level security policy for table "almacen_kv"' };
    if (mode.value === "rls-sin-codigo") return { message: "new row violates row-level security policy" };
    if (mode.value === "jwt") return { code: "PGRST301", message: "JWT expired" };
    throw new Error("modo desconocido " + mode.value);
  };
  const builder = (table) => {
    const q = {
      select() { return q; }, eq() { return q; }, order() { return q; }, range() { return q; },
      in() { return q; }, neq() { return q; }, delete() { return q; },
      maybeSingle() { if (table === "almacen_kv") calls.lecturaKv += 1; return Promise.resolve({ data: null, error: null }); },
      upsert(payload) { calls.upsert.push({ table, payload }); return Promise.resolve({ error: errorFor() }); },
      then(res, rej) { return Promise.resolve({ data: [], error: null }).then(res, rej); },
    };
    return q;
  };
  return {
    calls,
    client: {
      auth: { getSession: async () => ({ data: { session: { user: { id: "owner-test" } } } }) },
      from: builder,
    },
  };
}

function setup({ initial = {}, modo = "acepta" } = {}) {
  const mode = { value: modo };
  const cloud = makeCloud(mode);
  const localStorage = makeLocalStorage(initial);
  const events = [];
  const warns = [];
  const elementos = {};
  const reloj = { ahora: 1_800_000_000_000 };
  class RelojDate extends Date { static now() { return reloj.ahora; } }
  class TestCustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const context = {
    localStorage,
    navigator: { onLine: true },
    document: {
      getElementById(id) { return elementos[id] || null; },
      createElement() { return { style: {}, textContent: "", id: "" }; },
      body: { appendChild(el) { elementos[el.id] = el; } },
    },
    CustomEvent: TestCustomEvent,
    console: { log() {}, error() {}, warn(...a) { warns.push(a.join(" ")); } },
    setTimeout() { return 1; },   // el límite de espera nunca vence en el test
    clearTimeout() {},
    Promise, JSON, Error, Date: RelojDate,
  };
  context.window = context;
  context.globalThis = context;
  context.dispatchEvent = (e) => { events.push(e); return true; };
  vm.createContext(context);
  vm.runInContext(storageScript, context, { filename: "index-storage.js" });
  context.__modoPruebasLocal = false;
  context.__nubeActiva = true;
  context.__nubeCliente = cloud.client;
  context.__instalacionSyncPermitida = true;
  const pendientes = () => JSON.parse(localStorage.getItem("almacen__pendientes") || "[]");
  const denegados = () => JSON.parse(localStorage.getItem("almacen__denegados") || "{}");
  const indicador = () => elementos["estado-guardado"] || { style: { display: "none" }, textContent: "" };
  return { context, cloud, mode, localStorage, events, warns, reloj, pendientes, denegados, indicador };
}

const claveEvento = (events) => events.filter((e) => e.type === "clave-solo-local").map((e) => e.detail.key).sort();

// 1) El servidor ACEPTA (caso de producción hoy): nada cambia.
{
  const t = setup({ modo: "acepta" });
  await t.context.storage.set("temaOscuro", "true");
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }]));
  assert.equal(t.cloud.calls.upsert.length, 2, "con servidor que acepta, se sube cada clave");
  assert.deepEqual(t.pendientes(), []);
  assert.deepEqual(t.denegados(), {});
  assert.equal(t.indicador().style.display, "none", "sin pendientes ni denegadas no hay aviso");
  assert.deepEqual([...t.context.__clavesSoloLocal()], []);
  assert.equal(t.warns.length, 0);
}

// 2) RECHAZO por permisos (QA): no queda en la cola, se anota aparte y el aviso lo dice.
{
  const t = setup({ modo: "rls" });
  await t.context.storage.set("temaOscuro", "true");
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }]));
  assert.deepEqual(t.pendientes(), [], "un rechazo por permisos no se queda en pendientes");
  assert.deepEqual(Object.keys(t.denegados()).sort(), ["productos", "temaOscuro"]);
  assert.deepEqual([...t.context.__clavesSoloLocal()].sort(), ["productos", "temaOscuro"]);
  assert.equal(t.indicador().style.display, "block");
  assert.match(t.indicador().textContent, /^2 colecciones solo en este equipo/);
  assert.doesNotMatch(t.indicador().textContent, /Subiendo/);
  assert.deepEqual(claveEvento(t.events), ["productos", "temaOscuro"]);
  assert.equal(t.warns.length, 2, "una advertencia por clave, no una por intento");
  // Sigue guardado y legible en este equipo.
  const leido = await t.context.storage.get("productos");
  assert.equal(leido.value, JSON.stringify([{ id: "p1" }]));
}

// 3) Dentro del plazo no se insiste, y la lectura no va a la nube (no pisa lo local).
{
  const t = setup({ modo: "rls" });
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }]));
  const subidas = t.cloud.calls.upsert.length;
  const lecturas = t.cloud.calls.lecturaKv;
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }, { id: "p2" }]));
  assert.equal(t.cloud.calls.upsert.length, subidas, "no se reintenta dentro del plazo");
  const leido = await t.context.storage.get("productos");
  assert.equal(leido.value, JSON.stringify([{ id: "p1" }, { id: "p2" }]), "se lee lo último guardado en este equipo");
  assert.equal(t.cloud.calls.lecturaKv, lecturas, "no se lee de la nube una clave marcada como denegada");
  assert.equal(t.warns.length, 1, "la advertencia no se repite");
}

// 4) Una cola antigua se limpia sola: lo pendiente que el servidor rechaza pasa a "solo en este equipo".
{
  const t = setup({
    modo: "rls",
    initial: {
      "almacen__pendientes": JSON.stringify(["temaOscuro", "productos"]),
      "almacen:temaOscuro": "true",
      "almacen:productos": JSON.stringify([{ id: "p1" }]),
    },
  });
  await t.context.subirPendientes();
  assert.deepEqual(t.pendientes(), [], "la cola antigua queda vacía");
  assert.deepEqual(Object.keys(t.denegados()).sort(), ["productos", "temaOscuro"]);
  const subidas = t.cloud.calls.upsert.length;
  assert.equal(subidas, 2, "se intenta una vez cada clave");
  await t.context.subirPendientes();
  assert.equal(t.cloud.calls.upsert.length, subidas, "la segunda pasada no vuelve a subir nada");
}

// 5) Un fallo TRANSITORIO (sesión caducada, red) sigue siendo pendiente y se reintenta.
{
  for (const modo of ["jwt"]) {
    const t = setup({ modo });
    await t.context.storage.set("temaOscuro", "true");
    assert.deepEqual(t.pendientes(), ["temaOscuro"], "un fallo transitorio sigue en la cola");
    assert.deepEqual(t.denegados(), {});
    assert.match(t.indicador().textContent, /^Subiendo 1…$/);
    assert.equal(t.warns.length, 0);
  }
}

// 6) El rechazo se reconoce también por el mensaje cuando no llega el código.
{
  const t = setup({ modo: "rls-sin-codigo" });
  await t.context.storage.set("temaOscuro", "true");
  assert.deepEqual(t.pendientes(), []);
  assert.deepEqual(Object.keys(t.denegados()), ["temaOscuro"]);
}

// 7) Pasado el plazo se vuelve a intentar UNA vez; si ya funciona, la marca desaparece.
{
  const t = setup({ modo: "rls" });
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }]));
  assert.deepEqual(Object.keys(t.denegados()), ["productos"]);
  t.reloj.ahora += 7 * H;
  t.mode.value = "acepta"; // el servidor cambió sus reglas
  const antes = t.cloud.calls.upsert.length;
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }, { id: "p2" }]));
  assert.equal(t.cloud.calls.upsert.length, antes + 1, "pasado el plazo se reintenta");
  assert.deepEqual(t.denegados(), {}, "la subida correcta retira la marca");
  assert.equal(t.indicador().style.display, "none");
  assert.deepEqual([...t.context.__clavesSoloLocal()], []);
}

// 8) Pasado el plazo y sigue rechazando: vuelve a marcarse y avisa de nuevo una vez.
{
  const t = setup({ modo: "rls" });
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }]));
  t.reloj.ahora += 7 * H;
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }, { id: "p2" }]));
  assert.deepEqual(Object.keys(t.denegados()), ["productos"]);
  assert.deepEqual(t.pendientes(), []);
  assert.equal(t.warns.length, 2, "una advertencia por plazo vencido");
}

// 9) Mezcla: una clave pendiente (fallo transitorio) y otra denegada se muestran por separado.
{
  const t = setup({ modo: "rls" });
  await t.context.storage.set("productos", JSON.stringify([{ id: "p1" }]));
  t.mode.value = "jwt";
  await t.context.storage.set("conteos", JSON.stringify([]));
  assert.deepEqual(t.pendientes(), ["conteos"]);
  assert.equal(t.indicador().textContent, "Subiendo 1… · 1 solo en este equipo");
}

console.log("p1-denied-keys-solo-local: OK");
