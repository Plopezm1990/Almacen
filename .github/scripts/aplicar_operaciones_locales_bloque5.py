from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def uno(texto, viejo, nuevo, nombre):
    n = texto.count(viejo)
    assert n == 1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK', nombre)
    return texto.replace(viejo, nuevo, 1)


def rx_uno(texto, patron, repl, nombre):
    nuevo, n = re.subn(patron, repl, texto, count=1, flags=re.S)
    assert n == 1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK', nombre)
    return nuevo

# ------------------------------------------------------------------
# 1) Colecciones operativas del local activo.
# ------------------------------------------------------------------
ancla = '  const conteosDelLocalActivo = (0, import_react4.useMemo)(() => {'
i = s.index(ancla)
derivados = '''  const encargosDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return encargos;
    return encargos.filter((e2) => {
      if (e2.localId) return e2.localId === localActivoId;
      const ids = [...new Set((e2.lineas || []).map((ln2) => productos.find((p2) => p2.id === ln2.productoId)?.localId).filter(Boolean))];
      return ids.length === 1 && ids[0] === localActivoId;
    });
  }, [encargos, productos, localActivoId]);
  const encargosPendientesDelLocalActivo = (0, import_react4.useMemo)(() => encargosDelLocalActivo.filter((e2) => e2.estado !== "Entregado"), [encargosDelLocalActivo]);
  const encargosUrgentesDelLocalActivo = (0, import_react4.useMemo)(() => {
    const hoy = todayISO();
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaISO = manana.toISOString().slice(0, 10);
    return encargosPendientesDelLocalActivo.filter((e2) => e2.fechaEntrega === hoy || e2.fechaEntrega === mananaISO);
  }, [encargosPendientesDelLocalActivo]);
  const devolucionesDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return devoluciones;
    return devoluciones.filter((d2) => {
      if (d2.localId) return d2.localId === localActivoId;
      const prod = productos.find((p2) => p2.id === d2.productoId);
      return !!prod && prod.localId === localActivoId;
    });
  }, [devoluciones, productos, localActivoId]);
  const traspasosDelLocalActivo = (0, import_react4.useMemo)(() => {
    if (!localActivoId) return traspasos;
    return traspasos.filter((t2) => {
      if (t2.localId) return t2.localId === localActivoId;
      const prod = productos.find((p2) => p2.id === t2.productoId);
      return !!prod && prod.localId === localActivoId;
    });
  }, [traspasos, productos, localActivoId]);
  const arqueosDelLocalActivo = (0, import_react4.useMemo)(() => localActivoId ? arqueos.filter((a2) => a2.localId === localActivoId) : arqueos, [arqueos, localActivoId]);
  const movimientosCajaDelLocalActivo = (0, import_react4.useMemo)(() => localActivoId ? movimientosCaja.filter((m2) => m2.localId === localActivoId) : movimientosCaja, [movimientosCaja, localActivoId]);
  const pisoVentaBajoDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p2) => p2.tipo !== "elaborado" && Number(p2.stockMinimoPisoVenta) > 0 && (Number(p2.stockPisoVenta) || 0) <= Number(p2.stockMinimoPisoVenta)),
    [productosDelLocalActivo]
  );
'''
s = s[:i] + derivados + s[i:]
print('OK derivados operativos por local')

# ------------------------------------------------------------------
# 2) Núcleo de Productos: un ID explícitamente de otro local no muta.
# ------------------------------------------------------------------
inicio = s.index('function crearLogicaProductos({')
fin = s.index('function crearLogicaPedidos(', inicio)
b = s[inicio:fin]
ancla = re.search(r'function crearLogicaProductos\([^\n]+\) \{\n', b).group(0)
helper = ancla + '''  function productoEsDelLocalActivo(prod) {
    if (!prod) return false;
    if (!localActivoId) return true;
    return !prod.localId || prod.localId === localActivoId;
  }
'''
b = uno(b, ancla, helper, 'Productos: helper local')

