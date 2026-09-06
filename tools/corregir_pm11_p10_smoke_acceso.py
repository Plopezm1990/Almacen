from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = ruta.read_text(encoding='utf-8')

MARCADOR = './pm11-access-patch.js?v=pm11-p10-smoke-v1'
if MARCADOR in s:
    print(f'PM11 P10 smoke acceso: ya aplicado en {ruta}')
    raise SystemExit(0)

old = '<script type="module" src="./fuente.js"></script>'
new = '<script src="./pm11-access-patch.js?v=pm11-p10-smoke-v1"></script>\n' + old

if s.count(old) != 1:
    raise SystemExit(f'Inserción fuente.js inesperada: {s.count(old)}')

s = s.replace(old, new, 1)
ruta.write_text(s, encoding='utf-8')
print(f'PM11 P10 smoke acceso aplicado en {ruta}')
