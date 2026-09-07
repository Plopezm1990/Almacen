from pathlib import Path

src = Path('fuente.js').read_text(encoding='utf-8')


def extraer_entre(inicio, fin, nombre):
    a = src.find(inicio)
    if a < 0:
        return f'\n## {nombre}\nNO_ENCONTRADO: {inicio}\n'
    b = src.find(fin, a + len(inicio))
    if b < 0:
        b = min(len(src), a + 40000)
    return f'\n## {nombre}\n' + src[a:b] + '\n'


def extraer_funcion(nombre):
    marca = f'function {nombre}'
    a = src.find(marca)
    if a < 0:
        return f'\n## function {nombre}\nNO_ENCONTRADO\n'
    brace = src.find('{', a)
    if brace < 0:
        return f'\n## function {nombre}\nSIN_LLAVE\n'
    nivel = 0
    i = brace
    en_str = None
    esc = False
    while i < len(src):
        ch = src[i]
        if en_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == en_str:
                en_str = None
        else:
            if ch in ('\"', "'", '`'):
                en_str = ch
            elif ch == '{':
                nivel += 1
            elif ch == '}':
                nivel -= 1
                if nivel == 0:
                    i += 1
                    break
        i += 1
    return f'\n## function {nombre}\n' + src[a:i] + '\n'

out = []
out.append('PM09 / PUNTO 9 / DIAGNOSTICO HISTORIAL DE VENTAS\n')
out.append(f'bytes_fuente={len(src.encode("utf-8"))}\n')
out.append(extraer_entre('const [filtroVentasTexto', 'function renderTicketVenta', 'estado_historial_y_proyeccion'))
out.append(extraer_funcion('renderTicketVenta'))
out.append(extraer_funcion('renderHistorialVentas'))
out.append(extraer_funcion('anularVenta'))
out.append(extraer_entre('const registrarDevolucionCliente', 'const registrarDevolucionProveedor', 'registrar_devolucion_cliente'))
out.append(extraer_entre('async function sincronizarStockPm07', 'function', 'sincronizacion_movimientos_pm07'))
Path('tests/pm09/P09_HISTORIAL_DIAGNOSTICO.txt').write_text(''.join(out), encoding='utf-8')
print('PM09_P09_DIAGNOSTICO_OK=1')
