from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'fuente.js')
s = ruta.read_text(encoding='utf-8')

if 'title: "Dar de baja empleado"' not in s:
    raise SystemExit('No se encontró el modal P06 de baja lógica')

frontera = '\nfunction inicioSemana(fecha) {'
pos = s.find(frontera)
if pos < 0:
    raise SystemExit('No se encontró la frontera posterior de Personal')

antes = s[:pos]
if antes.endswith('\n}'):
    print(f'PM11 P06 sintaxis: cierre Personal ya presente en {ruta}')
    raise SystemExit(0)

# El parche P06 sustituye el modal final del componente. El bundle original
# conserva el cierre de la expresión React, pero el primer candidato omitió la
# llave final de la función Personal. Reponerla exactamente en su frontera.
s = antes + '\n}' + s[pos:]
ruta.write_text(s, encoding='utf-8')
print(f'PM11 P06 sintaxis: cierre Personal corregido en {ruta}')
