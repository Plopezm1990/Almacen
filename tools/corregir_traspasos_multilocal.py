from pathlib import Path

path = Path("fuente.js")
s = path.read_text(encoding="utf-8")
original = s


def function_span(text, name):
    marker = f"function {name}("
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f"No se encontró {marker}")
    p = text.find("(", start)
    depth = 0
    quote = None
    esc = False
    i = p
    while i < len(text):
        c = text[i]
        if quote:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in ('"', "'", '`'):
                quote = c
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    break
        i += 1
    brace = text.find("{", i)
    if brace < 0:
        raise SystemExit(f"No se encontró cuerpo de {name}")
    depth = 0
    quote = None
    esc = False
    j = brace
    while j < len(text):
        c = text[j]
        if quote:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in ('"', "'", '`'):
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return start, j + 1
        j += 1
    raise SystemExit(f"No se pudo cerrar {name}")


def replace_function(text, name, replacement):
    a, b = function_span(text, name)
    return text[:a] + replacement.strip() + text[b:]


new_logic = r'''
function crearLogicaTraspasos({ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria, localActivoId, locales = [] }) {
  function productoEsDelLocalActivoTraspaso(prod) {
    if (!prod) return false;
    if (!localActivoId) return false;
    return prod.localId === localActivoId;
  }
  const { aplicarMovimientoStock } = crearMotorStock({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria });
  function traspasarStock(productoId, cantidad, direccion) {
    const cant = Number(cantidad) || 0;
    if (cant <= 0) return { ok: false, error: "Indica una cantidad mayor que cero." };
    const prod = productos.find((p2) => p2.id === productoId);
    if (!prod) return { ok: false, error: "Producto no encontrado." };
    if (!productoEsDelLocalActivoTraspaso(prod)) return { ok: false, error: "Ese producto no pertenece al local activo." };
    const enPiso = Number(prod.stockPisoVenta) || 0;
    const total = Number(prod.stock) || 0;
    const enAlmacen = Math.max(0, total - enPiso);
    if (direccion === "a_piso" && cant > enAlmacen) {
      return { ok: false, error: `Solo hay ${fmt(enAlmacen)} ${prod.unidad} en el almacén.` };
    }
    if (direccion === "a_almacen" && cant > enPiso) {
      return { ok: false, error: `Solo hay ${fmt(enPiso)} ${prod.unidad} en el piso de venta.` };
    }
    const cantidadConSigno2 = direccion === "a_piso" ? cant : -cant;
    const movimientoId = uid();
    const r = aplicarMovimientoStock({
      productoId,
      cantidad: cantidadConSigno2,
      tipo: direccion === "a_piso" ? "TRASPASO_A_PISO" : "TRASPASO_A_ALMACEN",
      movimientoId,
      origen: "traspasarStock",
      afectaStockTotal: false,
      afectaStockPisoVenta: true,
      permitirDeficit: false
    });
    if (!r.ok) return r;
    setTraspasos((s2) => [
      { id: uid(), localId: localActivoId || prod.localId || null, productoId, nombre: prod.nombre, cantidad: cant, direccion, fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), movimientoId },
      ...s2
    ]);
    return { ok: true };
  }
  function traspasarEntreLocales(productoOrigenId, productoDestinoId, destinoLocalId, cantidad) {
    const cant = Number(cantidad) || 0;
    if (!localActivoId) return { ok: false, error: "Selecciona un local de origen concreto." };
    if (cant <= 0) return { ok: false, error: "Indica una cantidad mayor que cero." };
    if (!destinoLocalId || destinoLocalId === localActivoId) return { ok: false, error: "Elige un local de destino distinto del origen." };
    const localOrigen = locales.find((l2) => l2.id === localActivoId && l2.activo !== false && !l2.fusionadoEn);
    const localDestino = locales.find((l2) => l2.id === destinoLocalId && l2.activo !== false && !l2.fusionadoEn);
    if (!localOrigen || !localDestino) return { ok: false, error: "El local de origen o destino ya no está activo." };
    if (!localOrigen.empresaId || !localDestino.empresaId || localOrigen.empresaId !== localDestino.empresaId) {
      return { ok: false, error: "Solo se puede traspasar stock entre locales de la misma empresa." };
    }
    const origen = productos.find((p2) => p2.id === productoOrigenId);
    const destino = productos.find((p2) => p2.id === productoDestinoId);
    if (!origen || origen.localId !== localActivoId || origen.activo === false || origen.fusionadoEnId || origen.fusionadoEn) {
      return { ok: false, error: "El producto de origen no pertenece al local activo." };
    }
    if (!destino || destino.localId !== destinoLocalId || destino.activo === false || destino.fusionadoEnId || destino.fusionadoEn) {
      return { ok: false, error: "El producto de destino no pertenece al local elegido." };
    }
    const unidadOrigen = String(origen.unidad || "").trim().toLowerCase();
    const unidadDestino = String(destino.unidad || "").trim().toLowerCase();
    if (!unidadOrigen || unidadOrigen !== unidadDestino) {
      return { ok: false, error: "Origen y destino deben usar la misma unidad de medida." };
    }
    const deficitOrigen = Number(origen.deficitPendiente) || 0;
    const deficitDestino = Number(destino.deficitPendiente) || 0;
    if (deficitOrigen > 0 || deficitDestino > 0) {
      return { ok: false, error: "Hay un déficit de stock pendiente. Reconcílialo antes de hacer el traspaso." };
    }
    const totalOrigen = Number(origen.stock) || 0;
    const pisoOrigen = Number(origen.stockPisoVenta) || 0;
    const disponibleAlmacen = Math.max(0, totalOrigen - pisoOrigen);
    if (cant > disponibleAlmacen) {
      return { ok: false, error: `Solo hay ${fmt(disponibleAlmacen)} ${origen.unidad} disponibles en el almacén de ${localOrigen.nombre}.` };
    }
    const traspasoId = uid();
    const salidaId = uid();
    const entradaId = uid();
    const salida = aplicarMovimientoStock({
      productoId: origen.id,
      cantidad: -cant,
      tipo: "TRASPASO_ENTRE_LOCALES_SALIDA",
      movimientoId: salidaId,
      origen: "traspasarEntreLocales",
      documentoOrigenId: traspasoId,
      afectaStockTotal: true,
      afectaStockPisoVenta: false,
      permitirDeficit: false
    });
    if (!salida.ok) return salida;
    const entrada = aplicarMovimientoStock({
      productoId: destino.id,
      cantidad: cant,
      tipo: "TRASPASO_ENTRE_LOCALES_ENTRADA",
      movimientoId: entradaId,
      origen: "traspasarEntreLocales",
      documentoOrigenId: traspasoId,
      afectaStockTotal: true,
      afectaStockPisoVenta: false,
      permitirDeficit: false
    });
    if (!entrada.ok) {
      return { ok: false, error: "No se pudo completar la entrada en destino. Revisa el diagnóstico de stock antes de repetir el traspaso." };
    }
    const registro = {
      id: traspasoId,
      tipo: "ENTRE_LOCALES",
      origenLocalId: localActivoId,
      destinoLocalId,
      origenLocalNombre: localOrigen.nombre,
      destinoLocalNombre: localDestino.nombre,
      productoOrigenId: origen.id,
      productoDestinoId: destino.id,
      productoOrigenNombre: origen.nombre,
      productoDestinoNombre: destino.nombre,
      unidad: origen.unidad,
      cantidad: cant,
      fecha: todayISO(),
      hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5),
      movimientoSalidaId: salidaId,
      movimientoEntradaId: entradaId,
      estado: "Completado"
    };
    setTraspasos((s2) => [registro, ...s2]);
    if (registrarAuditoria) registrarAuditoria("Traspaso entre locales", `${fmt(cant)} ${origen.unidad} · ${localOrigen.nombre} → ${localDestino.nombre} · ${origen.nombre} → ${destino.nombre}`);
    return { ok: true, traspaso: registro };
  }
  return { traspasarStock, traspasarEntreLocales };
}
'''

