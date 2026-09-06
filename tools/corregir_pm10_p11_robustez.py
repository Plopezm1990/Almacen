from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

# 1) Recepción: token estable de operación + caché inmediata contra doble ejecución.
old='function procesarRecepcion({ lineas, proveedorId, fecha, documentoTipo, documentoId, documentoNumero }) {'
new='function procesarRecepcion({ lineas, proveedorId, fecha, documentoTipo, documentoId, documentoNumero, operationId = null }) {\n    const operationIdRecepcionPM10 = operationId || `pm10-recepcion:${documentoTipo || "doc"}:${documentoId || documentoNumero || "sin-id"}`;\n    if (!procesarRecepcion._pm10Resultados) procesarRecepcion._pm10Resultados = /* @__PURE__ */ new Map();\n    const replayInmediatoPM10 = procesarRecepcion._pm10Resultados.get(operationIdRecepcionPM10);\n    if (replayInmediatoPM10) return { ...replayInmediatoPM10, replayed: true };'
if old in s:
    s=s.replace(old,new,1)
elif 'operationIdRecepcionPM10' not in s:
    raise SystemExit('No se encontró firma procesarRecepcion')

# forEach necesita índice para movimiento determinista.
s=s.replace('    lineas.forEach((ln2) => {','    lineas.forEach((ln2, idxRecepcionPM10) => {',1)

# Movimiento de producto existente: ID estable y operationId estable; respetar replay del motor.
old_mov='''        aplicarMovimientoStock({\n          productoId: prod.id,\n          cantidad: unidadesTotales,\n          tipo: "COMPRA",\n          movimientoId: uid(),\n          origen: "procesarRecepcion",'''
new_mov='''        const resultadoMovimientoPM10 = aplicarMovimientoStock({\n          productoId: prod.id,\n          cantidad: unidadesTotales,\n          tipo: "COMPRA",\n          operationId: operationIdRecepcionPM10,\n          movimientoId: `${operationIdRecepcionPM10}:linea:${idxRecepcionPM10}:producto:${prod.id}`,\n          origen: "procesarRecepcion",'''
if old_mov in s:
    s=s.replace(old_mov,new_mov,1)
elif 'resultadoMovimientoPM10 = aplicarMovimientoStock' not in s:
    raise SystemExit('No se encontró movimiento recepción existente')

# Evitar recalcular metadatos/coste en replay inmediato del movimiento.
old_cost='''        setProductos((s22) => s22.map(\n          (p22) => p22.id === prod.id ? {'''
new_cost='''        if (!resultadoMovimientoPM10.ok) return;\n        if (!resultadoMovimientoPM10.yaExistia) setProductos((s22) => s22.map(\n          (p22) => p22.id === prod.id ? {'''
if old_cost in s:
    s=s.replace(old_cost,new_cost,1)
elif 'if (!resultadoMovimientoPM10.yaExistia) setProductos' not in s:
    raise SystemExit('No se encontró setProductos recepción existente')

# Alta automática determinista: id estable y no duplicar en la misma operación.
old_auto='''        const nuevoId = uid();\n        const nuevo = {'''
new_auto='''        const nuevoId = `${operationIdRecepcionPM10}:producto-auto:${idxRecepcionPM10}`;\n        const nuevoYaCreadoPM10 = productos.find((p22) => p22.id === nuevoId);\n        const nuevo = nuevoYaCreadoPM10 || {'''
if old_auto in s:
    s=s.replace(old_auto,new_auto,1)
elif 'producto-auto:${idxRecepcionPM10}' not in s:
    raise SystemExit('No se encontró alta automática recepción')

old_auto_set='''        setProductos((s22) => [...s22, nuevo]);\n        setMovimientos((s22) => [\n          {\n            id: uid(),\n            operationId: uid(),'''
new_auto_set='''        if (!nuevoYaCreadoPM10) setProductos((s22) => s22.some((p22) => p22.id === nuevoId) ? s22 : [...s22, nuevo]);\n        setMovimientos((s22) => s22.some((m22) => m22.id === `${operationIdRecepcionPM10}:linea:${idxRecepcionPM10}:auto`) ? s22 : [\n          {\n            id: `${operationIdRecepcionPM10}:linea:${idxRecepcionPM10}:auto`,\n            operationId: operationIdRecepcionPM10,'''
if old_auto_set in s:
    s=s.replace(old_auto_set,new_auto_set,1)
