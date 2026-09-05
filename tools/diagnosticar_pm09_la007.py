from pathlib import Path
import re

SRC = Path('fuente.js')
OUT = Path('tests/pm09/LA007_DIAGNOSTICO_FUENTE.txt')
s = SRC.read_text(encoding='utf-8')

markers = [
    r'function\s+Resultados\w*\s*\(',
    r'\bResultados\s*=\s*',
    r'Punto de equilibrio',
    r'Coste de ventas',
    r'Coste de venta',
    r'Ingresos',
    r'beneficio',
    r'ingresoUnitario',
]

lines = [
    'PM09 / LA-007 / DIAGNOSTICO DE FUENTE',
    'No modifica fuente.js. Extrae contexto para reproducir antes de corregir.',
    f'bytes_fuente={len(s.encode("utf-8"))}',
    '',
]

seen = set()
for pat in markers:
    matches = list(re.finditer(pat, s, re.I))
    lines.append(f'PATRON {pat!r}: {len(matches)} coincidencias')
    for i, m in enumerate(matches[:12], 1):
        start = max(0, m.start() - 1800)
        end = min(len(s), m.end() + 4200)
        key = (start, end)
        if key in seen:
            continue
        seen.add(key)
        snippet = s[start:end]
        lines += [
            f'--- coincidencia {i} pos={m.start()} ---',
            snippet,
            '--- fin coincidencia ---',
            '',
        ]

# Extrae el bloque completo si el componente mantiene nombre de función.
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
    for pos in range(open_brace, len(s)):
        c = s[pos]
        n = s[pos + 1] if pos + 1 < len(s) else ''
        if line_comment:
            if c == '\n':
                line_comment = False
            continue
        if block_comment:
            if c == '*' and n == '/':
                block_comment = False
            continue
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
            continue
        if c == '/' and n == '/':
            line_comment = True
            continue
        if c == '/' and n == '*':
            block_comment = True
            continue
        if c in ('"', "'", '`'):
            quote = c
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return s[start:pos + 1], 1
    return None, 1

block, count = function_block('Resultados')
lines += ['', f'BLOQUE function Resultados: coincidencias={count}']
if block is not None:
    # Evita generar un artefacto desproporcionado.
    lines.append(block[:60000])
    lines.append(f'BLOQUE_TRUNCADO={1 if len(block) > 60000 else 0}; longitud={len(block)}')

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text('\n'.join(lines), encoding='utf-8')
print(f'LA007_DIAGNOSTICO_OK={OUT}')
