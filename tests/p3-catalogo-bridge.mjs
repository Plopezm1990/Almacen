import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const bridgeScript = await readFile(process.env.BRIDGE_SCRIPT || new URL("../ui-context-bridge.js", import.meta.url), "utf8");
const OP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;   // formato que exige abc_operaciones

function makeLocalStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { data.set(k, String(v)); },
    removeItem(k) { data.delete(k); },
    _data: data,
  };
}

// Temporizadores controlables: nada se ejecuta hasta que el test lo pide.
function makeTimers() {
  let id = 0;
  const cola = new Map();
  return {
    setTimeout(fn, ms) { id += 1; cola.set(id, { fn, ms }); return id; },
    clearTimeout(i) { cola.delete(i); },
    pendientes() { return [...cola.values()].map((t) => t.ms); },
    async correrPrimero() {
      const primero = [...cola.entries()][0];
      if (!primero) return;
      cola.delete(primero[0]);
      primero[1].fn();
      for (let k = 0; k < 15; k++) await new Promise((r) => setImmediate(r));
    },
    async correr() {
      for (let vuelta = 0; vuelta < 20; vuelta++) {
        const lote = [...cola.entries()];
        if (!lote.length) break;
        for (const [i, t] of lote) { cola.delete(i); t.fn(); }
        for (let k = 0; k < 15; k++) await new Promise((r) => setImmediate(r));
      }
    },
  };
}

function setup({ nube = true, sesion = true, respuestas = [], locales = [{ id: "L1", empresaId: "E1" }], pendiente = null, getValor = null } = {}) {
  const timers = makeTimers();
  const localStorage = makeLocalStorage({
    "almacen:locales": JSON.stringify(locales),
    ...(pendiente ? { la_suite_catalogo_tpv_pendiente_v1: JSON.stringify(pendiente) } : {}),
  });
  const llamadas = [];
  const avisos = [];
  const eventos = [];
  const guardados = [];
  const cola = [...respuestas];
  const windowObj = {
    __nubeActiva: nube,
    __instalacionSyncPermitida: true,
    localStorage,
    storage: {
      async get(key) { return { key, value: key === "productos" ? getValor : null, shared: false }; },
      async set(key, value) { guardados.push([key, value]); return { key, value, shared: false }; },
      async delete(key) { return { key, shared: false }; },
    },
    async getSupabaseClient() {
      return {
        auth: { async getSession() { return { data: { session: sesion ? { user: { id: "u1" } } : null } }; } },
        async rpc(nombre, args) {
          llamadas.push({ nombre, args: JSON.parse(JSON.stringify(args)) });
          const r = cola.length ? cola.shift() : { data: respuestaOk(args), error: null };
          if (typeof r === "function") return r(args);
          return r;
        },
      };
    },
    addEventListener(tipo, fn) { windowObj._oyentes = windowObj._oyentes || {}; windowObj._oyentes[tipo] = fn; },
    dispatchEvent(e) { eventos.push(e); return true; },
  };
  class TestCustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const context = {
    window: windowObj, localStorage,
    console: { log() {}, error() {}, warn(...a) { avisos.push(a.join(" ")); } },
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    CustomEvent: TestCustomEvent,
    Promise, JSON, Error, Date, Math, Object, Array, String, Number,
  };
  vm.createContext(context);
  vm.runInContext(bridgeScript, context, { filename: "ui-context-bridge.js" });
  return { win: windowObj, timers, localStorage, llamadas, avisos, eventos, guardados };
}

function respuestaOk(args) {
  const productos = args.p_productos.map((p) => ({ id: String(p.id), resultado: "ACTUALIZADO", version: 2 }));
  return {
    ok: true, currency_code: args.p_currency_code,
    resumen: { creados: 0, actualizados: productos.length, sin_cambios: 0, desactivados: 0, omitidos: 0, stock_inicial_creado: 0 },
    productos,
  };
}

const prod = (id, extra = {}) => ({ id, localId: "L1", nombre: "Producto " + id, unidad: "unidad", precioVenta: 1.1, ivaVenta: 10, stock: 10, stockPisoVenta: 5, ...extra });
const lista = (...ps) => JSON.stringify(ps);
const pendiente = (t) => JSON.parse(t.localStorage.getItem("la_suite_catalogo_tpv_pendiente_v1") || "{}");

// 1) Solo viajan las diferencias de venta, hacia la RPC correcta y con empresa deducida del local.
{
  const t = setup({ getValor: lista(prod("A"), prod("B")) });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A"), prod("B", { precioVenta: 2.2 })));
  assert.equal(t.llamadas.length, 0, "no se llama a la RPC antes de la espera");
  assert.deepEqual(t.timers.pendientes(), [1500]);
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1);
  const c = t.llamadas[0];
  assert.equal(c.nombre, "abc_catalogo_guardar_productos");
  assert.equal(c.args.p_empresa_id, "E1");
  assert.equal(c.args.p_local_id, "L1");
  assert.equal(c.args.p_currency_code, "EUR");
  assert.deepEqual(c.args.p_productos.map((p) => p.id), ["B"], "solo el producto cambiado");
  assert.equal(c.args.p_productos[0].precioVenta, 2.2);
  assert.match(c.args.p_operation_id, OP_ID);
  assert.deepEqual(pendiente(t), {}, "tras el éxito no queda pendiente");
  assert.equal(t.eventos.at(-1).type, "catalogo-tpv-sincronizado");
  assert.equal(t.guardados.length, 1, "el guardado heredado se hace una vez y no se altera");
}

