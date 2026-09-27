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

// A07.2: conflictos específicos de origen/destino también son optimistic-lock conflicts.
source = replaceOnce(
  source,
  '      || msg.includes("mesa_version_conflict");\n',
  '      || msg.includes("mesa_version_conflict")\n      || msg.includes("mesa_origen_version_conflict")\n      || msg.includes("mesa_destino_version_conflict");\n',
  "A07.2 conflict classes"
);

const errorAnchor = '    if (msg.includes("zona_no_activa")) return "La zona de la mesa ya no está activa.";\n';
source = replaceOnce(
  source,
  errorAnchor,
  errorAnchor +
  '    if (msg.includes("mesa_mover_no_autorizada")) return "Tu perfil no tiene permiso para trasladar esta cuenta.";\n' +
  '    if (msg.includes("mesa_origen_version_conflict") || msg.includes("mesa_destino_version_conflict")) return "La mesa cambió en otro terminal. Se ha bloqueado el traslado hasta recargar la sala.";\n' +
  '    if (msg.includes("mesa_destino_no_asignable")) return "La mesa de destino ya no está disponible.";\n' +
  '    if (msg.includes("mesa_destino_igual_origen")) return "Selecciona una mesa distinta de la actual.";\n' +
  '    if (msg.includes("cuenta_sin_mesa_activa")) return "La cuenta ya no tiene una mesa activa. Recarga la sala.";\n' +
  '    if (msg.includes("cuenta_reasignar_no_autorizada") || msg.includes("responsables_listar_no_autorizado")) return "Solo un perfil autorizado puede cambiar el responsable de la cuenta.";\n' +
  '    if (msg.includes("nuevo_responsable_no_pertenece_local")) return "El nuevo responsable ya no pertenece a este local.";\n' +
  '    if (msg.includes("responsable_sin_cambio")) return "Ese usuario ya es el responsable actual.";\n' +
  '    if (msg.includes("motivo_reasignacion_requerido")) return "Indica el motivo del cambio de responsable.";\n',
  "A07.2 errors"
);

