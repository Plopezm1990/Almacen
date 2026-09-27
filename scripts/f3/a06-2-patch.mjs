import fs from "node:fs";

const sourcePath = "source-recovery/fuente-recuperado.js";
let source = fs.readFileSync(sourcePath, "utf8");

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}
function replaceOnce(haystack, needle, replacement, label) {
  const n = countOf(haystack, needle);
  if (n !== 1) throw new Error(`${label}: expected 1 anchor, found ${n}`);
  return haystack.replace(needle, replacement);
}

// A06.2 — detectar conflictos de optimistic locking sin perder el código original.
source = replaceOnce(
  source,
  "  function errorRpcA02(error) {\n",
`  function esConflictoVersionA06(error) {
    const msg = String(error?.message || error || "");
    return msg.includes("cuenta_version_conflict")
      || msg.includes("pedido_version_conflict")
      || msg.includes("linea_version_conflict");
  }
  function respuestaErrorA06(error) {
    const conflict = esConflictoVersionA06(error);
    return {
      ok: false,
      error: errorRpcA02(error),
      conflict,
      conflictType: conflict ? "VERSION" : null
    };
  }
  function errorRpcA02(error) {
`,
  "A06.2 conflict helpers"
);

// Solo los catches finales de las tres rutas que escriben el agregado se convierten
// en respuestas tipadas de conflicto; el resto de validaciones sigue igual.
const venderStart = source.indexOf("async function venderCarritoA02(");
const enviarStart = source.indexOf("async function enviarPedidoA05()", venderStart);
if (venderStart < 0 || enviarStart < 0) throw new Error("A06.2 venderCarrito block missing");
let venderBlock = source.slice(venderStart, enviarStart);
const genericCatch = '    } catch (error) {\n      return { ok: false, error: errorRpcA02(error) };\n    }\n  }';
if (!venderBlock.endsWith(genericCatch + "\n")) throw new Error("A06.2 venderCarrito catch anchor mismatch");
venderBlock = venderBlock.slice(0, -genericCatch.length - 1)
  + '    } catch (error) {\n      return respuestaErrorA06(error);\n    }\n  }\n';
source = source.slice(0, venderStart) + venderBlock + source.slice(enviarStart);

const enviarStart2 = source.indexOf("async function enviarPedidoA05()");
const accionStart = source.indexOf("async function accionPedidoA05(", enviarStart2);
if (enviarStart2 < 0 || accionStart < 0) throw new Error("A06.2 enviar block missing");
let enviarBlock = source.slice(enviarStart2, accionStart);
if (!enviarBlock.endsWith(genericCatch + "\n")) throw new Error("A06.2 enviar catch anchor mismatch");
enviarBlock = enviarBlock.slice(0, -genericCatch.length - 1)
  + '    } catch (error) {\n      return respuestaErrorA06(error);\n    }\n  }\n';
source = source.slice(0, enviarStart2) + enviarBlock + source.slice(accionStart);

const accionStart2 = source.indexOf("async function accionPedidoA05(");
const recuperarStart = source.indexOf("async function recuperarCuentaA06()", accionStart2);
if (accionStart2 < 0 || recuperarStart < 0) throw new Error("A06.2 accion block missing");
let accionBlock = source.slice(accionStart2, recuperarStart);
if (!accionBlock.endsWith(genericCatch + "\n")) throw new Error("A06.2 accion catch anchor mismatch");
accionBlock = accionBlock.slice(0, -genericCatch.length - 1)
  + '    } catch (error) {\n      return respuestaErrorA06(error);\n    }\n  }\n';
source = source.slice(0, accionStart2) + accionBlock + source.slice(recuperarStart);