new_component = r'''
function Traspasos({ productos, productosEmpresa = [], locales = [], localActivoId, traspasos, traspasarStock, traspasarEntreLocales, pisoVentaBajo, fichasCosto = [] }) {
  const h = import_react4.default.createElement;
  const [verTodos, setVerTodos] = (0, import_react4.useState)(false);
  const vendibles = (0, import_react4.useMemo)(() => {
    if (verTodos) return productos;
    const idsDeFichas = new Set(fichasCosto.map((f2) => f2.productoVinculadoId).filter(Boolean));
    return productos.filter((p2) => p2.tipo === "elaborado" || Number(p2.precioVenta) > 0 || idsDeFichas.has(p2.id) || Number(p2.stockPisoVenta) > 0);
  }, [productos, fichasCosto, verTodos]);
  const [productoId, setProductoId] = (0, import_react4.useState)(vendibles[0]?.id || "");
  const [cantidad, setCantidad] = (0, import_react4.useState)("");
  const [direccion, setDireccion] = (0, import_react4.useState)("a_piso");
  const [error, setError] = (0, import_react4.useState)("");
  const [ok, setOk] = (0, import_react4.useState)("");
  (0, import_react4.useEffect)(() => {
    if (vendibles.length > 0 && !vendibles.some((p2) => p2.id === productoId)) setProductoId(vendibles[0].id);
  }, [vendibles, productoId]);
  const producto = productos.find((p2) => p2.id === productoId);
  const enPiso = producto ? Number(producto.stockPisoVenta) || 0 : 0;
  const enAlmacen = producto ? Math.max(0, (Number(producto.stock) || 0) - enPiso) : 0;
  function submit() {
    const res = traspasarStock(productoId, cantidad, direccion);
    if (!res || !res.ok) {
      setError(res?.error || "No se pudo completar el traspaso.");
      setOk("");
      return;
    }
    setError("");
    setOk(`Traspasado ${fmt(Number(cantidad))} ${producto?.unidad || ""} ${direccion === "a_piso" ? "al piso de venta" : "al almacén"}.`);
    setCantidad("");
  }

  const destinos = locales.filter((l2) => l2.id !== localActivoId && l2.activo !== false && !l2.fusionadoEn);
  const [destinoLocalId, setDestinoLocalId] = (0, import_react4.useState)(destinos[0]?.id || "");
  const [productoOrigenInterId, setProductoOrigenInterId] = (0, import_react4.useState)(productos[0]?.id || "");
  const [productoDestinoInterId, setProductoDestinoInterId] = (0, import_react4.useState)("");
  const [cantidadInter, setCantidadInter] = (0, import_react4.useState)("");
  const [errorInter, setErrorInter] = (0, import_react4.useState)("");
  const [okInter, setOkInter] = (0, import_react4.useState)("");
  (0, import_react4.useEffect)(() => {
    if (destinos.length && !destinos.some((l2) => l2.id === destinoLocalId)) setDestinoLocalId(destinos[0].id);
    if (!destinos.length && destinoLocalId) setDestinoLocalId("");
  }, [localActivoId, locales, destinoLocalId]);
  (0, import_react4.useEffect)(() => {
    if (productos.length && !productos.some((p2) => p2.id === productoOrigenInterId)) setProductoOrigenInterId(productos[0].id);
  }, [productos, productoOrigenInterId]);
  const productoOrigenInter = productos.find((p2) => p2.id === productoOrigenInterId);
  const unidadOrigen = String(productoOrigenInter?.unidad || "").trim().toLowerCase();
  const productosDestino = productosEmpresa.filter((p2) => p2.localId === destinoLocalId && p2.activo !== false && !p2.fusionadoEnId && !p2.fusionadoEn && String(p2.unidad || "").trim().toLowerCase() === unidadOrigen);
  (0, import_react4.useEffect)(() => {
    if (productosDestino.length && !productosDestino.some((p2) => p2.id === productoDestinoInterId)) setProductoDestinoInterId(productosDestino[0].id);
    if (!productosDestino.length && productoDestinoInterId) setProductoDestinoInterId("");
  }, [destinoLocalId, productoOrigenInterId, productosEmpresa, productoDestinoInterId]);
  const localOrigen = locales.find((l2) => l2.id === localActivoId);
  const localDestino = locales.find((l2) => l2.id === destinoLocalId);
  const disponibleInter = productoOrigenInter ? Math.max(0, (Number(productoOrigenInter.stock) || 0) - (Number(productoOrigenInter.stockPisoVenta) || 0)) : 0;
  function submitEntreLocales() {
    const res = traspasarEntreLocales(productoOrigenInterId, productoDestinoInterId, destinoLocalId, cantidadInter);
    if (!res || !res.ok) {
      setErrorInter(res?.error || "No se pudo completar el traspaso entre locales.");
      setOkInter("");
      return;
    }
    setErrorInter("");
    setOkInter(`Traspaso completado: ${fmt(Number(cantidadInter))} ${productoOrigenInter?.unidad || ""} · ${localOrigen?.nombre || "Origen"} → ${localDestino?.nombre || "Destino"}.`);
    setCantidadInter("");
  }

  function selectBase(value, onChange) {
    return h("select", { value, onChange, className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } });
  }

  const historial = (traspasos || []).slice(0, 60);
  return h("div", null,
    h(SectionTitle, null, "Traspasos"),
    h(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } },
      h("div", { className: "text-[12.5px]" }, "Gestiona dos movimientos distintos: almacén ↔ piso de venta dentro del local, o stock físico entre dos locales de la misma empresa. Los traspasos entre locales salen del almacén trasero y entran al almacén trasero del destino.")),
    pisoVentaBajo.length > 0 && h(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } },
      h("div", { className: "text-[12.5px] font-semibold mb-2" }, "Bajo mínimo en el piso de venta"),
      h("div", { className: "space-y-1" }, pisoVentaBajo.map((p2) => h("div", { key: p2.id, className: "flex items-center justify-between text-[12px]" }, h("span", null, p2.nombre), h("span", { className: "mono" }, fmt(p2.stockPisoVenta || 0), " / mín. ", fmt(p2.stockMinimoPisoVenta))))),
    h("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4" },
      h(Card, null,
        h("div", { className: "font-semibold text-[14px] mb-1" }, "Dentro de este local"),
        h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Mueve unidades entre almacén y piso de venta sin cambiar el stock total."),
        vendibles.length === 0 ? h(Empty, { text: "No hay productos disponibles para traspasar." }) : h(import_react4.default.Fragment, null,
          h(Field, { label: "Producto" }, h("select", { value: productoId, onChange: (e) => { setProductoId(e.target.value); setError(""); setOk(""); }, className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, vendibles.map((p2) => h("option", { key: p2.id, value: p2.id }, p2.nombre)))),
          h("button", { type: "button", onClick: () => setVerTodos((x3) => !x3), className: "text-[11.5px] font-medium mb-3", style: { color: C2.accent } }, verTodos ? "Mostrar solo productos de venta" : "Mostrar todos los productos"),
          producto && h("div", { className: "grid grid-cols-2 gap-2 mb-3 text-[12px]" },
            h("div", { className: "p-2 rounded-lg", style: { background: C2.surfaceSoft } }, h("div", { style: { color: C2.inkSoft } }, "En almacén"), h("b", { className: "mono" }, fmt(enAlmacen), " ", producto.unidad)),
            h("div", { className: "p-2 rounded-lg", style: { background: C2.surfaceSoft } }, h("div", { style: { color: C2.inkSoft } }, "En piso"), h("b", { className: "mono" }, fmt(enPiso), " ", producto.unidad))),
          h(Field, { label: "Dirección" }, h("select", { value: direccion, onChange: (e) => setDireccion(e.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, h("option", { value: "a_piso" }, "Almacén → Piso de venta"), h("option", { value: "a_almacen" }, "Piso de venta → Almacén"))),
          h(Field, { label: `Cantidad${producto?.unidad ? ` (${producto.unidad})` : ""}` }, h(Input, { type: "number", min: "0", step: "any", value: cantidad, onChange: (e) => setCantidad(e.target.value), placeholder: "0" })),
          error && h("div", { className: "text-[12px] mb-2", style: { color: C2.red } }, error),
          ok && h("div", { className: "text-[12px] mb-2", style: { color: C2.green } }, ok),
          h(Btn, { onClick: submit }, "Confirmar movimiento"))),
      h(Card, null,
        h("div", { className: "font-semibold text-[14px] mb-1" }, "Entre locales"),
        h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "El origen es el local activo. Elige el local y el producto exacto que recibirá la mercancía."),
        destinos.length === 0 ? h(Empty, { text: "Esta empresa no tiene otro local activo disponible." }) : productos.length === 0 ? h(Empty, { text: "No hay productos en el local de origen." }) : h(import_react4.default.Fragment, null,
          h(Field, { label: "Local origen" }, h("div", { className: "rounded-lg px-3 py-2 text-[13px]", style: { background: C2.surfaceSoft } }, localOrigen?.nombre || "Local activo")),
          h(Field, { label: "Local destino" }, h("select", { value: destinoLocalId, onChange: (e) => { setDestinoLocalId(e.target.value); setProductoDestinoInterId(""); setErrorInter(""); setOkInter(""); }, className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, destinos.map((l2) => h("option", { key: l2.id, value: l2.id }, l2.nombre)))),
          h(Field, { label: "Producto que sale" }, h("select", { value: productoOrigenInterId, onChange: (e) => { setProductoOrigenInterId(e.target.value); setProductoDestinoInterId(""); setErrorInter(""); }, className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, productos.filter((p2) => p2.activo !== false && !p2.fusionadoEnId && !p2.fusionadoEn).map((p2) => h("option", { key: p2.id, value: p2.id }, `${p2.nombre} · ${fmt(Math.max(0, (Number(p2.stock) || 0) - (Number(p2.stockPisoVenta) || 0)))} ${p2.unidad || ""} almacén`)))),
          h(Field, { label: "Producto que recibe" }, productosDestino.length ? h("select", { value: productoDestinoInterId, onChange: (e) => setProductoDestinoInterId(e.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, productosDestino.map((p2) => h("option", { key: p2.id, value: p2.id }, `${p2.nombre} · ${p2.unidad || ""}`))) : h("div", { className: "text-[12px] p-2 rounded-lg", style: { background: C2.amberSoft, color: C2.ink } }, "El destino no tiene un producto activo con la misma unidad. Créalo primero en Productos para evitar asignaciones equivocadas.")),
          productoOrigenInter && h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Disponible en almacén de origen: ", h("b", { className: "mono" }, fmt(disponibleInter), " ", productoOrigenInter.unidad || ""), Number(productoOrigenInter.deficitPendiente) > 0 ? " · Déficit pendiente: bloqueado" : ""),
          h(Field, { label: `Cantidad${productoOrigenInter?.unidad ? ` (${productoOrigenInter.unidad})` : ""}` }, h(Input, { type: "number", min: "0", step: "any", value: cantidadInter, onChange: (e) => setCantidadInter(e.target.value), placeholder: "0" })),
          errorInter && h("div", { className: "text-[12px] mb-2", style: { color: C2.red } }, errorInter),
          okInter && h("div", { className: "text-[12px] mb-2", style: { color: C2.green } }, okInter),
          h(Btn, { onClick: submitEntreLocales, disabled: !productoDestinoInterId }, "Confirmar traspaso entre locales")))),
    h(Card, null,
      h("div", { className: "font-semibold text-[14px] mb-3" }, "Historial de traspasos"),
      historial.length === 0 ? h(Empty, { text: "Todavía no hay traspasos en este local." }) : h("div", { className: "space-y-2" }, historial.map((t2) => {
        const entre = t2.tipo === "ENTRE_LOCALES";
        const sale = entre && t2.origenLocalId === localActivoId;
        const titulo = entre ? `${t2.origenLocalNombre || "Origen"} → ${t2.destinoLocalNombre || "Destino"}` : t2.direccion === "a_piso" ? "Almacén → Piso de venta" : "Piso de venta → Almacén";
        const detalle = entre ? `${sale ? "Salida" : "Entrada"} · ${t2.productoOrigenNombre || "Producto"} → ${t2.productoDestinoNombre || "Producto"}` : t2.nombre;
        return h("div", { key: t2.id, className: "p-3 rounded-xl", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
          h("div", { className: "flex items-start justify-between gap-3" }, h("div", null, h("div", { className: "text-[12.5px] font-medium" }, titulo), h("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, detalle)), h("div", { className: "mono text-[12.5px] font-semibold whitespace-nowrap" }, fmt(t2.cantidad), " ", t2.unidad || (productos.find((p2) => p2.id === t2.productoId)?.unidad || ""))),
          h("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, t2.fecha, " ", t2.hora));
      })))
  );
}
'''

