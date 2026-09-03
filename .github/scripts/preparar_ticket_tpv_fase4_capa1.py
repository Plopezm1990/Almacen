from pathlib import Path
p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y hay {n}')
    s = s.replace(old, new, 1)

replace_once(
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria }) {',
    'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos = [], registrarAuditoria, local = null }) {',
    'firma VentaRapida'
)
anchor = '  const [ventaDetalle, setVentaDetalle] = (0, import_react4.useState)(null);'
replace_once(anchor, anchor + '\n  const [ticketVenta, setTicketVenta] = (0, import_react4.useState)(null);', 'estado ticket')
if s.count('const [ticketVenta, setTicketVenta]') != 1:
    raise RuntimeError('estado ticket no quedó único')
p.write_text(s, encoding='utf-8')
print('CAPA1_TICKET_OK=1')
