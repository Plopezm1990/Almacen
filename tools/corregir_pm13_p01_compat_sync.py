from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')
a = s.find('function crearLogicaPersonal({')
b = s.find('function crearLogicaTurnos({', a)
if a < 0 or b < 0:
    raise SystemExit('PM13 P01 compat: no se encontró crearLogicaPersonal')
x = s[a:b]

# PM10 ejecuta la lógica aislada con localActivoId pero sin empresaId. Mantener ese
# contrato histórico; empresaId pasa a ser obligatorio únicamente cuando existe
# el motor remoto, donde forma parte del scope de las RPC PM11.
old = '    if (!localActivoId || !empresaId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Personal requiere empresa y local concretos.");\n'
new = '    if (!localActivoId) return errorValidacionPM10("contexto_no_autorizado", "localId", "Personal requiere un local concreto.");\n    if (motorPersonalRemotoDisponiblePM13() && !empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "El motor remoto de Personal requiere empresa y local concretos.");\n'
x = x.replace(old, new, 1)

old = '    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId || !empresaId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");\n'
new = '    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");\n    if (motorPersonalRemotoDisponiblePM13() && !empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "El motor remoto de Personal requiere empresa y local concretos.");\n'
x = x.replace(old, new, 1)

old = '    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId || !empresaId) return false;\n'
new = '    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId) return false;\n    if (motorPersonalRemotoDisponiblePM13() && !empresaId) return false;\n'
# Aparece una vez en baja y una vez en reactivación.
x = x.replace(old, new, 2)

# Verificación del modo híbrido final.
requeridos = [
    'function addEmpleado(data, controlPM13 = {})',
    'function updateEmpleado(id, data)',
    'function deleteEmpleado(id, baja = {})',
    'function reactivarEmpleado(id)',
    'async function ejecutarRpcPersonalPM13(nombre, args)',
    'pm11_alta_empleado',
    'pm11_editar_empleado',
    'pm11_baja_empleado',
    'pm11_reactivar_empleado',
]
for token in requeridos:
    if token not in x:
        raise SystemExit(f'PM13 P01 compat: falta {token}')

if 'if (!motorPersonalRemotoDisponiblePM13()) return aplicarLocal();' not in x:
    raise SystemExit('PM13 P01 compat: alta perdió fallback síncrono')
if 'motorPersonalRemotoDisponiblePM13() && !empresaId' not in x:
    raise SystemExit('PM13 P01 compat: modo remoto no exige empresa')
if 'setEmpleados((s22) => s22.filter' in x:
    raise SystemExit('PM13 P01 compat: borrado físico de empleados detectado')
if 'setNominas((s22) => s22.filter' in x:
    raise SystemExit('PM13 P01 compat: borrado físico de nóminas detectado')

s = s[:a] + x + s[b:]
p.write_text(s, encoding='utf-8')
print('PM13 P01: compatibilidad híbrida PM10/remoto verificada')
