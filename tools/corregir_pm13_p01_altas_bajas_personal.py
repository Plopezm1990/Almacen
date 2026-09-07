from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

logic_ini = s.find('function crearLogicaPersonal({')
logic_fin = s.find('function crearLogicaTurnos({', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('PM13 P01: no se encontró crearLogicaPersonal')
segment = s[logic_ini:logic_fin]

# La primera fase P01 ya eliminó el borrado físico. No permitir regresión.
if 'setEmpleados((s22) => s22.filter((e22) => e22.id !== id))' in segment:
    raise SystemExit('PM13 P01: reapareció borrado físico de empleado')
if 'setNominas((s22) => s22.filter((n2) => n2.empleadoId !== id))' in segment:
    raise SystemExit('PM13 P01: reapareció borrado físico de nóminas')

# Helpers locales + adaptador remoto. En navegador con getSupabaseClient la RPC es
# autoritativa; en contratos aislados sin window se conserva el fallback histórico.
if 'async function ejecutarRpcPersonalPM13(' not in segment:
    anchor = '  const bajasRegistradasPersonalPM13 = new Set(empleados.filter((e2) => e2 && e2.activo === false).map((e2) => e2.id));\n'
    if anchor not in segment:
        raise SystemExit('PM13 P01: falta ancla de bajas lógicas')
    helpers = '''  const operacionesRemotasPersonalPM13 = new Map();\n  const motorPersonalRemotoDisponiblePM13 = () => typeof window !== \"undefined\" && typeof window.getSupabaseClient === \"function\";\n  async function ejecutarRpcPersonalPM13(nombre, args) {\n    if (!motorPersonalRemotoDisponiblePM13()) return { disponible: false, ok: true, data: null };\n    try {\n      const supabase = await window.getSupabaseClient();\n      if (!supabase || typeof supabase.rpc !== \"function\") return { disponible: true, ok: false, error: \"El motor remoto de Personal no está disponible.\" };\n      const { data, error } = await supabase.rpc(nombre, args);\n      if (error) return { disponible: true, ok: false, error: error.message || String(error) };\n      return { disponible: true, ok: true, data };\n    } catch (error) {\n      return { disponible: true, ok: false, error: error?.message || String(error) };\n    }\n  }\n  function ejecutarUnaVezPersonalPM13(clave, ejecutar) {\n    if (operacionesRemotasPersonalPM13.has(clave)) return operacionesRemotasPersonalPM13.get(clave);\n    const promesa = Promise.resolve().then(ejecutar).finally(() => operacionesRemotasPersonalPM13.delete(clave));\n    operacionesRemotasPersonalPM13.set(clave, promesa);\n    return promesa;\n  }\n  const errorBackendPersonalPM13 = (mensaje) => errorValidacionPM10(\"backend_personal\", \"personal\", mensaje || \"No se pudo confirmar la operación de Personal.\");\n'''
    segment = segment.replace(anchor, anchor + helpers, 1)

# Alta: identidad estable durante reintentos de UI, RPC primero y caché local después.
if 'async function addEmpleado(data, controlPM13 = {})' not in segment:
    pat = re.compile(r'  function addEmpleado\(data\) \{.*?\n  \}\n  async function crearCuentaEmpleado', re.S)
    new_add = '''  async function addEmpleado(data, controlPM13 = {}) {\n    const validacion = validarEmpleadoPM10(data, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    if (!localActivoId || !empresaId) return errorValidacionPM10(\"contexto_no_autorizado\", \"localId\", \"Personal requiere empresa y local concretos.\");\n    const empleadoId = String(controlPM13.empleadoId || uid());\n    const operationId = String(controlPM13.operationId || empleadoId);\n    const nuevo = {\n      documentos: [],\n      ...validacion.datos,\n      id: empleadoId,\n      localId: localActivoId,\n      activo: true,\n      fechaAlta: validacion.datos.fechaAlta || fechaHoyPersonalPM13(),\n      fechaBaja: \"\",\n      motivoBaja: \"\",\n      pm13AltaOperationId: operationId\n    };\n    const remoto = await ejecutarUnaVezPersonalPM13(`alta:${empresaId}:${localActivoId}:${empleadoId}`, () => ejecutarRpcPersonalPM13(\"pm11_alta_empleado\", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: empleadoId,\n      p_nombre: nuevo.nombre,\n      p_datos: nuevo\n    }));\n    if (remoto.disponible && !remoto.ok) return errorBackendPersonalPM13(remoto.error);\n    setEmpleados((s22) => s22.some((e2) => e2.id === empleadoId) ? s22 : [...s22, nuevo]);\n    return nuevo;\n  }\n  async function crearCuentaEmpleado'''
    segment, n = pat.subn(new_add, segment, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir addEmpleado a RPC')

# Edición: la RPC PM11 es autoritativa. Cambios de estado en navegador se hacen
# solo con las acciones dedicadas de baja/reactivación, para evitar dos escrituras parciales.
if 'async function updateEmpleado(id, data)' not in segment:
    pat = re.compile(r'  function updateEmpleado\(id, data\) \{.*?\n  \}\n  function deleteEmpleado', re.S)
    new_update = '''  async function updateEmpleado(id, data) {\n    const actual = empleados.find((e2) => e2.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId || !empresaId) return errorValidacionPM10(\"contexto_no_autorizado\", \"empleadoId\", \"El empleado no pertenece al local activo.\");\n    const validacion = validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    const dandoBaja = actual.activo !== false && validacion.datos.activo === false;\n    const reactivando = actual.activo === false && validacion.datos.activo === true;\n    if (motorPersonalRemotoDisponiblePM13() && (dandoBaja || reactivando)) {\n      return errorValidacionPM10(\"cambio_estado_dedicado\", \"activo\", dandoBaja ? \"Usa Dar de baja para cambiar el estado laboral.\" : \"Usa Reactivar para cambiar el estado laboral.\");\n    }\n    if (motorPersonalRemotoDisponiblePM13()) {\n      const remoto = await ejecutarUnaVezPersonalPM13(`editar:${empresaId}:${localActivoId}:${id}`, () => ejecutarRpcPersonalPM13(\"pm11_editar_empleado\", {\n        p_empresa_id: empresaId,\n        p_local_id: localActivoId,\n        p_empleado_id: id,\n        p_cambios: validacion.datos,\n        p_nombre: validacion.datos.nombre || actual.nombre\n      }));\n      if (!remoto.ok) return errorBackendPersonalPM13(remoto.error);\n      setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, id: e2.id, localId: e2.localId || localActivoId } : e2));\n      return true;\n    }\n    const cambiosEstado = dandoBaja ? {\n      fechaBaja: validacion.datos.fechaBaja || fechaHoyPersonalPM13(),\n      motivoBaja: String(validacion.datos.motivoBaja || \"Baja registrada desde edición\").trim() || \"Baja registrada desde edición\"\n    } : reactivando ? { fechaBaja: \"\", motivoBaja: \"\" } : {};\n    setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, ...cambiosEstado, id: e2.id, localId: e2.localId || localActivoId } : e2));\n    if (dandoBaja) {\n      bajasRegistradasPersonalPM13.add(id);\n      registrarAuditoria(\"Dar de baja empleado\", `${actual.nombre} \\xB7 ${cambiosEstado.fechaBaja} \\xB7 ${cambiosEstado.motivoBaja}`);\n    }\n    if (reactivando) {\n      bajasRegistradasPersonalPM13.delete(id);\n      registrarAuditoria(\"Reactivar empleado\", actual.nombre);\n    }\n    return true;\n  }\n  function deleteEmpleado'''
    segment, n = pat.subn(new_update, segment, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir updateEmpleado a RPC')

# Baja: nunca mutar caché antes de que backend confirme.
if 'async function deleteEmpleado(id, baja = {})' not in segment:
    pat = re.compile(r'  function deleteEmpleado\(id, baja = \{\}\) \{.*?\n  \}\n  function anonimizarEmpleado', re.S)
    new_delete = '''  async function deleteEmpleado(id, baja = {}) {\n    const e2 = empleados.find((x3) => x3.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId || !empresaId) return false;\n    const remotoDisponible = motorPersonalRemotoDisponiblePM13();\n    if (!remotoDisponible && (bajasRegistradasPersonalPM13.has(id) || e2.activo === false)) return true;\n    const fechaSistema = fechaHoyPersonalPM13();\n    const fechaBajaSolicitada = String(baja.fechaBaja || fechaSistema).trim() || fechaSistema;\n    const motivoBaja = String(baja.motivoBaja || baja.motivo || \"Baja registrada desde Personal\").trim() || \"Baja registrada desde Personal\";\n    const remoto = await ejecutarUnaVezPersonalPM13(`baja:${empresaId}:${localActivoId}:${id}`, () => ejecutarRpcPersonalPM13(\"pm11_baja_empleado\", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: id,\n      p_motivo: motivoBaja\n    }));\n    if (remoto.disponible && !remoto.ok) return errorBackendPersonalPM13(remoto.error);\n    const datosRemotos = remoto.data?.empleado?.datos || {};\n    const fechaBaja = remoto.disponible ? String(datosRemotos.fechaBaja || fechaBajaSolicitada) : fechaBajaSolicitada;\n    const motivoConfirmado = remoto.disponible ? String(datosRemotos.motivoBaja || motivoBaja) : motivoBaja;\n    setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: false, fechaBaja, motivoBaja: motivoConfirmado } : emp));\n    bajasRegistradasPersonalPM13.add(id);\n    if (!remoto.disponible) registrarAuditoria(\"Dar de baja empleado\", `${e2.nombre} \\xB7 ${fechaBaja || \"sin fecha\"} \\xB7 ${motivoConfirmado}`);\n    return true;\n  }\n  async function reactivarEmpleado(id) {\n    const e2 = empleados.find((x3) => x3.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId || !empresaId) return false;\n    const remotoDisponible = motorPersonalRemotoDisponiblePM13();\n    if (!remotoDisponible && e2.activo !== false) return true;\n    const remoto = await ejecutarUnaVezPersonalPM13(`reactivar:${empresaId}:${localActivoId}:${id}`, () => ejecutarRpcPersonalPM13(\"pm11_reactivar_empleado\", {\n      p_empresa_id: empresaId,\n      p_local_id: localActivoId,\n      p_empleado_id: id\n    }));\n    if (remoto.disponible && !remoto.ok) return errorBackendPersonalPM13(remoto.error);\n    setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: true, fechaBaja: \"\", motivoBaja: \"\" } : emp));\n    bajasRegistradasPersonalPM13.delete(id);\n    if (!remoto.disponible) registrarAuditoria(\"Reactivar empleado\", e2.nombre);\n    return true;\n  }\n  function anonimizarEmpleado'''
    segment, n = pat.subn(new_delete, segment, count=1)
    if n != 1:
        raise SystemExit('PM13 P01: no se pudo convertir baja a RPC')

# Exponer reactivación dedicada desde la misma lógica Personal.
segment = segment.replace(
    'return { addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado };',
    'return { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado };'
)
if 'return { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado,' not in segment:
    raise SystemExit('PM13 P01: reactivarEmpleado no quedó expuesto')

s = s[:logic_ini] + segment + s[logic_fin:]

# Conectar destructuring del App.
s = s.replace(
    'const { addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal(',
    'const { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal(',
    1
)

personal_ini = s.find('function Personal({')
personal_fin = s.find('function Turnos({', personal_ini)
if personal_ini < 0 or personal_fin < 0:
    raise SystemExit('PM13 P01: no se encontró componente Personal')
ui = s[personal_ini:personal_fin]

# Prop dedicada de reactivación.
ui = ui.replace(
    'function Personal({ empleados, addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado,',
    'function Personal({ empleados, addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado,',
    1
)

# Identidad estable de alta mientras la operación siga pendiente/error.
ref_anchor = '  const submitBloqueadoPersonalPM10 = import_react4.default.useRef(false);\n'
if 'altaOperacionPersonalPM13' not in ui:
    if ref_anchor not in ui:
        raise SystemExit('PM13 P01: no se encontró ref de submit Personal')
    ui = ui.replace(ref_anchor, ref_anchor + '  const altaOperacionPersonalPM13 = import_react4.default.useRef(null);\n', 1)

if 'function resetForm() {\n    altaOperacionPersonalPM13.current = null;' not in ui:
    ui = ui.replace('  function resetForm() {\n', '  function resetForm() {\n    altaOperacionPersonalPM13.current = null;\n', 1)

old_submit = '    const resultado = editingId ? updateEmpleado(editingId, datos) : addEmpleado(datos);'
if old_submit in ui:
    new_submit = '''    let controlAltaPersonalPM13 = void 0;\n    if (!editingId) {\n      if (!altaOperacionPersonalPM13.current) altaOperacionPersonalPM13.current = { empleadoId: uid(), operationId: uid() };\n      controlAltaPersonalPM13 = altaOperacionPersonalPM13.current;\n    }\n    const resultado = editingId ? await updateEmpleado(editingId, datos) : await addEmpleado(datos, controlAltaPersonalPM13);'''
    ui = ui.replace(old_submit, new_submit, 1)
elif 'await addEmpleado(datos, controlAltaPersonalPM13)' not in ui:
    raise SystemExit('PM13 P01: no se pudo conectar submit async')

# Un empleado inactivo no se edita como atajo de reactivación: acción explícita.
edit_btn = '/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: \"ghost\", onClick: () => openEdit(e2) }, \"Editar\"),'
if 'reactivarEmpleado(e2.id)' not in ui and edit_btn in ui:
    repl = '''e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: \"ghost\", onClick: () => openEdit(e2) }, \"Editar\"), e2.activo === false && reactivarEmpleado && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: \"ghost\", onClick: async () => {\n    const r2 = await reactivarEmpleado(e2.id);\n    if (!r2 || r2.ok === false) setError(r2?.error || \"No se pudo reactivar al empleado.\");\n  } }, \"Reactivar\"),'''
    ui = ui.replace(edit_btn, repl, 1)

# La baja modal espera confirmación remota antes de cerrar.
old_delete_click = '''/* @__PURE__ */ import_react4.default.createElement(Btn, { variant: \"danger\", onClick: () => {\n    deleteEmpleado(confirmDeleteId);\n    setConfirmDeleteId(null);\n  } }, \"Dar de baja\")'''
if old_delete_click in ui:
    new_delete_click = '''/* @__PURE__ */ import_react4.default.createElement(Btn, { variant: \"danger\", onClick: async () => {\n    const r2 = await deleteEmpleado(confirmDeleteId);\n    if (!r2 || r2.ok === false) {\n      setError(r2?.error || \"No se pudo confirmar la baja del empleado.\");\n      return;\n    }\n    setConfirmDeleteId(null);\n  } }, \"Dar de baja\")'''
    ui = ui.replace(old_delete_click, new_delete_click, 1)
elif 'await deleteEmpleado(confirmDeleteId)' not in ui:
    raise SystemExit('PM13 P01: modal de baja no quedó async')

# La anonimización tiene un RPC PM11 distinto y no forma parte de P01. Quitar el
# atajo local del modal de baja para que no borre datos fuera del motor remoto.
ui = re.sub(
    r'anonimizarEmpleado && /\* @__PURE__ \*/ import_react4\.default\.createElement\(Btn, \{ onClick: \(\) => \{\n\s*anonimizarEmpleado\(confirmDeleteId\);\n\s*setConfirmDeleteId\(null\);\n\s*\} \}, \"Anonimizar datos\"\),\s*',
    '',
    ui,
    count=1
)

# Etiquetas y trazabilidad de la primera fase P01 deben mantenerse.
ui = ui.replace('aria-label: \"Eliminar empleado\"', 'aria-label: \"Dar de baja empleado\"')
ui = ui.replace('title: \"Eliminar empleado\"', 'title: \"Dar de baja empleado\"')
ui = ui.replace('\"Eliminar del todo\"', '\"Dar de baja\"')
if 'Eliminar del todo' in ui or 'Se borra la ficha completa' in ui:
    raise SystemExit('PM13 P01: reapareció UI destructiva')

s = s[:personal_ini] + ui + s[personal_fin:]

# Pasar reactivación al componente Personal. Limitar reemplazo al bloque de props
# reconocido para no tocar otros módulos.
if 'reactivarEmpleado,\n      anonimizarEmpleado,' not in s:
    props_anchor = '      deleteEmpleado,\n      anonimizarEmpleado,\n'
    if props_anchor not in s:
        raise SystemExit('PM13 P01: no se encontró props Personal')
    s = s.replace(props_anchor, '      deleteEmpleado,\n      reactivarEmpleado,\n      anonimizarEmpleado,\n', 1)

# Barreras estáticas finales.
logic_ini = s.find('function crearLogicaPersonal({')
logic_fin = s.find('function crearLogicaTurnos({', logic_ini)
final_logic = s[logic_ini:logic_fin]
for rpc in ('pm11_alta_empleado', 'pm11_editar_empleado', 'pm11_baja_empleado', 'pm11_reactivar_empleado'):
    if rpc not in final_logic:
        raise SystemExit(f'PM13 P01: falta RPC {rpc}')
if 'setEmpleados((s22) => s22.filter' in final_logic or 'setNominas((s22) => s22.filter' in final_logic:
    raise SystemExit('PM13 P01: detectado borrado físico final')

p.write_text(s, encoding='utf-8')
print('PM13 P01: frontend conectado al ciclo PM11 con RPC autoritativa y fallback aislado')
