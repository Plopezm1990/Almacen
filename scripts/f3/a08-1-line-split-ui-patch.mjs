import fs from "node:fs";

const path = "source-recovery/fuente-recuperado.js";
let src = fs.readFileSync(path, "utf8");

function replaceOnce(anchor, replacement, label) {
  const first = src.indexOf(anchor);
  const second = first < 0 ? -1 : src.indexOf(anchor, first + anchor.length);
  if (first < 0 || second >= 0) throw new Error("A08_1_PATCH_ANCHOR_" + label);
  src = src.slice(0, first) + replacement + src.slice(first + anchor.length);
}

replaceOnce(
  'const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });',
  'const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, listarCuentasRepartoA08, moverCantidadLineaCuentaA08 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });',
  "APP_DESTRUCTURE"
);

replaceOnce(
  '/* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, nombreResponsableActualA07: miPerfil?.nombre || nombreActivoEmpleado || "", anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })',
  '/* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, listarCuentasRepartoA08, moverCantidadLineaCuentaA08, nombreResponsableActualA07: miPerfil?.nombre || nombreActivoEmpleado || "", anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })',
  "APP_PROPS"
);

replaceOnce(
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, nombreResponsableActualA07 = "", anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  'function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, listarCuentasRepartoA08, moverCantidadLineaCuentaA08, nombreResponsableActualA07 = "", anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {',
  "TPV_SIGNATURE"
);

replaceOnce(
  '      || msg.includes("mesa_destino_version_conflict");',
  '      || msg.includes("mesa_destino_version_conflict")\n      || msg.includes("cuenta_origen_version_conflict")\n      || msg.includes("cuenta_destino_version_conflict");',
  "CONFLICTS"
);

replaceOnce(
  '    if (msg.includes("pedido_enviar_no_autorizado")) return "Tu perfil no tiene permiso para enviar este pedido.";',
  `    if (msg.includes("reparto_cuenta_no_autorizado") || msg.includes("reparto_consultar_no_autorizado")) return "Tu perfil no tiene permiso para repartir esta cuenta.";
    if (msg.includes("cuenta_origen_version_conflict") || msg.includes("cuenta_destino_version_conflict")) return "Una de las cuentas cambió en otro terminal. Recarga el reparto antes de continuar.";
    if (msg.includes("reparto_cantidad_no_fraccionable")) return "Ese producto solo puede repartirse por unidades completas.";
    if (msg.includes("reparto_cantidad_precision_invalida") || msg.includes("reparto_cantidad_precision_maxima")) return "La cantidad no respeta la precisión permitida para ese producto.";
    if (msg.includes("reparto_parte_fiscalizada_inmovil")) return "Esa cantidad ya está fiscalizada y no puede moverse a otra cuenta.";
    if (msg.includes("reparto_cantidad_excede_disponible")) return "La cantidad supera la parte disponible en esta cuenta.";
    if (msg.includes("cuota_activa_incompatible_con_reparto_linea")) return "La cuenta tiene un reparto por importe activo y no admite reparto por productos.";
    if (msg.includes("reparto_moneda_incompatible")) return "Las cuentas usan monedas distintas y no se pueden repartir entre sí.";
    if (msg.includes("reparto_operating_day_incompatible")) return "Las cuentas pertenecen a días operativos distintos.";
    if (msg.includes("reparto_cuenta_no_abierta") || msg.includes("reparto_cuenta_no_encontrada")) return "La cuenta origen o destino ya no está disponible.";
    if (msg.includes("reparto_linea_no_repartible") || msg.includes("reparto_linea_no_encontrada")) return "La línea seleccionada ya no se puede repartir.";
    if (msg.includes("reparto_comensal_conflict")) return "La parte destino ya está asignada a otro comensal.";
    if (msg.includes("pedido_enviar_no_autorizado")) return "Tu perfil no tiene permiso para enviar este pedido.";`,
  "ERROR_MAP"
);

