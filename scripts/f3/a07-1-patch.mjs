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

// A07.1 — el contexto local conserva campos reales de cuenta necesarios para sala.
source = replaceOnce(
  source,
  '        currencyCode: pending.currencyCode,\n        updatedAt: (/* @__PURE__ */ new Date()).toISOString()\n',
  '        currencyCode: pending.currencyCode,\n        modalidad: pending.modalidad,\n        responsableActual: contexto.userId,\n        ubicacion: null,\n        updatedAt: (/* @__PURE__ */ new Date()).toISOString()\n',
  "A07.1 initial account metadata"
);

source = replaceOnce(
  source,
  '        currencyCode: String(data.cuenta.currency_code || contextoLocal.currencyCode || "EUR"),\n        updatedAt: (/* @__PURE__ */ new Date()).toISOString()\n',
  '        currencyCode: String(data.cuenta.currency_code || contextoLocal.currencyCode || "EUR"),\n        modalidad: String(data.cuenta.modalidad || contextoLocal.modalidad || "BARRA"),\n        responsableActual: data.cuenta.responsable_actual || contextoLocal.responsableActual || null,\n        ubicacion: data.ubicacion && typeof data.ubicacion === "object" ? data.ubicacion : null,\n        updatedAt: (/* @__PURE__ */ new Date()).toISOString()\n',
  "A07.1 recovered account metadata"
);

// Mesa también participa en optimistic locking.
source = replaceOnce(
  source,
  '      || msg.includes("linea_version_conflict");\n',
  '      || msg.includes("linea_version_conflict")\n      || msg.includes("mesa_version_conflict");\n',
  "A07.1 mesa conflict"
);

// Errores A07.1 visibles y específicos.
const errorAnchor = '    if (msg.includes("cuenta_recuperacion_id_distinto") || msg.includes("cuenta_recuperacion_respuesta_invalida")) return "La respuesta de recuperación no coincide con la cuenta guardada; se ha bloqueado la reanudación.";\n';
source = replaceOnce(
  source,
  errorAnchor,
  errorAnchor +
  '    if (msg.includes("sala_ver_no_autorizada")) return "Tu perfil no tiene permiso para ver la sala.";\n' +
  '    if (msg.includes("mesa_asignar_no_autorizada")) return "Tu perfil no tiene permiso para asignar mesas.";\n' +
  '    if (msg.includes("mesa_version_conflict")) return "La mesa cambió en otro terminal. Se ha recargado el mapa antes de continuar.";\n' +
  '    if (msg.includes("cuenta_ya_asignada_mesa")) return "La cuenta ya tiene una mesa asignada. Recarga la sala antes de continuar.";\n' +
  '    if (msg.includes("mesa_no_asignable") || msg.includes("mesa_fuera_servicio")) return "La mesa ya no está disponible para asignación.";\n' +
  '    if (msg.includes("mesa_no_encontrada")) return "La mesa seleccionada ya no existe.";\n' +
  '    if (msg.includes("zona_no_activa")) return "La zona de la mesa ya no está activa.";\n',
  "A07.1 errors"
);

