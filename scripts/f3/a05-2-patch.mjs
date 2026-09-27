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

// 1. El contexto persistido A02/A04 incorpora estado operativo A05.
source = replaceOnce(
  source,
`    versionServidorA02(contexto.pedidoVersion, "contexto.pedido_version");
    if (!uuidPersistidoA02(contexto.terminalId) || !uuidPersistidoA02(contexto.sessionId)) throw new Error("contexto_cuenta_persistido_invalido");
`,
`    versionServidorA02(contexto.pedidoVersion, "contexto.pedido_version");
    const pedidoEstadoA05 = String(contexto.pedidoEstado || "ABIERTO");
    if (!["BORRADOR", "ABIERTO", "ENVIADO", "EN_PREPARACION", "PARCIALMENTE_PREPARADO", "PREPARADO", "SERVIDO", "CERRADO", "CANCELADO"].includes(pedidoEstadoA05)) {
      throw new Error("contexto_cuenta_persistido_invalido");
    }
    contexto.pedidoEstado = pedidoEstadoA05;
    if (!uuidPersistidoA02(contexto.terminalId) || !uuidPersistidoA02(contexto.sessionId)) throw new Error("contexto_cuenta_persistido_invalido");
`,
  "A05 pedido state context"
);

source = replaceOnce(
  source,
`      versionServidorA02(linea.lineaVersion, "contexto.linea_version");
      if (!Number.isFinite(Number(linea.cantidad)) || Number(linea.cantidad) <= 0) throw new Error("contexto_cuenta_persistido_invalido");
      importeServidorA02(linea.total, "contexto.linea_total");
`,
`      versionServidorA02(linea.lineaVersion, "contexto.linea_version");
      const lineaEstadoA05 = String(linea.estado || "BORRADOR");
      if (!["BORRADOR", "CONFIRMADA", "ENVIADA", "EN_PREPARACION", "PREPARADA", "SERVIDA", "CANCELADA"].includes(lineaEstadoA05)) {
        throw new Error("contexto_cuenta_persistido_invalido");
      }
      linea.estado = lineaEstadoA05;
      if (!Number.isFinite(Number(linea.cantidad)) || Number(linea.cantidad) <= 0) throw new Error("contexto_cuenta_persistido_invalido");
      importeServidorA02(linea.total, "contexto.linea_total");
`,
  "A05 line state context"
);

// 2. Mensajes de error A05.
source = replaceOnce(
  source,
`    if (msg.includes("cuenta_version_conflict") || msg.includes("pedido_version_conflict") || msg.includes("linea_version_conflict")) return "La cuenta, el pedido o una línea cambió en otro terminal. Recarga antes de continuar.";
`,
`    if (msg.includes("cuenta_version_conflict") || msg.includes("pedido_version_conflict") || msg.includes("linea_version_conflict")) return "La cuenta, el pedido o una línea cambió en otro terminal. Recarga antes de continuar.";
    if (msg.includes("pedido_enviar_no_autorizado")) return "Tu perfil no tiene permiso para enviar este pedido.";
    if (msg.includes("pedido_no_enviable")) return "El pedido ya no está en un estado que permita enviarlo.";
    if (msg.includes("pedido_lineas_no_confirmadas")) return "Hay líneas que todavía no están confirmadas y el pedido no puede enviarse.";
    if (msg.includes("pedido_sin_lineas_enviables")) return "El pedido no contiene líneas que se puedan enviar.";
    if (msg.includes("linea_no_confirmable")) return "Una línea cambió de estado y ya no puede confirmarse desde este pedido.";
    if (msg.includes("configuracion_a04_contexto_ausente")) return "Falta la configuración original de una variante o modificador. Vuelve a crear ese pedido antes de enviarlo.";
`,
  "A05 errors"
);

// 3. Guardar el estado y configuración necesaria para la transición A05.
source = replaceOnce(
  source,
`        pedidoId: pending.pedidoId,
        pedidoVersion,
        lineas: pending.lineas.map((l22) => ({
`,
`        pedidoId: pending.pedidoId,
        pedidoVersion,
        pedidoEstado: "ABIERTO",
        lineas: pending.lineas.map((l22) => ({
`,
  "A05 initial pedido state"
);

