from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

def uno(texto, viejo, nuevo, nombre):
    n = texto.count(viejo)
    assert n == 1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK', nombre)
    return texto.replace(viejo, nuevo, 1)

# Derivados de documentos del local activo.
ancla = '  const pedidosPendientesDelLocalActivo = (0, import_react4.useMemo)(() => pedidosDelLocalActivo.filter((p2) => p2.estado !== "Recibido"), [pedidosDelLocalActivo]);'
assert s.index('const facturasPorPagar =') < s.index(ancla)
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
  }, [facturasDirectas, localActivoId]);
  const facturasPorPagarDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return facturasPorPagar;
    const idsAlbaranes = new Set(albaranesDelLocalActivo.map((a2) => a2.id));
    const idsDirectas = new Set(facturasDirectasDelLocalActivo.map((f2) => f2.id));
    return facturasPorPagar.filter((f2) => f2.origen === "albaran" ? idsAlbaranes.has(f2.id) : idsDirectas.has(f2.id));
  }, [facturasPorPagar, albaranesDelLocalActivo, facturasDirectasDelLocalActivo, localActivoId]);
  const pendientesPagoDelLocalActivo = (0, import_react4.useMemo)(() => facturasPorPagarDelLocalActivo.filter((f2) => !f2.pagada), [facturasPorPagarDelLocalActivo]);
  const totalPendientePagoDelLocalActivo = (0, import_react4.useMemo)(() => pendientesPagoDelLocalActivo.reduce((a2, f2) => a2 + f2.total, 0), [pendientesPagoDelLocalActivo]);
  const vencenProntoDelLocalActivo = (0, import_react4.useMemo)(() => pendientesPagoDelLocalActivo.filter((f2) => f2.dias !== null && f2.dias <= 7), [pendientesPagoDelLocalActivo]);'''
s = uno(s, ancla, nuevo, 'derivados documentales del local activo')

# Blindaje del núcleo de Albaranes.
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

viejo = '''  function guardarAlbaran(alb) {
    const limpioBase = sinFotoIncrustada(alb);
    const idsLocalesLineas = [...new Set((limpioBase.lineas || []).map((ln2) => productos.find((p2) => p2.id === ln2.productoId)?.localId).filter(Boolean))];
    const limpio = { ...limpioBase, localId: limpioBase.localId || (idsLocalesLineas.length === 1 ? idsLocalesLineas[0] : null) || localActivoId || null };
    setAlbaranes((s2) => {
      const existe = s2.some((a2) => a2.id === limpio.id);
      return existe ? s2.map((a2) => a2.id === limpio.id ? limpio : a2) : [limpio, ...s2];
    });
  }'''
nuevo = '''  function guardarAlbaran(alb) {
    if (!albaranEsDelLocalActivo(alb, true)) return false;
    const limpioBase = sinFotoIncrustada(alb);
    const idsLocalesLineas = [...new Set((limpioBase.lineas || []).map((ln2) => productos.find((p2) => p2.id === ln2.productoId)?.localId).filter(Boolean))];
    const limpio = { ...limpioBase, localId: limpioBase.localId || (idsLocalesLineas.length === 1 ? idsLocalesLineas[0] : null) || localActivoId || null };
    if (localActivoId && limpio.localId !== localActivoId) return false;
    setAlbaranes((s2) => {
      const existe = s2.some((a2) => a2.id === limpio.id);
      return existe ? s2.map((a2) => a2.id === limpio.id ? limpio : a2) : [limpio, ...s2];
    });
    return true;
  }'''
b = uno(b, viejo, nuevo, 'guardar albarán protegido')

viejo = '    const otros = albaranes.filter((a2) => a2.id !== alb.id && a2.proveedorId === alb.proveedorId);'
nuevo = '    const otros = albaranes.filter((a2) => a2.id !== alb.id && a2.proveedorId === alb.proveedorId && albaranEsDelLocalActivo(a2));'
b = uno(b, viejo, nuevo, 'duplicados limitados al local')

viejo = '''  function eliminarAlbaran(id) {
    const a2 = albaranes.find((x3) => x3.id === id);
    if (!a2) return;'''
nuevo = '''  function eliminarAlbaran(id) {
    const a2 = albaranes.find((x3) => x3.id === id);
    if (!a2 || !albaranEsDelLocalActivo(a2)) return false;'''
b = uno(b, viejo, nuevo, 'eliminar albarán protegido')

viejo = '''  function marcarPagada(id, pagada) {
    const a2 = albaranes.find((x3) => x3.id === id);
    registrarAuditoria'''
nuevo = '''  function marcarPagada(id, pagada) {
    const a2 = albaranes.find((x3) => x3.id === id);
    if (!a2 || !albaranEsDelLocalActivo(a2)) return false;
    registrarAuditoria'''
b = uno(b, viejo, nuevo, 'pago de albarán protegido')

viejo = '''  function confirmarAlbaran(alb) {
    const { lineasResueltas, avisos } = procesarRecepcion({'''
nuevo = '''  function confirmarAlbaran(alb) {
    if (!albaranEsDelLocalActivo(alb, true)) return false;
    if (alb.pedidoId) {
      const pedido = pedidos.find((pe2) => pe2.id === alb.pedidoId);
      if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;
    }
    const { lineasResueltas, avisos } = procesarRecepcion({'''
b = uno(b, viejo, nuevo, 'confirmar albarán protegido')

viejo = '''  function anularAlbaran(alb) {
    registrarAuditoria'''
nuevo = '''  function anularAlbaran(alb) {
    if (!albaranEsDelLocalActivo(alb)) return false;
    registrarAuditoria'''
b = uno(b, viejo, nuevo, 'anular albarán protegido')

viejo = '''  function recibirConAlbaran(pedido) {
    const lineas = pedido.items.map((it2) => {'''
nuevo = '''  function recibirConAlbaran(pedido) {
    if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;
    const lineas = pedido.items.map((it2) => {'''
b = uno(b, viejo, nuevo, 'recibir con albarán protegido')

viejo = '''      pedidoId: pedido.id,
      lineas: lineas.length ? lineas : [],'''
nuevo = '''      pedidoId: pedido.id,
      localId: localActivoId || pedido.localId || null,
      lineas: lineas.length ? lineas : [],'''
b = uno(b, viejo, nuevo, 'prefill de albarán con local')

viejo = '''  function recibirConFotoIA(pedido) {
    setPedidoParaFotoIA(pedido);
    setTab("albaranes");
  }'''
nuevo = '''  function recibirConFotoIA(pedido) {
    if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;
    setPedidoParaFotoIA(pedido);
    setTab("albaranes");
    return true;
  }'''
b = uno(b, viejo, nuevo, 'foto IA protegida por local')
s = s[:inicio] + b + s[fin:]

# Blindaje de facturas directas.
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
b = uno(b, ancla, nuevo, 'helper factura directa por local')

viejo = '''  function updateFacturaDirecta(id, data) {
    setFacturasDirectas('''
nuevo = '''  function updateFacturaDirecta(id, data) {
    const actual = facturasDirectas.find((f2) => f2.id === id);
    if (!facturaDirectaEsDelLocalActivo(actual)) return false;
    setFacturasDirectas('''
b = uno(b, viejo, nuevo, 'editar factura directa protegido')

viejo = '''  function deleteFacturaDirecta(id) {
    setFacturasDirectas((s2) => {'''
nuevo = '''  function deleteFacturaDirecta(id) {
    const actual = facturasDirectas.find((f2) => f2.id === id);
    if (!facturaDirectaEsDelLocalActivo(actual)) return false;
    setFacturasDirectas((s2) => {'''
b = uno(b, viejo, nuevo, 'eliminar factura directa protegido')

viejo = '''  function marcarPagadaFacturaDirecta(id, pagada) {
    const f2 = facturasDirectas.find((x3) => x3.id === id);
    setFacturasDirectas'''
nuevo = '''  function marcarPagadaFacturaDirecta(id, pagada) {
    const f2 = facturasDirectas.find((x3) => x3.id === id);
    if (!facturaDirectaEsDelLocalActivo(f2)) return false;
    setFacturasDirectas'''
b = uno(b, viejo, nuevo, 'pago factura directa protegido')
s = s[:inicio] + b + s[fin:]

# Render de Albaranes con datos del local activo.
ini = s.index('tab === "albaranes"')
fin = s.index('tab === "pagos"', ini)
b = s[ini:fin]
b = uno(b, '      albaranes,\n', '      albaranes: albaranesDelLocalActivo,\n', 'Albaranes: colección')
b = uno(b, '      productos,\n', '      productos: productosDelLocalActivo,\n', 'Albaranes: productos')
b = uno(b, '      pedidos\n', '      pedidos: pedidosDelLocalActivo\n', 'Albaranes: pedidos')
s = s[:ini] + b + s[fin:]

# Cuentas por pagar del local activo.
ini = s.index('tab === "pagos"')
fin = s.index('tab === "personal"', ini)
b = s[ini:fin]
b = uno(b, '      facturasPorPagar,\n', '      facturasPorPagar: facturasPorPagarDelLocalActivo,\n', 'Pagos: facturas')
b = uno(b, '      totalPendientePago,\n', '      totalPendientePago: totalPendientePagoDelLocalActivo,\n', 'Pagos: total')
s = s[:ini] + b + s[fin:]

# Facturas y sus enlaces, siempre dentro del local activo.
ini = s.index('tab === "facturas"')
fin = s.index('tab === "libroiva"', ini)
b = s[ini:fin]
b = uno(b, '      albaranes,\n', '      albaranes: albaranesDelLocalActivo,\n', 'Facturas: albaranes')
b = uno(b, '      facturasDirectas,\n', '      facturasDirectas: facturasDirectasDelLocalActivo,\n', 'Facturas: directas')
b = uno(b, '        const a2 = albaranes.find((x3) => x3.id === albId);', '        const a2 = albaranesDelLocalActivo.find((x3) => x3.id === albId);', 'Facturas: enlace a albarán')
viejo = '''      irAFacturaDirecta: (fdId) => {
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }'''
nuevo = '''      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f2) => f2.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }'''
b = uno(b, viejo, nuevo, 'Facturas: enlace a directa')
s = s[:ini] + b + s[fin:]

s = uno(s, '{ id: "pagos", label: "Cuentas por pagar", icon: Coins, badge: vencenPronto.length, badgeColor: C2.red }', '{ id: "pagos", label: "Cuentas por pagar", icon: Coins, badge: vencenProntoDelLocalActivo.length, badgeColor: C2.red }', 'badge pagos por local')

# Guardas finales.
assert s.count('albaranes: albaranesDelLocalActivo') == 2
assert s.count('facturasDirectas: facturasDirectasDelLocalActivo') == 1
assert s.count('facturasPorPagar: facturasPorPagarDelLocalActivo') == 1
assert s.count('productos: productosDelLocalActivo') >= 3
assert 'vencenProntoDelLocalActivo.length' in s
p.write_text(s, encoding='utf-8')
print('GUARDAS_OK')
