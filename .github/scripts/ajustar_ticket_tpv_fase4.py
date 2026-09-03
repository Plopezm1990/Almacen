from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise RuntimeError(f'{label}: esperada 1 coincidencia, hay {n}')
    s=s.replace(old,new,1)

# Pasar el local real al TPV sin cambiar su lógica de selección.
one(
'createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria })',
'createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l2) => l2.id === localActivoId) || null })',
'pasar local al TPV'
)

# Reconocer nombres de timestamp habituales de Supabase/legacy sin fabricar una hora inexistente.
one(
'const marcaTiempo = lineas.map((l2) => l2.timestamp || l2.createdAt || l2.fechaHora || "").filter(Boolean).sort().slice(-1)[0] || "";',
'const marcaTiempo = lineas.map((l2) => l2.timestamp || l2.createdAt || l2.created_at || l2.fechaHora || l2.fecha_hora || l2.marcaTiempo || "").filter(Boolean).sort().slice(-1)[0] || "";',
'lectura de marca temporal'
)

# Una anulación no debe agradecer una compra como si siguiera vigente.
old='"Gracias por su compra"'
if s.count(old)!=1:
    raise RuntimeError(f'pie gracias: esperada 1 coincidencia, hay {s.count(old)}')
s=s.replace(old, 'v2.anulada ? "Venta anulada · recibo sin validez de cobro" : "Gracias por su compra"', 1)

p.write_text(s,encoding='utf-8')
print('AJUSTES_TICKET_TPV_FASE4_OK=1')