// Insert A07.2 adapters immediately after A07.1 assignment.
const beforeLegacy = '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {\n';
source = replaceOnce(
  source,
  beforeLegacy,
`  async function listarResponsablesCuentaA07() {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de consultar responsables." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "El relevo de responsable necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const { data, error } = await supabase.rpc("abc_listar_responsables_cuenta", {
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      });
      if (error) throw error;
      if (!data?.ok || !Array.isArray(data.responsables)) throw new Error("responsables_respuesta_invalida");
      return { ok: true, responsables: data.responsables };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

  async function moverMesaCuentaA07(mesaDestinoId, comensales, motivo, expectedMesaDestinoVersion) {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de trasladar la cuenta." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    const nComensales = Number(comensales);
    const motivoLimpio = String(motivo || "").trim();
    if (!mesaDestinoId || !Number.isSafeInteger(nComensales) || nComensales < 1 || nComensales > 999 || !motivoLimpio) {
      return { ok: false, error: "Selecciona mesa de destino, comensales y un motivo del traslado." };
    }
    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto?.ubicacion?.mesa_id) throw new Error("cuenta_sin_mesa_activa");
      if (String(contexto.ubicacion.mesa_id) === String(mesaDestinoId)) throw new Error("mesa_destino_igual_origen");

      const cuentaVersion = versionServidorA02(contexto.cuentaVersion, "a07.move.cuenta_version");
      const mesaOrigenVersion = versionServidorA02(contexto.ubicacion.mesa_version, "a07.move.mesa_origen_version");
      const mesaDestinoVersion = versionServidorA02(expectedMesaDestinoVersion, "a07.move.mesa_destino_version");

      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "El traslado de mesa necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const operationId = [
        "a07.2.move",
        contexto.cuentaId,
        contexto.ubicacion.mesa_id,
        mesaDestinoId,
        cuentaVersion,
        mesaOrigenVersion,
        mesaDestinoVersion,
        nComensales,
        motivoLimpio.slice(0, 48)
      ].join(".");

      const movimiento = await rpcA02ConRecuperacion(supabase, "abc_mover_cuenta_mesa", {
        p_operation_id: operationId,
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_cuenta_id: contexto.cuentaId,
        p_mesa_destino_id: mesaDestinoId,
        p_comensales: nComensales,
        p_motivo: motivoLimpio,
        p_expected_cuenta_version: cuentaVersion,
        p_expected_mesa_origen_version: mesaOrigenVersion,
        p_expected_mesa_destino_version: mesaDestinoVersion,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      }, empresaId, localActivoId, operationId);

      const recuperada = await recuperarCuentaA06();
      const mapa = await cargarMapaSalaA07();
      return {
        ok: true,
        movimiento,
        cuenta: recuperada?.ok ? recuperada : null,
        mapa: mapa?.ok ? mapa : null
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

  async function cambiarResponsableCuentaA07(nuevoResponsable, motivo) {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de cambiar responsable." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    const responsableId = String(nuevoResponsable || "").trim();
    const motivoLimpio = String(motivo || "").trim();
    if (!responsableId || !motivoLimpio) return { ok: false, error: "Selecciona un responsable e indica el motivo del relevo." };

    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      if (String(contexto.responsableActual || "") === responsableId) throw new Error("responsable_sin_cambio");
      const cuentaVersion = versionServidorA02(contexto.cuentaVersion, "a07.responsable.cuenta_version");

      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "El relevo de responsable necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const operationId = [
        "a07.2.responsable",
        contexto.cuentaId,
        responsableId,
        cuentaVersion,
        motivoLimpio.slice(0, 48)
      ].join(".");

      const cambio = await rpcA02ConRecuperacion(supabase, "abc_cambiar_responsable_cuenta", {
        p_operation_id: operationId,
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_cuenta_id: contexto.cuentaId,
        p_nuevo_responsable: responsableId,
        p_motivo: motivoLimpio,
        p_expected_cuenta_version: cuentaVersion,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      }, empresaId, localActivoId, operationId);

      const recuperada = await recuperarCuentaA06();
      const mapa = await cargarMapaSalaA07();
      return {
        ok: true,
        cambio,
        cuenta: recuperada?.ok ? recuperada : null,
        mapa: mapa?.ok ? mapa : null
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {
`,
  "A07.2 adapters"
);

// Exports/wiring.
source = replaceOnce(
  source,
  'return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07 };',
  'return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07 };',
  "A07.2 factory return"
);

source = replaceOnce(
  source,
  'const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });',
  'const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });',
  "A07.2 factory destructure"
);

source = replaceOnce(
  source,
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, nombreResponsableActualA07 = "", anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, nombreResponsableActualA07 = "", anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  "A07.2 VentaRapida props"
);

source = replaceOnce(
  source,
  'recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, nombreResponsableActualA07: miPerfil?.nombre || nombreActivoEmpleado || "", anularVenta',
  'recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, nombreResponsableActualA07: miPerfil?.nombre || nombreActivoEmpleado || "", anularVenta',
  "A07.2 parent wiring"
);

// UI state.
source = replaceOnce(
  source,
  '  const [asignandoMesaA07, setAsignandoMesaA07] = (0, import_react4.useState)(false);\n',
`  const [asignandoMesaA07, setAsignandoMesaA07] = (0, import_react4.useState)(false);
  const [motivoTrasladoA07, setMotivoTrasladoA07] = (0, import_react4.useState)("");
  const [moviendoMesaA07, setMoviendoMesaA07] = (0, import_react4.useState)(false);
  const [relevoAbiertoA07, setRelevoAbiertoA07] = (0, import_react4.useState)(false);
  const [responsablesA07, setResponsablesA07] = (0, import_react4.useState)([]);
  const [responsableSeleccionadoA07, setResponsableSeleccionadoA07] = (0, import_react4.useState)("");
  const [motivoResponsableA07, setMotivoResponsableA07] = (0, import_react4.useState)("");
  const [cargandoResponsablesA07, setCargandoResponsablesA07] = (0, import_react4.useState)(false);
  const [cambiandoResponsableA07, setCambiandoResponsableA07] = (0, import_react4.useState)(false);
`,
  "A07.2 state"
);