# Alta: el caller no puede imponer otro local.
b = rx_uno(b, r'setProductos\(\(s2\) => \[\.\.\.s2, \{ id: uid\(\), stock: Number\(data\.stock\) \|\| 0, localId: localActivoId \|\| null, \.\.\.data \}\]\);',
'''setProductos((s2) => [...s2, { id: uid(), stock: Number(data.stock) || 0, ...data, localId: localActivoId || data.localId || null }]);''', 'Productos: alta fuerza local')

# Guardas en update/delete/reactivar/salida.
b = rx_uno(b, r'(function updateProducto\(id, data\) \{\n\s*const \w+ = productos\.find\([^\n]+\);)', r'\1\n    if (!productoEsDelLocalActivo(producto)) return false;', 'Productos: update protegido') if 'const producto = productos.find' in b else b
# Variante si el nombre local no es producto.
if 'function updateProducto(id, data)' in b and 'productoEsDelLocalActivo(producto)' not in b:
    b = rx_uno(b, r'(function updateProducto\(id, data\) \{\n\s*const (\w+) = productos\.find\([^\n]+\);)', lambda m: m.group(1) + f'\n    if (!productoEsDelLocalActivo({m.group(2)})) return false;', 'Productos: update protegido variante')

for fn, nom in [('deleteProducto','borrado'),('reactivarProducto','reactivación')]:
    patron = rf'(function {fn}\(id\) \{{\n\s*const (\w+) = productos\.find\([^\n]+\);)'
    if re.search(patron,b,re.S):
        b = rx_uno(b, patron, lambda m: m.group(1)+f'\n    if (!productoEsDelLocalActivo({m.group(2)})) return false;', f'Productos: {nom} protegido')
    else:
        # Si no hay lookup previo, añadir uno al inicio.
        b = uno(b, f'  function {fn}(id) {{\n', f'  function {fn}(id) {{\n    const actual = productos.find((p2) => p2.id === id);\n    if (!productoEsDelLocalActivo(actual)) return false;\n', f'Productos: {nom} protegido')

b = rx_uno(b, r'(function registrarSalida\(productoId, cantidad, motivo, meta = \{\}\) \{\n\s*if \(almacenCongelado\) return[^\n]*;?\n\s*const (\w+) = productos\.find\([^\n]+\);)', lambda m: m.group(1)+f'\n    if (!productoEsDelLocalActivo({m.group(2)})) return false;', 'Productos: salida protegida')

# Ajuste producto por otro: proteger origen y destino tras ambos lookups.
pat = r'(function ajustarProductoPorOtro\([^\n]+\) \{.*?const (\w+) = productos\.find\([^\n]+productoOrigenId[^\n]+\);.*?const (\w+) = productos\.find\([^\n]+productoDestinoId[^\n]+\);)'
m = re.search(pat,b,re.S)
assert m, 'Productos: no se localizaron origen/destino del ajuste'
insert = m.group(1) + f'\n    if (!productoEsDelLocalActivo({m.group(2)}) || !productoEsDelLocalActivo({m.group(3)})) return false;'
b = b[:m.start()] + insert + b[m.end():]
print('OK Productos: ajuste cruzado protegido')
s = s[:inicio] + b + s[fin:]

