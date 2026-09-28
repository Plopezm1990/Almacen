import fs from "node:fs";

const recoveredPath = "source-recovery/fuente-recuperado.js";
const runtimePath = "fuente.js";
let source = fs.readFileSync(recoveredPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

function replaceOnce(text, needle, replacement, label) {
  const count = countOf(text, needle);
  if (count !== 1) throw new Error("A09_1_7_" + label + "_ANCHOR_COUNT=" + count);
  return text.replace(needle, replacement);
}

function replaceExpected(text, needle, replacement, expected, label) {
  const count = countOf(text, needle);
  if (count !== expected) throw new Error("A09_1_7_" + label + "_ANCHOR_COUNT=" + count);
  return text.split(needle).join(replacement);
}

function block(lines) {
  return lines.join("\n") + "\n";
}

let changed = false;

if (!source.includes("async function aplicarDescuentoCuentaA09(")) {
  source = replaceOnce(
    source,
    "listarCuentasRepartoA08, moverCantidadLineaCuentaA08 } = crearLogicaVenta",
    "aplicarDescuentoCuentaA09, listarAutorizacionesDescuentoA09, resolverAutorizacionDescuentoA09, listarCuentasRepartoA08, moverCantidadLineaCuentaA08 } = crearLogicaVenta",
    "FACTORY_DESTRUCTURE"
  );

  source = replaceOnce(
    source,
    "anularVenta, movimientos: movimientosDelLocalActivo, listarCuentasRepartoA08",
    "anularVenta, aplicarDescuentoCuentaA09, listarAutorizacionesDescuentoA09, resolverAutorizacionDescuentoA09, movimientos: movimientosDelLocalActivo, listarCuentasRepartoA08",
    "TPV_WIRING"
  );

  source = replaceOnce(
    source,
    "listarCuentasRepartoA08, moverCantidadLineaCuentaA08 };\n}",
    "aplicarDescuentoCuentaA09, listarAutorizacionesDescuentoA09, resolverAutorizacionDescuentoA09, listarCuentasRepartoA08, moverCantidadLineaCuentaA08 };\n}",
    "FACTORY_RETURN"
  );

  const ventaSignatureMatch = source.match(/function VentaRapida\(\{[^\n]*moverCantidadLineaCuentaA08[^\n]*\}\) \{/);
  if (!ventaSignatureMatch) throw new Error("A09_1_7_VENTA_RAPIDA_PROPS_ANCHOR_COUNT=0");
  const ventaSignature = ventaSignatureMatch[0];
  if (!ventaSignature.includes("aplicarDescuentoCuentaA09")) {
    source = source.replace(
      ventaSignature,
      ventaSignature.replace(
        "listarCuentasRepartoA08",
        "aplicarDescuentoCuentaA09, listarAutorizacionesDescuentoA09, resolverAutorizacionDescuentoA09, listarCuentasRepartoA08"
      )
    );
  }

  const errorAnchor = '    if (msg.includes("pedido_enviar_no_autorizado")) return "Tu perfil no tiene permiso para enviar este pedido.";';
  const errorBlock = block([
    '    if (msg.includes("descuento_no_autorizado") || msg.includes("descuento_solicitar_no_autorizado") || msg.includes("descuento_aplicar_no_autorizado")) return "Tu perfil no tiene permiso para solicitar o aplicar este descuento.";',
    '    if (msg.includes("descuento_parametros_invalidos")) return "Revisa el tipo, valor y motivo del descuento.";',
    '    if (msg.includes("descuento_cortesia_requerida")) return "Para dejar el importe al 100 % debes usar la opción Cortesía.";',
    '    if (msg.includes("descuento_importe_fuera_base") || msg.includes("descuento_base_no_positiva")) return "El descuento supera la base disponible de la cuenta.";',
    '    if (msg.includes("descuento_limite_acumulado_excedido")) return "El descuento acumulado supera el límite autorizado para este perfil.";',
    '    if (msg.includes("descuento_escalado_no_permitido")) return "Este perfil no puede escalar descuentos por encima de su límite.";',
    '    if (msg.includes("descuento_compromiso_financiero")) return "La cuenta ya tiene un compromiso de cobro o reparto por importe y no admite este descuento.";',
    '    if (msg.includes("descuento_reparto_iva_mixto_no_soportado") || msg.includes("descuento_tipo_iva_desconocido")) return "Esta cuenta tiene una combinación de IVA que A09 todavía no puede descontar de forma segura.";',
    '    if (msg.includes("descuento_linea_fiscalizada")) return "Hay líneas ya fiscalizadas; el descuento no puede modificarlas.";',
    '    if (msg.includes("descuento_operating_day_incompatible")) return "La cuenta pertenece a otro día operativo.";',
    '    if (msg.includes("descuento_cuenta_no_encontrada") || msg.includes("descuento_cuenta_no_abierta")) return "La cuenta ya no está abierta o no está disponible.";',
    '    if (msg.includes("descuento_cuenta_sin_lineas") || msg.includes("descuento_linea_no_apta")) return "La cuenta no tiene líneas aptas para aplicar el descuento.";',
    '    if (msg.includes("descuento_autorizacion_version_obsoleta") || msg.includes("descuento_autorizacion_contexto_cambiado") || msg.includes("descuento_autorizacion_configuracion_cambiada")) return "La autorización quedó obsoleta porque cambió la cuenta, la política o el contexto. Solicita una nueva.";',
    '    if (msg.includes("descuento_autoaprobacion_rechazada")) return "La misma persona que solicitó el descuento no puede aprobarlo.";',
    '    if (msg.includes("descuento_aprobador_sin_permiso")) return "Tu perfil no tiene capacidad suficiente para autorizar este descuento.";',
    '    if (msg.includes("descuento_aprobacion_snapshot_conflict")) return "La autorización no coincide con la solicitud original.";',
    '    if (msg.includes("descuento_aprobacion_attempt_id_conflict")) return "Este intento de autorización ya existe con otros datos.";',
    '    if (msg.includes("descuento_rechazado_por_autorizador")) return "El descuento fue rechazado por el autorizador.";',
    '    if (msg.includes("descuento_solicitud_no_encontrada")) return "No se encontró la solicitud de descuento pendiente.";',
    '    if (msg.includes("descuento_solicitud_cerrada")) return "La solicitud de descuento ya está cerrada.";',
    '    if (msg.includes("descuento_ya_aprobado")) return "La solicitud ya fue aprobada; el solicitante debe reintentar la aplicación.";',
  ]);
  source = replaceOnce(source, errorAnchor, errorBlock + errorAnchor, "ERROR_MESSAGES");

  const apiBlock = block([
    '  async function hashHexA09(value) {',
    '    const bytes = new TextEncoder().encode(String(value));',
    '    const digest = await crypto.subtle.digest("SHA-256", bytes);',
    '    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");',
    '  }',
    '',
    '  function uuidA09DesdeHash(hash) {',
    '    const chars = String(hash || "").padEnd(32, "0").slice(0, 32).split("");',
    '    chars[12] = "4";',
    '    chars[16] = ((parseInt(chars[16], 16) & 3) | 8).toString(16);',
    '    const h = chars.join("");',
    '    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20, 32);',
    '  }',
    '',
    '  async function listarAutorizacionesDescuentoA09() {',
    '    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de revisar autorizaciones." };',
    '    const empresaId = empresaDelLocalActivo?.id || null;',
    '    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };',
    '    try {',
    '      const contexto = leerContextoCuentaA02(empresaId, localActivoId);',
    '      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");',
    '      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";',
    '      if (!hayConexion) return { ok: false, error: "Los descuentos y autorizaciones necesitan conexión con el servidor." };',
    '      const supabase = await window.getSupabaseClient();',
    '      const { data, error } = await supabase',
    '        .from("abc_descuento_autorizaciones")',
    '        .select("operation_id,cuenta_id,solicitante_id,motivo,snapshot,snapshot_hash,estado,autorizador_id,motivo_autorizacion,solicitada_at,autorizada_at,resultado")',
    '        .eq("empresa_id", empresaId)',
    '        .eq("local_id", localActivoId)',
    '        .eq("cuenta_id", contexto.cuentaId)',
    '        .in("estado", ["PENDIENTE", "APROBADA"])',
    '        .order("solicitada_at", { ascending: false })',
    '        .limit(50);',
    '      if (error) throw error;',
    '      return { ok: true, solicitudes: Array.isArray(data) ? data : [] };',
    '    } catch (error) {',
    '      return { ok: false, error: respuestaErrorA06(error) };',
    '    }',
    '  }',
    '',
    '  async function aplicarDescuentoCuentaA09({ tipo, valor = null, motivo, solicitud = null } = {}) {',
    '    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de aplicar un descuento." };',
    '    const empresaId = empresaDelLocalActivo?.id || null;',
    '    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };',
    '    const kind = String(solicitud?.tipo || tipo || "").trim().toUpperCase();',
    '    const reason = String(solicitud?.motivo || motivo || "").trim();',
    '    const rawValue = solicitud ? solicitud.valor : valor;',
    '    const valueText = kind === "COURTESY" ? null : String(rawValue ?? "").trim();',
    '    if (!["PERCENT", "AMOUNT", "COURTESY"].includes(kind) || reason.length < 1 || reason.length > 500) {',
    '      return { ok: false, error: "Selecciona el tipo de descuento y escribe un motivo." };',
    '    }',
    '    if (kind !== "COURTESY") {',
    '      if (!/^(?:\\d+)(?:\\.\\d{1,8})?$/.test(valueText || "") || Number(valueText) <= 0) {',
    '        return { ok: false, error: "El valor debe ser positivo y tener como máximo 8 decimales." };',
    '      }',
    '      if (kind === "PERCENT" && Number(valueText) > 100) return { ok: false, error: "El porcentaje no puede superar el 100 %." };',
    '    }',
    '',
    '    try {',
    '      let contexto = leerContextoCuentaA02(empresaId, localActivoId);',
    '      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");',
    '      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";',
    '      if (!hayConexion) return { ok: false, error: "Los descuentos necesitan conexión con el servidor." };',
    '      const supabase = await window.getSupabaseClient();',
    '',
    '      let cuentaId;',
    '      let expectedCuentaVersion;',
    '      let terminalId;',
    '      let sessionId;',
    '      let operatingDay;',
    '      let operationId;',
    '',
    '      if (solicitud?.operationId) {',
    '        cuentaId = String(solicitud.cuentaId || contexto.cuentaId);',
    '        expectedCuentaVersion = versionServidorA02(solicitud.expectedCuentaVersion, "a09.retry.cuenta_version");',
    '        terminalId = solicitud.terminalId;',
    '        sessionId = solicitud.sessionId;',
    '        operatingDay = solicitud.operatingDay;',
    '        operationId = solicitud.operationId;',
    '      } else {',
    '        if (typeof recuperarCuentaA06 === "function") {',
    '          const fresca = await recuperarCuentaA06();',
    '          if (fresca?.ok && fresca.cuentaId) contexto = fresca;',
    '          else if (fresca?.error) return fresca;',
    '        }',
    '        const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);',
    '        cuentaId = contexto.cuentaId;',
    '        expectedCuentaVersion = versionServidorA02(contexto.cuentaVersion, "a09.apply.cuenta_version");',
    '        terminalId = terminal.terminalId;',
    '        sessionId = terminal.sessionId;',
    '        operatingDay = contexto.operatingDay;',
    '        const seed = JSON.stringify({',
    '          empresaId, localId: localActivoId, cuentaId, tipo: kind, valor: valueText, motivo: reason,',
    '          expectedCuentaVersion, terminalId, sessionId, operatingDay',
    '        });',
    '        operationId = "a09.1.7.descuento:" + await hashHexA09(seed);',
    '      }',
    '',
    '      if (!terminalId || !sessionId || !operatingDay) throw new Error("terminal_sesion_no_operativa");',
    '      const params = {',
    '        p_operation_id: operationId,',
    '        p_empresa_id: empresaId,',
    '        p_local_id: localActivoId,',
    '        p_cuenta_id: cuentaId,',
    '        p_tipo: kind,',
    '        p_valor: kind === "COURTESY" ? null : valueText,',
    '        p_motivo: reason,',
    '        p_expected_cuenta_version: expectedCuentaVersion,',
    '        p_terminal_id: terminalId,',
    '        p_session_id: sessionId,',
    '        p_operating_day: operatingDay',
    '      };',
    '      const { data, error } = await supabase.rpc("abc_aplicar_descuento_cuenta", params);',
    '      if (error) throw error;',
    '',
    '      if (String(data?.status || "") === "PENDIENTE_AUTORIZACION") {',
    '        return {',
    '          ok: true, pending: true, resultado: data,',
    '          solicitud: {',
    '            operationId, cuentaId, tipo: kind, valor: valueText, motivo: reason, expectedCuentaVersion,',
    '            terminalId, sessionId, operatingDay, approvalHash: data?.approval_hash || ""',
    '          }',
    '        };',
    '      }',
    '      if (data?.ok && String(data?.status || "") === "APLICADA") {',
    '        const cuenta = typeof recuperarCuentaA06 === "function" ? await recuperarCuentaA06() : null;',
    '        return { ok: true, applied: true, resultado: data, cuenta };',
    '      }',
    '      const code = data?.error || ("descuento_" + String(data?.status || "respuesta_invalida").toLowerCase());',
    '      return { ok: false, resultado: data, error: respuestaErrorA06(new Error(code)) };',
    '    } catch (error) {',
    '      const conflict = esConflictoVersionA06(error);',
    '      const cuenta = conflict && typeof recuperarCuentaA06 === "function" ? await recuperarCuentaA06() : null;',
    '      return { ok: false, conflict, cuenta, error: respuestaErrorA06(error) };',
    '    }',
    '  }',
    '',
    '  async function resolverAutorizacionDescuentoA09(solicitud, decision, motivo) {',
    '    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de autorizar." };',
    '    const empresaId = empresaDelLocalActivo?.id || null;',
    '    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };',
    '    const operationId = String(solicitud?.operation_id || solicitud?.operationId || "").trim();',
    '    const snapshotHash = String(solicitud?.snapshot_hash || solicitud?.approvalHash || "").trim();',
    '    const action = String(decision || "").trim().toUpperCase();',
    '    const reason = String(motivo || "").trim();',
    '    if (!operationId || !/^[0-9a-f]{64}$/.test(snapshotHash) || !["APROBAR", "RECHAZAR"].includes(action) || reason.length < 1 || reason.length > 500) {',
    '      return { ok: false, error: "La autorización necesita solicitud, decisión y motivo válidos." };',
    '    }',
    '    try {',
    '      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";',
    '      if (!hayConexion) return { ok: false, error: "Las autorizaciones necesitan conexión con el servidor." };',
    '      const supabase = await window.getSupabaseClient();',
    '      const attemptHash = await hashHexA09(JSON.stringify({ operationId, snapshotHash, action, reason }));',
    '      const attemptId = uuidA09DesdeHash(attemptHash);',
    '      const { data, error } = await supabase.rpc("abc_aprobar_descuento_cuenta", {',
    '        p_operation_id: operationId,',
    '        p_empresa_id: empresaId,',
    '        p_local_id: localActivoId,',
    '        p_snapshot_hash: snapshotHash,',
    '        p_attempt_id: attemptId,',
    '        p_decision: action,',
    '        p_motivo: reason',
    '      });',
    '      if (error) throw error;',
    '      const code = String(data?.error || "");',
    '      if (code && code !== "descuento_rechazado_por_autorizador" && code !== "descuento_ya_aprobado") {',
    '        return { ok: false, resultado: data, error: respuestaErrorA06(new Error(code)) };',
    '      }',
    '      return { ok: true, estado: String(data?.status || ""), resultado: data };',
    '    } catch (error) {',
    '      return { ok: false, error: respuestaErrorA06(error) };',
    '    }',
    '  }',
    ''
  ]);
  source = replaceOnce(
    source,
    '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {',
    apiBlock + '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {',
    "API_INSERT"
  );

  const stateAnchor = '  const [motivoOperacionA05, setMotivoOperacionA05] = (0, import_react4.useState)("");';
  const stateBlock = block([
    '  const [descuentoAbiertoA09, setDescuentoAbiertoA09] = (0, import_react4.useState)(false);',
    '  const [tipoDescuentoA09, setTipoDescuentoA09] = (0, import_react4.useState)("PERCENT");',
    '  const [valorDescuentoA09, setValorDescuentoA09] = (0, import_react4.useState)("");',
    '  const [motivoDescuentoA09, setMotivoDescuentoA09] = (0, import_react4.useState)("");',
    '  const [motivoAutorizacionA09, setMotivoAutorizacionA09] = (0, import_react4.useState)("");',
    '  const [autorizacionesA09, setAutorizacionesA09] = (0, import_react4.useState)([]);',
    '  const [cargandoAutorizacionesA09, setCargandoAutorizacionesA09] = (0, import_react4.useState)(false);',
    '  const [procesandoDescuentoA09, setProcesandoDescuentoA09] = (0, import_react4.useState)(false);',
    '  const [errorDescuentoA09, setErrorDescuentoA09] = (0, import_react4.useState)("");',
    '  const [mensajeDescuentoA09, setMensajeDescuentoA09] = (0, import_react4.useState)("");',
  ]);
  source = replaceOnce(source, stateAnchor, stateBlock + stateAnchor, "UI_STATE");

  const resetAnchor = '  function etiquetaResponsableA07(userId) {';
  const resetBlock = block([
    '  (0, import_react4.useEffect)(() => {',
    '    setDescuentoAbiertoA09(false);',
    '    setTipoDescuentoA09("PERCENT");',
    '    setValorDescuentoA09("");',
    '    setMotivoDescuentoA09("");',
    '    setMotivoAutorizacionA09("");',
    '    setAutorizacionesA09([]);',
    '    setErrorDescuentoA09("");',
    '    setMensajeDescuentoA09("");',
    '  }, [pedidoOperativoA05?.cuentaId, local?.id, configEmpresa?.id]);',
    ''
  ]);
  source = replaceOnce(source, resetAnchor, resetBlock + resetAnchor, "UI_RESET");

  const helperAnchor = '  const vendibles = (0, import_react4.useMemo)(';
  const helperBlock = block([
    '  async function cargarAutorizacionesA09() {',
    '    if (typeof listarAutorizacionesDescuentoA09 !== "function") return;',
    '    setCargandoAutorizacionesA09(true);',
    '    const resultado = await listarAutorizacionesDescuentoA09();',
    '    setCargandoAutorizacionesA09(false);',
    '    if (!resultado?.ok) {',
    '      setErrorDescuentoA09(resultado?.error || "No se pudieron cargar las autorizaciones.");',
    '      return;',
    '    }',
    '    setAutorizacionesA09(Array.isArray(resultado.solicitudes) ? resultado.solicitudes : []);',
    '  }',
    '',
    '  async function abrirDescuentoCuentaA09() {',
    '    setDescuentoAbiertoA09(true);',
    '    setErrorDescuentoA09("");',
    '    setMensajeDescuentoA09("");',
    '    await cargarAutorizacionesA09();',
    '  }',
    '',
    '  function solicitudDesdeAutorizacionA09(row) {',
    '    const op = row?.snapshot?.operation || {};',
    '    return {',
    '      operationId: op.operation_id,',
    '      cuentaId: op.cuenta_id,',
    '      tipo: op.tipo,',
    '      valor: String(op.tipo || "") === "COURTESY" ? null : op.valor,',
    '      motivo: op.motivo,',
    '      expectedCuentaVersion: op.expected_cuenta_version,',
    '      terminalId: op.terminal_id,',
    '      sessionId: op.session_id,',
    '      operatingDay: op.operating_day,',
    '      approvalHash: row?.snapshot_hash || ""',
    '    };',
    '  }',
    '',
    '  async function enviarDescuentoA09(solicitud = null) {',
    '    if (typeof aplicarDescuentoCuentaA09 !== "function" || procesandoDescuentoA09) return;',
    '    setProcesandoDescuentoA09(true);',
    '    setErrorDescuentoA09("");',
    '    setMensajeDescuentoA09("");',
    '    const resultado = await aplicarDescuentoCuentaA09({',
    '      tipo: solicitud?.tipo || tipoDescuentoA09,',
    '      valor: solicitud ? solicitud.valor : valorDescuentoA09,',
    '      motivo: solicitud?.motivo || motivoDescuentoA09,',
    '      solicitud',
    '    });',
    '    setProcesandoDescuentoA09(false);',
    '    if (!resultado?.ok) {',
    '      if (resultado?.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);',
    '      setErrorDescuentoA09(resultado?.error || "No se pudo procesar el descuento.");',
    '      await cargarAutorizacionesA09();',
    '      return;',
    '    }',
    '    if (resultado.pending) {',
    '      setMensajeDescuentoA09("Solicitud pendiente de autorización. Debe aprobarla otra persona con capacidad suficiente.");',
    '    } else if (resultado.applied) {',
    '      if (resultado?.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);',
    '      setValorDescuentoA09("");',
    '      setMotivoDescuentoA09("");',
    '      setMensajeDescuentoA09("Descuento aplicado y cuenta recargada desde el servidor.");',
    '    }',
    '    await cargarAutorizacionesA09();',
    '  }',
    '',
    '  async function decidirAutorizacionA09(row, decision) {',
    '    if (typeof resolverAutorizacionDescuentoA09 !== "function" || procesandoDescuentoA09) return;',
    '    if (!motivoAutorizacionA09.trim()) {',
    '      setErrorDescuentoA09("Escribe el motivo de la aprobación o rechazo.");',
    '      return;',
    '    }',
    '    setProcesandoDescuentoA09(true);',
    '    setErrorDescuentoA09("");',
    '    setMensajeDescuentoA09("");',
    '    const resultado = await resolverAutorizacionDescuentoA09(row, decision, motivoAutorizacionA09);',
    '    setProcesandoDescuentoA09(false);',
    '    if (!resultado?.ok) {',
    '      setErrorDescuentoA09(resultado?.error || "No se pudo resolver la autorización.");',
    '      await cargarAutorizacionesA09();',
    '      return;',
    '    }',
    '    setMotivoAutorizacionA09("");',
    '    setMensajeDescuentoA09(resultado.estado === "APROBADA"',
    '      ? "Solicitud aprobada. El solicitante debe reintentar la aplicación con la solicitud original."',
    '      : "Solicitud rechazada.");',
    '    await cargarAutorizacionesA09();',
    '  }',
    ''
  ]);
  const ventaRapidaStart = source.indexOf("function VentaRapida(");
  if (ventaRapidaStart < 0) throw new Error("A09_1_7_VENTA_RAPIDA_NOT_FOUND");
  const helperIndex = source.indexOf(helperAnchor, ventaRapidaStart);
  if (helperIndex < 0) throw new Error("A09_1_7_UI_HELPERS_ANCHOR_COUNT=0");
  source = source.slice(0, helperIndex) + helperBlock + source.slice(helperIndex);

  const renderAnchor = '  function renderRepartoProductosA08() {';
  const renderBlock = block([
    '  function renderDescuentoCuentaA09() {',
    '    const pedido = pedidoOperativoA05;',
    '    if (!pedido?.cuentaId) return null;',
    '    if (!descuentoAbiertoA09) {',
    '      return /* @__PURE__ */ import_react4.default.createElement(',
    '        Card,',
    '        { className: "mb-4" },',
    '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2" },',
    '          /* @__PURE__ */ import_react4.default.createElement("div", null,',
    '            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Descuento / cortesía"),',
    '            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "Aplica límites A09 y escala a autorización cuando la política lo exige.")',
    '          ),',
    '          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: abrirDescuentoCuentaA09 }, "Abrir")',
    '        )',
    '      );',
    '    }',
    '',
    '    const activas = Array.isArray(autorizacionesA09) ? autorizacionesA09 : [];',
    '    return /* @__PURE__ */ import_react4.default.createElement(',
    '      Card,',
    '      { className: "mb-4" },',
    '      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },',
    '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Descuento / cortesía"),',
    '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-1.5" },',
    '          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: cargarAutorizacionesA09, disabled: cargandoAutorizacionesA09 || procesandoDescuentoA09 }, cargandoAutorizacionesA09 ? "Actualizando…" : "Actualizar"),',
    '          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setDescuentoAbiertoA09(false), disabled: procesandoDescuentoA09 }, "Cerrar")',
    '        )',
    '      ),',
    '      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tipo" },',
    '        /* @__PURE__ */ import_react4.default.createElement("select", { value: tipoDescuentoA09, onChange: (e2) => setTipoDescuentoA09(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },',
    '          /* @__PURE__ */ import_react4.default.createElement("option", { value: "PERCENT" }, "Porcentaje"),',
    '          /* @__PURE__ */ import_react4.default.createElement("option", { value: "AMOUNT" }, "Importe"),',
    '          /* @__PURE__ */ import_react4.default.createElement("option", { value: "COURTESY" }, "Cortesía")',
    '        )',
    '      ),',
    '      tipoDescuentoA09 !== "COURTESY" ? /* @__PURE__ */ import_react4.default.createElement(Field, { label: tipoDescuentoA09 === "PERCENT" ? "Porcentaje" : "Importe" },',
    '        /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "0.00000001", max: tipoDescuentoA09 === "PERCENT" ? "100" : void 0, step: "0.00000001", value: valorDescuentoA09, onChange: (e2) => setValorDescuentoA09(e2.target.value) })',
    '      ) : null,',
    '      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo" },',
    '        /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoDescuentoA09, onChange: (e2) => setMotivoDescuentoA09(e2.target.value), maxLength: 500, placeholder: "Motivo obligatorio" })',
    '      ),',
    '      /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => enviarDescuentoA09(), disabled: procesandoDescuentoA09 || !motivoDescuentoA09.trim() || (tipoDescuentoA09 !== "COURTESY" && !valorDescuentoA09) }, procesandoDescuentoA09 ? "Procesando…" : "Aplicar / solicitar"),',
    '      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-2", style: { color: C2.inkSoft } }, "Si requiere doble autorización, otra persona debe aprobar. La aprobación no aplica el descuento por sí sola."),',
    '      activas.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" },',
    '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold mb-2" }, "Autorizaciones de esta cuenta"),',
    '        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo de aprobación / rechazo" },',
    '          /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoAutorizacionA09, onChange: (e2) => setMotivoAutorizacionA09(e2.target.value), maxLength: 500 })',
    '        ),',
    '        activas.map((row) => {',
    '          const op = row?.snapshot?.operation || {};',
    '          return /* @__PURE__ */ import_react4.default.createElement("div", { key: row.operation_id, className: "p-2 rounded-lg mb-2", style: { border: "1px solid " + C2.line } },',
    '            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold" }, String(row.estado || ""), " · ", String(op.tipo || ""), " · €", fmt(Number(op.importe_descuento) || 0)),',
    '            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, row.motivo || op.motivo || ""),',
    '            row.estado === "PENDIENTE" ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mt-2 flex-wrap" },',
    '              /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => decidirAutorizacionA09(row, "APROBAR"), disabled: procesandoDescuentoA09 || !motivoAutorizacionA09.trim() }, "Aprobar"),',
    '              /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => decidirAutorizacionA09(row, "RECHAZAR"), disabled: procesandoDescuentoA09 || !motivoAutorizacionA09.trim() }, "Rechazar")',
    '            ) : null,',
    '            row.estado === "APROBADA" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, className: "mt-2", onClick: () => enviarDescuentoA09(solicitudDesdeAutorizacionA09(row)), disabled: procesandoDescuentoA09 }, "Reintentar aplicación") : null',
    '          );',
    '        })',
    '      ) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-3", style: { color: C2.inkSoft } }, cargandoAutorizacionesA09 ? "Cargando autorizaciones…" : "No hay autorizaciones pendientes para esta cuenta."),',
    '      errorDescuentoA09 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mt-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorDescuentoA09) : null,',
    '      mensajeDescuentoA09 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mt-2 p-2 rounded-lg", style: { background: C2.accentSoft } }, mensajeDescuentoA09) : null',
    '    );',
    '  }',
    ''
  ]);
  source = replaceOnce(source, renderAnchor, renderBlock + renderAnchor, "UI_RENDER");

  source = replaceOnce(
    source,
    "renderSalaA07(), renderRepartoProductosA08(), renderPedidoOperativoA05()",
    "renderSalaA07(), renderRepartoProductosA08(), renderPedidoOperativoA05(), renderDescuentoCuentaA09()",
    "UI_RENDER_CALL"
  );

  changed = true;
}

for (const required of [
  'supabase.rpc("abc_aplicar_descuento_cuenta"',
  'supabase.rpc("abc_aprobar_descuento_cuenta"',
  '.from("abc_descuento_autorizaciones")',
  'operationId = "a09.1.7.descuento:" + await hashHexA09(seed)',
  'String(data?.status || "") === "PENDIENTE_AUTORIZACION"',
  'function renderDescuentoCuentaA09()',
  'La misma persona que solicitó el descuento no puede aprobarlo.',
  'row.estado === "APROBADA"',
  'solicitudDesdeAutorizacionA09(row)'
]) {
  if (!source.includes(required)) throw new Error("A09_1_7_REQUIRED_MISSING=" + required);
}

for (const forbidden of [
  '.from("abc_descuento_autorizaciones").insert',
  '.from("abc_descuento_autorizaciones").update',
  '.from("abc_descuentos_aplicados").insert',
  '.from("abc_descuentos_aplicados").update'
]) {
  if (source.includes(forbidden)) throw new Error("A09_1_7_DIRECT_DML_FORBIDDEN=" + forbidden);
}

if (changed) {
  fs.writeFileSync(recoveredPath, source);
  console.log("A09_1_7_SOURCE_RECOVERY_PATCHED=1");
} else {
  console.log("A09_1_7_SOURCE_RECOVERY_ALREADY_CURRENT=1");
}

const lines = source.split("\n");
if (lines[0] !== "// FUENTE RECUPERADO DESDE EL BUNDLE CANDIDATO DE L&A SUITE.") {
  throw new Error("A09_1_7_BAD_RECOVERY_HEADER");
}
const body = lines.slice(14).join("\n");
const marker = "var C2 = {";
const first = runtime.indexOf(marker);
const second = runtime.indexOf(marker, first + 1);
if (first < 0 || second >= 0) throw new Error("A09_1_7_RUNTIME_BOUNDARY_AMBIGUOUS");
const materialized = runtime.slice(0, first) + body;
if (materialized !== runtime) {
  fs.writeFileSync(runtimePath, materialized);
  console.log("A09_1_7_RUNTIME_MATERIALIZED=PASS");
} else {
  console.log("A09_1_7_RUNTIME_ALREADY_CURRENT=1");
}
