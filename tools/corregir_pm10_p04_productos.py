from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

helper = r'''function errorValidacionPM10(codigo, campo, error) {
  return { ok: false, codigo, campo, error };
}
function numeroPM10(valor, campo, { minimo = null, maximo = null, estrictoMinimo = false, entero = false, opcional = false } = {}) {
  if (valor === null || valor === void 0 || typeof valor === "string" && valor.trim() === "") {
    return opcional ? { ok: true, vacio: true, valor: null } : errorValidacionPM10("campo_obligatorio", campo, `${campo} es obligatorio.`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return errorValidacionPM10("numero_no_finito", campo, `${campo} debe ser un número válido.`);
  if (entero && !Number.isInteger(numero)) return errorValidacionPM10("numero_no_entero", campo, `${campo} debe ser un número entero.`);
  if (minimo !== null && (estrictoMinimo ? numero <= minimo : numero < minimo)) return errorValidacionPM10("valor_fuera_rango", campo, estrictoMinimo ? `${campo} debe ser mayor que ${minimo}.` : `${campo} no puede ser menor que ${minimo}.`);
  if (maximo !== null && numero > maximo) return errorValidacionPM10("valor_fuera_rango", campo, `${campo} no puede ser mayor que ${maximo}.`);
  return { ok: true, valor: numero };
}
function validarProductoPM10(data, { parcial = false } = {}) {
  const entrada = data && typeof data === "object" ? data : {};
  const salida = { ...entrada };
  if (!parcial || Object.prototype.hasOwnProperty.call(entrada, "nombre")) {
    const nombre = String(entrada.nombre ?? "").trim();
    if (!nombre) return errorValidacionPM10("campo_obligatorio", "nombre", "Escribe el nombre del producto.");
    salida.nombre = nombre;
  }
  const reglas = [
    ["costo", { minimo: 0 }, !parcial],
    ["precioVenta", { minimo: 0, opcional: true }, false],
    ["stockMinimo", { minimo: 0 }, !parcial],
    ["udsPorCaja", { minimo: 0, estrictoMinimo: true, opcional: true }, false],
    ["ivaCompra", { minimo: 0, maximo: 100, opcional: true }, false],
    ["ivaVenta", { minimo: 0, maximo: 100, opcional: true }, false],
    ["stock", { minimo: 0, opcional: true }, false]
  ];
  for (const [campo, opciones, obligatorioAlta] of reglas) {
    const presente = Object.prototype.hasOwnProperty.call(entrada, campo);
    if (!presente && parcial) continue;
    if (!presente && !obligatorioAlta) continue;
    const r = numeroPM10(entrada[campo], campo, opciones);
    if (!r.ok) return r;
    if (r.vacio) delete salida[campo];
    else salida[campo] = r.valor;
  }
  return { ok: true, datos: salida };
}
'''