# ------------------------------------------------------------------
# 3) Venta rápida: local activo en productos, movimientos, arqueo y anulación.
# ------------------------------------------------------------------
s = uno(s, 'function crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos }) {', 'function crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId }) {', 'Venta: firma con local')
inicio = s.index('function crearLogicaVenta({')
fin = s.index('function crearLogicaTraspasos(', inicio)
b = s[inicio:fin]
ancla = re.search(r'function crearLogicaVenta\([^\n]+\) \{\n',b).group(0)
b = uno(b, ancla, ancla + '''  function productoEsDelLocalActivoVenta(prod) {
    if (!prod) return false;
    if (!localActivoId) return true;
    return !prod.localId || prod.localId === localActivoId;
  }
  function movimientoEsDelLocalActivoVenta(m2) {
    if (!localActivoId) return true;
    if (m2.localId) return m2.localId === localActivoId;
    const prod = productos.find((p2) => p2.id === m2.productoId);
    return !!prod && (!prod.localId || prod.localId === localActivoId);
  }
''', 'Venta: helpers local')
# Guardar local en líneas cloud si patrón existe.
b = b.replace('localId: prod ? prod.localId || null : null', 'localId: prod ? prod.localId || localActivoId || null : localActivoId || null')
# Producto de carrito/linea: añadir filtro donde se obtiene prod por productoId.
b, n = re.subn(r'(const prod = productos\.find\(\(p2\) => p2\.id === ([^;]+)\);)', r'\1\n      if (!productoEsDelLocalActivoVenta(prod)) return null;', b, count=1)
assert n==1, 'Venta: lookup principal de producto no localizado'
# Si el flujo construye array, eliminar nulls en el primer map relevante.
b = b.replace('    });\n    if (!lineas', '    }).filter(Boolean);\n    if (!lineas', 1) if '    });\n    if (!lineas' in b else b
# Anulación: limitar movimientos del ventaId al local.
b = uno(b, 'const lineas = movimientosActuales.filter((m2) => m2.ventaId === ventaId && esVenta(m2));', 'const lineas = movimientosActuales.filter((m2) => m2.ventaId === ventaId && esVenta(m2) && movimientoEsDelLocalActivoVenta(m2));', 'Venta: anulación por local')
# Arqueo del día debe corresponder al local de la venta.
b = b.replace('arqueos.find((a2) => a2.fecha === dia)', 'arqueos.find((a2) => a2.fecha === dia && (!localActivoId || a2.localId === localActivoId))')
s = s[:inicio] + b + s[fin:]
# Invocación.
s = rx_uno(s, r'crearLogicaVenta\(\{ pedidos,', 'crearLogicaVenta({ pedidos,', 'noop venta invocacion') if False else s
# Añadir localActivoId a la invocación existente por bloque.
pat = r'(crearLogicaVenta\(\{[^}]+)(\}\);)'
m = re.search(pat,s,re.S); assert m, 'Invocación crearLogicaVenta no encontrada'
inv=m.group(1)
if 'localActivoId' not in inv:
    inv = inv.rstrip() + ', localActivoId '
s = s[:m.start()] + inv + m.group(2) + s[m.end():]
print('OK Venta: invocación con local')

# ------------------------------------------------------------------
# 4) Encargos: datos y mutaciones del local activo.
# ------------------------------------------------------------------
inicio=s.index('function crearLogicaEncargos(')
fin=s.index('function crearLogicaVenta(',inicio)
b=s[inicio:fin]
ancla=re.search(r'function crearLogicaEncargos\([^\n]+\) \{\n',b).group(0)
b=uno(b,ancla,ancla+'''  function localDeEncargo(e2) {
    if (!e2) return null;
    if (e2.localId) return e2.localId;
    const ids = [...new Set((e2.lineas || []).map((ln2) => productos.find((p2) => p2.id === ln2.productoId)?.localId).filter(Boolean))];
    return ids.length === 1 ? ids[0] : null;
  }
  function encargoEsDelLocalActivo(e2) {
    if (!e2) return false;
    if (!localActivoId) return true;
    return localDeEncargo(e2) === localActivoId;
  }
''','Encargos: helpers local')
# Alta: impedir líneas de otro local y forzar localActivoId.
b=uno(b,'  function addEncargo(data) {\n','  function addEncargo(data) {\n    if (localActivoId && (data.lineas || []).some((ln2) => { const p2 = productos.find((x3) => x3.id === ln2.productoId); return p2 && p2.localId && p2.localId !== localActivoId; })) return false;\n','Encargos: alta protegida')
# En cálculo de local, priorizar activo.
b=b.replace('localId: data.localId || (idsLocalesLineas.length === 1 ? idsLocalesLineas[0] : null) || localActivoId || null', 'localId: localActivoId || (idsLocalesLineas.length === 1 ? idsLocalesLineas[0] : null) || data.localId || null')
# update/delete/entregar: añadir lookup/guard si no existe.
for fn in ['updateEncargo','deleteEncargo','entregarEncargo']:
    token=f'  function {fn}('
    pos=b.find(token); assert pos>=0, f'Encargos: {fn} no encontrado'
    brace=b.find('{',pos); line_end=b.find('\n',brace)
    firma=b[pos:line_end+1]
    # infer first id argument from signature
    args=firma[firma.find('(')+1:firma.find(')')]
    idarg=args.split(',')[0].strip()
    guard=f'    const actual = encargos.find((e2) => e2.id === {idarg});\n    if (!encargoEsDelLocalActivo(actual)) return false;\n'
    b=b[:line_end+1]+guard+b[line_end+1:]
    print('OK Encargos:',fn,'protegido')
