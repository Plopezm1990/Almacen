from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# 1) Validador y lógica de dominio de Pedidos.
if 'function validarPedidoPM10(' not in s:
    ini = s.find('function crearLogicaPedidos(')
    fin = s.find('function crearLogicaFichasCosto(', ini)
    if ini < 0 or fin < 0:
        raise SystemExit('No se encontró bloque crearLogicaPedidos')

    bloque = r'''function fechaValidaPedidoPM10(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [y, m, d] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}
function validarPedidoPM10(data, { pedidoActual = null, proveedores = [], productos = [], localActivoId = null } = {}) {
  const entrada = data && typeof data === "object" ? data : {};
  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para guardar el pedido.");
  if (pedidoActual && pedidoActual.localId !== localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "El pedido no pertenece al local activo.");

  const proveedorId = String(entrada.proveedorId ?? "").trim();
  if (!proveedorId) return errorValidacionPM10("campo_obligatorio", "proveedorId", "Selecciona un proveedor.");
  const proveedor = (proveedores || []).find((p22) => p22 && p22.id === proveedorId);
  if (!proveedor) return errorValidacionPM10("referencia_inexistente", "proveedorId", "El proveedor no existe en el contexto autorizado.");

  const fechaEsperada = String(entrada.fechaEsperada ?? "").trim();
  if (fechaEsperada && !fechaValidaPedidoPM10(fechaEsperada)) return errorValidacionPM10("fecha_invalida", "fechaEsperada", "La fecha esperada no es válida.");

  if (!Array.isArray(entrada.items) || entrada.items.length === 0) return errorValidacionPM10("campo_obligatorio", "items", "Añade al menos un producto al pedido.");

  const anterioresPorProducto = new Map();
  for (const anterior of pedidoActual?.items || []) {
    const clave = String(anterior?.productoId ?? "");
    if (!anterioresPorProducto.has(clave)) anterioresPorProducto.set(clave, []);
    anterioresPorProducto.get(clave).push(anterior);
  }
  const usados = new Set();
  const items = [];

  for (let i33 = 0; i33 < entrada.items.length; i33 += 1) {
    const item = entrada.items[i33] && typeof entrada.items[i33] === "object" ? entrada.items[i33] : {};
    const prefijo = `items.${i33}`;
    const productoId = String(item.productoId ?? "").trim();
    if (!productoId) return errorValidacionPM10("campo_obligatorio", `${prefijo}.productoId`, "Cada línea debe tener un producto.");
    const producto = (productos || []).find((p22) => p22 && p22.id === productoId);
    if (!producto) return errorValidacionPM10("referencia_inexistente", `${prefijo}.productoId`, "El producto no existe.");
    if (producto.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", `${prefijo}.productoId`, "El producto no pertenece al local activo.");

    const cantidadR = numeroPM10(item.cantidad, `${prefijo}.cantidad`, { minimo: 0, estrictoMinimo: true });
    if (!cantidadR.ok) return cantidadR;
    const costoR = numeroPM10(item.costoUnitario, `${prefijo}.costoUnitario`, { minimo: 0 });
    if (!costoR.ok) return costoR;

    const cola = anterioresPorProducto.get(productoId) || [];
    const anterior = cola.find((x3) => !usados.has(x3)) || null;
    if (anterior) usados.add(anterior);
    let cantidadRecibida = 0;
    if (anterior) {
      const recibidaAnterior = Number(anterior.cantidadRecibida ?? 0);
      if (!Number.isFinite(recibidaAnterior) || recibidaAnterior < 0) return errorValidacionPM10("conflicto_estado_previo", `${prefijo}.cantidadRecibida`, "La recepción acumulada anterior no es válida.");
      cantidadRecibida = recibidaAnterior;
      if (Object.prototype.hasOwnProperty.call(item, "cantidadRecibida") && item.cantidadRecibida !== null && item.cantidadRecibida !== void 0 && String(item.cantidadRecibida).trim() !== "") {
        const recibidaPayload = Number(item.cantidadRecibida);
        if (!Number.isFinite(recibidaPayload) || recibidaPayload !== recibidaAnterior) return errorValidacionPM10("conflicto_estado_previo", `${prefijo}.cantidadRecibida`, "La edición no puede modificar manualmente la cantidad ya recibida.");
      }
      if (cantidadR.valor < cantidadRecibida) return errorValidacionPM10("exceso_sobre_cantidad_pendiente", `${prefijo}.cantidad`, "La cantidad pedida no puede quedar por debajo de lo ya recibido.");
    } else if (Object.prototype.hasOwnProperty.call(item, "cantidadRecibida") && item.cantidadRecibida !== null && item.cantidadRecibida !== void 0 && String(item.cantidadRecibida).trim() !== "") {
      const recibidaNueva = Number(item.cantidadRecibida);
      if (!Number.isFinite(recibidaNueva) || recibidaNueva !== 0) return errorValidacionPM10("conflicto_estado_previo", `${prefijo}.cantidadRecibida`, "Una línea nueva debe empezar con cantidad recibida igual a cero.");
    }

    items.push({ ...item, productoId, cantidad: cantidadR.valor, costoUnitario: costoR.valor, cantidadRecibida });
  }

  if (pedidoActual) {
    for (const anterior of pedidoActual.items || []) {
      if (usados.has(anterior)) continue;
      const recibidaAnterior = Number(anterior.cantidadRecibida ?? 0);
      if (Number.isFinite(recibidaAnterior) && recibidaAnterior > 0) return errorValidacionPM10("conflicto_estado_previo", "items", "No puedes eliminar una línea que ya tiene unidades recibidas.");
    }
  }

  return { ok: true, datos: { ...entrada, proveedorId, fechaEsperada, items } };
}
function crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId }) {
  function pedidoEsDelLocalActivo(pedido) {
    if (!pedido) return false;
    if (!localActivoId) return false;
    return pedido.localId === localActivoId;
  }
  function crearPedido(data) {
    const validacion = validarPedidoPM10(data, { proveedores, productos, localActivoId });
    if (!validacion.ok) return validacion;
    const { proveedorId, fechaEsperada, items } = validacion.datos;
    const pedido = {
      id: uid(),
      localId: localActivoId,
      proveedorId,
      fecha: todayISO(),
      fechaEsperada,
      estado: "Pendiente",
      items
    };
    setPedidos((s22) => [pedido, ...s22]);
    return pedido;
  }
  function actualizarPedido(pedidoId, data) {
    const actual = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(actual)) return errorValidacionPM10("contexto_no_autorizado", "localId", "Pedido fuera del local activo.");
    const validacion = validarPedidoPM10(data, { pedidoActual: actual, proveedores, productos, localActivoId });
    if (!validacion.ok) return validacion;
    const { proveedorId, fechaEsperada, items } = validacion.datos;
    setPedidos(
      (s22) => s22.map(
        (pe2) => pe2.id === pedidoId ? { ...pe2, proveedorId, fechaEsperada, items } : pe2
      )
    );
    return true;
  }
  function eliminarPedido(pedidoId) {
    const actual = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(actual)) return false;
    setPedidos((s22) => s22.filter((pe2) => pe2.id !== pedidoId));
    return true;
  }
  function cerrarPedido(pedidoId) {
    const actual = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(actual)) return false;
    setPedidos((s22) => s22.map((pe2) => pe2.id === pedidoId ? { ...pe2, estado: "Recibido", cerradoManualmente: true } : pe2));
    return true;
  }
  function recibirPedido(pedidoId, lineas) {
    if (almacenCongelado) return false;
    const pedido = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(pedido)) return false;
    const lineasConDatos = lineas.filter((ln2) => Number(ln2.cantidad) > 0).map((ln2) => {
      const prod = productos.find((p22) => p22.id === ln2.productoId);
      if (!prod || localActivoId && (!prod.localId || prod.localId !== localActivoId)) return null;
      return {
        productoId: ln2.productoId,
        cantidad: Number(ln2.cantidad),
        precioBruto: Number(ln2.precioBruto) || 0,
        importe: (Number(ln2.precioBruto) || 0) * Number(ln2.cantidad),
        ivaPct: Number(ln2.ivaPct) || (prod ? prod.ivaCompra : 10) || 10,
        udsPorCaja: Number(ln2.udsPorCaja) || (prod ? prod.udsPorCaja : 1) || 1,
        descripcion: prod ? prod.nombre : "",
        unidad: prod ? prod.unidad : "unidad"
      };
    }).filter(Boolean);
    if (!lineasConDatos.length) return false;
    const { lineasResueltas, avisos } = procesarRecepcion({
      lineas: lineasConDatos,
      proveedorId: pedido.proveedorId,
      fecha: todayISO(),
      documentoTipo: "pedido",
      documentoId: pedido.id,
      documentoNumero: pedido.id.slice(-6)
    });
    setPedidos(
      (s22) => s22.map((pe2) => {
        if (pe2.id !== pedidoId) return pe2;
        const items = pe2.items.map((it2) => {
          const suyas = lineasResueltas.filter((ln2) => ln2.productoId === it2.productoId);
          if (!suyas.length) return it2;
          const recibidas = suyas.reduce((a22, ln2) => a22 + (Number(ln2.unidadesEntradas) || 0), 0);
          return { ...it2, cantidadRecibida: (Number(it2.cantidadRecibida) || 0) + recibidas };
        });
        const completo = items.every((it2) => (Number(it2.cantidadRecibida) || 0) >= (Number(it2.cantidad) || 0));
        const algo = items.some((it2) => (Number(it2.cantidadRecibida) || 0) > 0);
        return { ...pe2, items, estado: completo ? "Recibido" : algo ? "Parcial" : "Pendiente" };
      })
    );
    return { ok: true, avisos };
  }
  return { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido };
}
'''
    s = s[:ini] + bloque + s[fin:]

