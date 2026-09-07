from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

def reemplazar_tramo(texto, inicio, fin, nuevo, desde=0):
    i = texto.find(inicio, desde)
    if i < 0:
        raise SystemExit(f'No se encontró inicio: {inicio}')
    j = texto.find(fin, i)
    if j < 0:
        raise SystemExit(f'No se encontró fin: {fin}')
    return texto[:i] + nuevo + texto[j:]

# 1) Validador reutilizable antes de cualquier mutación.
if 'function validarPedidoPM10(' not in s:
    anchor = 'function crearLogicaPedidos('
    i = s.find(anchor)
    if i < 0:
        raise SystemExit('No se encontró crearLogicaPedidos')
    helper = r'''function fechaValidaPedidoPM10(valor) {
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
'''
    s = s[:i] + helper + s[i:]

# 2) La lógica resuelve proveedor y producto/contexto.
old_sig = 'function crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId }) {'
new_sig = 'function crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId }) {'
if old_sig in s:
    s = s.replace(old_sig, new_sig, 1)
elif new_sig not in s:
    raise SystemExit('No se encontró firma crearLogicaPedidos')

s = s.replace('    if (!localActivoId) return true;\n    return pedido.localId === localActivoId;', '    if (!localActivoId) return false;\n    return pedido.localId === localActivoId;', 1)

log_ini = s.find(new_sig)
crear_nuevo = r'''  function crearPedido(data) {
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
'''
if '  function crearPedido(data) {' not in s[log_ini:log_ini+5000]:
    s = reemplazar_tramo(s, '  function crearPedido(', '  function actualizarPedido(', crear_nuevo, log_ini)

actualizar_nuevo = r'''  function actualizarPedido(pedidoId, data) {
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
'''
if '  function actualizarPedido(pedidoId, data) {' not in s[log_ini:log_ini+7000]:
    s = reemplazar_tramo(s, '  function actualizarPedido(', '  function eliminarPedido(', actualizar_nuevo, log_ini)

old_call = 'crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId });'
new_call = 'crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId });'
if old_call in s:
    s = s.replace(old_call, new_call, 1)
elif new_call not in s:
    raise SystemExit('No se encontró invocación crearLogicaPedidos')

# 3) Editar conserva cantidadRecibida en la ruta UI.
old_open = 'setItems(pedido.items.map((it2) => ({ productoId: it2.productoId, cantidad: it2.cantidad, costoUnitario: it2.costoUnitario })));'
new_open = 'setItems(pedido.items.map((it2) => ({ productoId: it2.productoId, cantidad: it2.cantidad, costoUnitario: it2.costoUnitario, cantidadRecibida: it2.cantidadRecibida ?? 0 })));'
if old_open in s:
    s = s.replace(old_open, new_open, 1)
elif new_open not in s:
    raise SystemExit('No se encontró openEdit de Pedidos')

# 4) UI: no degrada números; si dominio rechaza, muestra error y no cierra.
ped_ini = s.find('function Pedidos({')
if ped_ini < 0:
    raise SystemExit('No se encontró componente Pedidos')
submit_nuevo = r'''  function submit() {
    if (!proveedorId) {
      setError("Selecciona un proveedor.");
      return;
    }
    if (items.length === 0) {
      setError("Añade al menos un producto al pedido.");
      return;
    }
    const payload = { proveedorId, fechaEsperada, items };
    if (editingId) {
      const resultado = actualizarPedido(editingId, payload);
      if (!resultado || resultado.ok === false) {
        setError(resultado?.error || "No se pudo actualizar el pedido.");
        return;
      }
      setError("");
      setShowForm(false);
      resetForm();
    } else {
      const pedido = crearPedido(payload);
      if (!pedido || pedido.ok === false) {
        setError(pedido?.error || "No se pudo crear el pedido.");
        return;
      }
      setError("");
      setShowForm(false);
      resetForm();
      setEnviarPedido(pedido);
    }
  }
'''
if '    const payload = { proveedorId, fechaEsperada, items };' not in s[ped_ini:ped_ini+20000]:
    s = reemplazar_tramo(s, '  function submit() {', '  function textoPedido(', submit_nuevo, ped_ini)

p.write_text(s, encoding='utf-8')
print('PM10 P05 LA-012 Pedidos: patch aplicado/idempotente')
