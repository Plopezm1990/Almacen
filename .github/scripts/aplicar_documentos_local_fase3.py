from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

def uno(texto, viejo, nuevo, nombre):
    n = texto.count(viejo)
    assert n == 1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK', nombre)
    return texto.replace(viejo, nuevo, 1)

# 1) Albaranes y facturas directas del local activo.
ancla = '  const pedidosPendientesDelLocalActivo = (0, import_react4.useMemo)(() => pedidosDelLocalActivo.filter((p2) => p2.estado !== "Recibido"), [pedidosDelLocalActivo]);'
nuevo = ancla + '''
  const albaranesDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return albaranes;
    const localPorProducto = new Map(productos.map((p2) => [p2.id, p2.localId || null]));
    return albaranes.filter((a2) => {
      if (a2.localId) return a2.localId === localActivoId;
      const ids = [...new Set((a2.lineas || []).map((ln2) => localPorProducto.get(ln2.productoId)).filter(Boolean))];
      return ids.length === 1 && ids[0] === localActivoId;
    });
  }, [albaranes, productos, localActivoId]);
  const facturasDirectasDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return facturasDirectas;
    return facturasDirectas.filter((f2) => f2.localId === localActivoId);
  }, [facturasDirectas, localActivoId]);'''
s = uno(s, ancla, nuevo, 'documentos del local activo')

# 2) Pagos filtrados, colocados después de que exista facturasPorPagar.
ancla = '  }, [albaranes, proveedores, facturasDirectas]);\n  const pendientesPago = (0, import_react4.useMemo)(() => facturasPorPagar.filter((f2) => !f2.pagada), [facturasPorPagar]);'
nuevo = '''  }, [albaranes, proveedores, facturasDirectas]);
  const facturasPorPagarDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return facturasPorPagar;
    const idsAlbaranes = new Set(albaranesDelLocalActivo.map((a2) => a2.id));
    const idsDirectas = new Set(facturasDirectasDelLocalActivo.map((f2) => f2.id));
    return facturasPorPagar.filter((f2) => f2.origen === "albaran" ? idsAlbaranes.has(f2.id) : idsDirectas.has(f2.id));
  }, [facturasPorPagar, albaranesDelLocalActivo, facturasDirectasDelLocalActivo, localActivoId]);
  const pendientesPagoDelLocalActivo = (0, import_react4.useMemo)(() => facturasPorPagarDelLocalActivo.filter((f2) => !f2.pagada), [facturasPorPagarDelLocalActivo]);
  const totalPendientePagoDelLocalActivo = (0, import_react4.useMemo)(() => pendientesPagoDelLocalActivo.reduce((a2, f2) => a2 + f2.total, 0), [pendientesPagoDelLocalActivo]);
  const vencenProntoDelLocalActivo = (0, import_react4.useMemo)(() => pendientesPagoDelLocalActivo.filter((f2) => f2.dias !== null && f2.dias <= 7), [pendientesPagoDelLocalActivo]);
  const pendientesPago = (0, import_react4.useMemo)(() => facturasPorPagar.filter((f2) => !f2.pagada), [facturasPorPagar]);'''
s = uno(s, ancla, nuevo, 'pagos después de facturasPorPagar')

# 3) Blindaje interno de Albaranes.
inicio = s.index('function crearLogicaAlbaranes({')
fin = s.index('function crearLogicaFacturasDirectas(', inicio)
b = s[inicio:fin]

ancla = '  const { aplicarMovimientoStock } = crearMotorStock({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria });\n  const claveCat ='
nuevo = '''  const { aplicarMovimientoStock } = crearMotorStock({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria });
  function localDeAlbaran(doc) {
    if (!doc) return null;
    if (doc.localId) return doc.localId;
    const ids = [...new Set((doc.lineas || []).map((ln2) => productos.find((p2) => p2.id === ln2.productoId)?.localId).filter(Boolean))];
    return ids.length === 1 ? ids[0] : null;
  }
  function albaranEsDelLocalActivo(doc, permitirNuevo = false) {
    if (!doc) return false;
    if (!localActivoId) return true;
    const existente = albaranes.find((a2) => a2.id === doc.id);
    const localId = localDeAlbaran(existente || doc);
    if (localId) return localId === localActivoId;
    return !existente && permitirNuevo;
  }
  function pedidoEsDelLocalActivoAlbaran(pedido) {
    if (!pedido) return false;
    if (!localActivoId) return true;
    if (pedido.localId) return pedido.localId === localActivoId;
    const ids = [...new Set((pedido.items || []).map((it2) => productos.find((p2) => p2.id === it2.productoId)?.localId).filter(Boolean))];
    return ids.length === 1 && ids[0] === localActivoId;
  }
  const claveCat ='''
