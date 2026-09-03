function Traspasos({ productos, productosEmpresa = [], locales = [], localActivoId, traspasos, traspasarStock, traspasarEntreLocales, pisoVentaBajo, fichasCosto = [] }) {
  const h = import_react4.default.createElement;
  const selectStyle = { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink };
  function selectNode(props, options) {
    return h("select", { ...props, className: "w-full rounded-lg px-3 py-2 text-[13px]", style: selectStyle }, options);
  }

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

  const productoOptions = vendibles.map((p2) => h("option", { key: p2.id, value: p2.id }, p2.nombre));
  const direccionOptions = [
    h("option", { key: "a_piso", value: "a_piso" }, "Almacén → Piso de venta"),
    h("option", { key: "a_almacen", value: "a_almacen" }, "Piso de venta → Almacén")
  ];
  const destinoOptions = destinos.map((l2) => h("option", { key: l2.id, value: l2.id }, l2.nombre));
  const origenOptions = productos
    .filter((p2) => p2.activo !== false && !p2.fusionadoEnId && !p2.fusionadoEn)
    .map((p2) => h("option", { key: p2.id, value: p2.id }, `${p2.nombre} · ${fmt(Math.max(0, (Number(p2.stock) || 0) - (Number(p2.stockPisoVenta) || 0)))} ${p2.unidad || ""} almacén`));
  const receptorOptions = productosDestino.map((p2) => h("option", { key: p2.id, value: p2.id }, `${p2.nombre} · ${p2.unidad || ""}`));

  let internoBody;
  if (vendibles.length === 0) {
    internoBody = h(Empty, { text: "No hay productos disponibles para traspasar." });
  } else {
    internoBody = h(import_react4.default.Fragment, null,
      h(Field, { label: "Producto" }, selectNode({
        value: productoId,
        onChange: (e) => { setProductoId(e.target.value); setError(""); setOk(""); }
      }, productoOptions)),
      h("button", { type: "button", onClick: () => setVerTodos((x3) => !x3), className: "text-[11.5px] font-medium mb-3", style: { color: C2.accent } }, verTodos ? "Mostrar solo productos de venta" : "Mostrar todos los productos"),
      producto && h("div", { className: "grid grid-cols-2 gap-2 mb-3 text-[12px]" },
        h("div", { className: "p-2 rounded-lg", style: { background: C2.surfaceSoft } }, h("div", { style: { color: C2.inkSoft } }, "En almacén"), h("b", { className: "mono" }, fmt(enAlmacen), " ", producto.unidad)),
        h("div", { className: "p-2 rounded-lg", style: { background: C2.surfaceSoft } }, h("div", { style: { color: C2.inkSoft } }, "En piso"), h("b", { className: "mono" }, fmt(enPiso), " ", producto.unidad))
      ),
      h(Field, { label: "Dirección" }, selectNode({ value: direccion, onChange: (e) => setDireccion(e.target.value) }, direccionOptions)),
      h(Field, { label: `Cantidad${producto?.unidad ? ` (${producto.unidad})` : ""}` }, h(Input, { type: "number", min: "0", step: "any", value: cantidad, onChange: (e) => setCantidad(e.target.value), placeholder: "0" })),
      error && h("div", { className: "text-[12px] mb-2", style: { color: C2.red } }, error),
      ok && h("div", { className: "text-[12px] mb-2", style: { color: C2.green } }, ok),
      h(Btn, { onClick: submit }, "Confirmar movimiento")
    );
  }

  let interBody;
  if (destinos.length === 0) {
    interBody = h(Empty, { text: "Esta empresa no tiene otro local activo disponible." });
  } else if (productos.length === 0) {
    interBody = h(Empty, { text: "No hay productos en el local de origen." });
  } else {
    const receptorNode = productosDestino.length
      ? selectNode({ value: productoDestinoInterId, onChange: (e) => setProductoDestinoInterId(e.target.value) }, receptorOptions)
      : h("div", { className: "text-[12px] p-2 rounded-lg", style: { background: C2.amberSoft, color: C2.ink } }, "El destino no tiene un producto activo con la misma unidad. Créalo primero en Productos para evitar asignaciones equivocadas.");
    interBody = h(import_react4.default.Fragment, null,
      h(Field, { label: "Local origen" }, h("div", { className: "rounded-lg px-3 py-2 text-[13px]", style: { background: C2.surfaceSoft } }, localOrigen?.nombre || "Local activo")),
      h(Field, { label: "Local destino" }, selectNode({
        value: destinoLocalId,
        onChange: (e) => { setDestinoLocalId(e.target.value); setProductoDestinoInterId(""); setErrorInter(""); setOkInter(""); }
      }, destinoOptions)),
      h(Field, { label: "Producto que sale" }, selectNode({
        value: productoOrigenInterId,
        onChange: (e) => { setProductoOrigenInterId(e.target.value); setProductoDestinoInterId(""); setErrorInter(""); }
      }, origenOptions)),
      h(Field, { label: "Producto que recibe" }, receptorNode),
      productoOrigenInter && h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Disponible en almacén de origen: ", h("b", { className: "mono" }, fmt(disponibleInter), " ", productoOrigenInter.unidad || ""), Number(productoOrigenInter.deficitPendiente) > 0 ? " · Déficit pendiente: bloqueado" : ""),
      h(Field, { label: `Cantidad${productoOrigenInter?.unidad ? ` (${productoOrigenInter.unidad})` : ""}` }, h(Input, { type: "number", min: "0", step: "any", value: cantidadInter, onChange: (e) => setCantidadInter(e.target.value), placeholder: "0" })),
      errorInter && h("div", { className: "text-[12px] mb-2", style: { color: C2.red } }, errorInter),
      okInter && h("div", { className: "text-[12px] mb-2", style: { color: C2.green } }, okInter),
      h(Btn, { onClick: submitEntreLocales, disabled: !productoDestinoInterId }, "Confirmar traspaso entre locales")
    );
  }

  const historial = (traspasos || []).slice(0, 60);
  let historialBody;
  if (historial.length === 0) {
    historialBody = h(Empty, { text: "Todavía no hay traspasos en este local." });
  } else {
    historialBody = h("div", { className: "space-y-2" }, historial.map((t2) => {
      const entre = t2.tipo === "ENTRE_LOCALES";
      const sale = entre && t2.origenLocalId === localActivoId;
      const titulo = entre ? `${t2.origenLocalNombre || "Origen"} → ${t2.destinoLocalNombre || "Destino"}` : t2.direccion === "a_piso" ? "Almacén → Piso de venta" : "Piso de venta → Almacén";
      const detalle = entre ? `${sale ? "Salida" : "Entrada"} · ${t2.productoOrigenNombre || "Producto"} → ${t2.productoDestinoNombre || "Producto"}` : t2.nombre;
      const unidad = t2.unidad || (productos.find((p2) => p2.id === t2.productoId)?.unidad || "");
      return h("div", { key: t2.id, className: "p-3 rounded-xl", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
        h("div", { className: "flex items-start justify-between gap-3" },
          h("div", null,
            h("div", { className: "text-[12.5px] font-medium" }, titulo),
            h("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, detalle)
          ),
          h("div", { className: "mono text-[12.5px] font-semibold whitespace-nowrap" }, fmt(t2.cantidad), " ", unidad)
        ),
        h("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, t2.fecha, " ", t2.hora)
      );
    }));
  }

  return h("div", null,
    h(SectionTitle, null, "Traspasos"),
    h(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } },
      h("div", { className: "text-[12.5px]" }, "Gestiona dos movimientos distintos: almacén ↔ piso de venta dentro del local, o stock físico entre dos locales de la misma empresa. Los traspasos entre locales salen del almacén trasero y entran al almacén trasero del destino.")
    ),
    pisoVentaBajo.length > 0 && h(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } },
      h("div", { className: "text-[12.5px] font-semibold mb-2" }, "Bajo mínimo en el piso de venta"),
      h("div", { className: "space-y-1" }, pisoVentaBajo.map((p2) => h("div", { key: p2.id, className: "flex items-center justify-between text-[12px]" }, h("span", null, p2.nombre), h("span", { className: "mono" }, fmt(p2.stockPisoVenta || 0), " / mín. ", fmt(p2.stockMinimoPisoVenta)))))
    ),
    h("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4" },
      h(Card, null,
        h("div", { className: "font-semibold text-[14px] mb-1" }, "Dentro de este local"),
        h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Mueve unidades entre almacén y piso de venta sin cambiar el stock total."),
        internoBody
      ),
      h(Card, null,
        h("div", { className: "font-semibold text-[14px] mb-1" }, "Entre locales"),
        h("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "El origen es el local activo. Elige el local y el producto exacto que recibirá la mercancía."),
        interBody
      )
    ),
    h(Card, null,
      h("div", { className: "font-semibold text-[14px] mb-3" }, "Historial de traspasos"),
      historialBody
    )
  );
}