// 2) Sin lista de referencia no se envía nada; cambios solo de stock tampoco.
{
  const t = setup();
  await t.win.storage.set("productos", lista(prod("A")));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 0, "sin referencia no se vuelca la lista");

  const u = setup({ getValor: lista(prod("A")) });
  await u.win.storage.get("productos");
  await u.win.storage.set("productos", lista(prod("A", { stock: 3, stockPisoVenta: 1 })));
  await u.timers.correr();
  assert.equal(u.llamadas.length, 0, "el stock se mueve constantemente y no dispara el catálogo");
}

// 3) Altas y bajas: nuevo producto viaja completo; el quitado viaja como inactivo.
{
  const t = setup({ getValor: lista(prod("A"), prod("B")) });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A"), prod("C", { stock: 7 })));
  await t.timers.correr();
  const enviados = Object.fromEntries(t.llamadas[0].args.p_productos.map((p) => [p.id, p]));
  assert.deepEqual(Object.keys(enviados).sort(), ["B", "C"]);
  assert.equal(enviados.B.activo, false, "lo quitado de la lista se envía como inactivo");
  assert.equal(enviados.C.stock, 7, "un alta lleva su stock inicial");
}

// 4) Varios cambios seguidos se agrupan en un solo envío (un temporizador).
{
  const t = setup({ getValor: lista(prod("A"), prod("B")) });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 3 }), prod("B")));
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 3 }), prod("B", { nombre: "Otro" })));
  assert.deepEqual(t.timers.pendientes(), [1500], "un único envío planificado");
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1);
  assert.deepEqual(t.llamadas[0].args.p_productos.map((p) => p.id).sort(), ["A", "B"]);
}

// 5) Fallo transitorio: se conserva, se reintenta con el MISMO operation_id y luego se limpia.
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{ data: null, error: { code: "08006", message: "network error" } }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();   // 1.er intento falla, planifica reintento y lo corre
  assert.equal(t.llamadas.length, 2, "se reintentó");
  assert.equal(t.llamadas[0].args.p_operation_id, t.llamadas[1].args.p_operation_id, "el reintento conserva el operation_id");
  assert.deepEqual(pendiente(t), {});
}

// 6) Si el contenido cambia entre intentos, el operation_id cambia y se envía lo más reciente.
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{ data: null, error: { message: "timeout" } }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correrPrimero();               // 1.er intento: falla y se planifica el reintento
  assert.equal(t.llamadas.length, 1);
  assert.deepEqual(t.timers.pendientes(), [2000]);
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 6 })));   // llega otro cambio
  await t.timers.correr();
  assert.equal(t.llamadas.length, 2);
  assert.notEqual(t.llamadas[0].args.p_operation_id, t.llamadas[1].args.p_operation_id, "contenido nuevo, operation_id nuevo");
  assert.equal(t.llamadas[1].args.p_productos[0].precioVenta, 6, "se envía el contenido más reciente");
  assert.deepEqual(pendiente(t), {});
}

// 7) La RPC no existe en el servidor (producción antes de promoverla): se apaga en silencio y no acumula.
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{ data: null, error: { code: "PGRST202", message: "Could not find the function public.abc_catalogo_guardar_productos" } }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1);
  assert.deepEqual(pendiente(t), {}, "no se acumulan pendientes si el servidor no tiene la RPC");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 6 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1, "ya no se intenta más en esta sesión");
  assert.equal(t.guardados.length, 2, "el guardado heredado sigue funcionando");
}

// 8) Sin permiso: se descarta, se avisa una vez y no se reintenta.
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{ data: null, error: { code: "P0001", message: "abc_catalogo_no_autorizado" } }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1, "no se reintenta una denegación");
  assert.deepEqual(pendiente(t), {});
  assert.equal(t.avisos.filter((a) => /no puede guardar el catálogo/.test(a)).length, 1);
  assert.equal(t.eventos.at(-1).type, "catalogo-tpv-error");
  assert.equal(t.eventos.at(-1).detail.motivo, "sin_permiso");
}

// 9) Local sin contexto fiscal: queda pendiente, avisa, y no entra en bucle de reintentos.
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{ data: null, error: { code: "P0001", message: "catalogo_contexto_fiscal_ausente" } }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1, "no hay bucle de reintentos");
  assert.equal(Object.keys(pendiente(t)).length, 1, "el cambio sigue pendiente hasta que se configure");
  assert.equal(t.eventos.at(-1).detail.motivo, "contexto_fiscal");
}

