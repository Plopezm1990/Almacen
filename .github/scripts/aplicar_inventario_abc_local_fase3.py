from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def uno(texto, viejo, nuevo, nombre):
    n = texto.count(viejo)
    assert n == 1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK', nombre)
    return texto.replace(viejo, nuevo, 1)


# 1) Vista de conteos del local activo, con inferencia estricta para datos antiguos.
ancla = '''  const facturasDirectasDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return facturasDirectas;
    return facturasDirectas.filter((f2) => f2.localId === localActivoId);
  }, [facturasDirectas, localActivoId]);'''
nuevo = ancla + '''
  const conteosDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return conteos;
    return conteos.filter((c2) => {
      if (c2.localId) return c2.localId === localActivoId;
      const items = c2.items || [];
      if (!items.length) return false;
      const idsLocales = items.map((it2) => productos.find((p2) => p2.id === it2.productoId)?.localId || null);
      if (idsLocales.some((id) => !id)) return false;
      const unicos = [...new Set(idsLocales)];
      return unicos.length === 1 && unicos[0] === localActivoId;
    });
  }, [conteos, productos, localActivoId]);'''
s = uno(s, ancla, nuevo, 'conteos del local activo')

# 2) El motor de conteos conoce y protege el local activo.
s = uno(
    s,
    'function crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria }) {',
    'function crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId }) {',
    'firma crearLogicaConteos con local'
)

inicio = s.index('function crearLogicaConteos({')
fin = s.index('function crearLogicaProduccion(', inicio)
b = s[inicio:fin]

ancla = '  const { aplicarMovimientoStock } = crearMotorStock({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria });'
nuevo = ancla + '''
  function localDeConteo(conteo) {
    if (!conteo) return null;
    if (conteo.localId) return conteo.localId;
    const items = conteo.items || [];
    if (!items.length) return null;
    const idsLocales = items.map((it2) => productos.find((p2) => p2.id === it2.productoId)?.localId || null);
    if (idsLocales.some((id) => !id)) return null;
    const unicos = [...new Set(idsLocales)];
    return unicos.length === 1 ? unicos[0] : null;
  }
  function conteoEsDelLocalActivo(conteo) {
    if (!conteo) return false;
    if (!localActivoId) return true;
    return localDeConteo(conteo) === localActivoId;
  }
  function movimientoEsDelLocalActivo(m2) {
    if (!localActivoId) return true;
    if (m2.localId) return m2.localId === localActivoId;
    const prod = productos.find((p2) => p2.id === m2.productoId);
    return !!prod && prod.localId === localActivoId;
  }'''
b = uno(b, ancla, nuevo, 'helpers de conteo por local')

# Crear productos desde un conteo solo en su local.
b = uno(
    b,
    '  function crearProductoEnConteo(conteoId, datos, cantidadContada) {\n    const nuevoId = uid();',
    '  function crearProductoEnConteo(conteoId, datos, cantidadContada) {\n    const conteo = conteos.find((c2) => c2.id === conteoId);\n    if (!conteoEsDelLocalActivo(conteo)) return false;\n    const nuevoId = uid();',
    'crear producto en conteo protegido'
)
b = uno(
    b,
    '      id: nuevoId,\n      stock: 0,',
    '      id: nuevoId,\n      localId: localActivoId || localDeConteo(conteo) || null,\n      stock: 0,',
    'producto de conteo con localId'
)

# Un conteo nuevo contiene exclusivamente productos del local y guarda localId.
b = uno(
    b,
    '  function iniciarConteo(ambito = "total") {\n    let productosDelConteo;',
    '  function iniciarConteo(ambito = "total") {\n    const productosBase = localActivoId ? productos.filter((p2) => p2.localId === localActivoId) : productos;\n    let productosDelConteo;',
    'base local al iniciar conteo'
)
# Estas dos expresiones aparecen una vez cada una dentro de crearLogicaConteos.
b = uno(b, '      productosDelConteo = productos.filter((p2) => p2.tipo === "elaborado" || Number(p2.precioVenta) > 0);', '      productosDelConteo = productosBase.filter((p2) => p2.tipo === "elaborado" || Number(p2.precioVenta) > 0);', 'conteo piso local')
b = uno(b, '      productosDelConteo = productos.filter((p2) => p2.tipo !== "elaborado");', '      productosDelConteo = productosBase.filter((p2) => p2.tipo !== "elaborado");', 'conteo almacén local')
b = uno(b, '      productosDelConteo = productos;\n    }\n    const conteo = {', '      productosDelConteo = productosBase;\n    }\n    const conteo = {', 'conteo total local')
b = uno(b, '      id: uid(),\n      fecha: todayISO(),', '      id: uid(),\n      localId: localActivoId || null,\n      fecha: todayISO(),', 'conteo con localId')