// Borrador local A06.2: solo conserva intención de pedido, nunca precio/total autoritativo.
// Política: 24 h desde la última modificación local. Se aísla por empresa + local.
source = replaceOnce(
  source,
  "function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {",
`const A06_BORRADOR_TTL_MS = 24 * 60 * 60 * 1e3;
function claveBorradorTpvA06(empresaId, localId) {
  if (!empresaId || !localId) return null;
  return \`la_suite_abc_tpv_borrador_v1:\${empresaId}:\${localId}\`;
}
function lineasBorradorTpvA06(lineas) {
  if (!Array.isArray(lineas) || lineas.length > 200) throw new Error("borrador_a06_invalido");
  return lineas.map((linea) => {
    const productoId = String(linea?.productoId || "");
    const cantidad = Number(linea?.cantidad);
    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) throw new Error("borrador_a06_invalido");
    const configuracionA04 = linea?.configuracionA04 && typeof linea.configuracionA04 === "object"
      ? linea.configuracionA04
      : null;
    return {
      claveCarrito: String(linea?.claveCarrito || productoId),
      productoId,
      cantidad,
      configuracionA04
    };
  });
}
function leerBorradorTpvA06(empresaId, localId, ahoraMs = Date.now()) {
  const key = claveBorradorTpvA06(empresaId, localId);
  if (!key) return { estado: "VACIO", lineas: [] };
  let raw = null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    return { estado: "NO_DISPONIBLE", lineas: [], error: "No se puede acceder al borrador local del TPV." };
  }
  if (!raw) return { estado: "VACIO", lineas: [] };
  try {
    const borrador = JSON.parse(raw);
    if (!borrador || borrador.schemaVersion !== 1 || borrador.estado !== "BORRADOR_LOCAL"
      || borrador.empresaId !== empresaId || borrador.localId !== localId
      || !Number.isFinite(Number(borrador.expiresAtMs))) {
      throw new Error("borrador_a06_invalido");
    }
    if (Number(borrador.expiresAtMs) <= Number(ahoraMs)) {
      try { localStorage.removeItem(key); } catch (error) {}
      return { estado: "CADUCADO", lineas: [], caducadoAtMs: Number(borrador.expiresAtMs) };
    }
    return {
      estado: "ACTIVO",
      lineas: lineasBorradorTpvA06(borrador.lineas),
      updatedAtMs: Number(borrador.updatedAtMs) || null,
      expiresAtMs: Number(borrador.expiresAtMs)
    };
  } catch (error) {
    try { localStorage.removeItem(key); } catch (e2) {}
    return { estado: "INVALIDO", lineas: [], error: "El borrador local estaba dañado y se descartó." };
  }
}
function guardarBorradorTpvA06(empresaId, localId, lineas, ahoraMs = Date.now()) {
  const key = claveBorradorTpvA06(empresaId, localId);
  if (!key) return { estado: "VACIO", lineas: [] };
  const normalizadas = lineasBorradorTpvA06(lineas || []);
  try {
    if (normalizadas.length === 0) {
      localStorage.removeItem(key);
      return { estado: "VACIO", lineas: [] };
    }
    const expiresAtMs = Number(ahoraMs) + A06_BORRADOR_TTL_MS;
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      estado: "BORRADOR_LOCAL",
      empresaId,
      localId,
      updatedAtMs: Number(ahoraMs),
      expiresAtMs,
      lineas: normalizadas
    }));
    return { estado: "ACTIVO", lineas: normalizadas, updatedAtMs: Number(ahoraMs), expiresAtMs };
  } catch (error) {
    return { estado: "NO_DISPONIBLE", lineas: normalizadas, error: "No se pudo guardar el borrador local del TPV." };
  }
}
function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {`,
  "A06.2 local draft helpers"
);

// Estado de borrador/conflicto visible.
source = replaceOnce(
  source,
  '  const [errorA05, setErrorA05] = (0, import_react4.useState)("");\n  const [pedidoOperativoA05, setPedidoOperativoA05] = (0, import_react4.useState)(null);\n',
`  const [errorA05, setErrorA05] = (0, import_react4.useState)("");
  const [pedidoOperativoA05, setPedidoOperativoA05] = (0, import_react4.useState)(null);
  const [borradorCargadoA06, setBorradorCargadoA06] = (0, import_react4.useState)(false);
  const [estadoBorradorA06, setEstadoBorradorA06] = (0, import_react4.useState)({ estado: "VACIO", lineas: [] });
  const [conflictoA06, setConflictoA06] = (0, import_react4.useState)(null);
  const omitirPersistenciaInicialA06Ref = (0, import_react4.useRef)(true);
`,
  "A06.2 state"
);

// Restaurar y persistir borrador por contexto antes de recuperar la cuenta servidor.
source = replaceOnce(
  source,
  "  (0, import_react4.useEffect)(() => {\n    let activo = true;\n    const localPersistido = typeof leerPedidoOperativoA05 === \"function\" ? leerPedidoOperativoA05() : null;\n",
`  (0, import_react4.useEffect)(() => {
    const empresaId = configEmpresa?.id || null;
    const localId = local?.id || null;
    omitirPersistenciaInicialA06Ref.current = true;
    const lectura = leerBorradorTpvA06(empresaId, localId);
    setEstadoBorradorA06(lectura);
    setCarrito(lectura.estado === "ACTIVO" ? lectura.lineas : []);
    setBorradorCargadoA06(true);
    setConflictoA06(null);
  }, [local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    if (!borradorCargadoA06) return;
    if (omitirPersistenciaInicialA06Ref.current) {
      omitirPersistenciaInicialA06Ref.current = false;
      return;
    }
    const empresaId = configEmpresa?.id || null;
    const localId = local?.id || null;
    setEstadoBorradorA06(guardarBorradorTpvA06(empresaId, localId, carrito));
  }, [carrito, borradorCargadoA06, local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    let activo = true;
    const localPersistido = typeof leerPedidoOperativoA05 === "function" ? leerPedidoOperativoA05() : null;
`,
  "A06.2 draft effects"
);