s=s[:inicio]+b+s[fin:]

# ------------------------------------------------------------------
# 5) Devoluciones: producto y registro del local.
# ------------------------------------------------------------------
s=uno(s,'function crearLogicaDevoluciones({ productos, setProductos, movimientos, setMovimientos, devoluciones, setDevoluciones, registrarAuditoria, registrarMovimientoCaja }) {','function crearLogicaDevoluciones({ productos, setProductos, movimientos, setMovimientos, devoluciones, setDevoluciones, registrarAuditoria, registrarMovimientoCaja, localActivoId }) {','Devoluciones: firma con local')
inicio=s.index('function crearLogicaDevoluciones(')
fin=s.index('function crearLogicaClientes(',inicio)
b=s[inicio:fin]
ancla=re.search(r'function crearLogicaDevoluciones\([^\n]+\) \{\n',b).group(0)
b=uno(b,ancla,ancla+'''  function productoEsDelLocalActivoDevolucion(prod) {
    if (!prod) return false;
    if (!localActivoId) return true;
    return !prod.localId || prod.localId === localActivoId;
  }
''','Devoluciones: helper local')
# Tras cada lookup `const p2/prod = productos.find` en las dos funciones, insertar guardia.
def guard_lookup(match):
    var=match.group(1)
    return match.group(0)+f'\n    if (!productoEsDelLocalActivoDevolucion({var})) return false;'
b,n=re.subn(r'const (\w+) = productos\.find\([^\n]+\);',guard_lookup,b,count=2)
assert n==2,f'Devoluciones: esperados 2 lookups, {n}'
# Añadir localId a cada registro de devolución justo después del id.
b,n=re.subn(r'(const dev = \{\n\s*id: uid\(\),)',r'\1\n      localId: prod.localId || localActivoId || null,',b,count=2)
if n!=2:
    # variable puede ser p2; reemplazo genérico según función usando productoId lookup.
    b,n2=re.subn(r'(const dev = \{\n\s*id: uid\(\),)',r'\1\n      localId: localActivoId || null,',b,count=2-n)
    n+=n2
assert n==2,f'Devoluciones: no se añadieron 2 localId ({n})'
print('OK Devoluciones: registros con localId')
s=s[:inicio]+b+s[fin:]
# Invocación localActivoId.
pat=r'(crearLogicaDevoluciones\(\{[^}]+)(\}\);)'; m=re.search(pat,s,re.S); assert m
inv=m.group(1)
if 'localActivoId' not in inv: inv=inv.rstrip()+', localActivoId '
s=s[:m.start()]+inv+m.group(2)+s[m.end():]

