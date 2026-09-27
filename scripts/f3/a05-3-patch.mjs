import fs from "node:fs";

const path = "source-recovery/fuente-recuperado.js";
let source = fs.readFileSync(path, "utf8");

function countOf(h, n) { return h.split(n).length - 1; }
function replaceOnce(h, n, r, label) {
  const c = countOf(h, n);
  if (c !== 1) throw new Error(label + ": expected 1 anchor, found " + c);
  return h.replace(n, r);
}

// Errores operativos A05.3.
source = replaceOnce(
  source,
  '    if (msg.includes("pedido_lineas_no_confirmadas")) return "Hay líneas que todavía no están confirmadas y el pedido no puede enviarse.";\n',
  '    if (msg.includes("pedido_lineas_no_confirmadas")) return "Hay líneas que todavía no están confirmadas y el pedido no puede enviarse.";\n' +
  '    if (msg.includes("transicion_linea_no_autorizada")) return "Tu perfil no tiene permiso para realizar esta transición del pedido.";\n' +
  '    if (msg.includes("linea_cancelar_no_autorizada")) return "Tu perfil no tiene permiso para cancelar esta línea.";\n' +
  '    if (msg.includes("cancelacion_sensible_no_autorizada")) return "Esta cancelación requiere autorización sensible de Encargado o Propietario.";\n' +
  '    if (msg.includes("pedido_cancelar_no_autorizado")) return "Tu perfil no tiene permiso para cancelar el pedido completo.";\n' +
  '    if (msg.includes("motivo_cancelacion_requerido")) return "Es obligatorio indicar un motivo para cancelar.";\n' +
  '    if (msg.includes("transicion_linea_invalida")) return "La línea cambió de estado y esa acción ya no es válida.";\n' +
  '    if (msg.includes("linea_no_cancelable")) return "La línea ya no se puede cancelar.";\n' +
  '    if (msg.includes("pedido_con_lineas_servidas_no_cancelable")) return "No se puede cancelar un pedido que ya tiene líneas servidas.";\n' +
  '    if (msg.includes("pedido_no_cancelable") || msg.includes("pedido_no_operable")) return "El pedido ya no admite esa operación.";\n',
  "A05.3 errors"
);

// Adaptador operativo A05.3.
source = replaceOnce(
  source,
  '\n  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {\n',
  `
  function leerPedidoOperativoA05() {
    if (!localActivoId) return null;
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return null;
    try {
      return leerContextoCuentaA02(empresaId, localActivoId);
    } catch (e2) {
      return null;
    }
  }

  async function accionPedidoA05(accion, lineaId = null, motivo = "") {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de operar el pedido." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) return { ok: false, error: "A05 requiere conexión con el servidor para operar el pedido." };

    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      if (["CERRADO", "CANCELADO"].includes(contexto.pedidoEstado)) throw new Error("pedido_no_operable");
      const supabase = await window.getSupabaseClient();

      if (accion === "CANCELAR_PEDIDO") {
        const motivoLimpio = String(motivo || "").trim();
        if (!motivoLimpio) throw new Error("motivo_cancelacion_requerido");
        const operationId = "a05.3.cancelar.pedido." + contexto.pedidoId + "." + contexto.pedidoVersion;
        const resultado = await rpcA02ConRecuperacion(supabase, "abc_cancelar_pedido", {
          p_operation_id: operationId,
          p_empresa_id: empresaId,
          p_local_id: localActivoId,
          p_pedido_id: contexto.pedidoId,
          p_motivo: motivoLimpio,
          p_expected_pedido_version: versionServidorA02(contexto.pedidoVersion, "a05.cancel.pedido_version"),
          p_terminal_id: contexto.terminalId,
          p_session_id: contexto.sessionId,
          p_operating_day: contexto.operatingDay
        }, empresaId, localActivoId, operationId);
        contexto.pedidoVersion = versionServidorA02(resultado?.pedido_version, "a05.cancel.result.pedido_version");
        contexto.pedidoEstado = String(resultado?.estado || "CANCELADO");
        contexto.lineas = contexto.lineas.map((linea) => linea.estado === "CANCELADA" ? linea : {
          ...linea,
          estado: "CANCELADA",
          lineaVersion: versionServidorA02(Number(linea.lineaVersion) + 1, "a05.cancel.result.linea_version")
        });
        contexto.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        const guardado = guardarContextoCuentaA02(empresaId, localActivoId, contexto);
        return { ok: true, ...guardado };
      }

      const linea = contexto.lineas.find((l22) => l22.lineaId === lineaId);
      if (!linea) throw new Error("linea_no_encontrada");
      const mapa = {
        INICIAR_PREPARACION: "abc_iniciar_preparacion_linea",
        MARCAR_PREPARADA: "abc_marcar_linea_preparada",
        SERVIR: "abc_servir_linea",
        CANCELAR_LINEA: "abc_cancelar_linea"
      };
      const rpc = mapa[accion];
      if (!rpc) throw new Error("accion_a05_invalida");
      const operationId = "a05.3." + accion.toLowerCase() + "." + linea.lineaId + "." + linea.lineaVersion + "." + contexto.pedidoVersion;
      const params = {
        p_operation_id: operationId,
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_linea_id: linea.lineaId,
        p_expected_linea_version: versionServidorA02(linea.lineaVersion, "a05.action.linea_version"),
        p_expected_pedido_version: versionServidorA02(contexto.pedidoVersion, "a05.action.pedido_version"),
        p_terminal_id: contexto.terminalId,
        p_session_id: contexto.sessionId,
        p_operating_day: contexto.operatingDay
      };
      if (accion === "CANCELAR_LINEA") {
        const motivoLimpio = String(motivo || "").trim();
        if (!motivoLimpio) throw new Error("motivo_cancelacion_requerido");
        params.p_motivo = motivoLimpio;
      }

      const resultado = await rpcA02ConRecuperacion(supabase, rpc, params, empresaId, localActivoId, operationId);
      linea.lineaVersion = versionServidorA02(resultado?.linea_version, "a05.action.result.linea_version");
      linea.estado = String(resultado?.estado || linea.estado);
      contexto.pedidoVersion = versionServidorA02(resultado?.pedido_version, "a05.action.result.pedido_version");
      contexto.pedidoEstado = String(resultado?.pedido_estado || contexto.pedidoEstado);
      contexto.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const guardado = guardarContextoCuentaA02(empresaId, localActivoId, contexto);
      return { ok: true, ...guardado };
    } catch (error) {
      return { ok: false, error: errorRpcA02(error) };
    }
  }

  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {
`,
  "A05.3 adapter insert"
);

