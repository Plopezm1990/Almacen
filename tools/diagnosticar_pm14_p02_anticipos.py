from pathlib import Path

s = Path('fuente.js').read_text(encoding='utf-8')


def avanzar_hasta_cierre_parentesis(paren_open: int):
    profundidad = 0
    quote = None
    escapado = False
    comentario_linea = False
    comentario_bloque = False
    i = paren_open
    while i < len(s):
        c = s[i]
        n = s[i + 1] if i + 1 < len(s) else ''
        if comentario_linea:
            if c == '\n': comentario_linea = False
            i += 1; continue
        if comentario_bloque:
            if c == '*' and n == '/': comentario_bloque = False; i += 2; continue
            i += 1; continue
        if quote:
            if escapado: escapado = False
            elif c == '\\': escapado = True
            elif c == quote: quote = None
            i += 1; continue
        if c == '/' and n == '/': comentario_linea = True; i += 2; continue
        if c == '/' and n == '*': comentario_bloque = True; i += 2; continue
        if c in ('"', "'", '`'): quote = c; i += 1; continue
        if c == '(': profundidad += 1
        elif c == ')':
            profundidad -= 1
            if profundidad == 0:
                return i
        i += 1
    return -1


def bloque_funcion(nombre: str):
    firmas = [f'function {nombre}(', f'async function {nombre}(']
    indices = [s.find(f) for f in firmas if s.find(f) >= 0]
    if not indices:
        return None
    inicio = min(indices)
    paren_open = s.find('(', inicio)
    paren_close = avanzar_hasta_cierre_parentesis(paren_open)
    if paren_close < 0:
        return None
    apertura = s.find('{', paren_close + 1)
    if apertura < 0:
        return None
    profundidad = 0
    quote = None
    escapado = False
    comentario_linea = False
    comentario_bloque = False
    i = apertura
    while i < len(s):
        c = s[i]
        n = s[i + 1] if i + 1 < len(s) else ''
        if comentario_linea:
            if c == '\n': comentario_linea = False
            i += 1; continue
        if comentario_bloque:
            if c == '*' and n == '/': comentario_bloque = False; i += 2; continue
            i += 1; continue
        if quote:
            if escapado: escapado = False
            elif c == '\\': escapado = True
            elif c == quote: quote = None
            i += 1; continue
        if c == '/' and n == '/': comentario_linea = True; i += 2; continue
        if c == '/' and n == '*': comentario_bloque = True; i += 2; continue
        if c in ('"', "'", '`'): quote = c; i += 1; continue
        if c == '{': profundidad += 1
        elif c == '}':
            profundidad -= 1
            if profundidad == 0:
                return s[inicio:i + 1]
        i += 1
    return None


def vecindad(patron: str, radio: int = 1800):
    pos = s.find(patron)
    if pos < 0:
        return None
    ini = max(0, pos - radio)
    fin = min(len(s), pos + len(patron) + radio)
    return s[ini:fin]

for nombre in [
    'crearLogicaMovimientosCaja',
    'crearLogicaEncargos',
    'sincronizarCajaPm08',
]:
    bloque = bloque_funcion(nombre)
    print(f'\n===== PM14_P02_BEGIN_{nombre} =====')
    print(bloque if bloque is not None else f'PM14_P02_FUNCION_AUSENTE={nombre}')
    print(f'===== PM14_P02_END_{nombre} =====\n')

for patron in [
    'sincronizarCobroSeñal',
    'sincronizarCobroSe\\u00F1al',
    'getSupabaseClient',
    '.rpc("registrar_movimiento_caja"',
    '.from("caja_operaciones")',
]:
    print(f'\n===== PM14_P02_NEIGHBOR_{patron} =====')
    print(vecindad(patron) or f'PM14_P02_PATRON_AUSENTE={patron}')
    print(f'===== PM14_P02_END_NEIGHBOR_{patron} =====\n')

for patron in [
    'getSupabaseClient',
    'window.__nubeActiva',
    '.rpc("registrar_movimiento_caja"',
    '.from("caja_operaciones")',
    'almacen_kv',
    'encargos',
]:
    print(f'PM14_P02_PATTERN_{patron}={s.count(patron)}')
