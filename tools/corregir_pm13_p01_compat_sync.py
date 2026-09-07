from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')
a = s.find('function crearLogicaPersonal({')
b = s.find('function crearLogicaTurnos({', a)
if a < 0 or b < 0:
    raise SystemExit('PM13 P01 compat: no se encontró crearLogicaPersonal')
x = s[a:b]

# El parche principal ya genera directamente el modo híbrido. Este segundo paso
# existe solo como gate explícito de compatibilidad con los contratos históricos.
requeridos = [
    'function addEmpleado(data, controlPM13 = {})',
    'function updateEmpleado(id, data)',
    'function deleteEmpleado(id, baja = {})',
    'function reactivarEmpleado(id)',
    'async function ejecutarRpcPersonalPM13(nombre, args)',
    'motorPersonalRemotoDisponiblePM13()',
    'pm11_alta_empleado',
    'pm11_editar_empleado',
    'pm11_baja_empleado',
    'pm11_reactivar_empleado',
]
for token in requeridos:
    if token not in x:
        raise SystemExit(f'PM13 P01 compat: falta {token}')

# Debe seguir existiendo ruta síncrona sin motor remoto.
if 'if (!motorPersonalRemotoDisponiblePM13()) return aplicarLocal();' not in x:
    raise SystemExit('PM13 P01 compat: alta perdió fallback síncrono')
if 'if (!motorPersonalRemotoDisponiblePM13()) {' not in x:
    raise SystemExit('PM13 P01 compat: mutaciones perdieron fallback síncrono')

# Nunca restaurar borrados físicos.
if 'setEmpleados((s22) => s22.filter' in x:
    raise SystemExit('PM13 P01 compat: borrado físico de empleados detectado')
if 'setNominas((s22) => s22.filter' in x:
    raise SystemExit('PM13 P01 compat: borrado físico de nóminas detectado')

print('PM13 P01: compatibilidad híbrida verificada')
