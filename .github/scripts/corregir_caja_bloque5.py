from pathlib import Path

p = Path('.github/scripts/aplicar_operaciones_locales_bloque5.py')
s = p.read_text(encoding='utf-8')

ini = s.index("# ------------------------------------------------------------------\n# 7) Caja y movimientos de caja.")
fin = s.index("# ------------------------------------------------------------------\n# 8) Render local de las pantallas del bloque 5.", ini)

reemplazo = r"""# ------------------------------------------------------------------
# 7) Caja y movimientos de caja.
# ------------------------------------------------------------------
inicio=s.index('function crearLogicaCaja('); fin=s.index('function crearLogicaMovimientosCaja(',inicio); b=s[inicio:fin]
b=uno(b,
'    setArqueos((s2) => [{ id: uid(), fecha: todayISO(), ...data, localId: data.localId || localActivoId || null }, ...s2]);',
'    setArqueos((s2) => [{ id: uid(), fecha: todayISO(), ...data, localId: localActivoId || data.localId || null }, ...s2]);',
'Caja: alta de arqueo fuerza local')
b=uno(b,
'          localId: data.localId || localActivoId || null,',
'          localId: localActivoId || data.localId || null,',
'Caja: notificación fuerza local')
viejo_delete_arqueo = '  function deleteArqueo(id) {\n    setArqueos((s2) => s2.filter((a2) => a2.id !== id));\n  }'
nuevo_delete_arqueo = '  function deleteArqueo(id) {\n    setArqueos((s2) => {\n      const actual = s2.find((a2) => a2.id === id);\n      if (!actual || localActivoId && actual.localId !== localActivoId) return s2;\n      return s2.filter((a2) => a2.id !== id);\n    });\n  }'
b=uno(b,viejo_delete_arqueo,nuevo_delete_arqueo,'Caja: borrar arqueo protegido')
s=s[:inicio]+b+s[fin:]

s=uno(s,
'function crearLogicaMovimientosCaja({ movimientosCaja, setMovimientosCaja, registrarAuditoria }) {',
'function crearLogicaMovimientosCaja({ movimientosCaja, setMovimientosCaja, registrarAuditoria, localActivoId }) {',
'Caja: movimientos firma local')
inicio=s.index('function crearLogicaMovimientosCaja('); fin=s.index('function crearLogicaDevoluciones(',inicio); b=s[inicio:fin]
b=uno(b,
'    const nuevo = { id: uid(), fecha: fecha || todayISO(), tipo, importe: importeNum, motivo: (motivo || "").trim(), creadoEn: (/* @__PURE__ */ new Date()).toISOString() };',
'    const nuevo = { id: uid(), fecha: fecha || todayISO(), tipo, importe: importeNum, motivo: (motivo || "").trim(), creadoEn: (/* @__PURE__ */ new Date()).toISOString(), localId: localActivoId || null };',
'Caja: movimiento con localId')
viejo_eliminar_mov = '  function eliminarMovimientoCaja(id) {\n    const m2 = movimientosCaja.find((x3) => x3.id === id);'
nuevo_eliminar_mov = '  function eliminarMovimientoCaja(id) {\n    const m2 = movimientosCaja.find((x3) => x3.id === id);\n    if (!m2 || localActivoId && m2.localId !== localActivoId) return false;'
b=uno(b,viejo_eliminar_mov,nuevo_eliminar_mov,'Caja: eliminar movimiento protegido')
s=s[:inicio]+b+s[fin:]
pat=r'(crearLogicaMovimientosCaja\(\{[^}]+)(\}\);)'; m=re.search(pat,s,re.S); assert m, 'Caja: invocación movimientos no localizada'
inv=m.group(1)
if 'localActivoId' not in inv: inv=inv.rstrip()+', localActivoId '
s=s[:m.start()]+inv+m.group(2)+s[m.end():]

"""

s = s[:ini] + reemplazo + s[fin:]

# Historial: la prop `traspasos` lleva coma en el bundle compilado.
viejo_hist = "('      traspasos\\n','      traspasos: traspasosDelLocalActivo\\n','Historial traspasos')"
nuevo_hist = "('      traspasos,\\n','      traspasos: traspasosDelLocalActivo,\\n','Historial traspasos')"
assert s.count(viejo_hist) == 1, f'Historial traspasos: ancla temporal esperada 1, encontrada {s.count(viejo_hist)}'
s = s.replace(viejo_hist, nuevo_hist, 1)

# Devoluciones: acotar la sustitución al render de la pestaña, no a la firma del componente.
viejo_dev = "s=uno(s,'{ productos, proveedores, devoluciones, registrarDevolucionCliente, registrarDevolucionProveedor }','{ productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor }','Devoluciones render local')"
nuevo_dev = "ini=s.index('tab === \\\"devoluciones\\\"'); fin=s.index('tab === \\\"facturas\\\"',ini); b=s[ini:fin]\nb=uno(b,'{ productos, proveedores, devoluciones, registrarDevolucionCliente, registrarDevolucionProveedor }','{ productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor }','Devoluciones render local')\ns=s[:ini]+b+s[fin:]"
assert s.count(viejo_dev) == 1, f'Devoluciones render temporal: esperado 1, encontrado {s.count(viejo_dev)}'
s = s.replace(viejo_dev, nuevo_dev, 1)

p.write_text(s, encoding='utf-8')
print('CORRECCION_CAJA_BLOQUE5_OK')