if 'function validarProductoPM10(' not in s:
    anchor = 'function crearLogicaProductos('
    idx = s.find(anchor)
    if idx < 0:
        raise SystemExit('No se encontró crearLogicaProductos')
    s = s[:idx] + helper + s[idx:]

    old_add = '''  function addProducto(data) {\n    const nuevo = { id: uid(), stock: Number(data.stock) || 0, ...data, localId: localActivoId || data.localId || null };\n    setProductos((s22) => [...s22, nuevo]);\n    const stockInicial = Number(data.stock) || 0;'''
    new_add = '''  function addProducto(data) {\n    const validacion = validarProductoPM10(data, { parcial: false });\n    if (!validacion.ok) return validacion;\n    const datosValidos = validacion.datos;\n    const stockInicial = Object.prototype.hasOwnProperty.call(datosValidos, "stock") ? datosValidos.stock : 0;\n    const nuevo = { id: uid(), ...datosValidos, stock: stockInicial, localId: localActivoId || datosValidos.localId || null };\n    setProductos((s22) => [...s22, nuevo]);'''
    if old_add not in s:
        raise SystemExit('No se encontró bloque addProducto')
    s = s.replace(old_add, new_add, 1)

    old_update = '''  function updateProducto(id, data) {\n    const anterior = productos.find((p22) => p22.id === id);\n    if (!productoEsDelLocalActivo(anterior)) return false;\n    const { stock: stockNuevoForm, ...restoDatos } = data;'''
    new_update = '''  function updateProducto(id, data) {\n    const anterior = productos.find((p22) => p22.id === id);\n    if (!productoEsDelLocalActivo(anterior)) return errorValidacionPM10("contexto_no_autorizado", "localId", "Producto fuera del local activo.");\n    const validacion = validarProductoPM10(data, { parcial: true });\n    if (!validacion.ok) return validacion;\n    const { stock: stockNuevoForm, ...restoDatos } = validacion.datos;'''
    if old_update not in s:
        raise SystemExit('No se encontró bloque updateProducto')
    s = s.replace(old_update, new_update, 1)

    old_stock = '      const valorNuevo = Number(stockNuevoForm) || 0;\n      const dif = valorNuevo - stockTeoricoAntes;'
    if old_stock not in s:
        raise SystemExit('No se encontró normalización de stock updateProducto')
    s = s.replace(old_stock, '      const valorNuevo = stockNuevoForm;\n      const dif = valorNuevo - stockTeoricoAntes;', 1)

    old_quick = '''  function guardarProductoNuevo() {\n    if (!nuevoProd.nombre.trim()) return;\n    const creado = addProducto({\n      nombre: nuevoProd.nombre.trim(),\n      unidad: nuevoProd.unidad || "unidad",\n      tipo: "materia_prima",\n      costo: Number(nuevoProd.costo) || 0,\n      ivaCompra: 10,\n      proveedorId: proveedorId || "",\n      stock: 0,\n      stockMinimo: 0\n    });\n    setItems((s22) => s22.map((it2, i33) => i33 === creandoNuevoIdx ? { ...it2, productoId: creado.id, costoUnitario: creado.costo } : it2));\n    setCreandoNuevoIdx(null);\n  }'''
    new_quick = '''  function guardarProductoNuevo() {\n    if (!nuevoProd.nombre.trim()) {\n      setError("Escribe el nombre del producto.");\n      return;\n    }\n    const creado = addProducto({\n      nombre: nuevoProd.nombre.trim(),\n      unidad: nuevoProd.unidad || "unidad",\n      tipo: "materia_prima",\n      costo: nuevoProd.costo,\n      ivaCompra: 10,\n      proveedorId: proveedorId || "",\n      stock: 0,\n      stockMinimo: 0\n    });\n    if (!creado || creado.ok === false) {\n      setError(creado?.error || "No se pudo crear el producto.");\n      return;\n    }\n    setError("");\n    setItems((s22) => s22.map((it2, i33) => i33 === creandoNuevoIdx ? { ...it2, productoId: creado.id, costoUnitario: creado.costo } : it2));\n    setCreandoNuevoIdx(null);\n  }'''
    if old_quick not in s:
        raise SystemExit('No se encontró alta rápida de producto')
    s = s.replace(old_quick, new_quick, 1)
else:
    # Mantener helper congelado y actualizar la versión inicial si este script
    # se ejecuta sobre una fuente ya corregida por una ejecución anterior.
    ini = s.index('function errorValidacionPM10(')
    fin = s.index('function crearLogicaProductos(', ini)
    s = s[:ini] + helper + s[fin:]

old_submit = '''  function submit() {\n    if (!form.nombre.trim()) {\n      setError("Escribe el nombre del producto.");\n      return;\n    }\n    setError("");\n    addProducto({ ...form, costo: Number(form.costo) || 0, ivaCompra: Number(form.ivaCompra) || 0, udsPorCaja: Number(form.udsPorCaja) || 1, precioVenta: Number(form.precioVenta) || 0, ivaVenta: Number(form.ivaVenta) || 0, stockMinimo: Number(form.stockMinimo) || 0 });\n    setForm(blank);\n    setShowForm(false);\n  }'''
new_submit = '''  function submit() {\n    if (!form.nombre.trim()) {\n      setError("Escribe el nombre del producto.");\n      return;\n    }\n    const creado = addProducto(form);\n    if (!creado || creado.ok === false) {\n      setError(creado?.error || "No se pudo guardar el producto.");\n      return;\n    }\n    setError("");\n    setForm(blank);\n    setShowForm(false);\n  }'''
if old_submit in s:
    s = s.replace(old_submit, new_submit, 1)

old_edit = '''    updateProducto(editFor, {\n      ...editForm,\n      costo: Number(editForm.costo) || 0,\n      ivaCompra: Number(editForm.ivaCompra) || 0,\n      udsPorCaja: Number(editForm.udsPorCaja) || 1,\n      precioVenta: Number(editForm.precioVenta) || 0,\n      ivaVenta: Number(editForm.ivaVenta) || 0,\n      stock: Number(editForm.stock) || 0,\n      stockMinimo: Number(editForm.stockMinimo) || 0\n    });\n    setEditFor(null);'''
new_edit = '''    const actualizado = updateProducto(editFor, editForm);\n    if (!actualizado || actualizado.ok === false) {\n      setEditError(actualizado?.error || "No se pudo actualizar el producto.");\n      return;\n    }\n    setEditError("");\n    setEditFor(null);'''
if old_edit in s:
    s = s.replace(old_edit, new_edit, 1)

p.write_text(s, encoding='utf-8')
print('PM10 P04 patch aplicado/idempotente')
