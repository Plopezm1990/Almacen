from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# PM13-P01: el alta debe nacer activa y con identidad temporal explícita.
old_add = '''  function addEmpleado(data) {\n    const validacion = validarEmpleadoPM10(data, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    const nuevo = { id: uid(), activo: true, documentos: [], ...validacion.datos, localId: localActivoId };\n    setEmpleados((s22) => [...s22, nuevo]);\n    return nuevo;\n  }'''
new_add = '''  function addEmpleado(data) {\n    const validacion = validarEmpleadoPM10(data, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    const nuevo = {\n      documentos: [],\n      ...validacion.datos,\n      id: uid(),\n      localId: localActivoId,\n      activo: true,\n      fechaAlta: validacion.datos.fechaAlta || fechaHoyPersonalPM13(),\n      fechaBaja: \"\",\n      motivoBaja: \"\"\n    };\n    setEmpleados((s22) => [...s22, nuevo]);\n    return nuevo;\n  }'''
if old_add in s:
    s = s.replace(old_add, new_add, 1)
elif 'fechaBaja: "",\n      motivoBaja: ""' not in s:
    raise SystemExit('PM13 P01: no se encontró addEmpleado esperado')
elif '...validacion.datos,\n      id: uid(),\n      localId: localActivoId,\n      activo: true' not in s:
    old_pm13_add = '''    const nuevo = {\n      id: uid(),\n      documentos: [],\n      ...validacion.datos,\n      localId: localActivoId,\n      activo: true,\n      fechaAlta: validacion.datos.fechaAlta || todayISO(),\n      fechaBaja: \"\",\n      motivoBaja: \"\"\n    };'''
    new_pm13_add = '''    const nuevo = {\n      documentos: [],\n      ...validacion.datos,\n      id: uid(),\n      localId: localActivoId,\n      activo: true,\n      fechaAlta: validacion.datos.fechaAlta || fechaHoyPersonalPM13(),\n      fechaBaja: \"\",\n      motivoBaja: \"\"\n    };'''
    if old_pm13_add in s:
        s = s.replace(old_pm13_add, new_pm13_add, 1)
    else:
        raise SystemExit('PM13 P01: no se pudo reforzar identidad de addEmpleado')
else:
    s = s.replace('fechaAlta: validacion.datos.fechaAlta || todayISO()', 'fechaAlta: validacion.datos.fechaAlta || fechaHoyPersonalPM13()', 1)

# Mantener compatibilidad con la edición existente: si cambia el estado laboral,
# registrar o limpiar la trazabilidad de baja de forma determinista.
old_update = '''  function updateEmpleado(id, data) {\n    const actual = empleados.find((e2) => e2.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId) return errorValidacionPM10(\"contexto_no_autorizado\", \"empleadoId\", \"El empleado no pertenece al local activo.\");\n    const validacion = validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, localId: e2.localId || localActivoId } : e2));\n    return true;\n  }'''
new_update = '''  function updateEmpleado(id, data) {\n    const actual = empleados.find((e2) => e2.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId) return errorValidacionPM10(\"contexto_no_autorizado\", \"empleadoId\", \"El empleado no pertenece al local activo.\");\n    const validacion = validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId, locales, empresaId });\n    if (!validacion.ok) return validacion;\n    const dandoBaja = actual.activo !== false && validacion.datos.activo === false;\n    const reactivando = actual.activo === false && validacion.datos.activo === true;\n    const cambiosEstado = dandoBaja ? {\n      fechaBaja: validacion.datos.fechaBaja || fechaHoyPersonalPM13(),\n      motivoBaja: String(validacion.datos.motivoBaja || \"Baja registrada desde edición\").trim() || \"Baja registrada desde edición\"\n    } : reactivando ? { fechaBaja: \"\", motivoBaja: \"\" } : {};\n    setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, ...cambiosEstado, id: e2.id, localId: e2.localId || localActivoId } : e2));\n    if (dandoBaja) {\n      bajasRegistradasPersonalPM13.add(id);\n      registrarAuditoria(\"Dar de baja empleado\", `${actual.nombre} \\xB7 ${cambiosEstado.fechaBaja} \\xB7 ${cambiosEstado.motivoBaja}`);\n    }\n    if (reactivando) {\n      bajasRegistradasPersonalPM13.delete(id);\n      registrarAuditoria(\"Reactivar empleado\", actual.nombre);\n    }\n    return true;\n  }'''
if old_update in s:
    s = s.replace(old_update, new_update, 1)