b = uno(b, ancla, nuevo, 'helpers de seguridad de albaranes')

b = uno(b, '  function guardarAlbaran(alb) {\n    const limpioBase = sinFotoIncrustada(alb);', '  function guardarAlbaran(alb) {\n    if (!albaranEsDelLocalActivo(alb, true)) return false;\n    const limpioBase = sinFotoIncrustada(alb);', 'guardar albarán protegido')
b = uno(b, '    const otros = albaranes.filter((a2) => a2.id !== alb.id && a2.proveedorId === alb.proveedorId);', '    const otros = albaranes.filter((a2) => a2.id !== alb.id && a2.proveedorId === alb.proveedorId && albaranEsDelLocalActivo(a2));', 'duplicados por local')
b = uno(b, '    const a2 = albaranes.find((x3) => x3.id === id);\n    if (!a2) return;', '    const a2 = albaranes.find((x3) => x3.id === id);\n    if (!a2 || !albaranEsDelLocalActivo(a2)) return false;', 'eliminar albarán protegido')
b = uno(b, '  function marcarPagada(id, pagada) {\n    const a2 = albaranes.find((x3) => x3.id === id);\n    registrarAuditoria', '  function marcarPagada(id, pagada) {\n    const a2 = albaranes.find((x3) => x3.id === id);\n    if (!a2 || !albaranEsDelLocalActivo(a2)) return false;\n    registrarAuditoria', 'pago de albarán protegido')
b = uno(b, '  function confirmarAlbaran(alb) {\n    const { lineasResueltas, avisos } = procesarRecepcion({', '  function confirmarAlbaran(alb) {\n    if (!albaranEsDelLocalActivo(alb, true)) return false;\n    if (alb.pedidoId) {\n      const pedido = pedidos.find((pe2) => pe2.id === alb.pedidoId);\n      if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;\n    }\n    const { lineasResueltas, avisos } = procesarRecepcion({', 'confirmar albarán protegido')
b = uno(b, '  function anularAlbaran(alb) {\n    registrarAuditoria', '  function anularAlbaran(alb) {\n    if (!albaranEsDelLocalActivo(alb)) return false;\n    registrarAuditoria', 'anular albarán protegido')
b = uno(b, '  function recibirConAlbaran(pedido) {\n    const lineas = pedido.items.map((it2) => {', '  function recibirConAlbaran(pedido) {\n    if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;\n    const lineas = pedido.items.map((it2) => {', 'recibir con albarán protegido')
b = uno(b, '      pedidoId: pedido.id,\n      lineas: lineas.length ? lineas : [],', '      pedidoId: pedido.id,\n      localId: localActivoId || pedido.localId || null,\n      lineas: lineas.length ? lineas : [],', 'prefill de albarán con local')
b = uno(b, '  function recibirConFotoIA(pedido) {\n    setPedidoParaFotoIA(pedido);', '  function recibirConFotoIA(pedido) {\n    if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;\n    setPedidoParaFotoIA(pedido);', 'foto IA protegida')
s = s[:inicio] + b + s[fin:]

# 4) Blindaje de facturas directas.
inicio = s.index('function crearLogicaFacturasDirectas(')
fin = s.index('function crearLogicaNominas(', inicio)
b = s[inicio:fin]
ancla = 'function crearLogicaFacturasDirectas({ facturasDirectas, setFacturasDirectas, registrarAuditoria, addGasto, deleteGasto, gastosGenerales, localActivoId }) {\n  function addFacturaDirecta(data) {'
nuevo = '''function crearLogicaFacturasDirectas({ facturasDirectas, setFacturasDirectas, registrarAuditoria, addGasto, deleteGasto, gastosGenerales, localActivoId }) {
  function facturaDirectaEsDelLocalActivo(f2) {
    if (!f2) return false;
    if (!localActivoId) return true;
    return f2.localId === localActivoId;
  }
  function addFacturaDirecta(data) {'''