s = replace_function(s, "crearLogicaTraspasos", new_logic)
s = replace_function(s, "Traspasos", new_component)

replacements = [
    (
        'const { traspasarStock } = crearLogicaTraspasos({ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria, localActivoId });',
        'const { traspasarStock, traspasarEntreLocales } = crearLogicaTraspasos({ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria, localActivoId, locales });'
    ),
    (
        'tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, traspasos: traspasosDelLocalActivo, traspasarStock, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo })',
        'tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p2) => localesEmpresaActiva.some((l2) => l2.id === p2.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo })'
    ),
    (
        '''const traspasosDelLocalActivo = (0, import_react4.useMemo)(() => {\n    if (!localActivoId) return traspasos;\n    return traspasos.filter((t2) => {\n      if (t2.localId) return t2.localId === localActivoId;\n      const prod = productos.find((p2) => p2.id === t2.productoId);\n      return !!prod && prod.localId === localActivoId;\n    });\n  }, [traspasos, productos, localActivoId]);'''.replace('\\n','\n'),
        '''const traspasosDelLocalActivo = (0, import_react4.useMemo)(() => {\n    if (!localActivoId) return traspasos;\n    return traspasos.filter((t2) => {\n      if (t2.tipo === "ENTRE_LOCALES") return t2.origenLocalId === localActivoId || t2.destinoLocalId === localActivoId;\n      if (t2.localId) return t2.localId === localActivoId;\n      const prod = productos.find((p2) => p2.id === t2.productoId);\n      return !!prod && prod.localId === localActivoId;\n    });\n  }, [traspasos, productos, localActivoId]);'''.replace('\\n','\n')
    ),
    (
        'return traspasos.filter((t2) => t2.productoId === producto.id).sort((a2, b2) => (b2.fecha || "").localeCompare(a2.fecha || ""));',
        'return traspasos.filter((t2) => t2.tipo === "ENTRE_LOCALES" ? t2.productoOrigenId === producto.id || t2.productoDestinoId === producto.id : t2.productoId === producto.id).sort((a2, b2) => (b2.fecha || "").localeCompare(a2.fecha || ""));'
    ),
    (
        'Sin traspasos entre almac\\xE9n y piso de venta para este producto.',
        'Sin traspasos registrados para este producto.'
    ),
    (
        't2.direccion === "a_piso" ? "Almac\\xE9n \\u2192 Piso de venta" : "Piso de venta \\u2192 Almac\\xE9n"',
        't2.tipo === "ENTRE_LOCALES" ? `${t2.origenLocalNombre || "Origen"} → ${t2.destinoLocalNombre || "Destino"}` : t2.direccion === "a_piso" ? "Almac\\xE9n \\u2192 Piso de venta" : "Piso de venta \\u2192 Almac\\xE9n"'
    ),
]

for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"Reemplazo inseguro: esperado 1, encontrado {count}: {old[:100]}")
    s = s.replace(old, new, 1)

# Invariantes de la nueva implementación.
checks = [
    'function traspasarEntreLocales(',
    'tipo: "ENTRE_LOCALES"',
    'TRASPASO_ENTRE_LOCALES_SALIDA',
    'TRASPASO_ENTRE_LOCALES_ENTRADA',
    'productosEmpresa: productos.filter',
    't2.origenLocalId === localActivoId || t2.destinoLocalId === localActivoId',
    'productoOrigenId === producto.id || t2.productoDestinoId === producto.id',
]
for needle in checks:
    if needle not in s:
        raise SystemExit(f"Falta invariante: {needle}")
if 'localActivoId || p2.localId || null' in s:
    raise SystemExit('Sigue presente la referencia p2 indefinida de Traspasos')
if 'return !prod.localId || prod.localId === localActivoId;' in s[s.find('function crearLogicaTraspasos'):s.find('function crearLogicaSeguridad')]:
    raise SystemExit('Sigue presente el fallback permisivo legacy de Traspasos')

path.write_text(s, encoding="utf-8")
print("Traspasos multi-local preparados correctamente")
print("Bytes antes:", len(original), "después:", len(s))