elif 'const dandoBaja = actual.activo !== false' not in s:
    raise SystemExit('PM13 P01: no se encontró updateEmpleado esperado')
else:
    s = s.replace('fechaBaja: validacion.datos.fechaBaja || todayISO()', 'fechaBaja: validacion.datos.fechaBaja || fechaHoyPersonalPM13()', 1)
    if '...cambiosEstado, id: e2.id, localId:' not in s:
        s = s.replace('...validacion.datos, ...cambiosEstado, localId: e2.localId || localActivoId', '...validacion.datos, ...cambiosEstado, id: e2.id, localId: e2.localId || localActivoId', 1)
    old_audit = '''    if (dandoBaja) registrarAuditoria(\"Dar de baja empleado\", `${actual.nombre} \\xB7 ${cambiosEstado.fechaBaja} \\xB7 ${cambiosEstado.motivoBaja}`);\n    if (reactivando) registrarAuditoria(\"Reactivar empleado\", actual.nombre);'''
    new_audit = '''    if (dandoBaja) {\n      bajasRegistradasPersonalPM13.add(id);\n      registrarAuditoria(\"Dar de baja empleado\", `${actual.nombre} \\xB7 ${cambiosEstado.fechaBaja} \\xB7 ${cambiosEstado.motivoBaja}`);\n    }\n    if (reactivando) {\n      bajasRegistradasPersonalPM13.delete(id);\n      registrarAuditoria(\"Reactivar empleado\", actual.nombre);\n    }'''
    if old_audit in s:
        s = s.replace(old_audit, new_audit, 1)

