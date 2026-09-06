from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = ruta.read_text(encoding='utf-8')

MARCADOR_V1 = './pm11-access-patch.js?v=pm11-p10-smoke-v1'
MARCADOR_V2 = './pm11-access-patch.js?v=pm11-p10-smoke-v2'
LAYOUT_V3 = './pm11-mobile-layout-v3.js?v=pm11-mobile-layout-v3'

# Mantener la barrera de acceso existente. Si queda una referencia v1,
# actualizarla primero a v2; la corrección geométrica es una capa separada.
if MARCADOR_V1 in s:
    if s.count(MARCADOR_V1) != 1:
        raise SystemExit(f'Marcador P10 v1 inesperado: {s.count(MARCADOR_V1)}')
    s = s.replace(MARCADOR_V1, MARCADOR_V2, 1)

access_tag = '<script src="./pm11-access-patch.js?v=pm11-p10-smoke-v2"></script>'
layout_tag = '<script src="./pm11-mobile-layout-v3.js?v=pm11-mobile-layout-v3"></script>'
fuente_tag = '<script type="module" src="./fuente.js"></script>'

# Si la barrera todavía no estaba en el HTML, instalarla antes del bundle.
if access_tag not in s:
    if s.count(fuente_tag) != 1:
        raise SystemExit(f'Inserción fuente.js inesperada: {s.count(fuente_tag)}')
    s = s.replace(fuente_tag, access_tag + '\n' + fuente_tag, 1)

if s.count(access_tag) != 1:
    raise SystemExit(f'Barrera PM11 inesperada: {s.count(access_tag)}')

# V3: cargar una corrección geométrica independiente inmediatamente después
# de la barrera de autorización y siempre antes de fuente.js. Así no se mezclan
# permisos con layout y el nombre nuevo evita caché móvil antigua.
if layout_tag not in s:
    s = s.replace(access_tag, access_tag + '\n' + layout_tag, 1)

if s.count(layout_tag) != 1:
    raise SystemExit(f'Layout móvil v3 inesperado: {s.count(layout_tag)}')

if s.index(access_tag) > s.index(layout_tag) or s.index(layout_tag) > s.index(fuente_tag):
    raise SystemExit('Orden de scripts PM11 incorrecto: acceso -> layout v3 -> fuente')

ruta.write_text(s, encoding='utf-8')
print(f'PM11 P10 smoke acceso + layout móvil v3 aplicado en {ruta}')