// Adaptadores A07.1: lectura de mapa y asignación de la cuenta real actual.
// No crean mesas/zonas ni implementan traslado o relevo (A07.2).
const beforeLegacy = '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {\n';
source = replaceOnce(
  source,
  beforeLegacy,
`  async function cargarMapaSalaA07() {
    if (!localActivoId) return { ok: false, error: "Selecciona un local para ver la sala." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    let contexto = null;
    try {
      contexto = leerContextoCuentaA02(empresaId, localActivoId);
    } catch (error) {
      return { ok: false, error: errorRpcA02(error) };
    }
    if (!contexto) {
      return {
        ok: false,
        requiereCuenta: true,
        error: "Guarda primero un pedido real para cargar la sala con el día operativo y la sesión del servidor."
      };
    }
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) return { ok: false, error: "La sala necesita conexión con el servidor." };
    try {
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const { data, error } = await supabase.rpc("abc_listar_mapa_sala", {
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      });
      if (error) throw error;
      if (!data?.ok || !Array.isArray(data.zonas)) throw new Error("mapa_sala_respuesta_invalida");
      return {
        ok: true,
        zonas: data.zonas,
        operatingDay: data.operating_day || contexto.operatingDay,
        terminalId: terminal.terminalId,
        sessionId: terminal.sessionId,
        currentUserId: terminal.userId,
        cuentaId: contexto.cuentaId,
        cuentaVersion: contexto.cuentaVersion,
        ubicacion: contexto.ubicacion || null,
        responsableActual: contexto.responsableActual || null
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

  async function asignarMesaCuentaA07(mesaId, comensales, expectedMesaVersion) {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de asignar una mesa." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    const nComensales = Number(comensales);
    if (!mesaId || !Number.isSafeInteger(nComensales) || nComensales < 1 || nComensales > 999) {
      return { ok: false, error: "Indica una mesa y un número de comensales entre 1 y 999." };
    }
    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto) throw new Error("contexto_cuenta_persistido_invalido");
      if (contexto.ubicacion?.mesa_id) throw new Error("cuenta_ya_asignada_mesa");
      const mesaVersion = versionServidorA02(expectedMesaVersion, "a07.mesa_version");
      const cuentaVersion = versionServidorA02(contexto.cuentaVersion, "a07.cuenta_version");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "La asignación de mesa necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const operationId = [
        "a07.1.assign",
        contexto.cuentaId,
        mesaId,
        cuentaVersion,
        mesaVersion,
        nComensales
      ].join(".");
      const asignacion = await rpcA02ConRecuperacion(supabase, "abc_asignar_cuenta_mesa", {
        p_operation_id: operationId,
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_cuenta_id: contexto.cuentaId,
        p_mesa_id: mesaId,
        p_comensales: nComensales,
        p_expected_cuenta_version: cuentaVersion,
        p_expected_mesa_version: mesaVersion,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      }, empresaId, localActivoId, operationId);

      const recuperada = await recuperarCuentaA06();
      const mapa = await cargarMapaSalaA07();
      return {
        ok: true,
        asignacion,
        cuenta: recuperada?.ok ? recuperada : null,
        mapa: mapa?.ok ? mapa : null
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {
`,
  "A07.1 adapters"
);

// Factory exports.
source = replaceOnce(
  source,
  'return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06 };',
  'return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07 };',
  "A07.1 factory return"
);

source = replaceOnce(
  source,
  'const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });',
  'const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });',
  "A07.1 factory destructure"
);

// VentaRapida receives only A07.1 adapters. A07.2 movement/reassignment is deliberately absent.
source = replaceOnce(
  source,
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, nombreResponsableActualA07 = "", anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  "A07.1 VentaRapida props"
);

source = replaceOnce(
  source,
  'VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }',
  'VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, nombreResponsableActualA07: miPerfil?.nombre || nombreActivoEmpleado || "", anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }',
  "A07.1 parent wiring"
);

// State and automatic refresh once there is a real server account.
source = replaceOnce(
  source,
  '  const [conflictoA06, setConflictoA06] = (0, import_react4.useState)(null);\n  const omitirPersistenciaInicialA06Ref = (0, import_react4.useRef)(true);\n',
`  const [conflictoA06, setConflictoA06] = (0, import_react4.useState)(null);
  const omitirPersistenciaInicialA06Ref = (0, import_react4.useRef)(true);
  const [mapaSalaA07, setMapaSalaA07] = (0, import_react4.useState)(null);
  const [cargandoSalaA07, setCargandoSalaA07] = (0, import_react4.useState)(false);
  const [errorSalaA07, setErrorSalaA07] = (0, import_react4.useState)("");
  const [mesaSeleccionadaA07, setMesaSeleccionadaA07] = (0, import_react4.useState)(null);
  const [comensalesA07, setComensalesA07] = (0, import_react4.useState)("2");
  const [asignandoMesaA07, setAsignandoMesaA07] = (0, import_react4.useState)(false);
`,
  "A07.1 state"
);

