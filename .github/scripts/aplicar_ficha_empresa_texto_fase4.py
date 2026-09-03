from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# 1. Estado de empresa junto a locales.
old_state = '  const [locales, setLocales] = (0, import_react4.useState)([]);\n  const [localActivoId, setLocalActivoId] = (0, import_react4.useState)(null);'
new_state = '''  const [locales, setLocales] = (0, import_react4.useState)([]);
  const [configEmpresa, setConfigEmpresa] = (0, import_react4.useState)({
    marca: "Chocolatería San Ginés",
    lema: "MADRID 1894",
    razonSocial: "CHOCOLOYOS, S.L.",
    nif: "B87342077",
    web: "",
    redSocial: "@ChocoSanGines",
    pieDocumentos: "GRACIAS POR SU VISITA"
  });
  const [localActivoId, setLocalActivoId] = (0, import_react4.useState)(null);'''
if s.count(old_state) != 1:
    raise SystemExit(f'guard state: {s.count(old_state)}')
s = s.replace(old_state, new_state, 1)

# 2. Carga de KV: añadir configEmpresa antes de locales.
old_tuple = 'const [p2, pr, pe2, mo, co, fc, hi, al, cp, gg, em, fj, dm, ra, pc, cl, en, aq, tu, to, me2, pin, au, op, tr, ua, fd2, nom, fre, rac, entr, mc, dev, loc, lai] = await Promise.all(['
new_tuple = 'const [p2, pr, pe2, mo, co, fc, hi, al, cp, gg, em, fj, dm, ra, pc, cl, en, aq, tu, to, me2, pin, au, op, tr, ua, fd2, nom, fre, rac, entr, mc, dev, ce, loc, lai] = await Promise.all(['
if s.count(old_tuple) != 1:
    raise SystemExit(f'guard tuple: {s.count(old_tuple)}')
s = s.replace(old_tuple, new_tuple, 1)

old_load = '        loadKey("devoluciones", []),\n        loadKey("locales", []),\n        loadKey("localActivoId", null)'
new_load = '''        loadKey("devoluciones", []),
        loadKey("configEmpresa", {
          marca: "Chocolatería San Ginés",
          lema: "MADRID 1894",
          razonSocial: "CHOCOLOYOS, S.L.",
          nif: "B87342077",
          web: "",
          redSocial: "@ChocoSanGines",
          pieDocumentos: "GRACIAS POR SU VISITA"
        }),
        loadKey("locales", []),
        loadKey("localActivoId", null)'''
if s.count(old_load) != 1:
    raise SystemExit(f'guard load: {s.count(old_load)}')
s = s.replace(old_load, new_load, 1)

# 3. Asignar config cargada, sin autoescribir defaults.
old_set = '      setDevoluciones(dev || []);\n      let localesFinales = Array.isArray(loc) ? [...loc] : [];'
new_set = '''      setDevoluciones(dev || []);
      setConfigEmpresa(ce && typeof ce === "object" ? ce : {
        marca: "Chocolatería San Ginés",
        lema: "MADRID 1894",
        razonSocial: "CHOCOLOYOS, S.L.",
        nif: "B87342077",
        web: "",
        redSocial: "@ChocoSanGines",
        pieDocumentos: "GRACIAS POR SU VISITA"
      });
      let localesFinales = Array.isArray(loc) ? [...loc] : [];'''
if s.count(old_set) != 1:
    raise SystemExit(f'guard set: {s.count(old_set)}')
s = s.replace(old_set, new_set, 1)

# 4. Persistencia al editar.
old_effect = '''  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);'''
new_effect = '''  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("configEmpresa", configEmpresa);
  }, [configEmpresa, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);'''
if s.count(old_effect) != 1:
    raise SystemExit(f'guard effect: {s.count(old_effect)}')
s = s.replace(old_effect, new_effect, 1)

# 5. Componente pequeño e independiente de ficha de empresa.
ancla = 'function DatosBasicosTicketLocal({ local, actualizarLocal }) {'
if s.count(ancla) != 1:
    raise SystemExit(f'guard local helper: {s.count(ancla)}')