# ------------------------------------------------------------------
# 6) Traspasos: producto y registro del local.
# ------------------------------------------------------------------
s=uno(s,'function crearLogicaTraspasos({ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria }) {','function crearLogicaTraspasos({ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria, localActivoId }) {','Traspasos: firma con local')
inicio=s.index('function crearLogicaTraspasos('); fin=s.index('function crearLogicaSeguridad(',inicio); b=s[inicio:fin]
ancla=re.search(r'function crearLogicaTraspasos\([^\n]+\) \{\n',b).group(0)
b=uno(b,ancla,ancla+'''  function productoEsDelLocalActivoTraspaso(prod) {
    if (!prod) return false;
    if (!localActivoId) return true;
    return !prod.localId || prod.localId === localActivoId;
  }
''','Traspasos: helper local')
m=re.search(r'(const (\w+) = productos\.find\([^\n]+\);)',b); assert m
b=b[:m.end()]+f'\n    if (!productoEsDelLocalActivoTraspaso({m.group(2)})) return false;'+b[m.end():]
# Añadir localId al registro `setTraspasos` donde haya objeto con productoId.
b,n=re.subn(r'(\{ id: uid\(\), productoId,)',r'{ id: uid(), localId: localActivoId || p2.localId || null, productoId,',b,count=1)
if n==0:
    b,n=re.subn(r'(\{ id: uid\(\),)',r'{ id: uid(), localId: localActivoId || null,',b,count=1)
assert n==1,'Traspasos: registro no localizado'
s=s[:inicio]+b+s[fin:]
pat=r'(crearLogicaTraspasos\(\{[^}]+)(\}\);)'; m=re.search(pat,s,re.S); assert m
inv=m.group(1)
if 'localActivoId' not in inv: inv=inv.rstrip()+', localActivoId '
s=s[:m.start()]+inv+m.group(2)+s[m.end():]

# ------------------------------------------------------------------
# 7) Caja y movimientos de caja.
# ------------------------------------------------------------------
inicio=s.index('function crearLogicaCaja('); fin=s.index('function crearLogicaMovimientosCaja(',inicio); b=s[inicio:fin]
# Forzar localId después de data.
b=b.replace('{ id: uid(), localId: data.localId || localActivoId || null, ...data }','{ id: uid(), ...data, localId: localActivoId || data.localId || null }')
# Borrado estricto usando el propio estado para no necesitar cambiar firma.
b=uno(b,'  function deleteArqueo(id) {\n    setArqueos((s2) => s2.filter((a2) => a2.id !== id));\n  }','''  function deleteArqueo(id) {
    setArqueos((s2) => {
      const actual = s2.find((a2) => a2.id === id);
      if (!actual || localActivoId && actual.localId !== localActivoId) return s2;
      return s2.filter((a2) => a2.id !== id);
    });
  }''','Caja: borrar arqueo protegido')
s=s[:inicio]+b+s[fin:]

s=uno(s,'function crearLogicaMovimientosCaja({ movimientosCaja, setMovimientosCaja, registrarAuditoria }) {','function crearLogicaMovimientosCaja({ movimientosCaja, setMovimientosCaja, registrarAuditoria, localActivoId }) {','Caja: movimientos firma local')
inicio=s.index('function crearLogicaMovimientosCaja('); fin=s.index('function crearLogicaDevoluciones(',inicio); b=s[inicio:fin]
# Entrada: insertar localId tras id si no lo tiene.
b,n=re.subn(r'(const entrada = \{\n\s*id: uid\(\),)',r'\1\n      localId: localActivoId || null,',b,count=1); assert n==1,'Caja: entrada no localizada'
# Borrado protegido.
b=uno(b,'  function eliminarMovimientoCaja(id) {\n    const mov = movimientosCaja.find((m2) => m2.id === id);','  function eliminarMovimientoCaja(id) {\n    const mov = movimientosCaja.find((m2) => m2.id === id);\n    if (!mov || localActivoId && mov.localId !== localActivoId) return false;','Caja: eliminar movimiento protegido')
s=s[:inicio]+b+s[fin:]
pat=r'(crearLogicaMovimientosCaja\(\{[^}]+)(\}\);)'; m=re.search(pat,s,re.S); assert m
inv=m.group(1)
if 'localActivoId' not in inv: inv=inv.rstrip()+', localActivoId '
s=s[:m.start()]+inv+m.group(2)+s[m.end():]