// Props y estado UI.
source = replaceOnce(
  source,
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  "A05.3 props"
);

source = replaceOnce(
  source,
  '  const [errorA05, setErrorA05] = (0, import_react4.useState)("");\n',
  '  const [errorA05, setErrorA05] = (0, import_react4.useState)("");\n' +
  '  const [pedidoOperativoA05, setPedidoOperativoA05] = (0, import_react4.useState)(null);\n' +
  '  const [motivoOperacionA05, setMotivoOperacionA05] = (0, import_react4.useState)("");\n' +
  '  const [accionEnCursoA05, setAccionEnCursoA05] = (0, import_react4.useState)("");\n',
  "A05.3 ui states"
);

// Carga del pedido persistido.
{
  const ventaStart = source.indexOf("function VentaRapida(");
  const vendiblesPos = source.indexOf("  const vendibles =", ventaStart);
  if (ventaStart < 0 || vendiblesPos < 0) throw new Error("A05.3 load anchor not found");
  const block = `
  (0, import_react4.useEffect)(() => {
    let activo = true;
    if (typeof leerPedidoOperativoA05 !== "function") {
      setPedidoOperativoA05(null);
      return () => {
        activo = false;
      };
    }
    Promise.resolve(leerPedidoOperativoA05()).then((pedido) => {
      if (activo) setPedidoOperativoA05(pedido || null);
    });
    return () => {
      activo = false;
    };
  }, [local?.id, configEmpresa?.id, leerPedidoOperativoA05]);
`;
  source = source.slice(0, vendiblesPos) + block + source.slice(vendiblesPos);
}

// Tras guardar, refrescar contexto operativo.
source = replaceOnce(
  source,
  '    setErrorA05("");\n    setCarrito([]);\n',
  '    setErrorA05("");\n' +
  '    if (typeof leerPedidoOperativoA05 === "function") {\n' +
  '      setPedidoOperativoA05(await Promise.resolve(leerPedidoOperativoA05()));\n' +
  '    }\n' +
  '    setCarrito([]);\n',
  "A05.3 refresh after save"
);

// Tras enviar, refrescar panel operativo.
source = replaceOnce(
  source,
  '      setConfirmacion((actual) => actual ? {\n        ...actual,\n        pedidoVersion: resultado.pedidoVersion,\n        pedidoEstado: resultado.pedidoEstado || "ENVIADO",\n        lineas: Array.isArray(resultado.lineas) ? resultado.lineas : actual.lineas\n      } : actual);\n',
  '      setConfirmacion((actual) => actual ? {\n        ...actual,\n        pedidoVersion: resultado.pedidoVersion,\n        pedidoEstado: resultado.pedidoEstado || "ENVIADO",\n        lineas: Array.isArray(resultado.lineas) ? resultado.lineas : actual.lineas\n      } : actual);\n' +
  '      setPedidoOperativoA05(resultado);\n',
  "A05.3 refresh after send"
);

