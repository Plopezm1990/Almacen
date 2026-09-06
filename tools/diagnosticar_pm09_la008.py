from pathlib import Path
import re

SRC = Path('fuente.js')
OUT = Path('tests/pm09/LA008_DIAGNOSTICO_FUENTE.txt')
s = SRC.read_text(encoding='utf-8')

patterns = [
    r'rotaci[oó]n',
    r'Reportes',
    r'unidades',
    r'ventasPor',
    r'ranking',
    r'margen',
    r'esVenta\(',
    r'cantidadConSigno\(',
]

lines = [
    'PM09 / LA-008 / DIAGNOSTICO DE FUENTE',
    'No modifica fuente.js. Extrae contexto de unidades, rotacion y margen antes de corregir.',
    f'bytes_fuente={len(s.encode("utf-8"))}',
    '',
]

seen = set()
for pat in patterns:
    ms = list(re.finditer(pat, s, re.I))
    lines.append(f'PATRON {pat!r}: {len(ms)} coincidencias')
    for i, m in enumerate(ms[:30], 1):
        start = max(0, m.start() - 1400)
        end = min(len(s), m.end() + 3600)
        key = (start, end)
        if key in seen:
            continue
        seen.add(key)
        lines += [f'--- coincidencia {i} pos={m.start()} ---', s[start:end], '--- fin coincidencia ---', '']

# Extrae funciones cuyo nombre sugiere reportes/rotacion/ventas/resultados.
fn_re = re.compile(r'(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(')
names = [m.group(1) for m in fn_re.finditer(s)]
selected = [n for n in names if re.search(r'(reporte|rota|venta|resultado|estacional|margen)', n, re.I)]
lines += ['', 'FUNCIONES_CANDIDATAS=' + ','.join(selected[:100])]

# Extraer bloque de funcion de forma robusta.
def function_block(name):
    rx = re.compile(r'(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(')
    ms = list(rx.finditer(s))
    if len(ms) != 1:
        return None, len(ms)
    start = ms[0].start()
    open_brace = s.find('{', start)
    depth = 0
    quote = None
    esc = False
    line_comment = False
    block_comment = False
    i = open_brace
    while i < len(s):
        c = s[i]
        n = s[i+1] if i + 1 < len(s) else ''
        if line_comment:
            if c == '\n': line_comment = False
            i += 1; continue
        if block_comment:
            if c == '*' and n == '/': block_comment = False; i += 2; continue
            i += 1; continue
        if quote:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == quote: quote = None
            i += 1; continue
        if c == '/' and n == '/': line_comment = True; i += 2; continue
        if c == '/' and n == '*': block_comment = True; i += 2; continue
        if c in ('"', "'", '`'): quote = c; i += 1; continue
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return s[start:i+1], 1
        i += 1
    return None, 1

for name in selected[:30]:
    block, count = function_block(name)
    lines += ['', f'BLOQUE function {name}: coincidencias={count}']
    if block is not None:
        lines.append(block[:80000])
        lines.append(f'BLOQUE_TRUNCADO={1 if len(block) > 80000 else 0}; longitud={len(block)}')

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text('\n'.join(lines), encoding='utf-8')
print(f'LA008_DIAGNOSTICO_OK={OUT}')