const afterRecoveryEffect = '  }, [local?.id, configEmpresa?.id, leerPedidoOperativoA05, recuperarCuentaA06]);\n';
source = replaceOnce(
  source,
  afterRecoveryEffect,
`  }, [local?.id, configEmpresa?.id, leerPedidoOperativoA05, recuperarCuentaA06]);

  async function refrescarSalaA07() {
    if (typeof cargarMapaSalaA07 !== "function") return;
    if (!pedidoOperativoA05?.cuentaId) {
      setMapaSalaA07(null);
      setErrorSalaA07("");
      return;
    }
    setCargandoSalaA07(true);
    const resultado = await cargarMapaSalaA07();
    setCargandoSalaA07(false);
    if (!resultado?.ok) {
      setMapaSalaA07(null);
      setErrorSalaA07(resultado?.error || "No se pudo cargar la sala.");
      return;
    }
    setMapaSalaA07(resultado);
    setErrorSalaA07("");
  }

  (0, import_react4.useEffect)(() => {
    if (!pedidoOperativoA05?.cuentaId) {
      setMapaSalaA07(null);
      setErrorSalaA07("");
      setMesaSeleccionadaA07(null);
      return;
    }
    refrescarSalaA07();
  }, [pedidoOperativoA05?.cuentaId, pedidoOperativoA05?.cuentaVersion, local?.id, configEmpresa?.id]);

  function etiquetaResponsableA07(userId) {
    const id = String(userId || "");
    if (!id) return "Sin responsable";
    if (mapaSalaA07?.currentUserId && id === String(mapaSalaA07.currentUserId) && nombreResponsableActualA07) {
      return nombreResponsableActualA07;
    }
    return "Usuario …" + id.slice(-8);
  }

  async function confirmarAsignacionMesaA07() {
    if (!mesaSeleccionadaA07 || typeof asignarMesaCuentaA07 !== "function") return;
    const n = Number(comensalesA07);
    if (!Number.isSafeInteger(n) || n < 1 || n > 999) {
      setErrorSalaA07("Indica un número de comensales entre 1 y 999.");
      return;
    }
    setAsignandoMesaA07(true);
    setErrorSalaA07("");
    const resultado = await asignarMesaCuentaA07(mesaSeleccionadaA07.mesa_id, n, mesaSeleccionadaA07.version);
    setAsignandoMesaA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudo asignar la mesa.");
      if (resultado?.conflict) await refrescarSalaA07();
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.mapa?.zonas) setMapaSalaA07(resultado.mapa);
    else await refrescarSalaA07();
    setMesaSeleccionadaA07(null);
  }
`,
  "A07.1 sala effects"
);

// Keep freshly created account metadata visible before the recovery roundtrip.
source = replaceOnce(
  source,
  '      currencyCode: resultado.currencyCode || "EUR"\n    });',
  '      currencyCode: resultado.currencyCode || "EUR",\n      responsableActual: resultado.responsableActual || null,\n      ubicacion: resultado.ubicacion || null\n    });',
  "A07.1 confirmacion metadata"
);

// Add A07 metadata to venderCarritoA02 result.
source = replaceOnce(
  source,
  '        currencyCode: agregado.currencyCode,\n        ventaId: agregado.cuentaId\n',
  '        currencyCode: agregado.currencyCode,\n        responsableActual: agregado.responsableActual || contexto.userId,\n        ubicacion: agregado.ubicacion || null,\n        ventaId: agregado.cuentaId\n',
  "A07.1 sale result metadata"
);