b = uno(b, ancla, nuevo, 'helper de factura directa')
b = uno(b, '  function updateFacturaDirecta(id, data) {\n    setFacturasDirectas(', '  function updateFacturaDirecta(id, data) {\n    const actual = facturasDirectas.find((f2) => f2.id === id);\n    if (!facturaDirectaEsDelLocalActivo(actual)) return false;\n    setFacturasDirectas(', 'editar factura directa protegido')
b = uno(b, '  function deleteFacturaDirecta(id) {\n    setFacturasDirectas((s2) => {', '  function deleteFacturaDirecta(id) {\n    const actual = facturasDirectas.find((f2) => f2.id === id);\n    if (!facturaDirectaEsDelLocalActivo(actual)) return false;\n    setFacturasDirectas((s2) => {', 'eliminar factura directa protegido')
b = uno(b, '  function marcarPagadaFacturaDirecta(id, pagada) {\n    const f2 = facturasDirectas.find((x3) => x3.id === id);\n    setFacturasDirectas', '  function marcarPagadaFacturaDirecta(id, pagada) {\n    const f2 = facturasDirectas.find((x3) => x3.id === id);\n    if (!facturaDirectaEsDelLocalActivo(f2)) return false;\n    setFacturasDirectas', 'pago de factura directa protegido')
s = s[:inicio] + b + s[fin:]

# 5) Render de Albaranes.
ini = s.index('tab === "albaranes"')
fin = s.index('tab === "pagos"', ini)
b = s[ini:fin]
b = uno(b, '      albaranes,\n', '      albaranes: albaranesDelLocalActivo,\n', 'Albaranes: colección')
b = uno(b, '      productos,\n', '      productos: productosDelLocalActivo,\n', 'Albaranes: productos')
b = uno(b, '      pedidos\n', '      pedidos: pedidosDelLocalActivo\n', 'Albaranes: pedidos')
s = s[:ini] + b + s[fin:]

# 6) Cuentas por pagar.
ini = s.index('tab === "pagos"')
fin = s.index('tab === "personal"', ini)
b = s[ini:fin]
b = uno(b, '      facturasPorPagar,\n', '      facturasPorPagar: facturasPorPagarDelLocalActivo,\n', 'Pagos: facturas')
b = uno(b, '      totalPendientePago,\n', '      totalPendientePago: totalPendientePagoDelLocalActivo,\n', 'Pagos: total')
s = s[:ini] + b + s[fin:]

# 7) Facturas y navegación segura.
ini = s.index('tab === "facturas"')
fin = s.index('tab === "libroiva"', ini)
b = s[ini:fin]
b = uno(b, '      albaranes,\n', '      albaranes: albaranesDelLocalActivo,\n', 'Facturas: albaranes')
b = uno(b, '      facturasDirectas,\n', '      facturasDirectas: facturasDirectasDelLocalActivo,\n', 'Facturas: directas')
b = uno(b, '        const a2 = albaranes.find((x3) => x3.id === albId);', '        const a2 = albaranesDelLocalActivo.find((x3) => x3.id === albId);', 'Facturas: enlace albarán')
b = uno(b, '      irAFacturaDirecta: (fdId) => {\n        setFacturaDirectaResaltada(fdId);', '      irAFacturaDirecta: (fdId) => {\n        if (!facturasDirectasDelLocalActivo.some((f2) => f2.id === fdId)) return;\n        setFacturaDirectaResaltada(fdId);', 'Facturas: enlace directa')
s = s[:ini] + b + s[fin:]

s = uno(s, '{ id: "pagos", label: "Cuentas por pagar", icon: Coins, badge: vencenPronto.length, badgeColor: C2.red }', '{ id: "pagos", label: "Cuentas por pagar", icon: Coins, badge: vencenProntoDelLocalActivo.length, badgeColor: C2.red }', 'badge de pagos por local')

assert s.count('albaranes: albaranesDelLocalActivo') == 2
assert s.count('facturasDirectas: facturasDirectasDelLocalActivo') == 1
assert s.count('facturasPorPagar: facturasPorPagarDelLocalActivo') == 1
assert 'vencenProntoDelLocalActivo.length' in s
p.write_text(s, encoding='utf-8')
print('GUARDAS_OK')