// Acciones UI y render operativo antes del return de VentaRapida.
{
  const ventaStart = source.indexOf("function VentaRapida(");
  const returnMarker = '\n  return /* @__PURE__ */ import_react4.default.createElement("div", null,';
  const returnPos = source.indexOf(returnMarker, ventaStart);
  if (ventaStart < 0 || returnPos < 0) throw new Error("A05.3 return anchor not found");

  const ui = `
  async function ejecutarAccionA05(accion, lineaId = null) {
    if (accionEnCursoA05 || typeof accionPedidoA05 !== "function") return;
    if ((accion === "CANCELAR_LINEA" || accion === "CANCELAR_PEDIDO") && !motivoOperacionA05.trim()) {
      setErrorA05("Escribe un motivo antes de cancelar.");
      return;
    }
    setAccionEnCursoA05(accion + ":" + (lineaId || "pedido"));
    setErrorA05("");
    try {
      const resultado = await accionPedidoA05(accion, lineaId, motivoOperacionA05);
      if (!resultado || resultado.ok === false) {
        setErrorA05(resultado?.error || "No se pudo realizar la operación.");
        return;
      }
      setPedidoOperativoA05(resultado);
      setConfirmacion((actual) => actual && actual.pedidoId === resultado.pedidoId ? {
        ...actual,
        pedidoVersion: resultado.pedidoVersion,
        pedidoEstado: resultado.pedidoEstado,
        lineas: resultado.lineas
      } : actual);
      if (accion === "CANCELAR_LINEA" || accion === "CANCELAR_PEDIDO") setMotivoOperacionA05("");
    } finally {
      setAccionEnCursoA05("");
    }
  }

  function renderPedidoOperativoA05() {
    const pedido = pedidoOperativoA05;
    if (!pedido || !pedido.pedidoId) return null;
    const terminal = pedido.pedidoEstado === "CERRADO" || pedido.pedidoEstado === "CANCELADO";
    const tieneServidas = (pedido.lineas || []).some((l22) => l22.estado === "SERVIDA");
    const puedeCancelarPedido = !terminal && !tieneServidas;
    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Pedido operativo"),
        /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[11px] font-semibold", style: { color: pedido.pedidoEstado === "CANCELADO" ? C2.red : C2.accent } }, pedido.pedidoEstado || "ABIERTO")
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, "Los permisos se validan siempre en el servidor. Preparación, servido y cancelaciones no registran cobro ni documento fiscal."),
      (pedido.lineas || []).map((linea) => {
        const producto = productos.find((p22) => p22.id === linea.productoId);
        const busy = !!accionEnCursoA05;
        return /* @__PURE__ */ import_react4.default.createElement(
          "div",
          { key: linea.lineaId, className: "py-2", style: { borderTop: "1px solid " + C2.line } },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-1" },
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-medium" }, producto?.nombre || linea.productoId),
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold", style: { color: C2.inkSoft } }, linea.estado)
          ),
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex flex-wrap gap-1.5" },
            linea.estado === "ENVIADA" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => ejecutarAccionA05("INICIAR_PREPARACION", linea.lineaId), disabled: busy }, "Iniciar preparación") : null,
            linea.estado === "EN_PREPARACION" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => ejecutarAccionA05("MARCAR_PREPARADA", linea.lineaId), disabled: busy }, "Marcar preparada") : null,
            linea.estado === "PREPARADA" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => ejecutarAccionA05("SERVIR", linea.lineaId), disabled: busy }, "Servir") : null,
            !["SERVIDA", "CANCELADA"].includes(linea.estado) ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "danger", onClick: () => ejecutarAccionA05("CANCELAR_LINEA", linea.lineaId), disabled: busy || !motivoOperacionA05.trim() }, "Cancelar línea") : null
          )
        );
      }),
      !terminal ? /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo de cancelación (obligatorio para cancelar)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoOperacionA05, onChange: (e2) => setMotivoOperacionA05(e2.target.value), placeholder: "Error de pedido, cliente cancela…" })) : null,
      errorA05 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorA05) : null,
      puedeCancelarPedido ? /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: () => ejecutarAccionA05("CANCELAR_PEDIDO"), disabled: !!accionEnCursoA05 || !motivoOperacionA05.trim() }, accionEnCursoA05 === "CANCELAR_PEDIDO:pedido" ? "Cancelando…" : "Cancelar pedido") : null
    );
  }
`;
  source = source.slice(0, returnPos) + ui + source.slice(returnPos);
}

// Montar panel operativo antes del catálogo.
{
  const ventaStart = source.indexOf("function VentaRapida(");
  const marker = "vendibles.length === 0 ?";
  const pos = source.indexOf(marker, ventaStart);
  if (ventaStart < 0 || pos < 0) throw new Error("A05.3 panel mount anchor not found");
  source = source.slice(0, pos) + "renderPedidoOperativoA05(), " + source.slice(pos);
}

// Texto post-envío actualizado.
source = source.replace(
  "A05 ha confirmado las líneas y enviado el pedido. Preparación, servido y cancelaciones se habilitarán en el siguiente subpunto.",
  "A05 ha confirmado las líneas y enviado el pedido. Continúa su preparación, servido o cancelación desde el panel operativo del TPV."
);

// Wiring desde App.
source = replaceOnce(
  source,
  'import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })',
  'import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })',
  "A05.3 wiring"
);

fs.writeFileSync(path, source);
console.log("A05_3_PATCH=PASS");
