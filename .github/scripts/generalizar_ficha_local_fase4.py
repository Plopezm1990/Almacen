from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

repls = [
('function DatosBasicosTicketLocal({ local, actualizarLocal }) {', 'function FichaDatosLocal({ local, actualizarLocal }) {'),
('nombreComercialTicket: local?.nombreComercialTicket || local?.nombre || "",', 'nombreComercial: local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "",'),
('direccionTicket: local?.direccionTicket || local?.direccion || (esChocoloyos ? "LÓPEZ DE HOYOS, 81 · 28002 MADRID (ESPAÑA)" : ""),', 'direccion: local?.direccion || local?.direccionTicket || (esChocoloyos ? "LÓPEZ DE HOYOS, 81 · 28002 MADRID (ESPAÑA)" : ""),'),
('telefonoTicket: local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),', 'telefono: local?.telefono || local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),'),
('emailTicket: local?.emailTicket || ""', 'email: local?.email || local?.emailTicket || ""'),
('nombreComercialTicket: String(form.nombreComercialTicket || "").trim(),', 'nombreComercial: String(form.nombreComercial || "").trim(),'),
('direccionTicket: String(form.direccionTicket || "").trim(),', 'direccion: String(form.direccion || "").trim(),'),
('telefonoTicket: String(form.telefonoTicket || "").trim(),', 'telefono: String(form.telefono || "").trim(),'),
('emailTicket: String(form.emailTicket || "").trim()', 'email: String(form.email || "").trim()'),
('createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Datos TPV")', 'createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Ficha del local")'),
('title: `Datos TPV · ${local.nombre}`', 'title: `Ficha del local · ${local.nombre}`'),
('"Estos datos pertenecen únicamente a este local y aparecerán en sus tickets."', '"Esta es la identidad común de este local. La usarán el TPV y, progresivamente, inventarios, pedidos, albaranes, caja, informes y documentos que correspondan."'),
('value: form.nombreComercialTicket, onChange: (e) => campo("nombreComercialTicket", e.target.value)', 'value: form.nombreComercial, onChange: (e) => campo("nombreComercial", e.target.value)'),
('label: "Dirección para el ticket"', 'label: "Dirección del local"'),
('value: form.direccionTicket, onChange: (e) => campo("direccionTicket", e.target.value)', 'value: form.direccion, onChange: (e) => campo("direccion", e.target.value)'),
('value: form.telefonoTicket, onChange: (e) => campo("telefonoTicket", e.target.value)', 'value: form.telefono, onChange: (e) => campo("telefono", e.target.value)'),
('value: form.emailTicket, onChange: (e) => campo("emailTicket", e.target.value)', 'value: form.email, onChange: (e) => campo("email", e.target.value)'),
('createElement(DatosBasicosTicketLocal, { local: l2, actualizarLocal })', 'createElement(FichaDatosLocal, { local: l2, actualizarLocal })'),
('const nombreLocal = local?.nombreComercialTicket || local?.nombre || "Local sin nombre";', 'const nombreLocal = local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "Local sin nombre";'),
('const direccionLocal = local?.direccionTicket || local?.direccion || "";', 'const direccionLocal = local?.direccion || local?.direccionTicket || "";'),
('const telefonoLocal = local?.telefonoTicket || "";', 'const telefonoLocal = local?.telefono || local?.telefonoTicket || "";'),
('const emailLocal = local?.emailTicket || "";', 'const emailLocal = local?.email || local?.emailTicket || "";'),
]

for old, new in repls:
    c = s.count(old)
    if c != 1:
        raise SystemExit(f'guard failed ({c}): {old[:90]}')
    s = s.replace(old, new, 1)

if s.count('function FichaDatosLocal(') != 1:
    raise SystemExit('guard FichaDatosLocal final')
if s.count('"Ficha del local"') != 1:
    raise SystemExit('guard boton ficha')
if 'local?.nombreComercial || local?.nombreComercialTicket' not in s:
    raise SystemExit('guard fallback ticket')

p.write_text(s, encoding='utf-8')
print('FICHA_LOCAL_GENERAL_FASE4=1')
