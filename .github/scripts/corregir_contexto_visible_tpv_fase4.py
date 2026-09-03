from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

# 1) Crear un único cambio de contexto visible: el selector de informes y el local operativo
# se sincronizan cuando se elige un local concreto. "Todos" solo limpia la vista consolidada.
anchor='  const { crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo } = crearLogicaLocales({ locales, setLocales, localActivoId, setLocalActivoId, registrarAuditoria });\n'
assert s.count(anchor)==1
insert=anchor + '''  function seleccionarContextoLocal(id) {\n    const siguiente = id || "";\n    setLocalInformeId(siguiente);\n    if (siguiente && locales.some((l2) => l2.id === siguiente && l2.activo !== false && !l2.fusionadoEn)) {\n      cambiarLocalActivo(siguiente);\n    }\n  }\n  function cambiarLocalActivoConVista(id) {\n    cambiarLocalActivo(id);\n    if (locales.some((l2) => l2.id === id && l2.activo !== false && !l2.fusionadoEn)) setLocalInformeId(id);\n  }\n'''
s=s.replace(anchor,insert,1)

# 2) El selector visible de Dashboard/Resultados/IVA pasa a sincronizar también local operativo.
old='import_react4.default.createElement(SelectorLocalInformes, { locales, valor: localInformeId, onChange: setLocalInformeId })'
assert s.count(old)==1
s=s.replace(old,'import_react4.default.createElement(SelectorLocalInformes, { locales, valor: localInformeId, onChange: seleccionarContextoLocal })',1)

# 3) Si se cambia desde Ajustes > Locales, mantener también la vista visible alineada.
old_locales='tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo })'
assert s.count(old_locales)==1
new_locales='tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista })'
s=s.replace(old_locales,new_locales,1)

# 4) El TPV obedece al selector visible. Con Todos, no se monta el componente operativo.
old_tpv='tab === "venta" && (localActivoId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria }) : /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Selecciona un local concreto para abrir el TPV. Las ventas, el stock y la caja siempre deben registrarse en un único local.")))'
assert s.count(old_tpv)==1
new_tpv='tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un único local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales, valor: localInformeId, onChange: seleccionarContextoLocal })))'
s=s.replace(old_tpv,new_tpv,1)

# Guardas
assert s.count('onChange: seleccionarContextoLocal')==2
assert 'localInformeId && localActivoId === localInformeId ?' in s
assert 'El TPV no puede abrirse en Todos los locales.' in s
assert 'cambiarLocalActivo: cambiarLocalActivoConVista' in s
assert s.count('function seleccionarContextoLocal(id)')==1

p.write_text(s,encoding='utf-8')
print('CONTEXTO_VISIBLE_TPV_OK=1')
