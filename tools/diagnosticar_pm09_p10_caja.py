import re
from pathlib import Path

src = Path('fuente.js').read_text(encoding='utf-8')

def function_block(name):
    m = re.search(r'(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(', src)
    if not m:
        return f'NO_ENCONTRADO function {name}\n'
    start = m.start()
    brace = src.find('{', m.end())
    if brace < 0:
        return f'SIN_APERTURA function {name}\n'
    depth = 0
    quote = None
    esc = False
    line_comment = False
    block_comment = False
    i = brace
    while i < len(src):
        c = src[i]
        n = src[i+1] if i+1 < len(src) else ''
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
                return src[start:i+1] + '\n'
        i += 1
    return f'SIN_CIERRE function {name}\n'

out = []
out.append('PM09 / PUNTO 10 / DIAGNOSTICO CAJA\n')
for name in ['crearLogicaCaja','crearLogicaMovimientosCaja','ArqueoCaja','VentaRapida']:
    out.append(f'\n## {name}\n')
    block = function_block(name)
    if name == 'VentaRapida' and len(block) > 45000:
        # Solo contextos relevantes para medio de pago / efectivo / venta.
        for needle in ['medioPago','detallePago','efectivo','venderCarrito','anularVenta']:
            out.append(f'\n### contexto {needle}\n')
            for m in list(re.finditer(re.escape(needle), block))[:12]:
                a = max(0, m.start()-800); b = min(len(block), m.end()+1400)
                out.append(block[a:b] + '\n---\n')
    else:
        out.append(block)

for needle in ['efectivo_base','efectivoBase','efectivoEsperado','efectivo esperado','ventasEfectivo','detallePago','medioPago']:
    out.append(f'\n## ocurrencias {needle}\n')
    matches = list(re.finditer(re.escape(needle), src))
    out.append(f'COUNT={len(matches)}\n')
    for m in matches[:30]:
        a=max(0,m.start()-650); b=min(len(src),m.end()+1000)
        out.append(src[a:b]+'\n---\n')

Path('tests/pm09/P10_CAJA_DIAGNOSTICO.txt').write_text(''.join(out), encoding='utf-8')
print('PM09_P10_DIAGNOSTICO_OK=1')
