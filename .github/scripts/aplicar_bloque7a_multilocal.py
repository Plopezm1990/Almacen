from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

def uno(txt,viejo,nuevo,nombre):
    n=txt.count(viejo)
    assert n==1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK',nombre)
    return txt.replace(viejo,nuevo,1)

# Gastos: alta ya conserva local; borrado protegido por local consultado.
s=uno(s,
'''  function deleteGasto(id) {
    setGastosGenerales((s2) => s2.filter((g2) => g2.id !== id));
  }''',
'''  function deleteGasto(id, localIdEsperado = localActivoId) {
    setGastosGenerales((s2) => {
      const actual = s2.find((g2) => g2.id === id);
      if (!actual || localIdEsperado && actual.localId !== localIdEsperado) return s2;
      return s2.filter((g2) => g2.id !== id);
    });
  }''','Gastos: borrado protegido por local')

# Reconciliación: la vista se filtrará fuera, pero las mutaciones deben validar local.
s=uno(s,
'function crearLogicaReconciliacion({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria }) {',
'function crearLogicaReconciliacion({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, localActivoId }) {',
'Reconciliacion: firma con local')
s=uno(s,
'''  function movimientosParaReconciliar(productoId) {
    return movimientos.filter((m2) => m2.productoId === productoId).slice().sort((a2, b2) => (b2.fecha || "").localeCompare(a2.fecha || ""));
  }''',
'''  function movimientosParaReconciliar(productoId) {
    const producto = productos.find((p2) => p2.id === productoId);
    if (!producto || localActivoId && producto.localId !== localActivoId) return [];
    return movimientos.filter((m2) => m2.productoId === productoId).slice().sort((a2, b2) => (b2.fecha || "").localeCompare(a2.fecha || ""));
  }''','Reconciliacion: historial protegido')
s=uno(s,
'''    const p2 = productos.find((pr) => pr.id === productoId);
    if (!p2) return { ok: false, error: "Producto no encontrado." };''',
'''    const p2 = productos.find((pr) => pr.id === productoId);
    if (!p2) return { ok: false, error: "Producto no encontrado." };
    if (localActivoId && p2.localId !== localActivoId) return { ok: false, error: "El producto no pertenece al local activo." };''','Reconciliacion: correccion protegida')
s=uno(s,
'crearLogicaReconciliacion({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria });',
'crearLogicaReconciliacion({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, localActivoId });',
'Reconciliacion: invocacion con local')

# Recordatorio de conteo reutilizable para empresa o local.
inicio=s.index('  const recordatorioConteo = (0, import_react4.useMemo)(() => {')
fin=s.index('  const conteosAtrasados =', inicio)
viejo=s[inicio:fin]
nuevo='''  function calcularRecordatorioConteo(conteosBase, nombreTotal = "Total (empresa completa)") {
    const hoy = /* @__PURE__ */ new Date();
    hoy.setHours(0, 0, 0, 0);
    const ambitos = [
      { id: "piso_venta", nombre: "Piso de venta", limiteDias: 14 },
      { id: "almacen", nombre: "Almac\\xE9n (trastienda)", limiteDias: 30 },
      { id: "total", nombre: nombreTotal, limiteDias: 30 }
    ];
    return ambitos.map((amb) => {
      const delAmbito = (conteosBase || []).filter((c2) => c2.completado && (c2.ambito || "total") === amb.id);
      if (delAmbito.length === 0) return { ...amb, ultimaFecha: null, diasDesde: null, atrasado: true };
      const ultima = delAmbito.reduce((max, c2) => c2.fecha > max ? c2.fecha : max, delAmbito[0].fecha);
      const diasDesde = Math.round((hoy - new Date(ultima)) / 864e5);
      return { ...amb, ultimaFecha: ultima, diasDesde, atrasado: diasDesde > amb.limiteDias };
    });
  }
  const recordatorioConteo = (0, import_react4.useMemo)(() => calcularRecordatorioConteo(conteos), [conteos]);
  const recordatorioConteoDelLocalActivo = (0, import_react4.useMemo)(() => calcularRecordatorioConteo(conteosDelLocalActivo, "Total del local"), [conteosDelLocalActivo]);
'''
assert 'Total (empresa completa)' in viejo and '[conteos]' in viejo, 'Recordatorio: bloque inesperado'
s=s[:inicio]+nuevo+s[fin:]
print('OK Recordatorio: helper empresa/local')

