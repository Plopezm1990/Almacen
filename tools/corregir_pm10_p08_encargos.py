from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# PM10 P08 / LA-018: un encargo se valida como una unidad antes de cualquier mutación.
if 'function validarEncargoPM10(' not in s:
    pos = s.find('function crearLogicaEncargos({')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaEncargos')
    helper = r'''function validarEncargoPM10(data, { productos = [], clientes = [], localActivoId = null, empresaId = null, fechaCreacion = null } = {}) {
  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para guardar el encargo.");
  if (!data || typeof data !== "object" || Array.isArray(data)) return errorValidacionPM10("formato_invalido", "encargo", "El encargo no tiene un formato válido.");
  if (data.localId && data.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", "localId", "El encargo pertenece a otro local.");

  const clienteId = String(data.clienteId || "").trim();
  if (!clienteId) return errorValidacionPM10("campo_obligatorio", "clienteId", "Selecciona o crea un cliente.");
  const cliente = clientes.find((c22) => c22 && c22.id === clienteId);
  if (!cliente) return errorValidacionPM10("referencia_inexistente", "clienteId", "El cliente seleccionado ya no existe o no está disponible.");
  if (empresaId && cliente.empresaId && cliente.empresaId !== empresaId) return errorValidacionPM10("referencia_otro_contexto", "clienteId", "El cliente pertenece a otra empresa.");

  const fechaEntrega = String(data.fechaEntrega || "").trim();
  if (!fechaEntrega) return errorValidacionPM10("campo_obligatorio", "fechaEntrega", "Indica la fecha de entrega.");
  function fechaISOValida(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const [y2, m22, d2] = fecha.split("-").map(Number);
    const dt = new Date(Date.UTC(y2, m22 - 1, d2));
    return dt.getUTCFullYear() === y2 && dt.getUTCMonth() === m22 - 1 && dt.getUTCDate() === d2;
  }
  if (!fechaISOValida(fechaEntrega)) return errorValidacionPM10("fecha_invalida", "fechaEntrega", "La fecha de entrega no es válida.");
  const fechaBase = String(fechaCreacion || todayISO()).slice(0, 10);
  if (!fechaISOValida(fechaBase)) return errorValidacionPM10("fecha_invalida", "fechaCreacion", "La fecha de creación del encargo no es válida.");
  if (fechaEntrega < fechaBase) return errorValidacionPM10("valor_fuera_rango", "fechaEntrega", "La fecha de entrega no puede ser anterior a la creación del encargo.");

  if (!Array.isArray(data.lineas) || data.lineas.length === 0) return errorValidacionPM10("campo_obligatorio", "lineas", "Añade al menos una línea al encargo.");
  const lineas = [];
  let total = 0;
  for (let i33 = 0; i33 < data.lineas.length; i33++) {
    const ln2 = data.lineas[i33];
    if (!ln2 || typeof ln2 !== "object" || Array.isArray(ln2)) return errorValidacionPM10("formato_invalido", `lineas.${i33}`, "Una línea del encargo no es válida.");
    const productoId = String(ln2.productoId || "").trim();
    const descripcion = String(ln2.descripcion || "").trim();
    let prod = null;
    if (productoId) {
      prod = productos.find((p22) => p22 && p22.id === productoId);
      if (!prod) return errorValidacionPM10("referencia_inexistente", `lineas.${i33}.productoId`, "Uno de los productos del encargo ya no existe.");
      if (prod.localId && prod.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", `lineas.${i33}.productoId`, "Uno de los productos pertenece a otro local.");
    } else if (!descripcion) {
      return errorValidacionPM10("campo_obligatorio", `lineas.${i33}.productoId`, "Selecciona un producto o escribe una descripción.");
    }

    const cantidadRaw = ln2.cantidad;
    if (cantidadRaw === null || cantidadRaw === void 0 || String(cantidadRaw).trim() === "") return errorValidacionPM10("campo_obligatorio", `lineas.${i33}.cantidad`, "Indica la cantidad de cada línea.");
    const cantidad = Number(cantidadRaw);
    if (!Number.isFinite(cantidad)) return errorValidacionPM10("numero_no_finito", `lineas.${i33}.cantidad`, "La cantidad debe ser un número válido.");
    if (!(cantidad > 0)) return errorValidacionPM10("valor_fuera_rango", `lineas.${i33}.cantidad`, "La cantidad debe ser mayor que cero.");

    const precioRaw = ln2.precioUnitario;
    if (precioRaw === null || precioRaw === void 0 || String(precioRaw).trim() === "") return errorValidacionPM10("campo_obligatorio", `lineas.${i33}.precioUnitario`, "Indica el precio unitario de cada línea.");
    const precioUnitario = Number(precioRaw);
    if (!Number.isFinite(precioUnitario)) return errorValidacionPM10("numero_no_finito", `lineas.${i33}.precioUnitario`, "El precio unitario debe ser un número válido.");
    if (precioUnitario < 0) return errorValidacionPM10("valor_fuera_rango", `lineas.${i33}.precioUnitario`, "El precio unitario no puede ser negativo.");

    total += cantidad * precioUnitario;
    lineas.push({ ...ln2, productoId, descripcion, cantidad, precioUnitario });
  }
  if (!Number.isFinite(total) || total < 0) return errorValidacionPM10("numero_no_finito", "total", "El total del encargo no es válido.");

  const señalRaw = data.señal;
  let señal = 0;
  if (!(señalRaw === null || señalRaw === void 0 || String(señalRaw).trim() === "")) {
    señal = Number(señalRaw);
    if (!Number.isFinite(señal)) return errorValidacionPM10("numero_no_finito", "señal", "La señal debe ser un número válido.");
    if (señal < 0) return errorValidacionPM10("valor_fuera_rango", "señal", "La señal no puede ser negativa.");
  }
  if (señal > total + 1e-9) return errorValidacionPM10("valor_fuera_rango", "señal", "La señal no puede superar el total del encargo.");

  const mediosValidos = new Set(["Efectivo", "Tarjeta", "Transferencia", "Otro"]);
  const señalMedioPago = String(data.señalMedioPago || "").trim();
  if (señal > 0 && !señalMedioPago) return errorValidacionPM10("campo_obligatorio", "señalMedioPago", "Indica cómo se ha cobrado la señal.");
  if (señal > 0 && !mediosValidos.has(señalMedioPago)) return errorValidacionPM10("valor_no_permitido", "señalMedioPago", "El medio de pago de la señal no es válido.");

  return {
    ok: true,
    total,
    datos: {
      ...data,
      clienteId,
      fechaEntrega,
      lineas,
      señal,
      señalMedioPago: señal > 0 ? señalMedioPago : señalMedioPago || "Efectivo",
      localId: localActivoId
    }
  };
}
'''
    s = s[:pos] + helper + s[pos:]

