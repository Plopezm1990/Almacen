from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# 1) Reemplazar el componente Locales completo por una versión con configuración TPV/ticket.
inicio = s.index('function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo }) {')
fin = s.index('function Respaldos(', inicio)

nuevo_locales = r'''function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo }) {
  const [mostrarForm, setMostrarForm] = import_react4.default.useState(false);
  const [nombre, setNombre] = import_react4.default.useState("");
  const [direccion, setDireccion] = import_react4.default.useState("");
  const [error, setError] = import_react4.default.useState("");
  const [confirmarDesactivar, setConfirmarDesactivar] = import_react4.default.useState(null);
  const [localTicketId, setLocalTicketId] = import_react4.default.useState(null);
  const [ticketForm, setTicketForm] = import_react4.default.useState(null);
  const [ticketGuardado, setTicketGuardado] = import_react4.default.useState(false);
  const [errorLogo, setErrorLogo] = import_react4.default.useState("");
  const activos = locales.filter((l2) => l2.activo !== false && !l2.fusionadoEn);
  const inactivos = locales.filter((l2) => l2.activo === false && !l2.fusionadoEn);
  function enviar() {
    const r = crearLocal({ nombre, direccion });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNombre("");
    setDireccion("");
    setError("");
    setMostrarForm(false);
  }
  function abrirDatosTicket(l2) {
    const esPrincipalActual = String(l2.nombre || "").trim().toLowerCase().replace(/\.$/, "") === "chocoloyos s.l";
    setLocalTicketId(l2.id);
    setTicketGuardado(false);
    setErrorLogo("");
    setTicketForm({
      nombreComercialTicket: l2.nombreComercialTicket || l2.nombre || "",
      marcaTicket: l2.marcaTicket || "Chocolatería San Ginés",
      lemaMarcaTicket: l2.lemaMarcaTicket || "MADRID 1894",
      razonSocialTicket: l2.razonSocialTicket || "CHOCOLOYOS, S.L.",
      nifTicket: l2.nifTicket || "B87342077",
      direccionTicket: l2.direccionTicket || l2.direccion || (esPrincipalActual ? "LÓPEZ DE HOYOS, 81" : ""),
      codigoPostalTicket: l2.codigoPostalTicket || (esPrincipalActual ? "28002" : ""),
      ciudadTicket: l2.ciudadTicket || (esPrincipalActual ? "MADRID" : ""),
      paisTicket: l2.paisTicket || "ESPAÑA",
      telefonoTicket: l2.telefonoTicket || (esPrincipalActual ? "91 603 43 19" : ""),
      emailTicket: l2.emailTicket || "",
      webTicket: l2.webTicket || "",
      redSocialTicket: l2.redSocialTicket || "@ChocoSanGines",
      pieTicket: l2.pieTicket || "GRACIAS POR SU VISITA",
      serieTicket: l2.serieTicket || "",
      logoTicket: l2.logoTicket || ""
    });
  }
  function cerrarDatosTicket() {
    setLocalTicketId(null);
    setTicketForm(null);
    setTicketGuardado(false);
    setErrorLogo("");
  }
  function setTicketCampo(campo, valor) {
    setTicketForm((f2) => ({ ...f2, [campo]: valor }));
    setTicketGuardado(false);
  }
  function guardarDatosTicket() {
    if (!localTicketId || !ticketForm) return;
    const limpio = {};
    Object.entries(ticketForm).forEach(([k, v]) => limpio[k] = typeof v === "string" ? v.trim() : v);
    actualizarLocal(localTicketId, limpio);
    setTicketForm(limpio);
    setTicketGuardado(true);
    setTimeout(() => setTicketGuardado(false), 2500);
  }
  function cargarLogoTicket(file) {
    if (!file) return;
    setErrorLogo("");
    if (!String(file.type || "").startsWith("image/")) {
      setErrorLogo("Elige un archivo de imagen.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorLogo("La imagen es demasiado grande. Elige una de menos de 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setErrorLogo("No se ha podido leer el logo.");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setErrorLogo("No se ha podido procesar el logo.");
      img.onload = () => {
        try {
          const maxW = 720, maxH = 300;
          const escala = Math.min(1, maxW / Math.max(1, img.width), maxH / Math.max(1, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * escala));
          canvas.height = Math.max(1, Math.round(img.height * escala));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let data = canvas.toDataURL("image/png");
          if (data.length > 700000) data = canvas.toDataURL("image/jpeg", 0.86);
          if (data.length > 900000) {
            setErrorLogo("El logo sigue siendo demasiado pesado. Usa una imagen más sencilla.");
            return;
          }
          setTicketCampo("logoTicket", data);
        } catch {
          setErrorLogo("No se ha podido preparar el logo.");
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }
  const localEditando = localTicketId ? locales.find((l2) => l2.id === localTicketId) : null;
  return /* @__PURE__ */ import_react4.default.createElement("div", null,
    /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Locales"),
    /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, "Cada local puede tener sus propios datos de TPV y ticket: nombre comercial, logo, dirección, teléfono, correo y serie. El TPV siempre usa el local seleccionado para cobrar y emitir su documento.")
    ),
    /* @__PURE__ */ import_react4.default.createElement(DiagnosticoSincronizacion, null),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }, activos.map((l2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: l2.id },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start justify-between gap-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "min-w-0" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-medium text-[13px] flex items-center gap-1.5 flex-wrap" }, l2.nombre, l2.id === localActivoId && /* @__PURE__ */ import_react4.default.createElement(Pill2, { color: C2.accent }, "activo en este dispositivo")),
          (l2.direccionTicket || l2.direccion) && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mt-0.5", style: { color: C2.inkSoft } }, l2.direccionTicket || l2.direccion),
          (l2.telefonoTicket || l2.emailTicket) && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-0.5", style: { color: C2.inkSoft } }, [l2.telefonoTicket, l2.emailTicket].filter(Boolean).join(" · "))
        ),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-1.5 flex-wrap justify-end" },
          l2.id !== localActivoId && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => cambiarLocalActivo(l2.id) }, "Usar este"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => abrirDatosTicket(l2) }, "TPV y ticket"),
          activos.length > 1 && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setConfirmarDesactivar(l2) }, "Desactivar")
        )
      )
    ))),
    mostrarForm ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: nombre, onChange: (e) => setNombre(e.target.value), placeholder: "Ej: San Ginés Centro", autoFocus: true })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Dirección (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: direccion, onChange: (e) => setDireccion(e.target.value) })),
      error && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.red } }, error),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: enviar }, "Crear local"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => { setMostrarForm(false); setError(""); } }, "Cancelar")
      )
    ) : /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setMostrarForm(true) }, "+ Añadir local nuevo"),
    inactivos.length > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-6" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] font-semibold uppercase tracking-wide mb-1", style: { color: C2.inkSoft } }, "Locales desactivados"),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, inactivos.map((l2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: l2.id, style: { opacity: 0.6 } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px]" }, l2.nombre)))
    ),
    confirmarDesactivar && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmarDesactivar(null), title: "Desactivar local" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-3" }, '"', confirmarDesactivar.nombre, '" dejará de aparecer como local activo. No se borra ningún dato — solo se oculta de la lista de "en uso".'),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => { desactivarLocal(confirmarDesactivar.id); setConfirmarDesactivar(null); } }, "Confirmar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmarDesactivar(null) }, "Cancelar")
      )
    ),
    localEditando && ticketForm && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: cerrarDatosTicket, title: `TPV y ticket · ${localEditando.nombre}` },
      /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-3", style: { background: C2.accentSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]" }, "Estos datos pertenecen solo a este local. Si mañana cambian, los tickets nuevos usarán los nuevos datos; más adelante guardaremos una copia dentro de cada venta para que los documentos antiguos nunca cambien.")),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-x-3" },
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre comercial en el ticket" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.nombreComercialTicket, onChange: (e) => setTicketCampo("nombreComercialTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Marca / cabecera" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.marcaTicket, onChange: (e) => setTicketCampo("marcaTicket", e.target.value), placeholder: "Chocolatería San Ginés" })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Lema de marca (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.lemaMarcaTicket, onChange: (e) => setTicketCampo("lemaMarcaTicket", e.target.value), placeholder: "MADRID 1894" })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Razón social" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.razonSocialTicket, onChange: (e) => setTicketCampo("razonSocialTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "NIF / CIF" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.nifTicket, onChange: (e) => setTicketCampo("nifTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Dirección del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.direccionTicket, onChange: (e) => setTicketCampo("direccionTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Código postal" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.codigoPostalTicket, onChange: (e) => setTicketCampo("codigoPostalTicket", e.target.value), inputMode: "numeric" })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Ciudad" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.ciudadTicket, onChange: (e) => setTicketCampo("ciudadTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "País" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.paisTicket, onChange: (e) => setTicketCampo("paisTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Teléfono" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.telefonoTicket, onChange: (e) => setTicketCampo("telefonoTicket", e.target.value), inputMode: "tel" })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.emailTicket, onChange: (e) => setTicketCampo("emailTicket", e.target.value), type: "email" })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Web (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.webTicket, onChange: (e) => setTicketCampo("webTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Red social / contacto (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.redSocialTicket, onChange: (e) => setTicketCampo("redSocialTicket", e.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Serie del ticket (se usará después)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.serieTicket, onChange: (e) => setTicketCampo("serieTicket", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10)), placeholder: "LH" }))
      ),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Texto al pie del ticket" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.pieTicket, onChange: (e) => setTicketCampo("pieTicket", e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-3", style: { background: C2.bg } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold mb-2" }, "Logo del ticket"),
        ticketForm.logoTicket ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-3 mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("img", { src: ticketForm.logoTicket, alt: "Logo del local", style: { maxHeight: 80, maxWidth: 220, objectFit: "contain", background: "#fff", padding: 6, borderRadius: 8 } }),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setTicketCampo("logoTicket", "") }, "Quitar logo")
        ) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mb-2", style: { color: C2.inkSoft } }, "Sin logo propio: el ticket mostrará la marca como texto."),
        /* @__PURE__ */ import_react4.default.createElement("input", { type: "file", accept: "image/*", onChange: (e) => cargarLogoTicket(e.target.files && e.target.files[0]), className: "text-[11.5px] w-full mb-2" }),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "O pega una URL de imagen" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: ticketForm.logoTicket && !ticketForm.logoTicket.startsWith("data:") ? ticketForm.logoTicket : "", onChange: (e) => setTicketCampo("logoTicket", e.target.value), placeholder: "https://.../logo.png" })),
        errorLogo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.red } }, errorLogo)
      ),
      ticketGuardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", style: { color: C2.accent } }, "✓ Datos del TPV y ticket guardados para este local."),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardarDatosTicket }, "Guardar datos del ticket"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: cerrarDatosTicket }, "Cerrar")
      )
    )
  );
}
'''

