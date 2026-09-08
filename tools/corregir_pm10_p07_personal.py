from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# Validación autoritativa y normalización numérica para la ficha de personal.
if 'function validarEmpleadoPM10(' not in s:
    pos = s.find('function crearLogicaPersonal({')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaPersonal')
    helper = r'''function validarEmpleadoPM10(data, { localActivoId = null } = {}) {
  if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Selecciona un local activo para modificar personal.");
  if (!data || typeof data !== "object" || Array.isArray(data)) return errorValidacionPM10("formato_invalido", "empleado", "La ficha del empleado no es válida.");
  if (data.localId && data.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", "localId", "El empleado pertenece a otro local.");

  const datos = { ...data, localId: data.localId || localActivoId };
  const validarNumero = (campo, { defecto = 0, estrictoMinimo = false, permitirVacio = false } = {}) => {
    const raw = datos[campo];
    if (raw === void 0) return { ok: true };
    if (permitirVacio && (raw === null || String(raw).trim() === "")) {
      datos[campo] = "";
      return { ok: true };
    }
    const valorEntrada = raw === null || String(raw).trim() === "" ? defecto : raw;
    const r2 = numeroPM10(valorEntrada, campo, { minimo: 0, estrictoMinimo });
    if (!r2.ok) return r2;
    datos[campo] = r2.valor;
    return { ok: true };
  };

  for (const [campo, opciones] of [
    ["horasSemanales", { defecto: 0 }],
    ["pagas", { defecto: 14, estrictoMinimo: true }],
    ["salarioBrutoMensual", { defecto: 0 }],
    ["costeEmpresaMensual", { permitirVacio: true }],
    ["diasVacacionesAnuales", { defecto: 0 }]
  ]) {
    const r2 = validarNumero(campo, opciones);
    if (!r2.ok) return r2;
  }
  return { ok: true, datos };
}
'''
    s = s[:pos] + helper + s[pos:]

# Endurecer el dominio: validar antes de cualquier setEmpleados y devolver resultado explícito.
logic_ini = s.find('function crearLogicaPersonal({')
logic_fin = s.find('function crearLogicaTurnos({', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('No se encontró bloque crearLogicaPersonal')
segment = s[logic_ini:logic_fin]

old_add = '''  function addEmpleado(data) {\n    setEmpleados((s22) => [...s22, { id: uid(), activo: true, documentos: [], ...data, localId: localActivoId || data.localId || null }]);\n  }'''
new_add = '''  function addEmpleado(data) {\n    const validacion = validarEmpleadoPM10(data, { localActivoId });\n    if (!validacion.ok) return validacion;\n    const nuevo = { id: uid(), activo: true, documentos: [], ...validacion.datos, localId: localActivoId };\n    setEmpleados((s22) => [...s22, nuevo]);\n    return nuevo;\n  }'''
if old_add in segment:
    segment = segment.replace(old_add, new_add, 1)
elif 'const validacion = validarEmpleadoPM10(data, { localActivoId });' not in segment:
    raise SystemExit('No se encontró addEmpleado esperado')

old_update = '''  function updateEmpleado(id, data) {\n    setEmpleados((s22) => s22.map((e2) => e2.id === id && empleadoEsDelLocalActivoPersonal(e2) ? { ...e2, ...data, localId: e2.localId || localActivoId || null } : e2));\n  }'''
new_update = '''  function updateEmpleado(id, data) {\n    const actual = empleados.find((e2) => e2.id === id);\n    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");\n    const validacion = validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId });\n    if (!validacion.ok) return validacion;\n    setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, localId: e2.localId || localActivoId } : e2));\n    return true;\n  }'''
if old_update in segment:
    segment = segment.replace(old_update, new_update, 1)
elif 'const validacion = validarEmpleadoPM10({ ...actual, ...data' not in segment:
    raise SystemExit('No se encontró updateEmpleado esperado')

s = s[:logic_ini] + segment + s[logic_fin:]

# UI Personal: no convertir valores inválidos a 0/14 antes de que el dominio pueda rechazarlos.
personal_ini = s.find('function Personal({')
personal_fin = s.find('function Turnos({', personal_ini)
if personal_ini < 0 or personal_fin < 0:
    raise SystemExit('No se encontró componente Personal')
ui = s[personal_ini:personal_fin]
old_datos = '''    const datos = {\n      ...form,\n      horasSemanales: Number(form.horasSemanales) || 0,\n      pagas: Number(form.pagas) || 14,\n      salarioBrutoMensual: Number(form.salarioBrutoMensual) || 0,\n      costeEmpresaMensual: form.costeEmpresaMensual === "" ? "" : Number(form.costeEmpresaMensual),\n      diasVacacionesAnuales: Number(form.diasVacacionesAnuales) || 0\n    };'''
new_datos = '''    const datos = { ...form };'''
if old_datos in ui:
    ui = ui.replace(old_datos, new_datos, 1)
elif 'const datos = { ...form };' not in ui:
    raise SystemExit('No se encontró normalización previa de Personal')

old_save = '''    if (editingId) updateEmpleado(editingId, datos);\n    else addEmpleado(datos);\n    resetForm();\n    setShowForm(false);'''
new_save = '''    const resultado = editingId ? updateEmpleado(editingId, datos) : addEmpleado(datos);\n    if (!resultado || resultado.ok === false) {\n      setError(resultado?.error || "No se pudo guardar la ficha del empleado.");\n      return;\n    }\n    resetForm();\n    setShowForm(false);'''
if old_save in ui:
    ui = ui.replace(old_save, new_save, 1)
elif 'const resultado = editingId ? updateEmpleado(editingId, datos) : addEmpleado(datos);' not in ui:
    raise SystemExit('No se encontró guardado UI Personal')

s = s[:personal_ini] + ui + s[personal_fin:]
p.write_text(s, encoding='utf-8')
print('PM10 P07 LA-017 Personal: patch aplicado/idempotente')