empresa_helper = r'''function FichaEmpresaBasica({ configEmpresa, setConfigEmpresa }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const c = configEmpresa || {};
    setForm({
      marca: c.marca || "Chocolatería San Ginés",
      lema: c.lema || "MADRID 1894",
      razonSocial: c.razonSocial || "CHOCOLOYOS, S.L.",
      nif: c.nif || "B87342077",
      web: c.web || "",
      redSocial: c.redSocial || "@ChocoSanGines",
      pieDocumentos: c.pieDocumentos || "GRACIAS POR SU VISITA"
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k, v) {
    setForm((f2) => ({ ...f2, [k]: v }));
    setGuardado(false);
  }
  function guardar() {
    if (!form) return;
    const limpio = {};
    Object.entries(form).forEach(([k, v]) => limpio[k] = String(v || "").trim());
    setConfigEmpresa(limpio);
    setForm(limpio);
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: abrir }, "Ficha de empresa"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setAbierto(false), title: "Ficha de empresa" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Identidad general compartida por todos los locales. Razón social y NIF se usarán en documentos fiscales; cada local mantiene aparte su dirección, teléfono y correo."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Marca" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.marca, onChange: (e) => campo("marca", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Lema / subtítulo" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.lema, onChange: (e) => campo("lema", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Razón social" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.razonSocial, onChange: (e) => campo("razonSocial", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "NIF / CIF" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nif, onChange: (e) => campo("nif", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Web (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.web, onChange: (e) => campo("web", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Red social (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.redSocial, onChange: (e) => campo("redSocial", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Texto final de documentos" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.pieDocumentos, onChange: (e) => campo("pieDocumentos", e.target.value) })),
      guardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.accent } }, "Datos de empresa guardados."),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardar }, "Guardar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAbierto(false) }, "Cerrar")
      )
    )
  );
}
'''
s = s.replace(ancla, empresa_helper + ancla, 1)

# 6. Locales recibe empresa y muestra ficha general sin reemplazar todo el componente.
old_sig = 'function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo }) {'
new_sig = 'function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo, configEmpresa, setConfigEmpresa }) {'
if s.count(old_sig) != 1:
    raise SystemExit(f'guard Locales sig: {s.count(old_sig)}')
s = s.replace(old_sig, new_sig, 1)

old_diag = '/* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }'
new_diag = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3" }, /* @__PURE__ */ import_react4.default.createElement(FichaEmpresaBasica, { configEmpresa, setConfigEmpresa })), /* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }'
if s.count(old_diag) != 1:
    raise SystemExit(f'guard Locales insert: {s.count(old_diag)}')
s = s.replace(old_diag, new_diag, 1)

old_inv_loc = 'createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista })'
new_inv_loc = 'createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, setConfigEmpresa })'
if s.count(old_inv_loc) != 1:
    raise SystemExit(f'guard Locales invocation: {s.count(old_inv_loc)}')
s = s.replace(old_inv_loc, new_inv_loc, 1)

# 7. TPV recibe configEmpresa.
old_tpv_inv = 'createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l2) => l2.id === localActivoId) || null })'
new_tpv_inv = 'createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l2) => l2.id === localActivoId) || null, configEmpresa })'
if s.count(old_tpv_inv) != 1:
    raise SystemExit(f'guard TPV invocation: {s.count(old_tpv_inv)}')
s = s.replace(old_tpv_inv, new_tpv_inv, 1)

old_tpv_sig = 'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos, registrarAuditoria, local }) {'
new_tpv_sig = 'function VentaRapida({ productos, venderCarrito, anularVenta, movimientos, registrarAuditoria, local, configEmpresa }) {'
if s.count(old_tpv_sig) != 1:
    raise SystemExit(f'guard TPV sig: {s.count(old_tpv_sig)}')
s = s.replace(old_tpv_sig, new_tpv_sig, 1)

# 8. Ticket toma identidad general de empresa.
old_ticket_vars = '''    const nombreLocal = local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "Local sin nombre";
    const direccionLocal = local?.direccion || local?.direccionTicket || "";
    const telefonoLocal = local?.telefono || local?.telefonoTicket || "";
    const emailLocal = local?.email || local?.emailTicket || "";'''