// UI: real zones/tables derived from A07 map. No fake floor plan.
const renderAnchor = '  function renderPedidoOperativoA05() {\n';
source = replaceOnce(
  source,
  renderAnchor,
`  function renderSalaA07() {
    const pedido = pedidoOperativoA05;
    if (!pedido?.cuentaId) return null;
    const ubicacion = pedido.ubicacion || mapaSalaA07?.ubicacion || null;
    const responsable = pedido.responsableActual || mapaSalaA07?.responsableActual || null;
    const zonas = Array.isArray(mapaSalaA07?.zonas) ? mapaSalaA07.zonas : [];
    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Sala y mesas"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: refrescarSalaA07, disabled: cargandoSalaA07 }, cargandoSalaA07 ? "Actualizando…" : "Actualizar")
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "Ocupación y comensales vienen de cuentas reales del servidor. Responsable: ", /* @__PURE__ */ import_react4.default.createElement("b", null, etiquetaResponsableA07(responsable))),
      ubicacion ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: C2.accentSoft } },
        /* @__PURE__ */ import_react4.default.createElement("b", null, ubicacion.mesa_nombre || ubicacion.mesa_codigo || "Mesa"),
        " · ", ubicacion.zona_nombre || ubicacion.zona_tipo || "Zona",
        " · ", Number(ubicacion.comensales) || 0, " comensal(es)",
        " · ", ubicacion.estado_mesa || "OCUPADA",
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Traslado de mesa y relevo de responsable se validan en A07.2.")
      ) : null,
      errorSalaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorSalaA07) : null,
      !cargandoSalaA07 && zonas.length === 0 && !errorSalaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "No hay zonas ni mesas configuradas para este local.") : null,
      zonas.map((zona) => /* @__PURE__ */ import_react4.default.createElement("div", { key: zona.zona_id, className: "mb-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] font-semibold uppercase tracking-wide mb-1", style: { color: C2.inkSoft } }, zona.nombre || zona.codigo, " · ", zona.tipo),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2" },
          (zona.mesas || []).map((mesa) => {
            const seleccionada = mesaSeleccionadaA07?.mesa_id === mesa.mesa_id;
            const noAsignable = ["BLOQUEADA", "RESERVADA", "FUERA_SERVICIO"].includes(String(mesa.estado_efectivo || ""));
            const esActual = ubicacion?.mesa_id && String(ubicacion.mesa_id) === String(mesa.mesa_id);
            return /* @__PURE__ */ import_react4.default.createElement("button", {
              key: mesa.mesa_id,
              type: "button",
              disabled: !!ubicacion || noAsignable || asignandoMesaA07,
              onClick: () => {
                setMesaSeleccionadaA07(mesa);
                if (Number(mesa.capacidad) > 0) setComensalesA07(String(Math.min(Number(mesa.capacidad), 2) || 1));
              },
              className: "rounded-lg p-2 text-left",
              style: {
                border: "1px solid " + (esActual || seleccionada ? C2.accent : C2.line),
                background: esActual ? C2.accentSoft : C2.surface,
                opacity: noAsignable ? 0.6 : 1
              }
            },
              /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold" }, mesa.nombre || mesa.codigo),
              /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, mesa.estado_efectivo, " · ", Number(mesa.ocupacion_comensales) || 0, "/", Number(mesa.capacidad) || 0, " personas"),
              mesa.sobre_capacidad ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.red } }, "Sobre capacidad") : null,
              (mesa.cuentas || []).length ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, (mesa.cuentas || []).length, " cuenta(s) activa(s)") : null
            );
          })
        )
      )),
      !ubicacion && mesaSeleccionadaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold mb-2" }, "Asignar ", mesaSeleccionadaA07.nombre || mesaSeleccionadaA07.codigo),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Comensales" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "1", max: "999", step: "1", value: comensalesA07, onChange: (e2) => setComensalesA07(e2.target.value) })),
        Number(comensalesA07) > Number(mesaSeleccionadaA07.capacidad) ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.amber || C2.inkSoft } }, "Aviso: supera la capacidad configurada de la mesa. El backend lo permite como advertencia, no como bloqueo.") : null,
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarAsignacionMesaA07, disabled: asignandoMesaA07 }, asignandoMesaA07 ? "Asignando…" : "Asignar esta cuenta"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setMesaSeleccionadaA07(null), disabled: asignandoMesaA07 }, "Cancelar")
        )
      ) : null
    );
  }

  function renderPedidoOperativoA05() {
`,
  "A07.1 render sala"
);

// Insert map before operational order card.
source = replaceOnce(
  source,
  '), renderPedidoOperativoA05(), vendibles.length === 0 ?',
  '), renderSalaA07(), renderPedidoOperativoA05(), vendibles.length === 0 ?',
  "A07.1 render placement"
);

fs.writeFileSync(sourcePath, source);
console.log("A07_1_PATCH=PASS");