elif 'operationIdRecepcionPM10}:linea:${idxRecepcionPM10}:auto' not in s:
    raise SystemExit('No se encontró set alta automática recepción')

# Guardar resultado de operación para replay inmediato.
old_ret='''    return { lineasResueltas, avisos };\n  }\n  function confirmarAlbaran(alb) {'''
new_ret='''    const resultadoRecepcionPM10 = { lineasResueltas, avisos, operationId: operationIdRecepcionPM10, replayed: false };\n    procesarRecepcion._pm10Resultados.set(operationIdRecepcionPM10, resultadoRecepcionPM10);\n    return resultadoRecepcionPM10;\n  }\n  function confirmarAlbaran(alb) {'''
if old_ret in s:
    s=s.replace(old_ret,new_ret,1)
elif 'resultadoRecepcionPM10' not in s:
    raise SystemExit('No se encontró retorno procesarRecepcion')

# Albarán: operación estable por id de albarán; si replay no reaplicar cantidad recibida.
old_call_alb='''      documentoId: alb.id,\n      documentoNumero: alb.numero\n    });\n    if (pedidoLigado) {\n      setPedidos((prev) => prev.map((pe2) => pe2.id === alb.pedidoId ? aplicarRecepcionPedidoPM10(pe2, lineasResueltas) : pe2));'''
new_call_alb='''      documentoId: alb.id,\n      documentoNumero: alb.numero,\n      operationId: `pm10-recepcion-albaran:${alb.id}`\n    });\n    if (pedidoLigado && !arguments[0]?._pm10Replay && !(procesarRecepcion._pm10Resultados?.get(`pm10-recepcion-albaran:${alb.id}`)?.replayed)) {\n      setPedidos((prev) => prev.map((pe2) => pe2.id === alb.pedidoId ? aplicarRecepcionPedidoPM10(pe2, lineasResueltas) : pe2));'''
# Do NOT use above awkward replay detection; replace more cleanly by destructuring replayed.
new_call_alb='''      documentoId: alb.id,\n      documentoNumero: alb.numero,\n      operationId: `pm10-recepcion-albaran:${alb.id}`\n    });\n    const replayedRecepcionPM10 = !!procesarRecepcion._pm10UltimoReplay;\n    if (pedidoLigado && !replayedRecepcionPM10) {\n      setPedidos((prev) => prev.map((pe2) => pe2.id === alb.pedidoId ? aplicarRecepcionPedidoPM10(pe2, lineasResueltas) : pe2));'''
# Instead alter proc cache to set a static flag before return.
# add flag on immediate replay and normal completion
s=s.replace('    if (replayInmediatoPM10) return { ...replayInmediatoPM10, replayed: true };','    if (replayInmediatoPM10) { procesarRecepcion._pm10UltimoReplay = true; return { ...replayInmediatoPM10, replayed: true }; }\n    procesarRecepcion._pm10UltimoReplay = false;',1)
if old_call_alb in s:
    s=s.replace(old_call_alb,new_call_alb,1)
elif 'operationId: `pm10-recepcion-albaran:${alb.id}`' not in s:
    raise SystemExit('No se encontró llamada albarán')

# Pedido directo: token estable por pedido + cantidades recibidas actuales; replay no vuelve a sumar.
old_call_ped='''      documentoId: pedido.id,\n      documentoNumero: pedido.id.slice(-6)\n    });\n    if (!resultado || !Array.isArray(resultado.lineasResueltas)) return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");\n    setPedidos((s22) => s22.map((pe2) => pe2.id === pedidoId ? aplicarRecepcionPedidoPM10(pe2, resultado.lineasResueltas) : pe2));'''
new_call_ped='''      documentoId: pedido.id,\n      documentoNumero: pedido.id.slice(-6),\n      operationId: `pm10-recepcion-pedido:${pedido.id}:${(pedido.items || []).map((it2) => `${it2.productoId}:${Number(it2.cantidadRecibida || 0)}`).join("|")}`\n    });\n    if (!resultado || !Array.isArray(resultado.lineasResueltas)) return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");\n    if (!resultado.replayed) setPedidos((s22) => s22.map((pe2) => pe2.id === pedidoId ? aplicarRecepcionPedidoPM10(pe2, resultado.lineasResueltas) : pe2));'''
if old_call_ped in s:
    s=s.replace(old_call_ped,new_call_ped,1)