// Reset contextual A07.2 state on local/account change.
source = replaceOnce(
  source,
  '      setMesaSeleccionadaA07(null);\n      return;\n',
  '      setMesaSeleccionadaA07(null);\n      setMotivoTrasladoA07("");\n      setRelevoAbiertoA07(false);\n      setResponsablesA07([]);\n      setResponsableSeleccionadoA07("");\n      setMotivoResponsableA07("");\n      return;\n',
  "A07.2 reset"
);

// Responsible labels should use server candidate names when loaded.
source = replaceOnce(
  source,
  '  function etiquetaResponsableA07(userId) {\n    const id = String(userId || "");\n    if (!id) return "Sin responsable";\n',
  '  function etiquetaResponsableA07(userId) {\n    const id = String(userId || "");\n    if (!id) return "Sin responsable";\n    const candidato = responsablesA07.find((r22) => String(r22.user_id || "") === id);\n    if (candidato?.nombre) return candidato.nombre;\n',
  "A07.2 responsible label"
);

// Add UI actions after assignment.
const afterAssign = '    setMesaSeleccionadaA07(null);\n  }\n  const vendibles = (0, import_react4.useMemo)(\n';
source = replaceOnce(
  source,
  afterAssign,
`    setMesaSeleccionadaA07(null);
  }

  async function confirmarTrasladoMesaA07() {
    if (!mesaSeleccionadaA07 || typeof moverMesaCuentaA07 !== "function") return;
    const n = Number(comensalesA07);
    const motivo = motivoTrasladoA07.trim();
    if (!Number.isSafeInteger(n) || n < 1 || n > 999 || !motivo) {
      setErrorSalaA07("Indica comensales y un motivo del traslado.");
      return;
    }
    setMoviendoMesaA07(true);
    setErrorSalaA07("");
    const resultado = await moverMesaCuentaA07(mesaSeleccionadaA07.mesa_id, n, motivo, mesaSeleccionadaA07.version);
    setMoviendoMesaA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudo trasladar la cuenta.");
      if (resultado?.conflict) await refrescarSalaA07();
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.mapa?.zonas) setMapaSalaA07(resultado.mapa);
    else await refrescarSalaA07();
    setMesaSeleccionadaA07(null);
    setMotivoTrasladoA07("");
  }

  async function abrirRelevoResponsableA07() {
    if (typeof listarResponsablesCuentaA07 !== "function") return;
    setCargandoResponsablesA07(true);
    setErrorSalaA07("");
    const resultado = await listarResponsablesCuentaA07();
    setCargandoResponsablesA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudieron cargar los responsables.");
      return;
    }
    setResponsablesA07(resultado.responsables || []);
    const actual = String(pedidoOperativoA05?.responsableActual || mapaSalaA07?.responsableActual || "");
    const primero = (resultado.responsables || []).find((r22) => String(r22.user_id || "") !== actual);
    setResponsableSeleccionadoA07(primero?.user_id || "");
    setRelevoAbiertoA07(true);
  }

  async function confirmarRelevoResponsableA07() {
    if (typeof cambiarResponsableCuentaA07 !== "function") return;
    const motivo = motivoResponsableA07.trim();
    if (!responsableSeleccionadoA07 || !motivo) {
      setErrorSalaA07("Selecciona un nuevo responsable e indica el motivo.");
      return;
    }
    setCambiandoResponsableA07(true);
    setErrorSalaA07("");
    const resultado = await cambiarResponsableCuentaA07(responsableSeleccionadoA07, motivo);
    setCambiandoResponsableA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudo cambiar el responsable.");
      if (resultado?.conflict) await refrescarSalaA07();
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.mapa?.zonas) setMapaSalaA07(resultado.mapa);
    else await refrescarSalaA07();
    setRelevoAbiertoA07(false);
    setMotivoResponsableA07("");
  }

  const vendibles = (0, import_react4.useMemo)(
`,
  "A07.2 UI handlers"
);