s = s[:inicio] + nuevo_locales + s[fin:]

# 2) Hacer la cabecera del ticket completamente dinámica por local.
old = '''    const nombreLocal = local?.nombre || "Local sin nombre";\n    const numeroDocumento = v2.numeroFiscal || v2.referencia;'''
new = '''    const nombreLocal = local?.nombreComercialTicket || local?.nombre || "Local sin nombre";\n    const marcaTicket = local?.marcaTicket || "Chocolatería San Ginés";\n    const lemaMarcaTicket = local?.lemaMarcaTicket || "MADRID 1894";\n    const razonSocialTicket = local?.razonSocialTicket || "CHOCOLOYOS, S.L.";\n    const nifTicket = local?.nifTicket || "B87342077";\n    const direccionTicket = local?.direccionTicket || local?.direccion || "";\n    const codigoPostalTicket = local?.codigoPostalTicket || "";\n    const ciudadTicket = local?.ciudadTicket || "";\n    const paisTicket = local?.paisTicket || "";\n    const telefonoTicket = local?.telefonoTicket || "";\n    const emailTicket = local?.emailTicket || "";\n    const webTicket = local?.webTicket || "";\n    const redSocialTicket = local?.redSocialTicket || "";\n    const pieTicket = local?.pieTicket || "GRACIAS POR SU VISITA";\n    const logoTicket = local?.logoTicket || "";\n    const numeroDocumento = v2.numeroFiscal || v2.referencia;'''
if s.count(old) != 1:
    raise SystemExit(f'ancla datos ticket esperada 1, encontrada {s.count(old)}')