// Reconciliación explícita: servidor gana, pero el carrito/borrador local NO se borra.
source = replaceOnce(
  source,
  "  async function confirmarCobro() {\n",
`  async function gestionarConflictoA06(resultado, origen) {
    if (!resultado?.conflict) return false;
    let recuperado = null;
    if (typeof recuperarCuentaA06 === "function") {
      try {
        recuperado = await recuperarCuentaA06();
      } catch (error) {
      }
    }
    if (recuperado?.ok && recuperado.pedidoId) {
      setPedidoOperativoA05(recuperado);
      setConfirmacion((actual) => actual && actual.pedidoId === recuperado.pedidoId ? {
        ...actual,
        pedidoVersion: recuperado.pedidoVersion,
        pedidoEstado: recuperado.pedidoEstado,
        lineas: recuperado.lineas
      } : actual);
    }
    setConflictoA06({
      origen,
      mensaje: resultado.error || "La cuenta cambió en otro terminal.",
      revisionServidor: recuperado?.revision || null,
      recuperado: !!(recuperado?.ok && recuperado.pedidoId)
    });
    return true;
  }

  async function confirmarCobro() {
`,
  "A06.2 UI conflict resolver"
);

source = replaceOnce(
  source,
  '    if (!resultado || resultado.ok === false) {\n      const prod = resultado && resultado.productoId ? productos.find((p22) => p22.id === resultado.productoId) : null;\n',
`    if (!resultado || resultado.ok === false) {
      if (await gestionarConflictoA06(resultado, "GUARDAR_PEDIDO")) {
        setErrorVenta("");
        return;
      }
      const prod = resultado && resultado.productoId ? productos.find((p22) => p22.id === resultado.productoId) : null;
`,
  "A06.2 save conflict branch"
);

source = replaceOnce(
  source,
  '    setErrorA05("");\n    if (typeof leerPedidoOperativoA05 === "function") {\n',
`    setErrorA05("");
    setConflictoA06(null);
    if (typeof leerPedidoOperativoA05 === "function") {
`,
  "A06.2 clear save conflict"
);

source = replaceOnce(
  source,
  '      if (!resultado || resultado.ok === false) {\n        setErrorA05(resultado?.error || "No se pudo enviar el pedido.");\n        return;\n      }\n',
`      if (!resultado || resultado.ok === false) {
        if (await gestionarConflictoA06(resultado, "ENVIAR_PEDIDO")) {
          setErrorA05("");
          return;
        }
        setErrorA05(resultado?.error || "No se pudo enviar el pedido.");
        return;
      }
      setConflictoA06(null);
`,
  "A06.2 send conflict branch"
);

source = replaceOnce(
  source,
  '      if (!resultado || resultado.ok === false) {\n        setErrorA05(resultado?.error || "No se pudo realizar la operación.");\n        return;\n      }\n',
`      if (!resultado || resultado.ok === false) {
        if (await gestionarConflictoA06(resultado, "ACCION_PEDIDO")) {
          setErrorA05("");
          return;
        }
        setErrorA05(resultado?.error || "No se pudo realizar la operación.");
        return;
      }
      setConflictoA06(null);
`,
  "A06.2 action conflict branch"
);

// Visibilidad obligatoria: estado del borrador + conflicto concurrente.
source = replaceOnce(
  source,
  '/* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "A02/A04 guardan la cuenta y el pedido con autoridad del servidor; A05 permite enviarlo de forma operativa. Los productos configurables usan variantes y modificadores A04. ", /* @__PURE__ */ import_react4.default.createElement("b", null, "No registra cobro, tique fiscal ni movimiento de stock"), ". El total definitivo lo confirma el servidor.")), renderPedidoOperativoA05(),',
`/* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "A02/A04 guardan la cuenta y el pedido con autoridad del servidor; A05 permite enviarlo de forma operativa. Los productos configurables usan variantes y modificadores A04. ", /* @__PURE__ */ import_react4.default.createElement("b", null, "No registra cobro, tique fiscal ni movimiento de stock"), ". El total definitivo lo confirma el servidor.")),
  estadoBorradorA06?.estado === "ACTIVO" ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold" }, "Borrador local activo"),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, carrito.length, " línea(s) · se conserva 24 h desde la última modificación · caduca ", estadoBorradorA06.expiresAtMs ? new Date(estadoBorradorA06.expiresAtMs).toLocaleString("es-ES") : "")
  ) : estadoBorradorA06?.estado === "CADUCADO" ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "Borrador local caducado: se descartó porque superó la política de 24 h.")
  ) : estadoBorradorA06?.estado === "INVALIDO" || estadoBorradorA06?.estado === "NO_DISPONIBLE" ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-4 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, estadoBorradorA06.error || "No se puede usar el borrador local.") : null,
  conflictoA06 ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: "#FCE8E6", border: "1px solid " + C2.red } },
    /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] font-semibold", style: { color: C2.red } }, "Conflicto de edición: otro terminal cambió esta cuenta."),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, conflictoA06.recuperado ? "Se ha recargado la versión del servidor. Tu borrador local no se ha borrado: revísalo antes de repetir la acción." : "No se ha sobrescrito el servidor. Tu borrador local se conserva; recarga la cuenta antes de repetir la acción."),
    conflictoA06.revisionServidor ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono text-[9.5px] mt-1", style: { color: C2.inkSoft } }, "Revisión servidor: ", conflictoA06.revisionServidor) : null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setConflictoA06(null) }, "Entendido")
  ) : null,
  renderPedidoOperativoA05(),`,
  "A06.2 visible states"
);

fs.writeFileSync(sourcePath, source);
console.log("A06_2_PATCH=PASS");