// Replace A07.1 placeholder text with real actions.
source = replaceOnce(
  source,
  '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Traslado de mesa y relevo de responsable se validan en A07.2.")\n',
`        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Traslados y relevos conservan la misma cuenta y se registran en el historial del servidor.")
`,
  "A07.2 remove placeholder"
);

// Table buttons now select destination when account already has a table.
source = replaceOnce(
  source,
  '              disabled: !!ubicacion || noAsignable || asignandoMesaA07,\n',
  '              disabled: !!esActual || noAsignable || asignandoMesaA07 || moviendoMesaA07,\n',
  "A07.2 table move enable"
);

// Default diners: preserve current count on a move.
source = replaceOnce(
  source,
  '                setMesaSeleccionadaA07(mesa);\n                if (Number(mesa.capacidad) > 0) setComensalesA07(String(Math.min(Number(mesa.capacidad), 2) || 1));\n',
  '                setMesaSeleccionadaA07(mesa);\n                if (ubicacion?.comensales) setComensalesA07(String(ubicacion.comensales));\n                else if (Number(mesa.capacidad) > 0) setComensalesA07(String(Math.min(Number(mesa.capacidad), 2) || 1));\n',
  "A07.2 preserve diners"
);

// Insert move/reassignment controls before closing Card.
const closeSala = '      !ubicacion && mesaSeleccionadaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },\n';
if (countOf(source, closeSala) !== 1) throw new Error("A07.2 sala form anchor");
const salaIndex = source.indexOf(closeSala);
const salaEndNeedle = '      ) : null\n    );\n  }\n\n  function renderPedidoOperativoA05()';
const salaEnd = source.indexOf(salaEndNeedle, salaIndex);
if (salaEnd < 0) throw new Error("A07.2 sala end anchor");
const originalTail = source.slice(salaIndex, salaEnd);
const extendedTail = originalTail.replace(
  '      ) : null\n',
  `      ) : null,
      ubicacion && mesaSeleccionadaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold mb-2" }, "Trasladar a ", mesaSeleccionadaA07.nombre || mesaSeleccionadaA07.codigo),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Comensales" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "1", max: "999", step: "1", value: comensalesA07, onChange: (e2) => setComensalesA07(e2.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del traslado" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoTrasladoA07, onChange: (e2) => setMotivoTrasladoA07(e2.target.value), placeholder: "Cliente cambia de mesa…" })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarTrasladoMesaA07, disabled: moviendoMesaA07 || !motivoTrasladoA07.trim() }, moviendoMesaA07 ? "Trasladando…" : "Trasladar cuenta"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => { setMesaSeleccionadaA07(null); setMotivoTrasladoA07(""); }, disabled: moviendoMesaA07 }, "Cancelar")
        )
      ) : null,
      !relevoAbiertoA07 ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrirRelevoResponsableA07, disabled: cargandoResponsablesA07 || cambiandoResponsableA07 }, cargandoResponsablesA07 ? "Cargando responsables…" : "Cambiar responsable") : /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nuevo responsable" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: responsableSeleccionadoA07, onChange: (e2) => setResponsableSeleccionadoA07(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona…"),
          responsablesA07.filter((r22) => String(r22.user_id || "") !== String(responsable || "")).map((r22) => /* @__PURE__ */ import_react4.default.createElement("option", { key: r22.user_id, value: r22.user_id }, r22.nombre, " · ", r22.rol))
        )),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del relevo" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoResponsableA07, onChange: (e2) => setMotivoResponsableA07(e2.target.value), placeholder: "Cambio de turno…" })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarRelevoResponsableA07, disabled: cambiandoResponsableA07 || !responsableSeleccionadoA07 || !motivoResponsableA07.trim() }, cambiandoResponsableA07 ? "Cambiando…" : "Confirmar relevo"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => { setRelevoAbiertoA07(false); setMotivoResponsableA07(""); }, disabled: cambiandoResponsableA07 }, "Cancelar")
        )
      )
`
);
source = source.slice(0, salaIndex) + extendedTail + source.slice(salaEnd);

fs.writeFileSync(sourcePath, source);
console.log("A07_2_PATCH=PASS");
