import fs from "node:fs";

const sourcePath = process.argv[2] || "source-recovery/fuente-recuperado.js";
let source = fs.readFileSync(sourcePath, "utf8");

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function replaceOnce(haystack, needle, replacement, label) {
  const actualNeedle = haystack.includes(needle) ? needle : needle.replaceAll("\n", "\r\n");
  const actualReplacement = actualNeedle.includes("\r\n") ? replacement.replaceAll("\n", "\r\n") : replacement;
  const n = countOf(haystack, actualNeedle);
  if (n !== 1) throw new Error(`${label}: expected 1 anchor, found ${n}`);
  return haystack.replace(actualNeedle, actualReplacement);
}

const confirmarA05 = String.raw`
  async function confirmarPedidoA05() {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de confirmar el pedido." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa para confirmar el pedido." };
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) return { ok: false, error: "A05 requiere conexión con el servidor para confirmar el pedido." };

    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      if (contexto.pedidoEstado !== "ABIERTO" && contexto.pedidoEstado !== "BORRADOR") {
        throw new Error("pedido_no_confirmable");
      }

      const supabase = await window.getSupabaseClient();
      let pedidoVersion = versionServidorA02(contexto.pedidoVersion, "a05.4.pedido_version");

      for (const linea of contexto.lineas) {
        if (linea.estado === "CONFIRMADA") continue;
        if (linea.estado !== "BORRADOR") throw new Error("linea_no_confirmable");

        const operationId = "a05.4.confirm." + linea.lineaId;
        let confirmado = null;
        if (linea.configuradaA04) {
          const configuracion = linea.configuracionA04;
          if (!configuracion || !Number.isSafeInteger(Number(configuracion.expectedProductVersion)) || !Array.isArray(configuracion.selecciones)) {
            throw new Error("configuracion_a04_contexto_ausente");
          }
          confirmado = await rpcA02ConRecuperacion(supabase, "abc_confirmar_linea_pedido_configurada", {
            p_operation_id: operationId,
            p_empresa_id: empresaId,
            p_local_id: localActivoId,
            p_linea_id: linea.lineaId,
            p_expected_product_version: Number(configuracion.expectedProductVersion),
            p_selecciones: configuracion.selecciones,
            p_expected_linea_version: versionServidorA02(linea.lineaVersion, "a05.4.linea_version"),
            p_expected_pedido_version: pedidoVersion,
            p_terminal_id: contexto.terminalId,
            p_session_id: contexto.sessionId,
            p_operating_day: contexto.operatingDay
          }, empresaId, localActivoId, operationId);
        } else {
          confirmado = await rpcA02ConRecuperacion(supabase, "abc_confirmar_linea_pedido", {
            p_operation_id: operationId,
            p_empresa_id: empresaId,
            p_local_id: localActivoId,
            p_linea_id: linea.lineaId,
            p_expected_linea_version: versionServidorA02(linea.lineaVersion, "a05.4.linea_version"),
            p_expected_pedido_version: pedidoVersion,
            p_terminal_id: contexto.terminalId,
            p_session_id: contexto.sessionId,
            p_operating_day: contexto.operatingDay
          }, empresaId, localActivoId, operationId);
        }

        linea.lineaVersion = versionServidorA02(confirmado?.linea_version, "a05.4.confirm.linea_version");
        linea.estado = String(confirmado?.estado || "CONFIRMADA");
        if (linea.estado !== "CONFIRMADA") throw new Error("confirmacion_linea_respuesta_invalida");
        pedidoVersion = versionServidorA02(confirmado?.pedido_version, "a05.4.confirm.pedido_version");
        contexto.pedidoVersion = pedidoVersion;
        contexto.pedidoEstado = "ABIERTO";
        contexto.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        guardarContextoCuentaA02(empresaId, localActivoId, contexto);
      }

      contexto.pedidoVersion = pedidoVersion;
      contexto.pedidoEstado = "ABIERTO";
      contexto.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const guardado = guardarContextoCuentaA02(empresaId, localActivoId, contexto);
      return {
        ok: true,
        pedidoId: guardado.pedidoId,
        pedidoVersion: guardado.pedidoVersion,
        pedidoEstado: guardado.pedidoEstado,
        lineas: guardado.lineas,
        lineasConfirmadas: guardado.lineas.filter((linea) => linea.estado === "CONFIRMADA").length
      };
    } catch (error) {
      return { ok: false, error: errorRpcA02(error) };
    }
  }

`;

source = replaceOnce(
  source,
  "  return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06,",
  "  return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, confirmarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06,",
  "A05.4 export confirmation adapter"
);

source = replaceOnce(
  source,
  "  async function enviarPedidoA05() {\n",
  confirmarA05 + "  async function enviarPedidoA05() {\n",
  "A05.4 confirmation adapter"
);

source = replaceOnce(
  source,
  '    if (msg.includes("pedido_no_enviable")) return "El pedido ya no está en un estado que permita enviarlo.";\n',
  '    if (msg.includes("pedido_no_enviable")) return "El pedido ya no está en un estado que permita enviarlo.";\n' +
    '    if (msg.includes("pedido_no_confirmable")) return "El pedido ya no está en un estado que permita confirmarlo.";\n' +
    '    if (msg.includes("confirmacion_linea_respuesta_invalida")) return "El servidor no confirmó la línea como esperaba.";\n',
  "A05.4 errors"
);

