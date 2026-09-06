from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = ruta.read_text(encoding='utf-8')

MARCADOR_V1 = './pm11-access-patch.js?v=pm11-p10-smoke-v1'
MARCADOR_V2 = './pm11-access-patch.js?v=pm11-p10-smoke-v2'
RUNTIME_V3 = './pm11-access-runtime-v3.js?v=pm11-runtime-scope-v3'
LAYOUT_V3 = './pm11-mobile-layout-v3.js?v=pm11-mobile-layout-v3'

# Mantener la barrera de acceso existente. Si queda una referencia v1,
# actualizarla primero a v2. Runtime y geometría son capas separadas.
if MARCADOR_V1 in s:
    if s.count(MARCADOR_V1) != 1:
        raise SystemExit(f'Marcador P10 v1 inesperado: {s.count(MARCADOR_V1)}')
    s = s.replace(MARCADOR_V1, MARCADOR_V2, 1)

access_tag = '<script src="./pm11-access-patch.js?v=pm11-p10-smoke-v2"></script>'
runtime_tag = '<script src="./pm11-access-runtime-v3.js?v=pm11-runtime-scope-v3"></script>'
layout_tag = '<script src="./pm11-mobile-layout-v3.js?v=pm11-mobile-layout-v3"></script>'
fuente_tag = '<script type="module" src="./fuente.js"></script>'

# Si la barrera todavía no estaba en el HTML, instalarla antes del bundle.
if access_tag not in s:
    if s.count(fuente_tag) != 1:
        raise SystemExit(f'Inserción fuente.js inesperada: {s.count(fuente_tag)}')
    s = s.replace(fuente_tag, access_tag + '\n' + fuente_tag, 1)

if s.count(access_tag) != 1:
    raise SystemExit(f'Barrera PM11 inesperada: {s.count(access_tag)}')

# Runtime v3 corrige la rehidratación post-login y fuerza el local autorizado.
# Se carga inmediatamente después de la barrera de autorización.
if runtime_tag not in s:
    s = s.replace(access_tag, access_tag + '\n' + runtime_tag, 1)

if s.count(runtime_tag) != 1:
    raise SystemExit(f'Runtime scope v3 inesperado: {s.count(runtime_tag)}')

# Layout v3 permanece independiente y antes del bundle.
if layout_tag not in s:
    s = s.replace(runtime_tag, runtime_tag + '\n' + layout_tag, 1)

if s.count(layout_tag) != 1:
    raise SystemExit(f'Layout móvil v3 inesperado: {s.count(layout_tag)}')

if not (s.index(access_tag) < s.index(runtime_tag) < s.index(layout_tag) < s.index(fuente_tag)):
    raise SystemExit('Orden de scripts PM11 incorrecto: acceso -> runtime v3 -> layout v3 -> fuente')

ruta.write_text(s, encoding='utf-8')
print(f'PM11 P10 acceso + runtime scope v3 + layout móvil v3 aplicado en {ruta}')
