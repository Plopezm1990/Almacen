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

// A06.1 también corrige un fallo de cableado detectado en preflight:
// los adaptadores A02/A05 vivían dentro de crearLogicaVenta pero no se
// devolvían al componente principal, y empresaDelLocalActivo no se inyectaba.
source = replaceOnce(
  source,
  "function crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId }) {",
  "function crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo = null }) {",
  "A06.1 factory scope"
);

source = replaceOnce(
  source,
  "const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId });",
  "const { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06 } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });",
  "A06.1 factory wiring"
);

source = replaceOnce(
  source,
  "  return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote };\n}",
  "  return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06 };\n}",
  "A06.1 factory return"
);

// Recuperación autoritativa de LA MISMA cuenta. No crea IDs ni líneas.
source = replaceOnce(
  source,
  "  function leerPedidoOperativoA05() {\n",
`  async function recuperarCuentaA06() {
    if (!localActivoId) return { ok: false, recuperable: false, error: "Selecciona un local antes de recuperar la cuenta." };
    const empresaId = empresaDelLocalActivo?.id || null;
    if (!empresaId) return { ok: false, recuperable: false, error: "No se pudo determinar la empresa activa para recuperar la cuenta." };

    let contextoLocal = null;
    try {
      contextoLocal = leerContextoCuentaA02(empresaId, localActivoId);
    } catch (error) {
      return { ok: false, recuperable: false, error: errorRpcA02(error) };
    }
    if (!contextoLocal) return { ok: false, recuperable: false, error: null };

    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) {
      return { ok: true, recuperado: false, offline: true, ...contextoLocal };
    }

    try {
      const supabase = await window.getSupabaseClient();
      const terminal = await contextoTerminalA02(supabase, empresaId, localActivoId);
      const { data, error } = await supabase.rpc("abc_recuperar_cuenta", {
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_cuenta_id: contextoLocal.cuentaId,
        p_terminal_id: terminal.terminalId,
        p_session_id: terminal.sessionId,
        p_operating_day: contextoLocal.operatingDay
      });
      if (error) throw error;
      if (!data?.ok || !data?.cuenta) throw new Error("cuenta_recuperacion_respuesta_invalida");
      if (String(data.cuenta.id || "") !== String(contextoLocal.cuentaId)) {
        throw new Error("cuenta_recuperacion_id_distinto");
      }
      if (data.requires_operating_day_resolution || data.reanudable === false) {
        throw new Error("cuenta_recuperacion_otro_dia");
      }

      const pedidos = Array.isArray(data.pedidos) ? data.pedidos : [];
      const activos = pedidos.filter((p22) => !["CERRADO", "CANCELADO"].includes(String(p22?.estado || "")));
      if (activos.length !== 1) throw new Error("cuenta_recuperacion_pedidos_ambigua");
      const pedido = activos[0];
      const lineasServidor = Array.isArray(pedido.lineas) ? pedido.lineas : [];
      if (lineasServidor.length === 0) throw new Error("cuenta_recuperacion_sin_lineas");

      const lineas = lineasServidor.map((linea) => {
        const opciones = Array.isArray(linea.opciones) ? linea.opciones : [];
        const catalogVersion = Number(linea?.snapshot_comercial?.catalog_version);
        const selecciones = opciones.map((opcion) => ({
          grupo_id: opcion.grupo_id,
          opcion_id: opcion.opcion_id,
          cantidad: Number(opcion.cantidad),
          expected_group_version: Number(opcion.catalog_group_version),
          expected_product_group_version: Number(opcion.catalog_product_group_version),
          expected_option_version: Number(opcion.catalog_option_version)
        }));
        const configuracionValida = opciones.length > 0
          && Number.isSafeInteger(catalogVersion)
          && catalogVersion > 0
          && selecciones.every((s22) =>
            !!s22.grupo_id
            && !!s22.opcion_id
            && Number.isSafeInteger(s22.cantidad)
            && s22.cantidad > 0
            && Number.isSafeInteger(s22.expected_group_version)
            && s22.expected_group_version > 0
            && Number.isSafeInteger(s22.expected_product_group_version)
            && s22.expected_product_group_version > 0
            && Number.isSafeInteger(s22.expected_option_version)
            && s22.expected_option_version > 0
          );

        return {
          lineaId: linea.id,
          lineaVersion: versionServidorA02(linea.version, "a06.linea_version"),
          estado: String(linea.estado || "BORRADOR"),
          productoId: String(linea.producto_id || ""),
          cantidad: Number(linea.cantidad),
          configuradaA04: opciones.length > 0,
          configuracionA04: configuracionValida ? {
            expectedProductVersion: catalogVersion,
            selecciones
          } : null,
          opciones,
          total: importeServidorA02(linea.total, "a06.linea_total")
        };
      });

      const recuperado = guardarContextoCuentaA02(empresaId, localActivoId, {
        schemaVersion: 1,
        empresaId,
        localId: localActivoId,
        cuentaId: data.cuenta.id,
        cuentaVersion: versionServidorA02(data.cuenta.version, "a06.cuenta_version"),
        pedidoId: pedido.id,
        pedidoVersion: versionServidorA02(pedido.version, "a06.pedido_version"),
        pedidoEstado: String(pedido.estado || "ABIERTO"),
        lineas,
        terminalId: terminal.terminalId,
        sessionId: terminal.sessionId,
        operatingDay: contextoLocal.operatingDay,
        currencyCode: String(data.cuenta.currency_code || contextoLocal.currencyCode || "EUR"),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });

      return {
        ok: true,
        recuperado: true,
        revision: data.revision || null,
        estadoCobro: data.estado_cobro || null,
        cuentaEstado: data.cuenta.estado || null,
        ...recuperado
      };
    } catch (error) {
      return { ok: false, recuperable: true, error: errorRpcA02(error) };
    }
  }

  function leerPedidoOperativoA05() {
`,
  "A06.1 recovery adapter"
);