# Diagnóstico local derivado, manteniendo el global para Panel Dirección e informes de empresa.
s=uno(s,
'''  const diagnosticoStock = (0, import_react4.useMemo)(() => diagnosticarStock(), [productos, movimientos]);
  const descuadresPendientes = (0, import_react4.useMemo)(() => diagnosticoStock.filter((d2) => !d2.coincide).length, [diagnosticoStock]);''',
'''  const diagnosticoStock = (0, import_react4.useMemo)(() => diagnosticarStock(), [productos, movimientos]);
  const idsProductosDelLocalActivo = (0, import_react4.useMemo)(() => new Set(productosDelLocalActivo.map((p2) => p2.id)), [productosDelLocalActivo]);
  const diagnosticoStockDelLocalActivo = (0, import_react4.useMemo)(() => diagnosticoStock.filter((d2) => idsProductosDelLocalActivo.has(d2.productoId)), [diagnosticoStock, idsProductosDelLocalActivo]);
  const descuadresPendientes = (0, import_react4.useMemo)(() => diagnosticoStock.filter((d2) => !d2.coincide).length, [diagnosticoStock]);
  const descuadresPendientesDelLocalActivo = (0, import_react4.useMemo)(() => diagnosticoStockDelLocalActivo.filter((d2) => !d2.coincide).length, [diagnosticoStockDelLocalActivo]);''','Diagnostico: derivados local')

# Reportes del local activo: filtrar resultados por producto y recalcular compras por proveedor.
marcador='''  const productosSinMovimiento = (0, import_react4.useMemo)(
    () => productos.filter((p2) => !esUtillaje(p2) && !movimientos.some((m2) => m2.productoId === p2.id && esSalida(m2))),
    [productos, movimientos]
  );'''
assert s.count(marcador)==1, 'Reportes: marcador productos sin movimiento'
extra=marcador+'''\n  const rotacionPorProductoDelLocalActivo = (0, import_react4.useMemo)(() => rotacionPorProducto.filter((p2) => idsProductosDelLocalActivo.has(p2.id)), [rotacionPorProducto, idsProductosDelLocalActivo]);
  const margenPorProductoDelLocalActivo = (0, import_react4.useMemo)(() => margenPorProducto.filter((p2) => idsProductosDelLocalActivo.has(p2.id)), [margenPorProducto, idsProductosDelLocalActivo]);
  const productosSinMovimientoDelLocalActivo = (0, import_react4.useMemo)(() => productosSinMovimiento.filter((p2) => idsProductosDelLocalActivo.has(p2.id)), [productosSinMovimiento, idsProductosDelLocalActivo]);
  const patronesDesviacionConteoDelLocalActivo = (0, import_react4.useMemo)(() => patronesDesviacionConteo.filter((x3) => idsProductosDelLocalActivo.has(x3.productoId)), [patronesDesviacionConteo, idsProductosDelLocalActivo]);
  const gastoPorProveedorDelLocalActivo = (0, import_react4.useMemo)(() => {
    const map = {};
    pedidosDelLocalActivo.forEach((pe2) => {
      const total = (pe2.items || []).reduce((a2, it2) => a2 + (Number(it2.cantidad) || 0) * (Number(it2.costoUnitario) || 0), 0);
      map[pe2.proveedorId] = (map[pe2.proveedorId] || 0) + total;
    });
    return Object.entries(map).map(([proveedorId, total]) => ({ proveedor: proveedorPorId(proveedorId), total })).sort((a2, b2) => b2.total - a2.total);
  }, [pedidosDelLocalActivo, proveedores]);'''
s=s.replace(marcador,extra,1)
print('OK Reportes: derivados local')

# Selector de informes: recordatorio por conteos del local seleccionado, no por IDs ficticios de ámbito.
s=uno(s,
'  const recordatorioConteoInforme = localInformeId ? recordatorioConteo.filter((a2) => localPorProductoInforme.get(a2.productoId || a2.id) === localInformeId) : recordatorioConteo;',
'  const conteosInforme = localInformeId ? conteos.filter((c2) => c2.localId === localInformeId) : conteos;\n  const recordatorioConteoInforme = calcularRecordatorioConteo(conteosInforme, localInformeId ? "Total del local" : "Total (empresa completa)");',
'Recordatorio: informe por local')
s=uno(s,
'  const addGastoInforme = (data) => addGasto({ ...data, localId: localInformeId || localActivoId || null });',
'  const addGastoInforme = (data) => addGasto({ ...data, localId: localInformeId || localActivoId || null });\n  const deleteGastoInforme = (id) => deleteGasto(id, localInformeId || localActivoId || null);',
'Gastos: wrapper borrar informe')
s=uno(s,'      deleteGasto,\n      empleados: empleadosInforme','      deleteGasto: deleteGastoInforme,\n      empleados: empleadosInforme','Gastos: Resultados usa wrapper')

