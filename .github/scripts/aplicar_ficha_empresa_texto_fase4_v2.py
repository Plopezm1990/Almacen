from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

DEFAULT = '''{
    marca: "Chocolatería San Ginés",
    lema: "MADRID 1894",
    razonSocial: "CHOCOLOYOS, S.L.",
    nif: "B87342077",
    web: "",
    redSocial: "@ChocoSanGines",
    pieDocumentos: "GRACIAS POR SU VISITA"
  }'''

# Estado
old = '  const [locales, setLocales] = (0, import_react4.useState)([]);\n  const [localActivoId, setLocalActivoId] = (0, import_react4.useState)(null);'
new = '  const [locales, setLocales] = (0, import_react4.useState)([]);\n  const [configEmpresa, setConfigEmpresa] = (0, import_react4.useState)(' + DEFAULT + ');\n  const [localActivoId, setLocalActivoId] = (0, import_react4.useState)(null);'
if s.count(old) != 1: raise SystemExit(f'guard state {s.count(old)}')
s = s.replace(old, new, 1)

# Carga KV
old = 'const [p2, pr, pe2, mo, co, fc, hi, al, cp, gg, em, fj, dm, ra, pc, cl, en, aq, tu, to, me2, pin, au, op, tr, ua, fd2, nom, fre, rac, entr, mc, dev, loc, lai] = await Promise.all(['
new = 'const [p2, pr, pe2, mo, co, fc, hi, al, cp, gg, em, fj, dm, ra, pc, cl, en, aq, tu, to, me2, pin, au, op, tr, ua, fd2, nom, fre, rac, entr, mc, dev, ce, loc, lai] = await Promise.all(['
if s.count(old) != 1: raise SystemExit(f'guard tuple {s.count(old)}')
s = s.replace(old, new, 1)

old = '        loadKey("devoluciones", []),\n        loadKey("locales", []),\n        loadKey("localActivoId", null)'
new = '        loadKey("devoluciones", []),\n        loadKey("configEmpresa", ' + DEFAULT.replace('\n', '\n        ') + '),\n        loadKey("locales", []),\n        loadKey("localActivoId", null)'
if s.count(old) != 1: raise SystemExit(f'guard load {s.count(old)}')
s = s.replace(old, new, 1)

old = '      setDevoluciones(dev || []);\n      let localesFinales = Array.isArray(loc) ? [...loc] : [];'
new = '      setDevoluciones(dev || []);\n      setConfigEmpresa(ce && typeof ce === "object" ? ce : ' + DEFAULT.replace('\n', '\n      ') + ');\n      let localesFinales = Array.isArray(loc) ? [...loc] : [];'
if s.count(old) != 1: raise SystemExit(f'guard set {s.count(old)}')
s = s.replace(old, new, 1)

old = '''  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);'''
new = '''  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("configEmpresa", configEmpresa);
  }, [configEmpresa, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);'''
if s.count(old) != 1: raise SystemExit(f'guard effect {s.count(old)}')
s = s.replace(old, new, 1)

