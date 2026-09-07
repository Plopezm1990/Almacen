from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# Helper común: toda escritura local exige un local concreto, existente y operable.
if 'function validarContextoEscrituraPM10(' not in s:
    pos = s.find('function validarProductoPM10(')
    if pos < 0:
        raise SystemExit('No se encontró validarProductoPM10')
    helper = r'''function validarContextoEscrituraPM10({ localActivoId = null, locales = [], empresaId = null } = {}) {
  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para realizar esta operación.");
  if (Array.isArray(locales) && locales.length) {
    const local = locales.find((l22) => l22 && l22.id === localActivoId) || null;
    if (!local) return errorValidacionPM10("referencia_inexistente", "localId", "El local seleccionado ya no existe.");
    if (local.activo === false || local.fusionadoEn) return errorValidacionPM10("local_inactivo", "localId", "El local seleccionado no admite nuevas operaciones.");
    if (empresaId && local.empresaId && local.empresaId !== empresaId) return errorValidacionPM10("referencia_otro_contexto", "localId", "El local seleccionado pertenece a otra empresa.");
    return { ok: true, local };
  }
  return { ok: true, local: null };
}
'''
    s = s[:pos] + helper + s[pos:]

# Productos: mantener el contrato P04, pero exigir contexto antes de mutar.
s = s.replace(
    'function crearLogicaProductos({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, almacenCongelado, addGasto, localActivoId }) {',
    'function crearLogicaProductos({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, almacenCongelado, addGasto, localActivoId, locales = [] }) {',
    1
)
old = '''  function addProducto(data) {\n    const validacion = validarProductoPM10(data, { parcial: false });\n    if (!validacion.ok) return validacion;\n    const datosValidos = validacion.datos;'''
new = '''  function addProducto(data) {\n    const validacion = validarProductoPM10(data, { parcial: false });\n    if (!validacion.ok) return validacion;\n    const contexto = validarContextoEscrituraPM10({ localActivoId, locales });\n    if (!contexto.ok) return contexto;\n    const datosValidos = validacion.datos;'''
if old in s:
    s = s.replace(old, new, 1)
elif 'const contexto = validarContextoEscrituraPM10({ localActivoId, locales });' not in s[s.find('function addProducto'):s.find('function updateProducto')]:
    raise SystemExit('No se pudo endurecer addProducto')

upd = s.find('  function updateProducto(id, data) {')
if upd < 0:
    raise SystemExit('No se encontró updateProducto')
needle = '  function updateProducto(id, data) {\n    const anterior = productos.find((p22) => p22.id === id);'
replacement = '  function updateProducto(id, data) {\n    const contexto = validarContextoEscrituraPM10({ localActivoId, locales });\n    if (!contexto.ok) return contexto;\n    const anterior = productos.find((p22) => p22.id === id);'
if needle in s:
    s = s.replace(needle, replacement, 1)

# Pedidos: contexto operable + proveedor de la misma empresa cuando la referencia lo explicita.
s = s.replace(
    'function validarPedidoPM10(data, { pedidoActual = null, proveedores = [], productos = [], localActivoId = null } = {}) {',
    'function validarPedidoPM10(data, { pedidoActual = null, proveedores = [], productos = [], localActivoId = null, locales = [], empresaId = null } = {}) {',
    1
)
old = '''  const entrada = data && typeof data === "object" ? data : {};\n  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para guardar el pedido.");'''
new = '''  const entrada = data && typeof data === "object" ? data : {};\n  const contexto = validarContextoEscrituraPM10({ localActivoId, locales, empresaId });\n  if (!contexto.ok) return contexto;'''
# Solo dentro de validarPedido.
ped0 = s.find('function validarPedidoPM10(')
ped1 = s.find('function unidadesRecepcionLineaPM10(', ped0)
seg = s[ped0:ped1]
if old in seg:
    seg = seg.replace(old, new, 1)
prov_needle = '  if (!proveedor) return errorValidacionPM10("referencia_inexistente", "proveedorId", "El proveedor no existe en el contexto autorizado.");'
prov_replace = prov_needle + '\n  if (empresaId && proveedor.empresaId && proveedor.empresaId !== empresaId) return errorValidacionPM10("referencia_otro_contexto", "proveedorId", "El proveedor pertenece a otra empresa.");'
if prov_needle in seg and 'El proveedor pertenece a otra empresa.' not in seg:
    seg = seg.replace(prov_needle, prov_replace, 1)
s = s[:ped0] + seg + s[ped1:]

