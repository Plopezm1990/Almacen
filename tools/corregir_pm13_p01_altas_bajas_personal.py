from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

logic_ini = s.find('function crearLogicaPersonal({')
logic_fin = s.find('function crearLogicaTurnos({', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('PM13 P01: no se encontró crearLogicaPersonal')
x = s[logic_ini:logic_fin]

# Barreras heredadas de la primera fase P01.
if 'setEmpleados((s22) => s22.filter((e22) => e22.id !== id))' in x:
    raise SystemExit('PM13 P01: reapareció borrado físico de empleado')
if 'setNominas((s22) => s22.filter((n2) => n2.empleadoId !== id))' in x:
    raise SystemExit('PM13 P01: reapareció borrado físico de nóminas')

# Helpers de RPC y coalescing de operaciones concurrentes.
if 'async function ejecutarRpcPersonalPM13(' not in x:
    anchor = '  const bajasRegistradasPersonalPM13 = new Set(empleados.filter((e2) => e2 && e2.activo === false).map((e2) => e2.id));\n'
    if anchor not in x:
        raise SystemExit('PM13 P01: falta ancla de bajas lógicas')
    helpers = '''  const operacionesRemotasPersonalPM13 = new Map();\n  const motorPersonalRemotoDisponiblePM13 = () => typeof window !== "undefined" && typeof window.getSupabaseClient === "function";\n  async function ejecutarRpcPersonalPM13(nombre, args) {\n    if (!motorPersonalRemotoDisponiblePM13()) return { disponible: false, ok: true, data: null };\n    try {\n      const supabase = await window.getSupabaseClient();\n      if (!supabase || typeof supabase.rpc !== "function") return { disponible: true, ok: false, error: "El motor remoto de Personal no está disponible." };\n      const { data, error } = await supabase.rpc(nombre, args);\n      if (error) return { disponible: true, ok: false, error: error.message || String(error) };\n      return { disponible: true, ok: true, data };\n    } catch (error) {\n      return { disponible: true, ok: false, error: error?.message || String(error) };\n    }\n  }\n  function ejecutarUnaVezPersonalPM13(clave, ejecutar) {\n    if (operacionesRemotasPersonalPM13.has(clave)) return operacionesRemotasPersonalPM13.get(clave);\n    const promesa = Promise.resolve().then(ejecutar).finally(() => operacionesRemotasPersonalPM13.delete(clave));\n    operacionesRemotasPersonalPM13.set(clave, promesa);\n    return promesa;\n  }\n  const errorBackendPersonalPM13 = (mensaje) => errorValidacionPM10("backend_personal", "personal", mensaje || "No se pudo confirmar la operación de Personal.");\n'''
    x = x.replace(anchor, anchor + helpers, 1)

# Alta híbrida: síncrona sin backend; RPC autoritativa en navegador.
if 'function addEmpleado(data, controlPM13 = {})' not in x:
    pat = re.compile(r'  function addEmpleado\(data\) \{.*?\n  \}\n  async function crearCuentaEmpleado', re.S)
    nuevo = '''  function addEmpleado(data, controlPM13 = {}) {\n    const validacion = validarEmpleadoPM10(data, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    if (!localActivoId || !empresaId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Personal requiere empresa y local concretos.");\n    const empleadoId = String(controlPM13.empleadoId || uid());\n    const operationId = String(controlPM13.operationId || empleadoId);\n    const nuevo = {\n      documentos: [],\n      ...validacion.datos,\n      id: empleadoId,\n      localId: localActivoId,\n      activo: true,\n      fechaAlta: validacion.datos.fechaAlta || fechaHoyPersonalPM13(),\n      fechaBaja: "",\n      motivoBaja: "",\n      pm13AltaOperationId: operationId\n    };\n    const aplicarLocal = () => {\n      setEmpleados((s22) => s22.some((e2) => e2.id === empleadoId) ? s22 : [...s22, nuevo]);\n      return nuevo;\n    };\n    if (!motorPersonalRemotoDisponiblePM13()) return aplicarLocal();\n    return ejecutarUnaVezPersonalPM13(`alta:${empresaId}:${localActivoId}:${empleadoId}`, () => ejecutarRpcPersonalPM13("pm11_alta_empleado", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: empleadoId,\n      p_nombre: nuevo.nombre,\n      p_datos: nuevo\n    })).then((remoto) => remoto.ok ? aplicarLocal() : errorBackendPersonalPM13(remoto.error));\n  }\n  async function crearCuentaEmpleado'''
    x, n = pat.subn(lambda _m: nuevo, x, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir addEmpleado')

# Edición híbrida. En navegador, los cambios de estado usan RPC dedicada.
if 'function updateEmpleado(id, data)' not in x or 'pm11_editar_empleado' not in x:
    pat = re.compile(r'  function updateEmpleado\(id, data\) \{.*?\n  \}\n  function deleteEmpleado', re.S)
    nuevo = '''  function updateEmpleado(id, data) {\n    const actual = empleados.find((e2) => e2.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId || !empresaId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");\n    const validacion = validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    const dandoBaja = actual.activo !== false && validacion.datos.activo === false;\n    const reactivando = actual.activo === false && validacion.datos.activo === true;\n    if (!motorPersonalRemotoDisponiblePM13()) {\n      const cambiosEstado = dandoBaja ? {\n        fechaBaja: validacion.datos.fechaBaja || fechaHoyPersonalPM13(),\n        motivoBaja: String(validacion.datos.motivoBaja || "Baja registrada desde edición").trim() || "Baja registrada desde edición"\n      } : reactivando ? { fechaBaja: "", motivoBaja: "" } : {};\n      setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, ...cambiosEstado, id: e2.id, localId: e2.localId || localActivoId } : e2));\n      if (dandoBaja) {\n        bajasRegistradasPersonalPM13.add(id);\n        registrarAuditoria("Dar de baja empleado", `${actual.nombre} \\xB7 ${cambiosEstado.fechaBaja} \\xB7 ${cambiosEstado.motivoBaja}`);\n      }\n      if (reactivando) {\n        bajasRegistradasPersonalPM13.delete(id);\n        registrarAuditoria("Reactivar empleado", actual.nombre);\n      }\n      return true;\n    }\n    if (dandoBaja || reactivando) {\n      return errorValidacionPM10("cambio_estado_dedicado", "activo", dandoBaja ? "Usa Dar de baja para cambiar el estado laboral." : "Usa Reactivar para cambiar el estado laboral.");\n    }\n    return ejecutarUnaVezPersonalPM13(`editar:${empresaId}:${localActivoId}:${id}`, () => ejecutarRpcPersonalPM13("pm11_editar_empleado", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: id,\n      p_cambios: validacion.datos,\n      p_nombre: validacion.datos.nombre || actual.nombre\n    })).then((remoto) => {\n      if (!remoto.ok) return errorBackendPersonalPM13(remoto.error);\n      setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, id: e2.id, localId: e2.localId || localActivoId } : e2));\n      return true;\n    });\n  }\n  function deleteEmpleado'''
    x, n = pat.subn(lambda _m: nuevo, x, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir updateEmpleado')

# Baja y reactivación híbridas: caché local solo después del éxito remoto.
if 'function reactivarEmpleado(id)' not in x:
    pat = re.compile(r'  function deleteEmpleado\(id, baja = \{\}\) \{.*?\n  \}\n  function anonimizarEmpleado', re.S)
    nuevo = '''  function deleteEmpleado(id, baja = {}) {\n    const e2 = empleados.find((x3) => x3.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId || !empresaId) return false;\n    const fechaSistema = fechaHoyPersonalPM13();\n    const fechaBajaSolicitada = String(baja.fechaBaja || fechaSistema).trim() || fechaSistema;\n    const motivoBaja = String(baja.motivoBaja || baja.motivo || "Baja registrada desde Personal").trim() || "Baja registrada desde Personal";\n    if (!motorPersonalRemotoDisponiblePM13()) {\n      if (bajasRegistradasPersonalPM13.has(id) || e2.activo === false) return true;\n      setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: false, fechaBaja: fechaBajaSolicitada, motivoBaja } : emp));\n      bajasRegistradasPersonalPM13.add(id);\n      registrarAuditoria("Dar de baja empleado", `${e2.nombre} \\xB7 ${fechaBajaSolicitada || "sin fecha"} \\xB7 ${motivoBaja}`);\n      return true;\n    }\n    return ejecutarUnaVezPersonalPM13(`baja:${empresaId}:${localActivoId}:${id}`, () => ejecutarRpcPersonalPM13("pm11_baja_empleado", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: id,\n      p_motivo: motivoBaja\n    })).then((remoto) => {\n      if (!remoto.ok) return errorBackendPersonalPM13(remoto.error);\n      const datosRemotos = remoto.data?.empleado?.datos || {};\n      const fechaBaja = String(datosRemotos.fechaBaja || fechaBajaSolicitada);\n      const motivoConfirmado = String(datosRemotos.motivoBaja || motivoBaja);\n      setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: false, fechaBaja, motivoBaja: motivoConfirmado } : emp));\n      bajasRegistradasPersonalPM13.add(id);\n      return true;\n    });\n  }\n  function reactivarEmpleado(id) {\n    const e2 = empleados.find((x3) => x3.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId || !empresaId) return false;\n    if (!motorPersonalRemotoDisponiblePM13()) {\n      if (e2.activo !== false) return true;\n      setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: true, fechaBaja: "", motivoBaja: "" } : emp));\n      bajasRegistradasPersonalPM13.delete(id);\n      registrarAuditoria("Reactivar empleado", e2.nombre);\n      return true;\n    }\n    return ejecutarUnaVezPersonalPM13(`reactivar:${empresaId}:${localActivoId}:${id}`, () => ejecutarRpcPersonalPM13("pm11_reactivar_empleado", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: id\n    })).then((remoto) => {\n      if (!remoto.ok) return errorBackendPersonalPM13(remoto.error);\n      setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: true, fechaBaja: "", motivoBaja: "" } : emp));\n      bajasRegistradasPersonalPM13.delete(id);\n      return true;\n    });\n  }\n  function anonimizarEmpleado'''
    x, n = pat.subn(lambda _m: nuevo, x, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir baja/reactivación')

x = x.replace(
    'return { addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado };',
    'return { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado };'
)
if 'return { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado,' not in x:
    raise SystemExit('PM13 P01: reactivarEmpleado no quedó expuesto')

s = s[:logic_ini] + x + s[logic_fin:]

# Destructuring del App.
s = s.replace(
    'const { addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal(',
    'const { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal(',
    1
)

# UI Personal.
ui_ini = s.find('function Personal({')
ui_fin = s.find('function Turnos({', ui_ini)
if ui_ini < 0 or ui_fin < 0:
    raise SystemExit('PM13 P01: no se encontró componente Personal')
ui = s[ui_ini:ui_fin]
ui = ui.replace(
    'function Personal({ empleados, addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado,',
    'function Personal({ empleados, addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado,',
    1
)

ref_anchor = '  const submitBloqueadoPersonalPM10 = import_react4.default.useRef(false);\n'
if 'altaOperacionPersonalPM13' not in ui:
    if ref_anchor not in ui:
        raise SystemExit('PM13 P01: no se encontró ref de submit')
    ui = ui.replace(ref_anchor, ref_anchor + '  const altaOperacionPersonalPM13 = import_react4.default.useRef(null);\n', 1)
if 'function resetForm() {\n    altaOperacionPersonalPM13.current = null;' not in ui:
    ui = ui.replace('  function resetForm() {\n', '  function resetForm() {\n    altaOperacionPersonalPM13.current = null;\n', 1)

old_submit = '    const resultado = editingId ? updateEmpleado(editingId, datos) : addEmpleado(datos);'
if old_submit in ui:
    nuevo_submit = '''    let controlAltaPersonalPM13 = void 0;\n    if (!editingId) {\n      if (!altaOperacionPersonalPM13.current) altaOperacionPersonalPM13.current = { empleadoId: uid(), operationId: uid() };\n      controlAltaPersonalPM13 = altaOperacionPersonalPM13.current;\n    }\n    const resultado = editingId ? await updateEmpleado(editingId, datos) : await addEmpleado(datos, controlAltaPersonalPM13);'''
    ui = ui.replace(old_submit, nuevo_submit, 1)
elif 'await addEmpleado(datos, controlAltaPersonalPM13)' not in ui:
    raise SystemExit('PM13 P01: submit no quedó conectado')

# Edición solo para activos y reactivación explícita para inactivos.
edit_btn = '/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => openEdit(e2) }, "Editar"),'
if 'await reactivarEmpleado(e2.id)' not in ui:
    if edit_btn not in ui:
        raise SystemExit('PM13 P01: no se encontró botón Editar')
    repl = '''e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => openEdit(e2) }, "Editar"), e2.activo === false && reactivarEmpleado && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: async () => {\n    const r2 = await reactivarEmpleado(e2.id);\n    if (!r2 || r2.ok === false) setError(r2?.error || "No se pudo reactivar al empleado.");\n  } }, "Reactivar"),'''
    ui = ui.replace(edit_btn, repl, 1)

# Baja espera confirmación remota antes de cerrar el modal.
pat = re.compile(r'/\* @__PURE__ \*/ import_react4\.default\.createElement\(Btn, \{ variant: "danger", onClick: \(\) => \{\n\s*deleteEmpleado\(confirmDeleteId\);\n\s*setConfirmDeleteId\(null\);\n\s*\} \}, "Dar de baja"\)')
if 'await deleteEmpleado(confirmDeleteId)' not in ui:
    repl = '''/* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: async () => {\n    const r2 = await deleteEmpleado(confirmDeleteId);\n    if (!r2 || r2.ok === false) {\n      setError(r2?.error || "No se pudo confirmar la baja del empleado.");\n      return;\n    }\n    setConfirmDeleteId(null);\n  } }, "Dar de baja")'''
    ui, n = pat.subn(lambda _m: repl, ui, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir modal de baja')

# Anonimización local no forma parte del flujo de baja P01.
ui = re.sub(
    r'anonimizarEmpleado && /\* @__PURE__ \*/ import_react4\.default\.createElement\(Btn, \{ onClick: \(\) => \{\n\s*anonimizarEmpleado\(confirmDeleteId\);\n\s*setConfirmDeleteId\(null\);\n\s*\} \}, "Anonimizar datos"\),\s*',
    lambda _m: '',
    ui,
    count=1
)

if 'Eliminar del todo' in ui or 'Se borra la ficha completa' in ui:
    raise SystemExit('PM13 P01: reapareció UI destructiva')
s = s[:ui_ini] + ui + s[ui_fin:]

# Prop de reactivación al componente.
if 'reactivarEmpleado,\n      anonimizarEmpleado,' not in s:
    anchor = '      deleteEmpleado,\n      anonimizarEmpleado,\n'
    if anchor not in s:
        raise SystemExit('PM13 P01: no se encontró props Personal')
    s = s.replace(anchor, '      deleteEmpleado,\n      reactivarEmpleado,\n      anonimizarEmpleado,\n', 1)

# Verificación final.
a = s.find('function crearLogicaPersonal({')
b = s.find('function crearLogicaTurnos({', a)
final = s[a:b]
for rpc in ('pm11_alta_empleado', 'pm11_editar_empleado', 'pm11_baja_empleado', 'pm11_reactivar_empleado'):
    if rpc not in final:
        raise SystemExit(f'PM13 P01: falta RPC {rpc}')
if 'setEmpleados((s22) => s22.filter' in final or 'setNominas((s22) => s22.filter' in final:
    raise SystemExit('PM13 P01: detectado borrado físico final')

p.write_text(s, encoding='utf-8')
print('PM13 P01: adaptador híbrido PM11 aplicado')