source = replaceOnce(
  source,
`          lineaVersion: versionServidorA02(l22.resultado?.linea_version, "linea.linea_version"),
          productoId: l22.productoId,
          cantidad: l22.cantidad,
          configuradaA04: !!l22.configuracionA04,
          opciones: Array.isArray(l22.resultado?.opciones) ? l22.resultado.opciones : [],
          total: importeServidorA02(l22.resultado?.total, "linea.total")
`,
`          lineaVersion: versionServidorA02(l22.resultado?.linea_version, "linea.linea_version"),
          estado: String(l22.resultado?.estado || "BORRADOR"),
          productoId: l22.productoId,
          cantidad: l22.cantidad,
          configuradaA04: !!l22.configuracionA04,
          configuracionA04: l22.configuracionA04 ? {
            expectedProductVersion: Number(l22.configuracionA04.expectedProductVersion),
            selecciones: (l22.configuracionA04.selecciones || []).map((s22) => ({
              grupo_id: s22.grupo_id,
              opcion_id: s22.opcion_id,
              cantidad: Number(s22.cantidad),
              expected_group_version: Number(s22.expected_group_version),
              expected_product_group_version: Number(s22.expected_product_group_version),
              expected_option_version: Number(s22.expected_option_version)
            }))
          } : null,
          opciones: Array.isArray(l22.resultado?.opciones) ? l22.resultado.opciones : [],
          total: importeServidorA02(l22.resultado?.total, "linea.total")
`,
  "A05 line context data"
);

source = replaceOnce(
  source,
`        pedidoId: agregado.pedidoId,
        pedidoVersion: agregado.pedidoVersion,
        lineas: agregado.lineas,
`,
`        pedidoId: agregado.pedidoId,
        pedidoVersion: agregado.pedidoVersion,
        pedidoEstado: agregado.pedidoEstado,
        lineas: agregado.lineas,
`,
  "A05 result state"
);

// 4. Adaptador A05.2: confirmar líneas y enviar pedido con idempotencia.
source = replaceOnce(
  source,
`  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {
`,
`  async function enviarPedidoA05() {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de enviar el pedido." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa para enviar el pedido." };
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) return { ok: false, error: "A05 requiere conexión con el servidor para enviar el pedido." };

    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      if (contexto.pedidoEstado === "ENVIADO") {
        return {
          ok: true,
          pedidoId: contexto.pedidoId,
          pedidoVersion: contexto.pedidoVersion,
          pedidoEstado: contexto.pedidoEstado,
          lineas: contexto.lineas
        };
      }
      if (contexto.pedidoEstado !== "ABIERTO" && contexto.pedidoEstado !== "BORRADOR") {
        throw new Error("pedido_no_enviable");
      }

      const supabase = await window.getSupabaseClient();
      let pedidoVersion = versionServidorA02(contexto.pedidoVersion, "a05.pedido_version");

      for (const linea of contexto.lineas) {
        if (linea.estado === "CONFIRMADA") {
          continue;
        }
        if (linea.estado !== "BORRADOR") {
          throw new Error("linea_no_confirmable");
        }

        const operationId = `a05.2.confirm.${linea.lineaId}`;
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
            p_expected_linea_version: versionServidorA02(linea.lineaVersion, "a05.linea_version"),
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
            p_expected_linea_version: versionServidorA02(linea.lineaVersion, "a05.linea_version"),
            p_expected_pedido_version: pedidoVersion,
            p_terminal_id: contexto.terminalId,
            p_session_id: contexto.sessionId,
            p_operating_day: contexto.operatingDay
          }, empresaId, localActivoId, operationId);
        }

        linea.lineaVersion = versionServidorA02(confirmado?.linea_version, "a05.confirm.linea_version");
        linea.estado = String(confirmado?.estado || "CONFIRMADA");
        pedidoVersion = versionServidorA02(confirmado?.pedido_version, "a05.confirm.pedido_version");
        contexto.pedidoVersion = pedidoVersion;
        contexto.pedidoEstado = "ABIERTO";
        contexto.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        guardarContextoCuentaA02(empresaId, localActivoId, contexto);
      }

      const sendOperationId = `a05.2.send.${contexto.pedidoId}`;
      const enviado = await rpcA02ConRecuperacion(supabase, "abc_enviar_pedido", {
        p_operation_id: sendOperationId,
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_pedido_id: contexto.pedidoId,
        p_expected_pedido_version: pedidoVersion,
        p_terminal_id: contexto.terminalId,
        p_session_id: contexto.sessionId,
        p_operating_day: contexto.operatingDay
      }, empresaId, localActivoId, sendOperationId);

      contexto.pedidoVersion = versionServidorA02(enviado?.pedido_version, "a05.send.pedido_version");
      contexto.pedidoEstado = String(enviado?.estado || "ENVIADO");
      contexto.lineas = contexto.lineas.map((linea) => {
        if (linea.estado !== "CONFIRMADA") return linea;
        return {
          ...linea,
          estado: "ENVIADA",
          lineaVersion: versionServidorA02(Number(linea.lineaVersion) + 1, "a05.send.linea_version")
        };
      });
      contexto.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const guardado = guardarContextoCuentaA02(empresaId, localActivoId, contexto);

      return {
        ok: true,
        pedidoId: guardado.pedidoId,
        pedidoVersion: guardado.pedidoVersion,
        pedidoEstado: guardado.pedidoEstado,
        lineas: guardado.lineas,
        lineasEnviadas: Number(enviado?.lineas_enviadas) || guardado.lineas.filter((l22) => l22.estado === "ENVIADA").length
      };
    } catch (error) {
      return { ok: false, error: errorRpcA02(error) };
    }
  }

  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {
`,
  "A05 adapter"
);