// Mensajes fail-closed específicos de recuperación.
source = replaceOnce(
  source,
  '    if (msg.includes("cuenta_version_conflict") || msg.includes("pedido_version_conflict") || msg.includes("linea_version_conflict")) return "La cuenta, el pedido o una línea cambió en otro terminal. Recarga antes de continuar.";\n',
  '    if (msg.includes("cuenta_version_conflict") || msg.includes("pedido_version_conflict") || msg.includes("linea_version_conflict")) return "La cuenta, el pedido o una línea cambió en otro terminal. Recarga antes de continuar.";\n' +
  '    if (msg.includes("cuenta_recuperar_no_autorizada")) return "Tu perfil no tiene permiso para recuperar esta cuenta.";\n' +
  '    if (msg.includes("cuenta_no_encontrada")) return "La cuenta guardada ya no existe en el servidor.";\n' +
  '    if (msg.includes("cuenta_recuperacion_otro_dia")) return "La cuenta pertenece a otro día operativo y requiere resolución antes de continuar.";\n' +
  '    if (msg.includes("cuenta_recuperacion_pedidos_ambigua")) return "La cuenta tiene más de un pedido operativo y no se reanudará automáticamente.";\n' +
  '    if (msg.includes("cuenta_recuperacion_sin_lineas")) return "La cuenta recuperada no contiene líneas operativas.";\n' +
  '    if (msg.includes("cuenta_recuperacion_id_distinto") || msg.includes("cuenta_recuperacion_respuesta_invalida")) return "La respuesta de recuperación no coincide con la cuenta guardada; se ha bloqueado la reanudación.";\n',
  "A06.1 recovery errors"
);

// Prop y cableado TPV.
source = replaceOnce(
  source,
  "function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {",
  "function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta, movimientos = [], registrarAuditoria, local = null, configEmpresa }) {",
  "A06.1 VentaRapida prop"
);

source = replaceOnce(
  source,
  "venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, anularVenta",
  "venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta",
  "A06.1 VentaRapida wiring"
);

// En cada carga/local: pintar primero el snapshot local y, si hay red,
// reconciliarlo con el agregado persistido en servidor usando el mismo cuenta_id.
const oldEffect = `  (0, import_react4.useEffect)(() => {
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

const newEffect = `  (0, import_react4.useEffect)(() => {
    let activo = true;
    const localPersistido = typeof leerPedidoOperativoA05 === "function" ? leerPedidoOperativoA05() : null;
    Promise.resolve(localPersistido).then((pedido) => {
      if (activo) setPedidoOperativoA05(pedido || null);
    });
    if (typeof recuperarCuentaA06 === "function") {
      Promise.resolve(recuperarCuentaA06()).then((resultado) => {
        if (!activo || !resultado) return;
        if (resultado.ok && resultado.pedidoId) {
          setPedidoOperativoA05(resultado);
          setErrorA05("");
        } else if (resultado.error) {
          setErrorA05(resultado.error);
        }
      }).catch(() => {
      });
    }
    return () => {
      activo = false;
    };
  }, [local?.id, configEmpresa?.id, leerPedidoOperativoA05, recuperarCuentaA06]);
`;

source = replaceOnce(source, oldEffect, newEffect, "A06.1 reload recovery effect");

fs.writeFileSync(sourcePath, source);
console.log("A06_1_PATCH=PASS");
