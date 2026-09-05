import re
from pathlib import Path

src = Path('fuente.js').read_text(encoding='utf-8')
out = ['PM09 / PUNTO 11 / DIAGNOSTICO IVA\n']

# Extraer funciones relevantes completas cuando sea viable.
def function_block(name):
    m = re.search(r'(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(', src)
    if not m:
        return f'NO_ENCONTRADO function {name}\n'
    start = m.start(); brace = src.find('{', m.end())
    if brace < 0: return f'SIN_APERTURA function {name}\n'
    depth=0; quote=None; esc=False; line=False; block=False; i=brace
    while i < len(src):
        c=src[i]; n=src[i+1] if i+1 < len(src) else ''
        if line:
            if c=='\n': line=False
            i+=1; continue
        if block:
            if c=='*' and n=='/': block=False; i+=2; continue
            i+=1; continue
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
            i+=1; continue
        if c=='/' and n=='/': line=True; i+=2; continue
        if c=='/' and n=='*': block=True; i+=2; continue
        if c in ('"', "'", '`'): quote=c; i+=1; continue
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0: return src[start:i+1]+'\n'
        i+=1
    return f'SIN_CIERRE function {name}\n'

for name in ['Resultados','Reportes','calcularIvaPM06','calcularImpuestosPM06','normalizarFiscalidadPM06']:
    out.append(f'\n## FUNCTION {name}\n')
    b=function_block(name)
    out.append(b if len(b) < 60000 else b[:60000]+'\n[TRUNCADO]\n')

needles = [
    'Libro IVA','libro IVA','IVA repercutido','IVA soportado','ivaRepercutido','ivaSoportado',
    'ivaVentaAplicado','porTipo','fiscal','modelo 303','modelo303','Base imponible','base imponible',
    'facturasDirectas','albaranes','gastosGenerales','movimientos.filter','DEVOLUCION_CLIENTE','REVERSO'
]
seen=[]
for needle in needles:
    matches=list(re.finditer(re.escape(needle),src,re.I if needle.lower()==needle else 0))
    out.append(f'\n## OCC {needle} COUNT={len(matches)}\n')
    for m in matches[:40]:
        a=max(0,m.start()-1200); b=min(len(src),m.end()+2200)
        chunk=src[a:b]
        sig=(a,b)
        if sig in seen: continue
        seen.append(sig)
        out.append(chunk+'\n---\n')

Path('tests/pm09/P11_IVA_DIAGNOSTICO.txt').write_text(''.join(out),encoding='utf-8')
print('PM09_P11_DIAGNOSTICO_OK=1')
# trigger workflow PM09 P11