# ------------------------------------------------------------------
# 8) Render local de las pantallas del bloque 5.
# ------------------------------------------------------------------
# Historial
ini=s.index('tab === "historial_producto"'); fin=s.index('tab === "aceite"',ini); b=s[ini:fin]
for viejo,nuevo,nombre in [
('      productos,\n','      productos: productosDelLocalActivo,\n','Historial productos'),
('      movimientos,\n','      movimientos: movimientosDelLocalActivo,\n','Historial movimientos'),
('      pedidos,\n','      pedidos: pedidosDelLocalActivo,\n','Historial pedidos'),
('      albaranes,\n','      albaranes: albaranesDelLocalActivo,\n','Historial albaranes'),
('      traspasos\n','      traspasos: traspasosDelLocalActivo\n','Historial traspasos')]:
    b=uno(b,viejo,nuevo,nombre)
s=s[:ini]+b+s[fin:]

# Mermas exact compact render.
s=uno(s,'tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos, movimientos, registrarSalida, almacenCongelado })','tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado })','Mermas por local')
# Venta
s=uno(s,'tab === "venta" && /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos, venderCarrito, anularVenta, movimientos, registrarAuditoria })','tab === "venta" && /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria })','Venta render local')
# Encargos block
ini=s.index('tab === "encargos"'); fin=s.index('tab === "clientes"',ini); b=s[ini:fin]
b=uno(b,'      encargosPendientes,\n','      encargosPendientes: encargosPendientesDelLocalActivo,\n','Encargos pendientes local')
b=uno(b,'      encargos,\n','      encargos: encargosDelLocalActivo,\n','Encargos colección local')
b=uno(b,'      productos,\n','      productos: productosDelLocalActivo,\n','Encargos productos local')
s=s[:ini]+b+s[fin:]
# Devoluciones
s=uno(s,'{ productos, proveedores, devoluciones, registrarDevolucionCliente, registrarDevolucionProveedor }','{ productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor }','Devoluciones render local')
# Caja
ini=s.index('tab === "caja"'); fin=s.index('tab === "tesoreria"',ini); b=s[ini:fin]
for viejo,nuevo,nombre in [
('      movimientos,\n','      movimientos: movimientosDelLocalActivo,\n','Caja movimientos local'),
('      arqueos,\n','      arqueos: arqueosDelLocalActivo,\n','Caja arqueos local'),
('      encargos,\n','      encargos: encargosDelLocalActivo,\n','Caja encargos local'),
('      movimientosCaja,\n','      movimientosCaja: movimientosCajaDelLocalActivo,\n','Caja movimientosCaja local')]: b=uno(b,viejo,nuevo,nombre)
s=s[:ini]+b+s[fin:]
# Traspasos
s=uno(s,'tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos, traspasos, traspasarStock, pisoVentaBajo, fichasCosto })','tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, traspasos: traspasosDelLocalActivo, traspasarStock, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto })','Traspasos render local')
# Encargos badge.
s=uno(s,'{ id: "encargos", label: "Encargos", icon: CalendarDays, badge: encargosUrgentes.length, badgeColor: C2.red }','{ id: "encargos", label: "Encargos", icon: CalendarDays, badge: encargosUrgentesDelLocalActivo.length, badgeColor: C2.red }','Encargos badge local')

# ------------------------------------------------------------------
# Guardas finales.
# ------------------------------------------------------------------
assert 'movimientosCaja: movimientosCajaDelLocalActivo' in s
assert 'devoluciones: devolucionesDelLocalActivo' in s
assert 'traspasos: traspasosDelLocalActivo' in s
assert 'encargos: encargosDelLocalActivo' in s
assert 'badge: encargosUrgentesDelLocalActivo.length' in s
assert 'productos: productosDelLocalActivo, venderCarrito' in s
assert 'Mermas, { productos: productosDelLocalActivo' in s
assert 'localId: localActivoId || null' in s
p.write_text(s,encoding='utf-8')
print('GUARDAS_OK')