# 2) La lógica debe poder resolver proveedor además de productos.
old_call = 'crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId });'
new_call = 'crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId });'
if old_call in s:
    s = s.replace(old_call, new_call, 1)
elif new_call not in s:
    raise SystemExit('No se encontró invocación crearLogicaPedidos')

# 3) Editar debe conservar la recepción acumulada en el formulario.
old_open = 'setItems(pedido.items.map((it2) => ({ productoId: it2.productoId, cantidad: it2.cantidad, costoUnitario: it2.costoUnitario })));'
new_open = 'setItems(pedido.items.map((it2) => ({ productoId: it2.productoId, cantidad: it2.cantidad, costoUnitario: it2.costoUnitario, cantidadRecibida: it2.cantidadRecibida ?? 0 })));'
if old_open in s:
    s = s.replace(old_open, new_open, 1)
elif new_open not in s:
    raise SystemExit('No se encontró openEdit de Pedidos')

# 4) La UI no degrada números ni cierra el formulario si dominio rechaza.
old_submit = '''  function submit() {\n    if (!proveedorId) {\n      setError("Selecciona un proveedor.");\n      return;\n    }\n    if (items.length === 0) {\n      setError("Añade al menos un producto al pedido.");\n      return;\n    }\n    setError("");\n    const itemsLimpios = items.map((it2) => ({ productoId: it2.productoId, cantidad: Number(it2.cantidad), costoUnitario: Number(it2.costoUnitario) }));\n    if (editingId) {\n      actualizarPedido(editingId, { proveedorId, fechaEsperada, items: itemsLimpios });\n      setShowForm(false);\n      resetForm();\n    } else {\n      const pedido = crearPedido({ proveedorId, fechaEsperada, items: itemsLimpios });\n      setShowForm(false);\n      resetForm();\n      setEnviarPedido(pedido);\n    }\n  }'''
new_submit = '''  function submit() {\n    if (!proveedorId) {\n      setError("Selecciona un proveedor.");\n      return;\n    }\n    if (items.length === 0) {\n      setError("Añade al menos un producto al pedido.");\n      return;\n    }\n    const payload = { proveedorId, fechaEsperada, items };\n    if (editingId) {\n      const resultado = actualizarPedido(editingId, payload);\n      if (!resultado || resultado.ok === false) {\n        setError(resultado?.error || "No se pudo actualizar el pedido.");\n        return;\n      }\n      setError("");\n      setShowForm(false);\n      resetForm();\n    } else {\n      const pedido = crearPedido(payload);\n      if (!pedido || pedido.ok === false) {\n        setError(pedido?.error || "No se pudo crear el pedido.");\n        return;\n      }\n      setError("");\n      setShowForm(false);\n      resetForm();\n      setEnviarPedido(pedido);\n    }\n  }'''
if old_submit in s:
    s = s.replace(old_submit, new_submit, 1)
elif new_submit not in s:
    raise SystemExit('No se encontró submit de Pedidos')

p.write_text(s, encoding='utf-8')
print('PM10 P05 LA-012 Pedidos: patch aplicado/idempotente')
