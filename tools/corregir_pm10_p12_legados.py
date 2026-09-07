from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

# 1) Alinear Personal con el contrato congelado: nombre obligatorio y pagas enteras.
emp_ini=s.find('function validarEmpleadoPM10(')
emp_fin=s.find('function crearLogicaPersonal({',emp_ini)
if emp_ini<0 or emp_fin<0:
    raise SystemExit('No se encontró validarEmpleadoPM10')
emp=s[emp_ini:emp_fin]
if 'const nombre = String(datos.nombre ?? "").trim();' not in emp:
    anchor='  const datos = { ...data, localId: data.localId || localActivoId };\n'
    if anchor not in emp:
        raise SystemExit('Anchor datos empleado no encontrado')
    ins='''  const datos = { ...data, localId: data.localId || localActivoId };\n  const nombre = String(datos.nombre ?? "").trim();\n  if (!nombre) return errorValidacionPM10("campo_obligatorio", "nombre", "Escribe el nombre del empleado.");\n  datos.nombre = nombre;\n'''
    emp=emp.replace(anchor,ins,1)
# parche específico de pagas: debe ser entero > 0
old='''    ["pagas", { defecto: 14, estrictoMinimo: true }],'''
new='''    ["pagas", { defecto: 14, estrictoMinimo: true, entero: true }],'''
if old in emp:
    emp=emp.replace(old,new,1)
# hacer que validarNumero respete entero si viene en opciones
old_sig='''  const validarNumero = (campo, { defecto = 0, estrictoMinimo = false, permitirVacio = false } = {}) => {'''
new_sig='''  const validarNumero = (campo, { defecto = 0, estrictoMinimo = false, permitirVacio = false, entero = false } = {}) => {'''
if old_sig in emp:
    emp=emp.replace(old_sig,new_sig,1)
old_num='''    const r2 = numeroPM10(valorEntrada, campo, { minimo: 0, estrictoMinimo });'''
new_num='''    const r2 = numeroPM10(valorEntrada, campo, { minimo: 0, estrictoMinimo, entero });'''
if old_num in emp:
    emp=emp.replace(old_num,new_num,1)
s=s[:emp_ini]+emp+s[emp_fin:]