logic_ini = s.find('function crearLogicaEncargos({')
logic_fin = s.find('function crearLogicaVenta({', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('No se encontró bloque crearLogicaEncargos')
logic = s[logic_ini:logic_fin]

old_sig = 'function crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, setProductos, setMovimientos, venderLineas, localActivoId }) {'
new_sig = 'function crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes = [], setProductos, setMovimientos, venderLineas, localActivoId, empresaId = null }) {'
if old_sig in logic:
    logic = logic.replace(old_sig, new_sig, 1)
elif new_sig not in logic:
    raise SystemExit('Firma crearLogicaEncargos no reconocida')

old_add = '''  function addEncargo(data) {\n    if (localActivoId && (data.lineas || []).some((ln2) => {\n      const p22 = productos.find((x3) => x3.id === ln2.productoId);\n      return p22 && p22.localId && p22.localId !== localActivoId;\n    })) return false;\n    const fecha = todayISO();\n    const cobros = sincronizarCobroSe\\u00F1al([], data.se\\u00F1al, data.se\\u00F1alMedioPago, fecha);\n    const idsLocalesLineas = [...new Set((data.lineas || []).map((ln2) => productos.find((p22) => p22.id === ln2.productoId)?.localId).filter(Boolean))];\n    const localId = data.localId || (idsLocalesLineas.length === 1 ? idsLocalesLineas[0] : null) || localActivoId || null;\n    setEncargos((s22) => [{ id: uid(), estado: \"Pendiente\", fechaCreacion: fecha, cobros, ...data, localId }, ...s22]);\n  }'''
new_add = '''  function addEncargo(data) {\n    const fecha = todayISO();\n    const validacion = validarEncargoPM10(data, { productos, clientes, localActivoId, empresaId, fechaCreacion: fecha });\n    if (!validacion.ok) return validacion;\n    const datos = validacion.datos;\n    const cobros = sincronizarCobroSe\\u00F1al([], datos.se\\u00F1al, datos.se\\u00F1alMedioPago, fecha);\n    const nuevo = { ...datos, id: uid(), estado: \"Pendiente\", fechaCreacion: fecha, cobros, localId: localActivoId };\n    setEncargos((s22) => [nuevo, ...s22]);\n    return nuevo;\n  }'''
if old_add in logic:
    logic = logic.replace(old_add, new_add, 1)
elif 'const validacion = validarEncargoPM10(data, { productos, clientes, localActivoId, empresaId, fechaCreacion: fecha });' not in logic:
    raise SystemExit('addEncargo no reconocido')

old_update = '''  function updateEncargo(id, data) {\n    const actual = encargos.find((e2) => e2.id === id);\n    if (!encargoEsDelLocalActivo(actual)) return false;\n    setEncargos(\n      (s22) => s22.map((e2) => {\n        if (e2.id !== id) return e2;\n        const actualizado = { ...e2, ...data };\n        if (\"se\\xF1al\" in data || \"se\\xF1alMedioPago\" in data) {\n          actualizado.cobros = sincronizarCobroSe\\u00F1al(e2.cobros, actualizado.se\\u00F1al, actualizado.se\\u00F1alMedioPago, e2.fechaCreacion);\n        }\n        return actualizado;\n      })\n    );\n  }'''
new_update = '''  function updateEncargo(id, data) {\n    const actual = encargos.find((e2) => e2.id === id);\n    if (!actual || !encargoEsDelLocalActivo(actual)) return errorValidacionPM10(\"contexto_no_autorizado\", \"encargoId\", \"El encargo no pertenece al local activo.\");\n    const candidato = { ...actual, ...data, id: actual.id, localId: actual.localId || localActivoId };\n    const validacion = validarEncargoPM10(candidato, { productos, clientes, localActivoId, empresaId, fechaCreacion: actual.fechaCreacion || todayISO() });\n    if (!validacion.ok) return validacion;\n    setEncargos(\n      (s22) => s22.map((e2) => {\n        if (e2.id !== id) return e2;\n        const actualizado = { ...e2, ...validacion.datos, id: e2.id, localId: e2.localId || localActivoId };\n        if (\"se\\xF1al\" in data || \"se\\xF1alMedioPago\" in data) {\n          actualizado.cobros = sincronizarCobroSe\\u00F1al(e2.cobros, actualizado.se\\u00F1al, actualizado.se\\u00F1alMedioPago, e2.fechaCreacion);\n        }\n        return actualizado;\n      })\n    );\n    return true;\n  }'''
if old_update in logic:
    logic = logic.replace(old_update, new_update, 1)
elif 'const candidato = { ...actual, ...data, id: actual.id' not in logic:
    raise SystemExit('updateEncargo no reconocido')

s = s[:logic_ini] + logic + s[logic_fin:]

# Pasar referencias de cliente/empresa al dominio de Encargos.
old_call = 'crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, setProductos, setMovimientos, venderLineas, localActivoId })'
new_call = 'crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes, setProductos, setMovimientos, venderLineas, localActivoId, empresaId: empresaDelLocalActivo?.id || null })'
if old_call in s:
    s = s.replace(old_call, new_call, 1)
elif new_call not in s:
    raise SystemExit('Llamada crearLogicaEncargos no reconocida')

# UI: no filtrar líneas inválidas ni convertir la señal antes de la barrera de dominio.
ui_ini = s.find('function Encargos({')
ui_fin = s.find('function Clientes(', ui_ini)
if ui_ini < 0:
    raise SystemExit('No se encontró componente Encargos')
if ui_fin < 0:
    ui_fin = min(len(s), ui_ini + 60000)
ui = s[ui_ini:ui_fin]
old_submit = '''    const validas = form.lineas.filter((l22) => (l22.productoId || l22.descripcion) && Number(l22.cantidad) > 0);\n    if (!validas.length) {\n      setError(\"A\\xF1ade al menos un producto con cantidad.\");\n      return;\n    }\n    setError(\"\");\n    const datos = { ...form, lineas: validas, se\\u00F1al: form.se\\u00F1al === \"\" ? 0 : Number(form.se\\u00F1al) };\n    if (editingId) updateEncargo(editingId, datos);\n    else addEncargo(datos);\n    setShowForm(false);\n    setForm(null);\n    setEditingId(null);'''
new_submit = '''    setError(\"\");\n    const datos = { ...form, lineas: form.lineas.map((l22) => ({ ...l22 })) };\n    const resultado = editingId ? updateEncargo(editingId, datos) : addEncargo(datos);\n    if (!resultado || resultado.ok === false) {\n      setError(resultado?.error || \"No se pudo guardar el encargo.\");\n      return;\n    }\n    setShowForm(false);\n    setForm(null);\n    setEditingId(null);'''
if old_submit in ui:
    ui = ui.replace(old_submit, new_submit, 1)
elif 'const resultado = editingId ? updateEncargo(editingId, datos) : addEncargo(datos);' not in ui:
    raise SystemExit('submit de Encargos no reconocido')
s = s[:ui_ini] + ui + s[ui_fin:]

p.write_text(s, encoding='utf-8')
print('PM10 P08 LA-018 Encargos: patch aplicado/idempotente')
