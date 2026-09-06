from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'fuente.js')
s = ruta.read_text(encoding='utf-8')

MARCADOR = 'supabase.functions.invoke("crear-cuenta-empleado"'
if MARCADOR in s:
    print(f'PM11 P09 cuenta segura: ya aplicado en {ruta}')
    raise SystemExit(0)

inicio = s.find('      const resp = await fetch("https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/crear-cuenta-empleado", {')
if inicio < 0:
    raise SystemExit('No se encontró el fetch histórico hardcodeado de crear-cuenta-empleado')

fin_token = '      const r2 = await resp.json();'
fin = s.find(fin_token, inicio)
if fin < 0:
    raise SystemExit('No se encontró el cierre del fetch histórico crear-cuenta-empleado')
fin += len(fin_token)

nuevo = '''      const { data: r2, error: errorCuenta } = await supabase.functions.invoke("crear-cuenta-empleado", {
        body: { empleadoId, nombre, email, password, rol }
      });
      if (errorCuenta) {
        return { ok: false, error: errorCuenta?.message || "No se pudo crear la cuenta de empleado." };
      }'''

s = s[:inicio] + nuevo + s[fin:]

if 'https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/crear-cuenta-empleado' in s:
    raise SystemExit('El endpoint de producción sigue hardcodeado tras el parche P09')
if MARCADOR not in s:
    raise SystemExit('No quedó instalado functions.invoke crear-cuenta-empleado')

ruta.write_text(s, encoding='utf-8')
print(f'PM11 P09 frontend cuenta segura aplicado en {ruta}')