# Mutaciones de conteos protegidas frente a IDs de otro local.
b = uno(b, '  function actualizarConteoItem(conteoId, productoId, campo, valor) {\n    setConteos(', '  function actualizarConteoItem(conteoId, productoId, campo, valor) {\n    const conteo = conteos.find((c2) => c2.id === conteoId);\n    if (!conteoEsDelLocalActivo(conteo)) return false;\n    setConteos(', 'actualizar item protegido')
b = uno(b, '  function actualizarResponsable(conteoId, campo, valor) {\n    setConteos(', '  function actualizarResponsable(conteoId, campo, valor) {\n    const conteo = conteos.find((c2) => c2.id === conteoId);\n    if (!conteoEsDelLocalActivo(conteo)) return false;\n    setConteos(', 'actualizar responsable protegido')
b = uno(b, '  function finalizarConteo(conteoId) {\n    setConteos(', '  function finalizarConteo(conteoId) {\n    const conteo = conteos.find((c2) => c2.id === conteoId);\n    if (!conteoEsDelLocalActivo(conteo)) return false;\n    setConteos(', 'finalizar conteo protegido')

# Eliminar / revertir / aplicar: guardia de conteo y movimientos locales.
marcador = '  function eliminarConteo(conteoId) {'
i = b.index(marcador)
j = b.index('  function revertirUltimaAplicacion(', i)
sub = b[i:j]
sub = uno(sub, '    if (!conteo) return { ok: false, error: "Conteo no encontrado." };', '    if (!conteoEsDelLocalActivo(conteo)) return { ok: false, error: "Conteo no disponible en el local activo." };', 'eliminar conteo: guardia local')
sub = uno(sub, '    const generados = movimientos.filter((m2) => m2.documentoOrigenId === conteoId && m2.origen === "aplicarAjustes");', '    const generados = movimientos.filter((m2) => m2.documentoOrigenId === conteoId && m2.origen === "aplicarAjustes" && movimientoEsDelLocalActivo(m2));', 'eliminar conteo: movimientos locales')
b = b[:i] + sub + b[j:]

marcador = '  function revertirUltimaAplicacion(conteoId) {'
i = b.index(marcador)
j = b.index('  function aplicarAjustes(', i)
sub = b[i:j]
sub = uno(sub, '    if (!conteo) return { ok: false, error: "Conteo no encontrado." };', '    if (!conteoEsDelLocalActivo(conteo)) return { ok: false, error: "Conteo no disponible en el local activo." };', 'revertir conteo: guardia local')
sub = uno(sub, '    const generados = movimientos.filter((m2) => m2.documentoOrigenId === conteoId && m2.origen === "aplicarAjustes");', '    const generados = movimientos.filter((m2) => m2.documentoOrigenId === conteoId && m2.origen === "aplicarAjustes" && movimientoEsDelLocalActivo(m2));', 'revertir conteo: movimientos locales')
b = b[:i] + sub + b[j:]

marcador = '  function aplicarAjustes(conteoId, motivos = {}) {'
i = b.index(marcador)
sub = b[i:]
sub = uno(sub, '    if (!conteo) return { ok: false, ajustados: 0, traspasados: [] };', '    if (!conteoEsDelLocalActivo(conteo)) return { ok: false, error: "Conteo no disponible en el local activo.", ajustados: 0, traspasados: [] };', 'aplicar ajustes: guardia local')
sub = uno(sub, '      const p2 = productos.find((pr) => pr.id === item.productoId);\n      if (!p2) return;', '      const p2 = productos.find((pr) => pr.id === item.productoId);\n      if (!p2 || localActivoId && p2.localId !== localActivoId) return;', 'aplicar ajustes: producto local')
b = b[:i] + sub
s = s[:inicio] + b + s[fin:]

# 3) La aplicación pasa localActivoId y solo congela el local que se está contando.
s = uno(
    s,
    'crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria });\n  const conteoAbierto = (0, import_react4.useMemo)(() => conteos.find((c2) => !c2.completado) || null, [conteos]);',
    'crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId });\n  const conteoAbierto = (0, import_react4.useMemo)(() => conteosDelLocalActivo.find((c2) => !c2.completado) || null, [conteosDelLocalActivo]);',
    'motor y congelación por local'
)

# 4) Métricas locales de valor y stock bajo.
ancla = '''  const valorUtillaje = (0, import_react4.useMemo)(
    () => productos.filter(esUtillaje).reduce((acc, p2) => acc + (Number(p2.stock) || 0) * Number(p2.costo || 0), 0),
    [productos]
  );'''
nuevo = ancla + '''
  const valorInventarioDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p2) => !esUtillaje(p2)).reduce((acc, p2) => acc + (Number(p2.stock) || 0) * Number(p2.costo || 0), 0),
    [productosDelLocalActivo]
  );
  const valorUtillajeDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter(esUtillaje).reduce((acc, p2) => acc + (Number(p2.stock) || 0) * Number(p2.costo || 0), 0),
    [productosDelLocalActivo]
  );'''