new_ticket_vars = '''    const nombreLocal = local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "Local sin nombre";
    const direccionLocal = local?.direccion || local?.direccionTicket || "";
    const telefonoLocal = local?.telefono || local?.telefonoTicket || "";
    const emailLocal = local?.email || local?.emailTicket || "";
    const empresa = configEmpresa || {};
    const marcaEmpresa = empresa.marca || "Chocolatería San Ginés";
    const lemaEmpresa = empresa.lema || "MADRID 1894";
    const razonSocialEmpresa = empresa.razonSocial || "CHOCOLOYOS, S.L.";
    const nifEmpresa = empresa.nif || "B87342077";
    const redSocialEmpresa = empresa.redSocial || "";
    const webEmpresa = empresa.web || "";
    const pieEmpresa = empresa.pieDocumentos || "GRACIAS POR SU VISITA";'''
if s.count(old_ticket_vars) != 1:
    raise SystemExit(f'guard ticket vars: {s.count(old_ticket_vars)}')
s = s.replace(old_ticket_vars, new_ticket_vars, 1)

# La cabecera actual está dividida en CHOCOLATERÍA / San Ginés / lema. Usar marca como una sola línea dinámica.
old_brand = '''          h("div", { className: "text-[10px] font-bold tracking-[0.18em]" }, "CHOCOLATERÍA"),
          h("div", { className: "text-[27px] font-black leading-none mt-1" }, "San Ginés"),
          h("div", { className: "text-[10px] font-bold tracking-[0.22em] mt-1" }, "MADRID 1894")'''
new_brand = '''          h("div", { className: "text-[10px] font-bold tracking-[0.18em]" }, "EMPRESA"),
          h("div", { className: "text-[22px] font-black leading-tight mt-1" }, marcaEmpresa),
          lemaEmpresa ? h("div", { className: "text-[10px] font-bold tracking-[0.18em] mt-1" }, lemaEmpresa) : null'''
if s.count(old_brand) != 1:
    raise SystemExit(f'guard brand: {s.count(old_brand)}')
s = s.replace(old_brand, new_brand, 1)

old_legal = '''          h("div", { className: "font-bold" }, "CHOCOLOYOS, S.L."),
          h("div", null, "N.I.F.: B87342077"),'''
new_legal = '''          h("div", { className: "font-bold" }, razonSocialEmpresa),
          nifEmpresa ? h("div", null, `N.I.F.: ${nifEmpresa}`) : null,'''
if s.count(old_legal) != 1:
    raise SystemExit(f'guard legal: {s.count(old_legal)}')
s = s.replace(old_legal, new_legal, 1)

old_social = '''          h("div", null, "Si quieres obtener ofertas especiales"),
          h("div", null, "y comunicarte con nosotros"),
          h("div", null, "síguenos en @ChocoSanGines"),
          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : "GRACIAS POR SU VISITA"),'''
new_social = '''          (redSocialEmpresa || webEmpresa) ? h("div", null,
            h("div", null, "Contacto"),
            redSocialEmpresa ? h("div", null, redSocialEmpresa) : null,
            webEmpresa ? h("div", null, webEmpresa) : null
          ) : null,
          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : pieEmpresa),'''
if s.count(old_social) != 1:
    raise SystemExit(f'guard social: {s.count(old_social)}')
s = s.replace(old_social, new_social, 1)

# Final guards.
for needle in [
    'function FichaEmpresaBasica(',
    'loadKey("configEmpresa"',
    'saveKey("configEmpresa", configEmpresa)',
    'configEmpresa, setConfigEmpresa',
    'const marcaEmpresa = empresa.marca',
    'const razonSocialEmpresa = empresa.razonSocial'
]:
    if needle not in s:
        raise SystemExit(f'guard missing: {needle}')

p.write_text(s, encoding='utf-8')
print('FICHA_EMPRESA_TEXTO_FASE4_APLICADA=1')