s = s.replace(old, new, 1)

old_header = '''        h("div", { className: "text-center mb-3" },\n          h("div", { className: "text-[10px] font-bold tracking-[0.18em]" }, "CHOCOLATERÍA"),\n          h("div", { className: "text-[27px] font-black leading-none mt-1" }, "San Ginés"),\n          h("div", { className: "text-[10px] font-bold tracking-[0.22em] mt-1" }, "MADRID 1894")\n        ),\n        h("div", { className: "text-center text-[10.5px] leading-5 mb-3" },\n          h("div", { className: "font-bold" }, "CHOCOLOYOS, S.L."),\n          h("div", null, "N.I.F.: B87342077"),\n          h("div", null, "LÓPEZ DE HOYOS, 81"),\n          h("div", null, "28002 MADRID (ESPAÑA)"),\n          h("div", null, "Tfno.: 91 603 43 19"),\n          h("div", { className: "mt-1 font-semibold" }, `LOCAL: ${nombreLocal}`)\n        ),'''
new_header = '''        h("div", { className: "text-center mb-3" },\n          logoTicket ? h("img", { src: logoTicket, alt: marcaTicket || nombreLocal, style: { maxHeight: 82, maxWidth: "92%", objectFit: "contain", margin: "0 auto 8px" } }) : null,\n          !logoTicket && marcaTicket ? h("div", { className: "text-[23px] font-black leading-none mt-1" }, marcaTicket) : null,\n          lemaMarcaTicket ? h("div", { className: "text-[10px] font-bold tracking-[0.18em] mt-1" }, lemaMarcaTicket) : null\n        ),\n        h("div", { className: "text-center text-[10.5px] leading-5 mb-3" },\n          razonSocialTicket ? h("div", { className: "font-bold" }, razonSocialTicket) : null,\n          nifTicket ? h("div", null, `N.I.F.: ${nifTicket}`) : null,\n          direccionTicket ? h("div", null, direccionTicket) : null,\n          (codigoPostalTicket || ciudadTicket || paisTicket) ? h("div", null, [codigoPostalTicket, ciudadTicket, paisTicket ? `(${paisTicket})` : ""].filter(Boolean).join(" ")) : null,\n          telefonoTicket ? h("div", null, `Tfno.: ${telefonoTicket}`) : null,\n          emailTicket ? h("div", null, emailTicket) : null,\n          webTicket ? h("div", null, webTicket) : null,\n          h("div", { className: "mt-1 font-semibold" }, `LOCAL: ${nombreLocal}`)\n        ),'''
if s.count(old_header) != 1:
    raise SystemExit(f'ancla cabecera esperada 1, encontrada {s.count(old_header)}')