# Props visuales finales.
s=uno(s,'tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos, proveedorPorId })','tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId })','Mapa: productos local')
s=uno(s,'badge: pisoVentaBajo.length, badgeColor: C2.amber','badge: pisoVentaBajoDelLocalActivo.length, badgeColor: C2.amber','Traspasos: badge local')
s=uno(s,'tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: diagnosticoStock, corregirProducto, movimientosParaReconciliar })','tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: diagnosticoStockDelLocalActivo, corregirProducto, movimientosParaReconciliar })','Diagnostico: pantalla local')
s=uno(s,'badge: descuadresPendientes, badgeColor: C2.red','badge: descuadresPendientesDelLocalActivo, badgeColor: C2.red','Diagnostico: badge local')

# Productos y Traspasos no deben recibir fichas de otro local.
ini=s.index('tab === "productos"'); fin=s.index('tab === "historial_producto"',ini); b=s[ini:fin]
b=uno(b,'      fichasCosto,\n','      fichasCosto: fichasCostoDelLocalActivo,\n','Productos: fichas local')
s=s[:ini]+b+s[fin:]
s=uno(s,'Traspasos, { productos: productosDelLocalActivo, traspasos: traspasosDelLocalActivo, traspasarStock, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto })','Traspasos, { productos: productosDelLocalActivo, traspasos: traspasosDelLocalActivo, traspasarStock, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo })','Traspasos: fichas local')

# Reportes render local.
ini=s.index('tab === "reportes"'); fin=s.index('tab === "resultados"',ini); b=s[ini:fin]
for viejo,nuevo,nombre in [
('      rotacionPorProducto,\n','      rotacionPorProducto: rotacionPorProductoDelLocalActivo,\n','Reportes rotacion'),
('      gastoPorProveedor,\n','      gastoPorProveedor: gastoPorProveedorDelLocalActivo,\n','Reportes gasto proveedor'),
('      productosSinMovimiento,\n','      productosSinMovimiento: productosSinMovimientoDelLocalActivo,\n','Reportes sin movimiento'),
('      valorInventario,\n','      valorInventario: valorInventarioDelLocalActivo,\n','Reportes valor inventario'),
('      margenPorProducto,\n','      margenPorProducto: margenPorProductoDelLocalActivo,\n','Reportes margen'),
('      patronesDesviacionConteo\n','      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo\n','Reportes desviaciones')]:
    b=uno(b,viejo,nuevo,nombre)
s=s[:ini]+b+s[fin:]

# Dashboard normal debe mostrar recordatorio del local activo cuando no está usando selector propietario.
# El Dashboard con selector sigue usando recordatorioConteoInforme; para el flujo normal el selector ya parte del local elegido.

# Guardas mínimas.
for requerido in [
'productos: productosDelLocalActivo, proveedorPorId',
'badge: pisoVentaBajoDelLocalActivo.length',
'diagnostico: diagnosticoStockDelLocalActivo',
'badge: descuadresPendientesDelLocalActivo',
'fichasCosto: fichasCostoDelLocalActivo',
'rotacionPorProducto: rotacionPorProductoDelLocalActivo',
'gastoPorProveedor: gastoPorProveedorDelLocalActivo',
'productosSinMovimiento: productosSinMovimientoDelLocalActivo',
'valorInventario: valorInventarioDelLocalActivo',
'margenPorProducto: margenPorProductoDelLocalActivo',
'patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo',
'const recordatorioConteoInforme = calcularRecordatorioConteo(conteosInforme',
'const deleteGastoInforme = (id) => deleteGasto(id, localInformeId || localActivoId || null);',
'El producto no pertenece al local activo.'
]: assert requerido in s, requerido

p.write_text(s,encoding='utf-8')
print('BLOQUE7A_GUARDAS_OK')