source = replaceOnce(
  source,
  "function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06,",
  "function VentaRapida({ productos, venderCarrito, enviarPedidoA05, confirmarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06,",
  "A05.4 VentaRapida prop"
);

source = replaceOnce(
  source,
  '      modalidad: resultado.modalidad || null\n    });\n',
  '      modalidad: resultado.modalidad || null,\n      lineasConfirmadas: Array.isArray(resultado.lineas) ? resultado.lineas.filter((linea) => linea.estado === "CONFIRMADA").length : 0\n    });\n',
  "A05.4 initial line confirmation count"
);

const confirmarUi = String.raw`
  async function confirmarPedidoGuardadoA05() {
    if (procesandoA05 || !confirmacion || typeof confirmarPedidoA05 !== "function") return;
    setProcesandoA05(true);
    setErrorA05("");
    try {
      const resultado = await confirmarPedidoA05();
      if (!resultado || resultado.ok === false) {
        if (await gestionarConflictoA06(resultado, "CONFIRMAR_PEDIDO")) {
          setErrorA05("");
          return;
        }
        setErrorA05(resultado?.error || "No se pudo confirmar el pedido.");
        return;
      }
      setConflictoA06(null);
      setConfirmacion((actual) => actual ? {
        ...actual,
        pedidoVersion: resultado.pedidoVersion,
        pedidoEstado: resultado.pedidoEstado || "ABIERTO",
        lineas: Array.isArray(resultado.lineas) ? resultado.lineas : actual.lineas,
        lineasConfirmadas: Number(resultado.lineasConfirmadas) || 0
      } : actual);
      setPedidoOperativoA05(resultado);
    } finally {
      setProcesandoA05(false);
    }
  }
`;

const ventaStart = source.indexOf("function VentaRapida(");
const returnMarker = '  return /* @__PURE__ */ import_react4.default.createElement("div", null,';
const returnPos = source.indexOf(returnMarker, ventaStart);
if (ventaStart < 0 || returnPos < 0) throw new Error("A05.4 UI return anchor not found");
source = source.slice(0, returnPos) + confirmarUi + source.slice(returnPos);

const modalStart = source.indexOf('confirmacion && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => !procesandoA05 && setConfirmacion(null), title: confirmacion.pedidoEstado === "ENVIADO" ? "Pedido enviado" : "Pedido guardado" }', ventaStart);
const modalEnd = source.indexOf(", renderHistorialVentas()", modalStart);
if (modalStart < 0 || modalEnd < 0) throw new Error("A05.4 confirmation modal anchor not found");
const modalNuevo = String.raw`confirmacion && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => !procesandoA05 && setConfirmacion(null), title: confirmacion.pedidoEstado === "ENVIADO" ? "Pedido enviado" : "Pedido guardado" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-2" }, confirmacion.currencyCode || "EUR", " ", fmt(confirmacion.total), " · ", confirmacion.n, " línea(s)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.inkSoft } }, "Cuenta ", confirmacion.cuentaId || "", " · Pedido ", confirmacion.pedidoId || "", confirmacion.modalidad ? " · Modalidad: " + (MODALIDADES_ETIQUETA_A02[confirmacion.modalidad] || confirmacion.modalidad) : ""), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2 font-semibold", style: { color: confirmacion.pedidoEstado === "ENVIADO" ? C2.accent : C2.ink } }, "Estado operativo: ", confirmacion.pedidoEstado || "ABIERTO"), confirmacion.lineasConfirmadas != null ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2 font-semibold", style: { color: confirmacion.lineasConfirmadas > 0 ? C2.accent : C2.inkSoft } }, "Líneas confirmadas: ", confirmacion.lineasConfirmadas, "/", confirmacion.n) : null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, confirmacion.pedidoEstado === "ENVIADO" ? "A05 ha confirmado las líneas y enviado el pedido. Continúa su preparación, servido o cancelación desde el panel operativo del TPV." : confirmacion.lineasConfirmadas > 0 ? "La línea está CONFIRMADA y permanece sin enviar. Puedes dejarla así para una devolución recuperable o enviarla a preparación." : "A02/A04 han persistido cuenta, pedido y líneas. Confirma las líneas para dejarlas en CONFIRMADA o envíalas a preparación."), errorA05 && /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorA05), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, confirmacion.pedidoEstado !== "ENVIADO" && confirmacion.lineasConfirmadas < Number(confirmacion.n || 0) ? /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarPedidoGuardadoA05, disabled: procesandoA05 }, procesandoA05 ? "Confirmando pedido…" : "Confirmar pedido") : null, confirmacion.pedidoEstado !== "ENVIADO" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: enviarPedidoGuardadoA05, disabled: procesandoA05 }, procesandoA05 ? "Enviando pedido…" : "Enviar pedido") : null, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmacion(null), disabled: procesandoA05 }, confirmacion.pedidoEstado === "ENVIADO" ? "Aceptar" : "Cerrar")))`;
source = source.slice(0, modalStart) + modalNuevo + source.slice(modalEnd);

source = replaceOnce(
  source,
  "import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05,",
  "import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, confirmarPedidoA05, leerPedidoOperativoA05, accionPedidoA05,",
  "A05.4 prop wiring"
);

fs.writeFileSync(sourcePath, source);
console.log("A05_4_PATCH=PASS");