s = s.replace(old_header, new_header, 1)

old_footer = '''          h("div", null, "Si quieres obtener ofertas especiales"),\n          h("div", null, "y comunicarte con nosotros"),\n          h("div", null, "síguenos en @ChocoSanGines"),\n          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : "GRACIAS POR SU VISITA"),'''
new_footer = '''          redSocialTicket ? h("div", null, `Síguenos / contacto: ${redSocialTicket}`) : null,\n          emailTicket ? h("div", null, emailTicket) : null,\n          h("div", { className: "font-bold text-[12px] mt-3" }, v2.anulada ? "VENTA ANULADA" : pieTicket),'''
if s.count(old_footer) != 1:
    raise SystemExit(f'ancla pie esperada 1, encontrada {s.count(old_footer)}')
s = s.replace(old_footer, new_footer, 1)

# Guardas semánticas.
for token in [
    '"TPV y ticket"', 'logoTicket', 'telefonoTicket', 'emailTicket', 'serieTicket',
    'const nombreLocal = local?.nombreComercialTicket || local?.nombre',
    'redSocialTicket ? h("div", null, `Síguenos / contacto: ${redSocialTicket}`)'
]:
    if token not in s:
        raise SystemExit(f'falta guarda: {token}')

p.write_text(s, encoding='utf-8')