# 2) Detector puramente de lectura. No muta ni normaliza datos.
if 'function diagnosticarDatosLegadosPM10(' not in s:
    pos=s.find('function DiagnosticoSincronizacion()')
    if pos<0:
        raise SystemExit('No se encontró DiagnosticoSincronizacion')
    helper=r'''function diagnosticarDatosLegadosPM10({ productos = [], pedidos = [], empleados = [], encargos = [], proveedores = [], clientes = [], locales = [], empresas = [] } = {}) {
  const incidencias = [];
  const push = (dominio, registro, codigo, campo, mensaje, nivel = "error") => {
    incidencias.push({ dominio, id: registro?.id || null, codigo, campo: campo || null, mensaje, nivel, localId: registro?.localId || null });
  };
  const idsDuplicados = (dominio, lista) => {
    const vistos = /* @__PURE__ */ new Set();
    const duplicados = /* @__PURE__ */ new Set();
    for (const r2 of lista || []) {
      if (!r2?.id) {
        push(dominio, r2, "id_ausente", "id", "Registro legado sin identificador estable.", "ambiguo");
        continue;
      }
      if (vistos.has(r2.id)) duplicados.add(r2.id);
      vistos.add(r2.id);
    }
    for (const id of duplicados) push(dominio, { id }, "id_duplicado", "id", `Hay más de un registro con el id ${id}.`, "ambiguo");
  };
  const localConocido = (r2) => r2?.localId && locales.some((l22) => l22.id === r2.localId);
  const revisarContextoLocal = (dominio, r2) => {
    if (!r2?.localId) push(dominio, r2, "contexto_ambiguo", "localId", "Registro legado sin localId: no se autoasigna a ningún local.", "ambiguo");
    else if (!localConocido(r2)) push(dominio, r2, "local_inexistente", "localId", "El localId del registro no existe en el catálogo de locales cargado.", "ambiguo");
  };
  const empresaDeLocal = (localId) => locales.find((l22) => l22.id === localId)?.empresaId || null;

  idsDuplicados("Productos", productos);
  idsDuplicados("Pedidos", pedidos);
  idsDuplicados("Personal", empleados);
  idsDuplicados("Encargos", encargos);

  for (const prod of productos || []) {
    revisarContextoLocal("Productos", prod);
    const v3 = validarProductoPM10(prod, { parcial: false });
    if (!v3.ok) push("Productos", prod, v3.codigo || "invalido", v3.campo, v3.error || "Producto legado inválido.");
  }

  for (const pedido of pedidos || []) {
    revisarContextoLocal("Pedidos", pedido);
    if (pedido?.localId) {
      const v3 = validarPedidoPM10(pedido, { proveedores, productos, localActivoId: pedido.localId, pedidoActual: pedido });
      if (!v3.ok) push("Pedidos", pedido, v3.codigo || "invalido", v3.campo, v3.error || "Pedido legado inválido.");
    }
    const items = Array.isArray(pedido?.items) ? pedido.items : [];
    let todoRecibido = items.length > 0;
    for (let i33 = 0; i33 < items.length; i33++) {
      const it2 = items[i33] || {};
      const pedida = Number(it2.cantidad);
      const recibida = Number(it2.cantidadRecibida ?? 0);
      if (!Number.isFinite(recibida) || recibida < 0) push("Recepción", pedido, "cantidad_recibida_invalida", `items.${i33}.cantidadRecibida`, "La cantidad recibida acumulada no es válida.");
      if (Number.isFinite(pedida) && Number.isFinite(recibida) && recibida > pedida + 1e-9) push("Recepción", pedido, "sobre_recepcion_legada", `items.${i33}.cantidadRecibida`, "El histórico indica más unidades recibidas que pedidas.");
      if (!(Number.isFinite(pedida) && Number.isFinite(recibida) && Math.abs(pedida - recibida) <= 1e-9)) todoRecibido = false;
    }
    if (items.length && todoRecibido && pedido?.estado !== "Recibido") push("Pedidos", pedido, "estado_ambiguo", "estado", "Todas las líneas figuran recibidas pero el pedido no está marcado como Recibido.", "aviso");
    if (pedido?.estado === "Recibido" && !todoRecibido) push("Pedidos", pedido, "estado_ambiguo", "estado", "El pedido figura Recibido pero todavía hay cantidades pendientes o incoherentes.", "aviso");
  }

  for (const emp of empleados || []) {
    revisarContextoLocal("Personal", emp);
    if (emp?.localId) {
      const v3 = validarEmpleadoPM10(emp, { localActivoId: emp.localId });
      if (!v3.ok) push("Personal", emp, v3.codigo || "invalido", v3.campo, v3.error || "Ficha laboral legada inválida.");
    }
  }

  for (const enc of encargos || []) {
    revisarContextoLocal("Encargos", enc);
    if (enc?.localId) {
      const empresaId = empresaDeLocal(enc.localId);
      const v3 = validarEncargoPM10(enc, { productos, clientes, localActivoId: enc.localId, empresaId, fechaCreacion: enc.fechaCreacion || enc.fechaEntrega || todayISO() });
      if (!v3.ok) push("Encargos", enc, v3.codigo || "invalido", v3.campo, v3.error || "Encargo legado inválido.");
    }
    if (Array.isArray(enc?.lineas)) {
      const totalCalculado = enc.lineas.reduce((sum, ln2) => {
        const c2 = Number(ln2?.cantidad), p22 = Number(ln2?.precioUnitario);
        return Number.isFinite(c2) && Number.isFinite(p22) ? sum + c2 * p22 : sum;
      }, 0);
      if (enc.total !== null && enc.total !== void 0 && String(enc.total).trim() !== "") {
        const totalGuardado = Number(enc.total);
        if (!Number.isFinite(totalGuardado)) push("Encargos", enc, "total_no_finito", "total", "El total guardado del encargo no es numérico.", "ambiguo");
        else if (Math.abs(totalGuardado - totalCalculado) > 0.01) push("Encargos", enc, "total_desfasado", "total", `El total guardado (${totalGuardado}) no coincide con las líneas (${Number(totalCalculado.toFixed(2))}).`, "aviso");
      }
    }
  }

  const porDominio = {};
  for (const i22 of incidencias) porDominio[i22.dominio] = (porDominio[i22.dominio] || 0) + 1;
  return {
    ok: true,
    soloLectura: true,
    totalRegistros: (productos?.length || 0) + (pedidos?.length || 0) + (empleados?.length || 0) + (encargos?.length || 0),
    totalIncidencias: incidencias.length,
    errores: incidencias.filter((i22) => i22.nivel === "error").length,
    ambiguas: incidencias.filter((i22) => i22.nivel === "ambiguo").length,
    avisos: incidencias.filter((i22) => i22.nivel === "aviso").length,
    porDominio,
    incidencias
  };
}
function DiagnosticoDatosLegadosPM10({ diagnostico }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const d2 = diagnostico || { totalRegistros: 0, totalIncidencias: 0, errores: 0, ambiguas: 0, avisos: 0, incidencias: [] };
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-3" },
      /* @__PURE__ */ import_react4.default.createElement("div", null,
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-medium" }, "Datos legados · PM10"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, d2.totalIncidencias === 0 ? `Sin incidencias detectadas en ${d2.totalRegistros} registro(s) cargados.` : `${d2.totalIncidencias} incidencia(s): ${d2.errores} inválida(s), ${d2.ambiguas} ambigua(s), ${d2.avisos} aviso(s).`)
      ),
      /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAbierto(!abierto) }, abierto ? "Ocultar" : "Revisar")
    ),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-2", style: { color: C2.inkSoft } }, "Solo lectura: este diagnóstico no borra, migra, reasigna ni corrige automáticamente ningún registro histórico."),
    abierto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 space-y-2" },
      d2.incidencias.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "No se han detectado datos legados incompatibles con el contrato PM10." }) : d2.incidencias.slice(0, 100).map((i22, idx) => /* @__PURE__ */ import_react4.default.createElement("div", { key: `${i22.dominio}:${i22.id || "sin-id"}:${i22.codigo}:${idx}`, className: "text-[11.5px] p-2 rounded-lg", style: { background: i22.nivel === "error" ? C2.redSoft : i22.nivel === "ambiguo" ? C2.amberSoft : C2.bg } },
        /* @__PURE__ */ import_react4.default.createElement("b", null, i22.dominio), " · ", i22.id || "sin id", " · ", i22.codigo,
        i22.campo ? ` · ${i22.campo}` : "", /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-0.5" }, i22.mensaje)
      )),
      d2.incidencias.length > 100 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, `Se muestran las primeras 100 de ${d2.incidencias.length}.`)
    )
  );
}
'''
    s=s[:pos]+helper+s[pos:]