s = s.replace(
    'function crearLogicaPedidos({ pedidos, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId }) {',
    'function crearLogicaPedidos({ pedidos, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId, locales = [], empresaId = null }) {',
    1
)
s = s.replace('validarPedidoPM10(data, { proveedores, productos, localActivoId })', 'validarPedidoPM10(data, { proveedores, productos, localActivoId, locales, empresaId })')
s = s.replace('validarPedidoPM10(data, { pedidoActual: actual, proveedores, productos, localActivoId })', 'validarPedidoPM10(data, { pedidoActual: actual, proveedores, productos, localActivoId, locales, empresaId })')

# Recepción: el pedido puede ser coherente pero un local inactivo no admite una nueva entrada.
s = s.replace(
    'function validarRecepcionPedidoPM10({ pedido, lineas, productos = [], localActivoId = null, modo = "directo" } = {}) {',
    'function validarRecepcionPedidoPM10({ pedido, lineas, productos = [], localActivoId = null, locales = [], empresaId = null, modo = "directo" } = {}) {',
    1
)
rec0 = s.find('function validarRecepcionPedidoPM10(')
rec1 = s.find('function aplicarRecepcionPedidoPM10(', rec0)
seg = s[rec0:rec1]
old = '  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para recibir mercancía.");'
new = '  const contexto = validarContextoEscrituraPM10({ localActivoId, locales, empresaId });\n  if (!contexto.ok) return contexto;'
if old in seg:
    seg = seg.replace(old, new, 1)
s = s[:rec0] + seg + s[rec1:]
s = s.replace('validarRecepcionPedidoPM10({ pedido, lineas, productos, localActivoId, modo: "directo" })', 'validarRecepcionPedidoPM10({ pedido, lineas, productos, localActivoId, locales, empresaId, modo: "directo" })')
s = s.replace('validarRecepcionPedidoPM10({ pedido: pedidoLigado, lineas: alb.lineas, productos, localActivoId, modo: "albaran" })', 'validarRecepcionPedidoPM10({ pedido: pedidoLigado, lineas: alb.lineas, productos, localActivoId, locales, empresaId, modo: "albaran" })')

# Personal.
s = s.replace(
    'function validarEmpleadoPM10(data, { localActivoId = null } = {}) {',
    'function validarEmpleadoPM10(data, { localActivoId = null, locales = [], empresaId = null } = {}) {',
    1
)
emp0 = s.find('function validarEmpleadoPM10(')
emp1 = s.find('function crearLogicaPersonal(', emp0)
seg = s[emp0:emp1]
old = '  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para modificar personal.");'
new = '  const contexto = validarContextoEscrituraPM10({ localActivoId, locales, empresaId });\n  if (!contexto.ok) return contexto;'
if old in seg:
    seg = seg.replace(old, new, 1)
s = s[:emp0] + seg + s[emp1:]
s = s.replace(
    'function crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId }) {',
    'function crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId, locales = [], empresaId = null }) {',
    1
)
s = s.replace('validarEmpleadoPM10(data, { localActivoId })', 'validarEmpleadoPM10(data, { localActivoId, locales, empresaId })')
s = s.replace('validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId })', 'validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId, locales, empresaId })')

# Encargos.
s = s.replace(
    'function validarEncargoPM10(data, { productos = [], clientes = [], localActivoId = null, empresaId = null, fechaCreacion = null } = {}) {',
    'function validarEncargoPM10(data, { productos = [], clientes = [], localActivoId = null, locales = [], empresaId = null, fechaCreacion = null } = {}) {',
    1
)
enc0 = s.find('function validarEncargoPM10(')
enc1 = s.find('function crearLogicaEncargos(', enc0)
seg = s[enc0:enc1]
old = '  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para guardar el encargo.");'
new = '  const contexto = validarContextoEscrituraPM10({ localActivoId, locales, empresaId });\n  if (!contexto.ok) return contexto;'
if old in seg:
    seg = seg.replace(old, new, 1)
s = s[:enc0] + seg + s[enc1:]
s = s.replace(
    'function crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes = [], setProductos, setMovimientos, venderLineas, localActivoId, empresaId = null }) {',
    'function crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes = [], setProductos, setMovimientos, venderLineas, localActivoId, empresaId = null, locales = [] }) {',
    1
)
s = s.replace('validarEncargoPM10(data, { productos, clientes, localActivoId, empresaId, fechaCreacion: fecha })', 'validarEncargoPM10(data, { productos, clientes, localActivoId, locales, empresaId, fechaCreacion: fecha })')
s = s.replace('validarEncargoPM10(candidato, { productos, clientes, localActivoId, empresaId, fechaCreacion: actual.fechaCreacion || todayISO() })', 'validarEncargoPM10(candidato, { productos, clientes, localActivoId, locales, empresaId, fechaCreacion: actual.fechaCreacion || todayISO() })')

