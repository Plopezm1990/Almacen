from pathlib import Path

p = Path('.github/scripts/aplicar_operaciones_locales_bloque5.py')
s = p.read_text(encoding='utf-8')

# Devoluciones: el registro nuevo pertenece estrictamente al local activo.
viejo = "localId: prod.localId || localActivoId || null,"
n = s.count(viejo)
assert n == 1, f'esperado 1 patrón de devolución, encontrado {n}'
s = s.replace(viejo, "localId: localActivoId || null,", 1)

# Alta de producto: ancla exacta confirmada en el bundle actual.
ini = s.index("# Alta: el caller no puede imponer otro local.")
fin = s.index("# Guardas en update/delete/reactivar/salida.", ini)
reemplazo = r'''# Alta: ancla exacta confirmada en el bundle actual.
viejo_alta = '    const nuevo = { id: uid(), stock: Number(data.stock) || 0, localId: localActivoId || null, ...data };'
nuevo_alta = '    const nuevo = { id: uid(), stock: Number(data.stock) || 0, ...data, localId: localActivoId || data.localId || null };'
b = uno(b, viejo_alta, nuevo_alta, 'Productos: alta fuerza local')

'''
s = s[:ini] + reemplazo + s[fin:]

# Salida de producto: forma exacta del bundle.
ini = s.index("b = rx_uno(b, r'(function registrarSalida")
fin = s.index("\n\n# Ajuste producto por otro", ini)
reemplazo = r'''viejo_salida = """    const prod = productos.find((p2) => p2.id === productoId);
    if (!prod) return false;"""
nuevo_salida = """    const prod = productos.find((p2) => p2.id === productoId);
    if (!prod || !productoEsDelLocalActivo(prod)) return false;"""
b = uno(b, viejo_salida, nuevo_salida, 'Productos: salida protegida')'''
s = s[:ini] + reemplazo + s[fin:]

# Ajuste entre productos: proteger origen y destino por local.
ini = s.index("# Ajuste producto por otro: proteger origen y destino tras ambos lookups.")
fin = s.index("s = s[:inicio] + b + s[fin:]", ini)
reemplazo = r'''# Ajuste entre productos: anclas exactas confirmadas en el bundle.
viejo_ajuste = """    const origen = productos.find((p2) => p2.id === productoOrigenId);
    const destino = productos.find((p2) => p2.id === productoDestinoId);"""
nuevo_ajuste = """    const origen = productos.find((p2) => p2.id === productoOrigenId);
    const destino = productos.find((p2) => p2.id === productoDestinoId);
    if (origen && destino && (!productoEsDelLocalActivo(origen) || !productoEsDelLocalActivo(destino))) return { ok: false, error: "Los dos productos deben pertenecer al local activo." };"""
b = uno(b, viejo_ajuste, nuevo_ajuste, 'Productos: ajuste cruzado protegido')
'''
s = s[:ini] + reemplazo + s[fin:]

# Venta rápida: guardas internas y anclas exactas confirmadas.
ini = s.index("# Guardar local en líneas cloud si patrón existe.")
fin = s.index("s = s[:inicio] + b + s[fin:]", ini)
reemplazo = r'''# Venta rápida: guardas internas y anclas exactas confirmadas.
b = uno(b, 'localId: prod ? prod.localId || null : null', 'localId: prod ? prod.localId || localActivoId || null : localActivoId || null', 'Venta: localId RPC')

viejo_vender_lineas = '  function venderLineas(lineas, opciones = {}) {\n'
nuevo_vender_lineas = '  function venderLineas(lineas, opciones = {}) {\n    const incluyeOtroLocal = (lineas || []).some((ln2) => {\n      const p2 = productos.find((x3) => x3.id === ln2.productoId);\n      return !!p2 && !productoEsDelLocalActivoVenta(p2);\n    });\n    if (incluyeOtroLocal) return { ok: false, error: "La venta incluye productos de otro local." };\n'
b = uno(b, viejo_vender_lineas, nuevo_vender_lineas, 'Venta: venderLineas protegido')

viejo_carrito = '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {\n'
nuevo_carrito = '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {\n    const incluyeOtroLocal = (lineas || []).some((ln2) => {\n      const p2 = productos.find((x3) => x3.id === ln2.productoId);\n      return !!p2 && !productoEsDelLocalActivoVenta(p2);\n    });\n    if (incluyeOtroLocal) return { ok: false, error: "La venta incluye productos de otro local." };\n'
b = uno(b, viejo_carrito, nuevo_carrito, 'Venta: carrito protegido')

viejo_anular = '    const lineas = (movimientosActuales || []).filter((m2) => m2.ventaId === ventaId || m2.operationId === ventaId).filter((m2) => esVenta(m2) || esSalida(m2));'
nuevo_anular = '    const lineas = (movimientosActuales || []).filter((m2) => m2.ventaId === ventaId || m2.operationId === ventaId).filter((m2) => esVenta(m2) || esSalida(m2)).filter((m2) => movimientoEsDelLocalActivoVenta(m2));'
b = uno(b, viejo_anular, nuevo_anular, 'Venta: anulación por local')

viejo_arqueo = '    const arqueoDelDia = fechaVenta && (arqueos || []).find((a2) => a2.fecha === fechaVenta);'
nuevo_arqueo = '    const arqueoDelDia = fechaVenta && (arqueos || []).find((a2) => a2.fecha === fechaVenta && (!localActivoId || a2.localId === localActivoId));'
b = uno(b, viejo_arqueo, nuevo_arqueo, 'Venta: arqueo por local')
'''
s = s[:ini] + reemplazo + s[fin:]

# Devoluciones: los objetos reales se llaman `registro` y usan `producto`.
ini = s.index("# Añadir localId a cada registro de devolución justo después del id.")
fin = s.index("s=s[:inicio]+b+s[fin:]", ini)
reemplazo = r'''# Añadir localId a los dos registros exactos de devolución.
viejo_cliente = """    const registro = {
      id: uid(),
      tipo: "cliente","""
nuevo_cliente = """    const registro = {
      id: uid(),
      localId: producto.localId || localActivoId || null,
      tipo: "cliente","""
b = uno(b, viejo_cliente, nuevo_cliente, 'Devoluciones: registro cliente con localId')

viejo_proveedor = """    const registro = {
      id: uid(),
      tipo: "proveedor","""
nuevo_proveedor = """    const registro = {
      id: uid(),
      localId: producto.localId || localActivoId || null,
      tipo: "proveedor","""
b = uno(b, viejo_proveedor, nuevo_proveedor, 'Devoluciones: registro proveedor con localId')
print('OK Devoluciones: registros con localId')
'''
s = s[:ini] + reemplazo + s[fin:]

p.write_text(s, encoding='utf-8')
print('CORRECCIONES_APLICADOR_BLOQUE5_OK')