elif 'pm10-recepcion-pedido:${pedido.id}' not in s:
    raise SystemExit('No se encontró llamada pedido directo')

# 2) Guardas UI contra doble clic: helper ref por componente y liberación solo tras fallo o pequeño timeout.
def add_ref(component_token, after_token, ref_name):
    global s
    a=s.find(component_token)
    if a<0: raise SystemExit(f'No componente {component_token}')
    b=s.find(after_token,a)
    if b<0: raise SystemExit(f'No token {after_token}')
    insert=f'  const {ref_name} = import_react4.default.useRef(false);\n'
    if ref_name not in s[a:b+len(after_token)+300]:
        s=s[:b]+insert+s[b:]

def guard_submit(component_token, next_component_token, ref_name, marker='function submit() {'):
    global s
    a=s.find(component_token); z=s.find(next_component_token,a)
    if a<0: raise SystemExit(component_token)
    if z<0: z=min(len(s),a+120000)
    seg=s[a:z]
    m=seg.find(marker)
    if m<0: raise SystemExit(f'{marker} en {component_token}')
    abs_m=a+m
    if f'if ({ref_name}.current) return;' not in seg:
        pos=abs_m+len(marker)
        s=s[:pos]+f'\n    if ({ref_name}.current) return;\n    {ref_name}.current = true;\n    setTimeout(() => {{ {ref_name}.current = false; }}, 750);'+s[pos:]

# Productos
add_ref('function Productos({','  const [showForm, setShowForm]','submitBloqueadoProductoPM10')
guard_submit('function Productos({','function Proveedores(','submitBloqueadoProductoPM10')
# Pedidos
add_ref('function Pedidos({','  const [showForm, setShowForm]','submitBloqueadoPedidoPM10')
guard_submit('function Pedidos({','function Recepcion(','submitBloqueadoPedidoPM10')
# Personal
add_ref('function Personal({','  const [showForm, setShowForm]','submitBloqueadoPersonalPM10')
guard_submit('function Personal({','function Turnos({','submitBloqueadoPersonalPM10')
# Encargos
add_ref('function Encargos({','  const [showForm, setShowForm]','submitBloqueadoEncargoPM10')
guard_submit('function Encargos({','function Clientes(','submitBloqueadoEncargoPM10')

# Recepción directa: Set por pedido en UI, se libera tras 900 ms.
a=s.find('function Recepcion({'); z=s.find('function ',a+30)
if a<0: raise SystemExit('Recepcion')
insert_token='  const [activos, setActivos] = (0, import_react4.useState)({});'
if 'recepcionesEnCursoPM10' not in s[a:a+5000]:
    pos=s.find(insert_token,a)+len(insert_token)
    s=s[:pos]+'\n  const recepcionesEnCursoPM10 = import_react4.default.useRef(/* @__PURE__ */ new Set());'+s[pos:]
needle='''      const porProducto = new Map();\n      pe2.items.forEach((it2) => {'''
repl='''      if (recepcionesEnCursoPM10.current.has(pe2.id)) return;\n      recepcionesEnCursoPM10.current.add(pe2.id);\n      setTimeout(() => recepcionesEnCursoPM10.current.delete(pe2.id), 900);\n      const porProducto = new Map();\n      pe2.items.forEach((it2) => {'''
# constrain replacement to Recepcion block; this occurrence should be unique from P06
ri=s.find(needle,a)
if ri>=0 and 'recepcionesEnCursoPM10.current.has(pe2.id)' not in s[a:a+30000]:
    s=s[:ri]+s[ri:].replace(needle,repl,1)
elif 'recepcionesEnCursoPM10.current.has(pe2.id)' not in s[a:a+30000]:
    raise SystemExit('No se encontró click recepción directa')

p.write_text(s,encoding='utf-8')
print('PM10 P11 robustez: patch aplicado')