# Albaranes ligados o directos también deben respetar local operable.
alb0 = s.find('function crearLogicaAlbaranes({')
alb1 = s.find('function crearLogicaRespaldos', alb0)
if alb0 < 0 or alb1 < 0:
    raise SystemExit('No se encontró crearLogicaAlbaranes')
seg = s[alb0:alb1]
if '  locales = [],\n' not in seg[:1500]:
    seg = seg.replace('  localActivoId,\n  empresaId,', '  localActivoId,\n  locales = [],\n  empresaId,', 1)
needle = '  function confirmarAlbaran(alb) {\n    if (!albaranEsDelLocalActivo(alb, true))'
repl = '  function confirmarAlbaran(alb) {\n    const contexto = validarContextoEscrituraPM10({ localActivoId, locales, empresaId });\n    if (!contexto.ok) return contexto;\n    if (!albaranEsDelLocalActivo(alb, true))'
if needle in seg:
    seg = seg.replace(needle, repl, 1)
s = s[:alb0] + seg + s[alb1:]

# Selector de local: nunca deja como activo un local inactivo/fusionado; si se desactiva el actual, se limpia.
loc0 = s.find('function crearLogicaLocales({')
loc1 = s.find('function crearLogica', loc0 + 30)
if loc0 < 0:
    raise SystemExit('No se encontró crearLogicaLocales')
if loc1 < 0:
    loc1 = loc0 + 5000
seg = s[loc0:loc1]
old = '''  function desactivarLocal(id) {\n    const l22 = locales.find((x3) => x3.id === id);\n    setLocales((s22) => s22.map((x3) => x3.id === id ? { ...x3, activo: false } : x3));\n    registrarAuditoria("Desactivar local", l22 ? l22.nombre : id);\n  }'''
new = '''  function desactivarLocal(id) {\n    const l22 = locales.find((x3) => x3.id === id);\n    setLocales((s22) => s22.map((x3) => x3.id === id ? { ...x3, activo: false } : x3));\n    if (id === localActivoId) setLocalActivoId(null);\n    registrarAuditoria("Desactivar local", l22 ? l22.nombre : id);\n  }'''
if old in seg:
    seg = seg.replace(old, new, 1)
old = '''  function cambiarLocalActivo(id) {\n    if (!locales.some((l22) => l22.id === id)) return;\n    setLocalActivoId(id);\n  }'''
new = '''  function cambiarLocalActivo(id) {\n    const local = locales.find((l22) => l22.id === id);\n    if (!local || local.activo === false || local.fusionadoEn) return false;\n    setLocalActivoId(id);\n    return true;\n  }'''
if old in seg:
    seg = seg.replace(old, new, 1)
s = s[:loc0] + seg + s[loc1:]

# Wiring App: pasar locals y empresa activa a las fronteras PM10.
s = s.replace('crearLogicaProductos({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, almacenCongelado, addGasto, localActivoId })', 'crearLogicaProductos({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, almacenCongelado, addGasto, localActivoId, locales })', 1)
s = s.replace('crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId })', 'crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId, locales, empresaId: empresaDelLocalActivo?.id || null })', 1)
s = s.replace('crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId })', 'crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId, locales, empresaId: empresaDelLocalActivo?.id || null })', 1)
s = s.replace('crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes, setProductos, setMovimientos, venderLineas, localActivoId, empresaId: empresaDelLocalActivo?.id || null })', 'crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes, setProductos, setMovimientos, venderLineas, localActivoId, empresaId: empresaDelLocalActivo?.id || null, locales })', 1)
# Llamada multilínea Albaranes: inserción única tras localActivoId.
call0 = s.find('crearLogicaAlbaranes({')
call1 = s.find('  });', call0)
if call0 >= 0 and call1 > call0:
    call = s[call0:call1]
    if '\n    locales,\n    empresaId:' not in call:
        call = call.replace('\n    localActivoId,\n    empresaId:', '\n    localActivoId,\n    locales,\n    empresaId:', 1)
        s = s[:call0] + call + s[call1:]

p.write_text(s, encoding='utf-8')
print('PM10 P13 aislamiento contexto: patch aplicado/idempotente')