const adapters = `
  async function listarCuentasRepartoA08() {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de repartir la cuenta." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "El reparto de cuenta necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const [repartoResp, cuentasResp] = await Promise.all([
        supabase.rpc("abc_consultar_reparto_cuenta", {
          p_empresa_id: empresaId,
          p_local_id: localActivoId,
          p_cuenta_id: contexto.cuentaId,
          p_terminal_id: terminal.terminalId,
          p_session_id: terminal.sessionId,
          p_operating_day: contexto.operatingDay
        }),
        supabase.rpc("abc_listar_cuentas_recuperables", {
          p_empresa_id: empresaId,
          p_local_id: localActivoId,
          p_terminal_id: terminal.terminalId,
          p_session_id: terminal.sessionId,
          p_operating_day: contexto.operatingDay,
          p_abandono_minutos: 0
        })
      ]);
      if (repartoResp.error) throw repartoResp.error;
      if (cuentasResp.error) throw cuentasResp.error;
      const actual = repartoResp.data;
      if (!actual?.ok || !actual?.reparto) throw new Error("reparto_respuesta_invalida");
      const cuentas = (Array.isArray(cuentasResp.data?.cuentas) ? cuentasResp.data.cuentas : []).filter((cuenta) =>
        String(cuenta?.cuenta_id || "") !== String(contexto.cuentaId)
        && String(cuenta?.estado || "") === "ABIERTA"
        && cuenta?.reanudable_mismo_dia === true
        && String(cuenta?.currency_code || "") === String(actual.currency_code || "")
      );
      return {
        ok: true,
        cuentaId: actual.cuenta_id,
        cuentaVersion: versionServidorA02(actual.version, "a08.reparto.cuenta_version"),
        reparto: actual.reparto,
        cuentas
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

  async function moverCantidadLineaCuentaA08({
    lineaId,
    cuentaDestinoId,
    cantidad,
    comensalRef = "",
    expectedOrigenVersion,
    expectedDestinoVersion,
    expectedLineaVersion
  }) {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de repartir la cuenta." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    const cantidadNumero = Number(cantidad);
    const destinoId = String(cuentaDestinoId || "").trim();
    const linea = String(lineaId || "").trim();
    const comensal = String(comensalRef || "").trim();
    if (!linea || !destinoId || !Number.isFinite(cantidadNumero) || cantidadNumero <= 0) {
      return { ok: false, error: "Selecciona producto, cuenta destino y una cantidad mayor que cero." };
    }
    try {
      const contexto = leerContextoCuentaA02(empresaId, localActivoId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      if (String(contexto.cuentaId) === destinoId) throw new Error("reparto_cuenta_destino_igual_origen");
      const origenVersion = versionServidorA02(expectedOrigenVersion, "a08.reparto.origen_version");
      const destinoVersion = versionServidorA02(expectedDestinoVersion, "a08.reparto.destino_version");
      const lineaVersion = versionServidorA02(expectedLineaVersion, "a08.reparto.linea_version");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "El reparto de cuenta necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const operationId = [
        "a08.1.line",
        contexto.cuentaId,
        linea,
        destinoId,
        origenVersion,
        destinoVersion,
        lineaVersion,
        String(cantidadNumero),
        comensal.slice(0, 32)
      ].join(".");
      const movimiento = await rpcA02ConRecuperacion(supabase, "abc_mover_cantidad_linea_cuenta", {
        p_operation_id: operationId,
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_linea_id: linea,
        p_cuenta_origen_id: contexto.cuentaId,
        p_cuenta_destino_id: destinoId,
        p_cantidad: cantidadNumero,
        p_comensal_ref: comensal || null,
        p_expected_origen_version: origenVersion,
        p_expected_destino_version: destinoVersion,
        p_expected_linea_version: lineaVersion,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contexto.operatingDay
      }, empresaId, localActivoId, operationId);

      const cuenta = await recuperarCuentaA06();
      const reparto = await listarCuentasRepartoA08();
      return {
        ok: true,
        movimiento,
        cuenta: cuenta?.ok ? cuenta : null,
        reparto: reparto?.ok ? reparto : null
      };
    } catch (error) {
      return respuestaErrorA06(error);
    }
  }

`;

replaceOnce(
  '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {',
  adapters + '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {',
  "ADAPTERS"
);

replaceOnce(
  '  return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07 };',
  '  return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, listarResponsablesCuentaA07, moverMesaCuentaA07, cambiarResponsableCuentaA07, listarCuentasRepartoA08, moverCantidadLineaCuentaA08 };',
  "LOGIC_RETURN"
);

replaceOnce(
  '  const [cambiandoResponsableA07, setCambiandoResponsableA07] = (0, import_react4.useState)(false);',
  `  const [cambiandoResponsableA07, setCambiandoResponsableA07] = (0, import_react4.useState)(false);
  const [repartoA08, setRepartoA08] = (0, import_react4.useState)(null);
  const [cuentaVersionA08, setCuentaVersionA08] = (0, import_react4.useState)(null);
  const [cuentasDestinoA08, setCuentasDestinoA08] = (0, import_react4.useState)([]);
  const [lineaSeleccionadaA08, setLineaSeleccionadaA08] = (0, import_react4.useState)("");
  const [cuentaDestinoA08, setCuentaDestinoA08] = (0, import_react4.useState)("");
  const [cantidadA08, setCantidadA08] = (0, import_react4.useState)("1");
  const [comensalA08, setComensalA08] = (0, import_react4.useState)("");
  const [cargandoRepartoA08, setCargandoRepartoA08] = (0, import_react4.useState)(false);
  const [moviendoLineaA08, setMoviendoLineaA08] = (0, import_react4.useState)(false);
  const [errorRepartoA08, setErrorRepartoA08] = (0, import_react4.useState)("");`,
  "UI_STATE"
);

