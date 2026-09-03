from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

ancla_locales = 'function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo }) {'
if s.count(ancla_locales) != 1:
    raise SystemExit(f'guard Locales: {s.count(ancla_locales)}')

helper = r'''function DatosBasicosTicketLocal({ local, actualizarLocal }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const esChocoloyos = String(local?.nombre || "").trim().toLowerCase().replace(/\.$/, "") === "chocoloyos s.l";
    setForm({
      nombreComercialTicket: local?.nombreComercialTicket || local?.nombre || "",
      direccionTicket: local?.direccionTicket || local?.direccion || (esChocoloyos ? "LÓPEZ DE HOYOS, 81 · 28002 MADRID (ESPAÑA)" : ""),
      telefonoTicket: local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),
      emailTicket: local?.emailTicket || ""
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
    actualizarLocal(local.id, {
      nombreComercialTicket: String(form.nombreComercialTicket || "").trim(),
      direccionTicket: String(form.direccionTicket || "").trim(),
      telefonoTicket: String(form.telefonoTicket || "").trim(),
      emailTicket: String(form.emailTicket || "").trim()
    });
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Datos TPV"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setAbierto(false), title: `Datos TPV · ${local.nombre}` },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Estos datos pertenecen únicamente a este local y aparecerán en sus tickets."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre comercial" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombreComercialTicket, onChange: (e) => campo("nombreComercialTicket", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Dirección para el ticket" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.direccionTicket, onChange: (e) => campo("direccionTicket", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Teléfono" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.telefonoTicket, onChange: (e) => campo("telefonoTicket", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo electrónico" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "email", value: form.emailTicket, onChange: (e) => campo("emailTicket", e.target.value), placeholder: "correo@local.es" })),
      guardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.accent } }, "Datos guardados."),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardar }, "Guardar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAbierto(false) }, "Cerrar")
      )
    )
  );
}
'''

s = s.replace(ancla_locales, helper + ancla_locales, 1)

old_buttons = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, l2.id !== localActivoId && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => cambiarLocalActivo(l2.id) }, "Usar este"), activos.length > 1 &&'
new_buttons = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, l2.id !== localActivoId && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => cambiarLocalActivo(l2.id) }, "Usar este"), /* @__PURE__ */ import_react4.default.createElement(DatosBasicosTicketLocal, { local: l2, actualizarLocal }), activos.length > 1 &&'
if s.count(old_buttons) != 1:
    raise SystemExit(f'guard botones Locales: {s.count(old_buttons)}')
s = s.replace(old_buttons, new_buttons, 1)

old_vars = '    const nombreLocal = local?.nombre || "Local sin nombre";'
new_vars = '''    const nombreLocal = local?.nombreComercialTicket || local?.nombre || "Local sin nombre";
    const direccionLocal = local?.direccionTicket || local?.direccion || "";
    const telefonoLocal = local?.telefonoTicket || "";
    const emailLocal = local?.emailTicket || "";'''
if s.count(old_vars) != 1:
    raise SystemExit(f'guard variables ticket: {s.count(old_vars)}')
s = s.replace(old_vars, new_vars, 1)

old_header = '''          h("div", { className: "font-bold" }, "CHOCOLOYOS, S.L."),
          h("div", null, "N.I.F.: B87342077"),
          h("div", null, "LÓPEZ DE HOYOS, 81"),
          h("div", null, "28002 MADRID (ESPAÑA)"),
          h("div", null, "Tfno.: 91 603 43 19"),
          h("div", { className: "mt-1 font-semibold" }, `LOCAL: ${nombreLocal}`)'''
new_header = '''          h("div", { className: "font-bold" }, "CHOCOLOYOS, S.L."),
          h("div", null, "N.I.F.: B87342077"),
          direccionLocal ? h("div", null, direccionLocal) : null,
          telefonoLocal ? h("div", null, `Tfno.: ${telefonoLocal}`) : null,
          emailLocal ? h("div", null, emailLocal) : null,
          h("div", { className: "mt-1 font-semibold" }, `LOCAL: ${nombreLocal}`)'''
if s.count(old_header) != 1:
    raise SystemExit(f'guard cabecera ticket: {s.count(old_header)}')
s = s.replace(old_header, new_header, 1)

if s.count('function DatosBasicosTicketLocal(') != 1:
    raise SystemExit('guard helper final')
if s.count('createElement(DatosBasicosTicketLocal') != 1:
    raise SystemExit('guard botón final')
if 'telefonoLocal ? h("div", null, `Tfno.: ${telefonoLocal}`) : null' not in s:
    raise SystemExit('guard ticket dinamico')

p.write_text(s, encoding='utf-8')
print('CAPA1_DATOS_LOCAL_TICKET_FASE4=1')
