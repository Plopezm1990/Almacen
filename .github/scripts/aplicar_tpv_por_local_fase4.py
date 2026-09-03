from pathlib import Path

p = Path("fuente.js")
s = p.read_text(encoding="utf-8")

# 1) Renombrar la denominación visible/operativa futura sin tocar el id interno "venta".
old_label = '"Venta r\\xE1pida"'
count_label = s.count(old_label)
assert count_label == 6, f"Se esperaban 6 referencias exactas a Venta rápida y hay {count_label}"
s = s.replace(old_label, '"TPV"')

# 2) El TPV no puede vender sin un local concreto seleccionado.
marker_vender_lineas = '  function venderLineas(lineas, opciones = {}) {\n'
assert s.count(marker_vender_lineas) == 1
s = s.replace(
    marker_vender_lineas,
    marker_vender_lineas + '    if (!localActivoId) return { ok: false, error: "Selecciona un local para abrir el TPV." };\n',
    1,
)

marker_vender_carrito = '  async function venderCarrito(lineas, medioPago = "Efectivo", detallePago = null) {\n'
assert s.count(marker_vender_carrito) == 1
s = s.replace(
    marker_vender_carrito,
    marker_vender_carrito + '    if (!localActivoId) return { ok: false, error: "Selecciona un local para abrir el TPV." };\n',
    1,
)

marker_anular = '  async function anularVenta(ventaId, movimientosActuales, motivo = "") {\n'
assert s.count(marker_anular) == 1
s = s.replace(
    marker_anular,
    marker_anular + '    if (!localActivoId) return { ok: false, error: "Selecciona un local para gestionar ventas del TPV." };\n',
    1,
)

# 3) Bloqueo visual completo cuando está seleccionado "Todos los locales".
old_render = 'tab === "venta" && /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria })'
assert s.count(old_render) == 1
new_render = '''tab === "venta" && (localActivoId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria }) : /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Selecciona un local concreto para abrir el TPV. Las ventas, el stock y la caja siempre deben registrarse en un único local.")))'''
s = s.replace(old_render, new_render, 1)

# Guardas semánticas finales.
assert s.count('{ id: "venta", label: "TPV", icon: ShoppingBag }') == 1
assert s.count('Selecciona un local para abrir el TPV.') == 2
assert s.count('Selecciona un local para gestionar ventas del TPV.') == 1
assert s.count('Selecciona un local concreto para abrir el TPV.') == 1
assert 'label: "Venta r\\xE1pida"' not in s
assert s.count('"Venta r\\xE1pida"') == 0
assert 'motivoBase = "TPV"' in s
assert 'referencia: "TPV"' in s

p.write_text(s, encoding="utf-8")
print("TPV_POR_LOCAL_OK=1")