replaceOnce(
  '      setMotivoResponsableA07("");\n      return;',
  `      setMotivoResponsableA07("");
      setRepartoA08(null);
      setCuentaVersionA08(null);
      setCuentasDestinoA08([]);
      setLineaSeleccionadaA08("");
      setCuentaDestinoA08("");
      setCantidadA08("1");
      setComensalA08("");
      setErrorRepartoA08("");
      return;`,
  "UI_RESET"
);

const handlers = `
  async function cargarRepartoA08UI() {
    if (typeof listarCuentasRepartoA08 !== "function" || !pedidoOperativoA05?.cuentaId) return;
    setCargandoRepartoA08(true);
    setErrorRepartoA08("");
    const resultado = await listarCuentasRepartoA08();
    setCargandoRepartoA08(false);
    if (!resultado?.ok) {
      setErrorRepartoA08(resultado?.error || "No se pudo cargar el reparto de la cuenta.");
      return;
    }
    const lineas = Array.isArray(resultado.reparto?.lineas) ? resultado.reparto.lineas : [];
    setRepartoA08(resultado.reparto || null);
    setCuentaVersionA08(resultado.cuentaVersion);
    setCuentasDestinoA08(resultado.cuentas || []);
    const lineaActual = lineas.some((l22) => String(l22.source_line_id) === String(lineaSeleccionadaA08))
      ? lineaSeleccionadaA08
      : String(lineas[0]?.source_line_id || "");
    const cuentaActual = (resultado.cuentas || []).some((c22) => String(c22.cuenta_id) === String(cuentaDestinoA08))
      ? cuentaDestinoA08
      : String(resultado.cuentas?.[0]?.cuenta_id || "");
    setLineaSeleccionadaA08(lineaActual);
    setCuentaDestinoA08(cuentaActual);
  }

  (0, import_react4.useEffect)(() => {
    if (pedidoOperativoA05?.cuentaId && typeof listarCuentasRepartoA08 === "function") {
      cargarRepartoA08UI();
    }
  }, [pedidoOperativoA05?.cuentaId, local?.id, configEmpresa?.id]);

  function etiquetaCuentaDestinoA08(cuenta) {
    const ubicacion = cuenta?.ubicacion || {};
    const mesa = ubicacion.mesa_nombre || ubicacion.mesa_codigo || "";
    const zona = ubicacion.zona_nombre || ubicacion.zona_tipo || "";
    const sitio = [mesa, zona].filter(Boolean).join(" · ");
    const id = String(cuenta?.cuenta_id || "");
    const total = Number(cuenta?.total_comercial || 0);
    return String(sitio || cuenta?.modalidad || "Cuenta") + " · …" + id.slice(-8) + " · €" + fmt(total);
  }

  async function confirmarRepartoLineaA08() {
    if (typeof moverCantidadLineaCuentaA08 !== "function") return;
    const lineas = Array.isArray(repartoA08?.lineas) ? repartoA08.lineas : [];
    const linea = lineas.find((l22) => String(l22.source_line_id) === String(lineaSeleccionadaA08));
    const destino = cuentasDestinoA08.find((c22) => String(c22.cuenta_id) === String(cuentaDestinoA08));
    const cantidad = Number(cantidadA08);
    const disponible = linea ? Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_fiscalizada || 0)) : 0;
    if (!linea || !destino || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > disponible) {
      setErrorRepartoA08("Selecciona producto, cuenta destino y una cantidad disponible válida.");
      return;
    }
    setMoviendoLineaA08(true);
    setErrorRepartoA08("");
    const resultado = await moverCantidadLineaCuentaA08({
      lineaId: linea.source_line_id,
      cuentaDestinoId: destino.cuenta_id,
      cantidad,
      comensalRef: comensalA08,
      expectedOrigenVersion: cuentaVersionA08,
      expectedDestinoVersion: destino.version,
      expectedLineaVersion: linea.linea_version
    });
    setMoviendoLineaA08(false);
    if (!resultado?.ok) {
      setErrorRepartoA08(resultado?.error || "No se pudo repartir el producto.");
      if (resultado?.conflict) {
        if (typeof recuperarCuentaA06 === "function") {
          const recuperada = await recuperarCuentaA06();
          if (recuperada?.ok && recuperada.pedidoId) setPedidoOperativoA05(recuperada);
        }
        await cargarRepartoA08UI();
      }
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.reparto?.ok) {
      setRepartoA08(resultado.reparto.reparto || null);
      setCuentaVersionA08(resultado.reparto.cuentaVersion);
      setCuentasDestinoA08(resultado.reparto.cuentas || []);
      const siguientes = Array.isArray(resultado.reparto.reparto?.lineas) ? resultado.reparto.reparto.lineas : [];
      setLineaSeleccionadaA08(String(siguientes[0]?.source_line_id || ""));
      setCuentaDestinoA08(String(resultado.reparto.cuentas?.[0]?.cuenta_id || ""));
    } else {
      await cargarRepartoA08UI();
    }
    setCantidadA08("1");
    setComensalA08("");
  }

`;