// 10) operation_id_conflict: se regenera el id y se reintenta.
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{ data: null, error: { code: "P0001", message: "operation_id_conflict" } }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 2);
  assert.notEqual(t.llamadas[0].args.p_operation_id, t.llamadas[1].args.p_operation_id);
}

// 11) Sin nube activa o sin sesión no se envía; con sesión caducada queda pendiente.
{
  const t = setup({ nube: false, getValor: lista(prod("A")) });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 0);
  assert.deepEqual(pendiente(t), {}, "con la nube apagada tampoco se encola");

  const u = setup({ sesion: false, getValor: lista(prod("A")) });
  await u.win.storage.get("productos");
  await u.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await u.timers.correr();
  assert.equal(u.llamadas.length, 0);
  assert.equal(Object.keys(pendiente(u)).length, 1, "sin sesión queda pendiente");
}

// 12) Un fallo del puente nunca rompe el guardado de la pantalla; las demás claves pasan sin tocar.
{
  const t = setup({ getValor: lista(prod("A")) });
  await t.win.storage.get("productos");
  t.win.getSupabaseClient = async () => { throw new Error("cliente roto"); };
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.guardados.length, 1, "el guardado heredado se completó");
  await t.win.storage.set("temaOscuro", "true");
  await t.win.storage.set("conteos", "[]");
  assert.deepEqual(t.guardados.map((g) => g[0]), ["productos", "temaOscuro", "conteos"]);
  assert.equal(t.llamadas.length, 0);
}

// 13) Productos sin local o sin empresa resoluble no se envían (y se avisa una vez).
{
  const t = setup({ getValor: lista(prod("A")), locales: [] });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  assert.equal(t.llamadas.length, 0);
  assert.equal(t.avisos.filter((a) => /sin empresa o local/.test(a)).length, 1);

  const u = setup({ getValor: lista(prod("A", { localId: undefined })) });
  await u.win.storage.get("productos");
  await u.win.storage.set("productos", lista(prod("A", { localId: undefined, precioVenta: 5 })));
  await u.timers.correr();
  assert.equal(u.llamadas.length, 0, "sin localId no se adivina el local");
}

// 14) Pendientes de una sesión anterior se reintentan al arrancar.
{
  const t = setup({
    pendiente: { "E1|L1": { empresaId: "E1", localId: "L1", opId: "p3.cat.L1.previo.0001", productos: { A: prod("A") } } },
  });
  assert.deepEqual(t.timers.pendientes(), [3000], "al cargar se planifica el reintento");
  await t.timers.correr();
  assert.equal(t.llamadas.length, 1);
  assert.equal(t.llamadas[0].args.p_operation_id, "p3.cat.L1.previo.0001", "se reutiliza el operation_id guardado");
  assert.deepEqual(pendiente(t), {});
}

// 15) Volcado completo explícito y troceado en lotes de 200.
{
  const muchos = Array.from({ length: 450 }, (_, i) => prod("P" + String(i).padStart(3, "0")));
  const t = setup({ getValor: JSON.stringify(muchos) });
  await t.win.storage.get("productos");
  const r = await t.win.__catalogoTpv.sincronizarTodo();
  assert.equal(r.ok, true);
  assert.deepEqual(t.llamadas.map((c) => c.args.p_productos.length), [200, 200, 50]);
  const ids = t.llamadas.map((c) => c.args.p_operation_id);
  assert.equal(new Set(ids).size, 3, "cada lote lleva su propio operation_id");
  ids.forEach((id) => assert.match(id, OP_ID));
  const vacio = setup();
  assert.deepEqual(JSON.parse(JSON.stringify(await vacio.win.__catalogoTpv.sincronizarTodo())), { ok: false, motivo: "sin_lista" });
}

// 16) Los omitidos por el servidor se avisan (menos los esperados: no vendible / inactivo).
{
  const t = setup({
    getValor: lista(prod("A")),
    respuestas: [{
      data: {
        ok: true, currency_code: "EUR",
        resumen: { creados: 0, actualizados: 0, sin_cambios: 0, desactivados: 0, omitidos: 2, stock_inicial_creado: 0 },
        productos: [{ id: "A", resultado: "OMITIDO", motivo: "iva_invalido" }, { id: "B", resultado: "OMITIDO", motivo: "no_vendible" }],
      },
      error: null,
    }],
  });
  await t.win.storage.get("productos");
  await t.win.storage.set("productos", lista(prod("A", { precioVenta: 5 })));
  await t.timers.correr();
  const aviso = t.avisos.find((a) => /omitió productos/.test(a));
  assert.ok(aviso && /iva_invalido/.test(JSON.stringify(t.eventos.at(-1).detail.omitidos)));
  assert.ok(!/no_vendible/.test(JSON.stringify(t.eventos.at(-1).detail.omitidos)), "no_vendible es esperado y no se avisa");
}

console.log("p3-catalogo-bridge: OK");
