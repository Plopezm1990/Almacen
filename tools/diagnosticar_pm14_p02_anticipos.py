from pathlib import Path

s = Path('fuente.js').read_text(encoding='utf-8')


def bloque_funcion(nombre: str) -> str:
    firmas = [f'function {nombre}(', f'async function {nombre}(']
    indices = [s.find(f) for f in firmas if s.find(f) >= 0]
    if not indices:
        raise SystemExit(f'PM14_P02_FUNCION_AUSENTE={nombre}')
    inicio = min(indices)
    apertura = s.find('{', inicio)
    if apertura < 0:
        raise SystemExit(f'PM14_P02_FUNCION_SIN_APERTURA={nombre}')
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
    raise SystemExit(f'PM14_P02_FUNCION_SIN_CIERRE={nombre}')

for nombre in [
    'sincronizarCobroSeñal',
    'crearLogicaMovimientosCaja',
    'crearLogicaEncargos',
    'sincronizarCajaPm08',
]:
    print(f'\n===== PM14_P02_BEGIN_{nombre} =====')
    print(bloque_funcion(nombre))
    print(f'===== PM14_P02_END_{nombre} =====\n')

for patron in [
    'getSupabaseClient',
    'window.__nubeActiva',
    '.rpc("registrar_movimiento_caja"',
    '.from("caja_operaciones")',
    'almacen_kv',
    'encargos',
]:
    print(f'PM14_P02_PATTERN_{patron}={s.count(patron)}')