replaceOnce(
  '  const vendibles = (0, import_react4.useMemo)(',
  handlers + '  const vendibles = (0, import_react4.useMemo)(',
  "UI_HANDLERS"
);

const render = `
  function renderRepartoA08() {
    if (!pedidoOperativoA05?.cuentaId) return null;
    const lineas = Array.isArray(repartoA08?.lineas) ? repartoA08.lineas : [];
    const linea = lineas.find((l22) => String(l22.source_line_id) === String(lineaSeleccionadaA08)) || null;
    const disponible = linea ? Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_fiscalizada || 0)) : 0;
    const producto = linea ? productos.find((p22) => String(p22.id) === String(linea.producto_id)) : null;
    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Repartir productos"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: cargarRepartoA08UI, disabled: cargandoRepartoA08 || moviendoLineaA08 }, cargandoRepartoA08 ? "Actualizando…" : "Actualizar")
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, "Mueve cantidades comerciales entre cuentas abiertas del mismo local. El pedido de cocina y los pagos no se reescriben."),
      errorRepartoA08 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[11px] mb-3", style: { color: C2.red } }, errorRepartoA08) : null,
      cargandoRepartoA08 && !repartoA08 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Cargando reparto…") : null,
      repartoA08 && lineas.length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "No hay líneas repartibles en esta cuenta.") : null,
      repartoA08 && lineas.length > 0 && cuentasDestinoA08.length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "No hay otra cuenta abierta compatible en este local.") : null,
      repartoA08 && lineas.length > 0 && cuentasDestinoA08.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", null,
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Producto / línea" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: lineaSeleccionadaA08, onChange: (e2) => { setLineaSeleccionadaA08(e2.target.value); setCantidadA08("1"); }, className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          lineas.map((l22) => {
            const p22 = productos.find((x3) => String(x3.id) === String(l22.producto_id));
            const libre = Math.max(0, Number(l22.cantidad || 0) - Number(l22.cantidad_fiscalizada || 0));
            return /* @__PURE__ */ import_react4.default.createElement("option", { key: l22.source_line_id, value: l22.source_line_id }, p22?.nombre || l22.producto_id, " · disponible ", fmt(libre));
          })
        )),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Cuenta destino" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: cuentaDestinoA08, onChange: (e2) => setCuentaDestinoA08(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          cuentasDestinoA08.map((c22) => /* @__PURE__ */ import_react4.default.createElement("option", { key: c22.cuenta_id, value: c22.cuenta_id }, etiquetaCuentaDestinoA08(c22)))
        )),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Cantidad" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "0.00000001", max: String(disponible || ""), step: "any", value: cantidadA08, onChange: (e2) => setCantidadA08(e2.target.value) })),
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Comensal (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: comensalA08, onChange: (e2) => setComensalA08(e2.target.value), placeholder: "Ej. Persona 2" }))
        ),
        linea ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, producto?.nombre || linea.producto_id, " · disponible ", fmt(disponible), Number(linea.cantidad_fiscalizada || 0) > 0 ? " · fiscalizado " + fmt(Number(linea.cantidad_fiscalizada || 0)) : "") : null,
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarRepartoLineaA08, disabled: moviendoLineaA08 || !linea || !cuentaDestinoA08 || !(Number(cantidadA08) > 0) || Number(cantidadA08) > disponible }, moviendoLineaA08 ? "Moviendo…" : "Mover producto")
      ) : null
    );
  }

`;

replaceOnce(
  '  function renderPedidoOperativoA05() {',
  render + '  function renderPedidoOperativoA05() {',
  "UI_RENDER"
);

replaceOnce(
  '  renderSalaA07(), renderPedidoOperativoA05(),',
  '  renderSalaA07(), renderRepartoA08(), renderPedidoOperativoA05(),',
  "UI_INSERT"
);

fs.writeFileSync(path, src);
console.log("A08_1_LINE_SPLIT_UI_PATCH=PASS");