# Componente independiente, justo antes de Locales.
ancla = 'function Locales('
pos = s.find(ancla)
if pos < 0: raise SystemExit('guard Locales anchor')
helper = r'''function FichaEmpresaBasica({ configEmpresa, setConfigEmpresa }) {
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
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Identidad general compartida por todos los locales. Razón social y NIF son de la empresa; cada local conserva aparte nombre, dirección, teléfono y correo."),
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
s = s[:pos] + helper + s[pos:]

# Ampliar firma de Locales de manera independiente del contenido de props.
m = re.search(r'function Locales\(\{([^}]*)\}\) \{', s)
if not m: raise SystemExit('guard Locales signature regex')
props = m.group(1)
if 'configEmpresa' in props: raise SystemExit('configEmpresa already in Locales unexpectedly')
repl = 'function Locales({' + props.rstrip() + ', configEmpresa, setConfigEmpresa }) {'
s = s[:m.start()] + repl + s[m.end():]

# Insertar botón antes del diagnóstico.
old = '/* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }'
new = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3" }, /* @__PURE__ */ import_react4.default.createElement(FichaEmpresaBasica, { configEmpresa, setConfigEmpresa })), /* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }'
if s.count(old) != 1: raise SystemExit(f'guard insert company button {s.count(old)}')
s = s.replace(old, new, 1)

# Invocación Locales.
old = 'createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista })'
new = 'createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, setConfigEmpresa })'
if s.count(old) != 1: raise SystemExit(f'guard Locales invocation {s.count(old)}')
s = s.replace(old, new, 1)

# TPV: prop e invocación.
old = 'createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l2) => l2.id === localActivoId) || null })'
new = 'createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l2) => l2.id === localActivoId) || null, configEmpresa })'
if s.count(old) != 1: raise SystemExit(f'guard TPV invocation {s.count(old)}')
s = s.replace(old, new, 1)

m = re.search(r'function VentaRapida\(\{([^}]*)\}\) \{', s)
if not m: raise SystemExit('guard TPV signature regex')
props = m.group(1)
if 'configEmpresa' in props: raise SystemExit('configEmpresa already in TPV unexpectedly')
repl = 'function VentaRapida({' + props.rstrip() + ', configEmpresa }) {'
s = s[:m.start()] + repl + s[m.end():]

# Ticket: combinar empresa + local.
old = '''    const nombreLocal = local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "Local sin nombre";
    const direccionLocal = local?.direccion || local?.direccionTicket || "";
    const telefonoLocal = local?.telefono || local?.telefonoTicket || "";
    const emailLocal = local?.email || local?.emailTicket || "";'''
new = '''    const nombreLocal = local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "Local sin nombre";
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
if s.count(old) != 1: raise SystemExit(f'guard ticket vars {s.count(old)}')
s = s.replace(old, new, 1)

old = '''          h("div", { className: "text-[10px] font-bold tracking-[0.18em]" }, "CHOCOLATERÍA"),
          h("div", { className: "text-[27px] font-black leading-none mt-1" }, "San Ginés"),
          h("div", { className: "text-[10px] font-bold tracking-[0.22em] mt-1" }, "MADRID 1894")'''
new = '''          h("div", { className: "text-[10px] font-bold tracking-[0.18em]" }, "EMPRESA"),
          h("div", { className: "text-[22px] font-black leading-tight mt-1" }, marcaEmpresa),
          lemaEmpresa ? h("div", { className: "text-[10px] font-bold tracking-[0.18em] mt-1" }, lemaEmpresa) : null'''
if s.count(old) != 1: raise SystemExit(f'guard brand {s.count(old)}')
s = s.replace(old, new, 1)

old = '''          h("div", { className: "font-bold" }, "CHOCOLOYOS, S.L."),
          h("div", null, "N.I.F.: B87342077"),'''
new = '''          h("div", { className: "font-bold" }, razonSocialEmpresa),
          nifEmpresa ? h("div", null, `N.I.F.: ${nifEmpresa}`) : null,'''
if s.count(old) != 1: raise SystemExit(f'guard legal {s.count(old)}')
s = s.replace(old, new, 1)

old = '''          h("div", null, "Si quieres obtener ofertas especiales"),
          h("div", null, "y comunicarte con nosotros"),
          h("div", null, "síguenos en @ChocoSanGines"),
          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : "GRACIAS POR SU VISITA"),'''
new = '''          (redSocialEmpresa || webEmpresa) ? h("div", null,
            h("div", null, "Contacto"),
            redSocialEmpresa ? h("div", null, redSocialEmpresa) : null,
            webEmpresa ? h("div", null, webEmpresa) : null
          ) : null,
          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : pieEmpresa),'''
if s.count(old) != 1: raise SystemExit(f'guard footer {s.count(old)}')
s = s.replace(old, new, 1)

for needle in ['function FichaEmpresaBasica(', 'loadKey("configEmpresa"', 'saveKey("configEmpresa", configEmpresa)', 'const marcaEmpresa = empresa.marca', 'const razonSocialEmpresa = empresa.razonSocial']:
    if needle not in s: raise SystemExit('missing ' + needle)

p.write_text(s, encoding='utf-8')
print('FICHA_EMPRESA_TEXTO_FASE4_V2=1')
