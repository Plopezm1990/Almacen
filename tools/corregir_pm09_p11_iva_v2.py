from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')
actual = r''' 'Solo cuentan las ventas registradas con motivo "Venta", los albaranes ya dados de entrada y las facturas directas registradas en Cuentas por pagar. Si falta algo por registrar, este libro tampoco lo ver\xE1.' '''.strip()
esperado = r'''"Solo cuentan las ventas registradas con motivo \"Venta\", los albaranes ya dados de entrada y las facturas directas registradas en Cuentas por pagar. Si falta algo por registrar, este libro tampoco lo ver\xE1."'''
if actual not in s:
    raise SystemExit('PM09_P11_NOTA_REAL_NO_ENCONTRADA')
s = s.replace(actual, esperado, 1)
p.write_text(s, encoding='utf-8')

# Ejecutar el parche principal ya validado hasta este último marcador.
code = Path('tools/corregir_pm09_p11_iva.py').read_text(encoding='utf-8')
exec(compile(code, 'tools/corregir_pm09_p11_iva.py', 'exec'))