s = uno(s, ancla, nuevo, 'valores de inventario por local')

ancla = '''  const stockBajo = (0, import_react4.useMemo)(
    () => productos.filter((p2) => p2.tipo !== "elaborado" && p2.stock <= Number(p2.stockMinimo || 0)),
    [productos]
  );'''
nuevo = ancla + '''
  const stockBajoDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p2) => p2.tipo !== "elaborado" && p2.stock <= Number(p2.stockMinimo || 0)),
    [productosDelLocalActivo]
  );'''
s = uno(s, ancla, nuevo, 'stock bajo por local')

# 5) Copia paralela del mismo algoritmo ABC, alimentada solo con datos locales.
i = s.index('  const analisisABC = (0, import_react4.useMemo)(() => {')
j = s.index('  const clasificacionABC = analisisABC.mapa;', i)
bloque_abc = s[i:j]
assert bloque_abc.count('movimientos.forEach') == 1
assert bloque_abc.count('productos.filter') == 1
assert '[productos, movimientos]' in bloque_abc
local_abc = bloque_abc.replace('const analisisABC =', 'const analisisABCDelLocalActivo =', 1)
local_abc = local_abc.replace('movimientos.forEach', 'movimientosDelLocalActivo.forEach', 1)
local_abc = local_abc.replace('productos.filter', 'productosDelLocalActivo.filter', 1)
local_abc = local_abc.replace('[productos, movimientos]', '[productosDelLocalActivo, movimientosDelLocalActivo]', 1)
ancla = '  const clasificacionABC = analisisABC.mapa;'
nuevo = ancla + '\n' + local_abc + '  const clasificacionABCDelLocalActivo = analisisABCDelLocalActivo.mapa;\n'
s = uno(s, ancla, nuevo, 'ABC paralelo por local')

# 6) Productos e Inventario usan la clasificación local.
ini = s.index('tab === "productos"')
fin = s.index('tab === "historial_producto"', ini)
b = s[ini:fin]
b = uno(b, '      clasificacionABC,\n', '      clasificacionABC: clasificacionABCDelLocalActivo,\n', 'Productos: ABC local')
s = s[:ini] + b + s[fin:]

ini = s.index('tab === "conteo"')
fin = s.index('tab === "reportes"', ini)
b = s[ini:fin]
b = uno(b, '      productos,\n', '      productos: productosDelLocalActivo,\n', 'Inventario: productos locales')
b = uno(b, '      conteos,\n', '      conteos: conteosDelLocalActivo,\n', 'Inventario: conteos locales')
b = uno(b, '      productoPorId,\n', '      productoPorId: (id) => productosDelLocalActivo.find((p2) => p2.id === id),\n', 'Inventario: productoPorId local')
b = uno(b, '      clasificacionABC,\n', '      clasificacionABC: clasificacionABCDelLocalActivo,\n', 'Inventario: ABC local')
s = s[:ini] + b + s[fin:]

# 7) Saldo de almacén refleja únicamente el local activo.
viejo = 'tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos, proveedores, valorInventario, valorUtillaje, proveedorPorId, clasificacionABC, analisisABC })'
nuevo = 'tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos: productosDelLocalActivo, proveedores, valorInventario: valorInventarioDelLocalActivo, valorUtillaje: valorUtillajeDelLocalActivo, proveedorPorId, clasificacionABC: clasificacionABCDelLocalActivo, analisisABC: analisisABCDelLocalActivo })'
s = uno(s, viejo, nuevo, 'Saldo almacén por local')

# Badge de Inventario coherente con el local activo.
s = uno(
    s,
    '{ id: "conteo", label: "Inventario ciego", icon: Boxes, badge: stockBajo.length, badgeColor: C2.amber }',
    '{ id: "conteo", label: "Inventario ciego", icon: Boxes, badge: stockBajoDelLocalActivo.length, badgeColor: C2.amber }',
    'badge inventario por local'
)

# 8) Textos: el conteo total ya no es empresa completa, sino local activo.
s = uno(s, 'Contar todo (empresa completa)', 'Contar todo el local', 'texto botón conteo total')
s = uno(s, 'Todo (empresa completa)', 'Todo el local', 'texto ámbito conteo total')

# Guardas finales.
assert s.count('conteos: conteosDelLocalActivo') == 1
assert s.count('clasificacionABC: clasificacionABCDelLocalActivo') >= 3
assert 'conteosDelLocalActivo.find((c2) => !c2.completado)' in s
assert 'localId: localActivoId || null' in s
assert 'badge: stockBajoDelLocalActivo.length' in s
assert 'SaldoAlmacen, { productos: productosDelLocalActivo' in s
p.write_text(s, encoding='utf-8')
print('GUARDAS_OK')