logic_ini = s.find('function crearLogicaPersonal({')
logic_fin = s.find('function crearLogicaTurnos({', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('PM13 P01: no se encontró crearLogicaPersonal')
segment = s[logic_ini:logic_fin]

if 'const fechaHoyPersonalPM13 = () =>' not in segment:
    anchor = '  const empleadoEsDelLocalActivoPersonal = (e2) => !!e2 && (!localActivoId || e2.localId === localActivoId);\n'
    if anchor not in segment:
        raise SystemExit('PM13 P01: no se encontró ancla de contexto Personal')
    helper = '  const fechaHoyPersonalPM13 = () => typeof todayISO === \"function\" ? todayISO() : \"\";\n'
    segment = segment.replace(anchor, anchor + helper, 1)

if 'const bajasRegistradasPersonalPM13 = new Set(' not in segment:
    anchor = '  const fechaHoyPersonalPM13 = () => typeof todayISO === \"function\" ? todayISO() : \"\";\n'
    segment = segment.replace(anchor, anchor + '  const bajasRegistradasPersonalPM13 = new Set(empleados.filter((e2) => e2 && e2.activo === false).map((e2) => e2.id));\n', 1)

old_delete = '''  function deleteEmpleado(id) {\n    const e2 = empleados.find((x3) => x3.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(e2)) return false;\n    registrarAuditoria(\"Eliminar empleado\", e2.nombre);\n    setEmpleados((s22) => s22.filter((e22) => e22.id !== id));\n    if (setNominas) setNominas((s22) => s22.filter((n2) => n2.empleadoId !== id));\n    return true;\n  }'''
new_delete = '''  function deleteEmpleado(id, baja = {}) {\n    const e2 = empleados.find((x3) => x3.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId) return false;\n    if (bajasRegistradasPersonalPM13.has(id) || e2.activo === false) return true;\n    const fechaSistema = fechaHoyPersonalPM13();\n    const fechaBaja = String(baja.fechaBaja || fechaSistema).trim() || fechaSistema;\n    const motivoBaja = String(baja.motivoBaja || baja.motivo || \"Baja registrada desde Personal\").trim() || \"Baja registrada desde Personal\";\n    bajasRegistradasPersonalPM13.add(id);\n    try {\n      setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: false, fechaBaja, motivoBaja } : emp));\n      registrarAuditoria(\"Dar de baja empleado\", `${e2.nombre} \\xB7 ${fechaBaja || \"sin fecha\"} \\xB7 ${motivoBaja}`);\n      return true;\n    } catch (error) {\n      bajasRegistradasPersonalPM13.delete(id);\n      throw error;\n    }\n  }'''
if old_delete in segment:
    segment = segment.replace(old_delete, new_delete, 1)
elif 'function deleteEmpleado(id, baja = {})' not in segment:
    raise SystemExit('PM13 P01: no se encontró deleteEmpleado esperado')
else:
    segment = segment.replace('const fechaBaja = String(baja.fechaBaja || todayISO()).trim() || todayISO();', 'const fechaSistema = fechaHoyPersonalPM13();\n    const fechaBaja = String(baja.fechaBaja || fechaSistema).trim() || fechaSistema;', 1)
    segment = segment.replace('`${e2.nombre} \\xB7 ${fechaBaja} \\xB7 ${motivoBaja}`', '`${e2.nombre} \\xB7 ${fechaBaja || \"sin fecha\"} \\xB7 ${motivoBaja}`', 1)

s = s[:logic_ini] + segment + s[logic_fin:]

personal_ini = s.find('function Personal({')
personal_fin = s.find('function Turnos({', personal_ini)
if personal_ini < 0 or personal_fin < 0:
    raise SystemExit('PM13 P01: no se encontró componente Personal')
ui = s[personal_ini:personal_fin]

ui = ui.replace('aria-label: \"Eliminar empleado\"', 'aria-label: \"Dar de baja empleado\"')
ui = ui.replace('title: \"Eliminar empleado\"', 'title: \"Dar de baja empleado\"')
ui = ui.replace('\"Eliminar del todo\"', '\"Dar de baja\"')
ui = ui.replace('\"Anonimizar (recomendado)\"', '\"Anonimizar datos\"')
ui = re.sub(
    r'\"Se borra la ficha completa,[^\"]*conservar el historial\.\"',
    lambda _m: '\"La baja desactiva al empleado sin borrar su ficha, ausencias, documentos, fichajes ni n\\xF3minas. La fecha y el motivo quedan registrados y el historial se conserva.\"',
    ui,
    count=1
)
ui = re.sub(
    r'\"Este empleado tiene n\\xF3minas registradas\. La legislaci\\xF3n laboral obliga a conservar esos documentos varios a\\xF1os\. Mejor usa \"',
    lambda _m: '\"Este empleado tiene n\\xF3minas registradas. La baja conservar\\xE1 esas n\\xF3minas y el resto del historial. La anonimizaci\\xF3n queda como una acci\\xF3n de privacidad separada. \"',
    ui,
    count=1
)

card_anchor = 'import_react4.default.createElement(\"div\", null, \"Alta: \", e2.fechaAlta, e2.fechaFinContrato && ` \\xB7 Fin de contrato: ${e2.fechaFinContrato}`)'
if 'e2.fechaBaja || "sin fecha (registro legado)"' not in ui:
    if card_anchor not in ui:
        raise SystemExit('PM13 P01: no se encontró línea Alta de tarjeta Personal')
    card_new = card_anchor + ', e2.activo === false && /* @__PURE__ */ import_react4.default.createElement(\"div\", null, \"Baja: \", e2.fechaBaja || \"sin fecha (registro legado)\", e2.motivoBaja && ` \\xB7 ${e2.motivoBaja}`)'
    ui = ui.replace(card_anchor, card_new, 1)

export_anchor = '      `Fecha de fin de contrato: ${e2.fechaFinContrato || \"\\u2014\"}`,\n'
if '`Fecha de baja: ${e2.fechaBaja || "\\u2014"}`' not in ui:
    if export_anchor in ui:
        ui = ui.replace(export_anchor, export_anchor + '      `Fecha de baja: ${e2.fechaBaja || \"\\u2014\"}`,\n      `Motivo de baja: ${e2.motivoBaja || \"\\u2014\"}`,\n', 1)

if 'Eliminar del todo' in ui:
    raise SystemExit('PM13 P01: sigue visible Eliminar del todo')

s = s[:personal_ini] + ui + s[personal_fin:]
p.write_text(s, encoding='utf-8')
print('PM13 P01: alta/baja lógica aplicada de forma idempotente')