// 5. Prop A05.2 en TPV.
source = replaceOnce(
  source,
`function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {
`,
`function VentaRapida({ productos, venderCarrito, enviarPedidoA05, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {
`,
  "A05 VentaRapida prop"
);

// 6. Estado UI para envío.
source = replaceOnce(
  source,
`  const [confirmacion, setConfirmacion] = (0, import_react4.useState)(null);
  const [enviandoVenta, setEnviandoVenta] = (0, import_react4.useState)(false);
  const [errorVenta, setErrorVenta] = (0, import_react4.useState)("");
`,
`  const [confirmacion, setConfirmacion] = (0, import_react4.useState)(null);
  const [enviandoVenta, setEnviandoVenta] = (0, import_react4.useState)(false);
  const [procesandoA05, setProcesandoA05] = (0, import_react4.useState)(false);
  const [errorA05, setErrorA05] = (0, import_react4.useState)("");
  const [errorVenta, setErrorVenta] = (0, import_react4.useState)("");
`,
  "A05 UI state"
);

// 7. Resultado de guardado incorpora estado/versiones.
source = replaceOnce(
  source,
`    setConfirmacion({ total: resultado.totalServidor != null ? resultado.totalServidor : total, n: resultado.n, cuentaId: resultado.cuentaId || null, pedidoId: resultado.pedidoId || null, currencyCode: resultado.currencyCode || "EUR" });
    setCarrito([]);
`,
`    setConfirmacion({
      total: resultado.totalServidor != null ? resultado.totalServidor : total,
      n: resultado.n,
      cuentaId: resultado.cuentaId || null,
      pedidoId: resultado.pedidoId || null,
      pedidoVersion: resultado.pedidoVersion || null,
      pedidoEstado: resultado.pedidoEstado || "ABIERTO",
      lineas: Array.isArray(resultado.lineas) ? resultado.lineas : [],
      currencyCode: resultado.currencyCode || "EUR"
    });
    setErrorA05("");
    setCarrito([]);
`,
  "A05 confirmation payload"
);