# 3) Integración visible en Empresas y locales, sin botones de mutación.
old_sig='function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo, configEmpresa, empresas, setEmpresas }) {'
new_sig='function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo, configEmpresa, empresas, setEmpresas, diagnosticoLegadosPM10 = null }) {'
if old_sig in s:
    s=s.replace(old_sig,new_sig,1)
elif new_sig not in s:
    raise SystemExit('Firma Locales no reconocida')

old_render='/* @__PURE__ */ import_react4.default.createElement(GestorEmpresas, { empresas, setEmpresas }), /* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }'
new_render='/* @__PURE__ */ import_react4.default.createElement(GestorEmpresas, { empresas, setEmpresas }), /* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null), /* @__PURE__ */ import_react4.default.createElement(DiagnosticoDatosLegadosPM10, { diagnostico: diagnosticoLegadosPM10 }), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }'
if old_render in s:
    s=s.replace(old_render,new_render,1)
elif 'DiagnosticoDatosLegadosPM10, { diagnostico: diagnosticoLegadosPM10 }' not in s:
    raise SystemExit('Render Locales no reconocido')

old_call='tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, empresas, setEmpresas })'
new_call='tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, empresas, setEmpresas, diagnosticoLegadosPM10: diagnosticarDatosLegadosPM10({ productos, pedidos: pedidos2, empleados, encargos, proveedores, clientes, locales, empresas }) })'
if old_call in s:
    s=s.replace(old_call,new_call,1)
elif new_call not in s:
    raise SystemExit('Llamada Locales no reconocida')

p.write_text(s,encoding='utf-8')
print('PM10 P12 datos legados: detector de solo lectura aplicado')
