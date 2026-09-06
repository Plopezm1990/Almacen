from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = ruta.read_text(encoding='utf-8')

MARCADOR_V1 = './pm11-access-patch.js?v=pm11-p10-smoke-v1'
MARCADOR_V2 = './pm11-access-patch.js?v=pm11-p10-smoke-v2'

if MARCADOR_V2 in s:
    print(f'PM11 P10 smoke acceso v2: ya aplicado en {ruta}')
    raise SystemExit(0)

if MARCADOR_V1 in s:
    if s.count(MARCADOR_V1) != 1:
        raise SystemExit(f'Marcador P10 v1 inesperado: {s.count(MARCADOR_V1)}')
    s = s.replace(MARCADOR_V1, MARCADOR_V2, 1)
    ruta.write_text(s, encoding='utf-8')
    print(f'PM11 P10 smoke acceso actualizado v1 -> v2 en {ruta}')
    raise SystemExit(0)

old = '<script type="module" src="./fuente.js"></script>'
new = '<script src="./pm11-access-patch.js?v=pm11-p10-smoke-v2"></script>\n' + old

if s.count(old) != 1:
    raise SystemExit(f'Inserción fuente.js inesperada: {s.count(old)}')

s = s.replace(old, new, 1)
ruta.write_text(s, encoding='utf-8')
print(f'PM11 P10 smoke acceso v2 aplicado en {ruta}')