// 8. Acción UI de envío.
source = replaceOnce(
  source,
`  return /* @__PURE__ */ import_react4.default.createElement("div", null,
`,
`  async function enviarPedidoGuardadoA05() {
    if (procesandoA05 || !confirmacion || typeof enviarPedidoA05 !== "function") return;
    setProcesandoA05(true);
    setErrorA05("");
    try {
      const resultado = await enviarPedidoA05();
      if (!resultado || resultado.ok === false) {
        setErrorA05(resultado?.error || "No se pudo enviar el pedido.");
        return;
      }
      setConfirmacion((actual) => actual ? {
        ...actual,
        pedidoVersion: resultado.pedidoVersion,
        pedidoEstado: resultado.pedidoEstado || "ENVIADO",
        lineas: Array.isArray(resultado.lineas) ? resultado.lineas : actual.lineas
      } : actual);
    } finally {
      setProcesandoA05(false);
    }
  }
  return /* @__PURE__ */ import_react4.default.createElement("div", null,
`,
  "A05 UI send function"
);

// 9. Modal de confirmación: Guardar -> Enviar.
source = replaceOnce(
  source,
`confirmacion && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmacion(null), title: "Pedido guardado" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-2" }, confirmacion.currencyCode || "EUR", " ", fmt(confirmacion.total), " · ", confirmacion.n, " línea(s)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.inkSoft } }, "Cuenta ", confirmacion.cuentaId || "", " · Pedido ", confirmacion.pedidoId || ""), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "A02.1 ha persistido cuenta, pedido y líneas en el servidor. No se ha registrado cobro, documento fiscal ni movimiento de stock."), /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => setConfirmacion(null) }, "Aceptar")),`,
`confirmacion && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => !procesandoA05 && setConfirmacion(null), title: confirmacion.pedidoEstado === "ENVIADO" ? "Pedido enviado" : "Pedido guardado" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-2" }, confirmacion.currencyCode || "EUR", " ", fmt(confirmacion.total), " · ", confirmacion.n, " línea(s)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.inkSoft } }, "Cuenta ", confirmacion.cuentaId || "", " · Pedido ", confirmacion.pedidoId || ""), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2 font-semibold", style: { color: confirmacion.pedidoEstado === "ENVIADO" ? C2.accent : C2.ink } }, "Estado operativo: ", confirmacion.pedidoEstado || "ABIERTO"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, confirmacion.pedidoEstado === "ENVIADO" ? "A05 ha confirmado las líneas y enviado el pedido. Preparación, servido y cancelaciones se habilitarán en el siguiente subpunto." : "A02/A04 han persistido cuenta, pedido y líneas. A05 puede confirmar las líneas y enviar el pedido sin registrar cobro, documento fiscal ni movimiento de stock."), errorA05 && /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorA05), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, confirmacion.pedidoEstado !== "ENVIADO" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: enviarPedidoGuardadoA05, disabled: procesandoA05 }, procesandoA05 ? "Enviando pedido…" : "Enviar pedido") : null, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmacion(null), disabled: procesandoA05 }, confirmacion.pedidoEstado === "ENVIADO" ? "Aceptar" : "Cerrar"))),`,
  "A05 confirmation modal"
);

// 10. Aviso del TPV.
source = replaceOnce(
  source,
`"A02.1/A04.2 guarda la cuenta y el pedido con autoridad del servidor. Los productos configurables usan variantes y modificadores A04. ", /* @__PURE__ */ import_react4.default.createElement("b", null, "No registra cobro, tique fiscal ni movimiento de stock"), ". El total definitivo lo confirma el servidor."`,
`"A02/A04 guardan la cuenta y el pedido con autoridad del servidor; A05 permite enviarlo de forma operativa. Los productos configurables usan variantes y modificadores A04. ", /* @__PURE__ */ import_react4.default.createElement("b", null, "No registra cobro, tique fiscal ni movimiento de stock"), ". El total definitivo lo confirma el servidor."`,
  "A05 TPV notice"
);

// 11. Pasar adaptador A05 al componente.
source = replaceOnce(
  source,
`import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })`,
`import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })`,
  "A05 prop wiring"
);

fs.writeFileSync(sourcePath, source);
console.log("A05_2_PATCH=PASS");
