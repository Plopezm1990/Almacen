from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# 1) Estado de empresas, manteniendo configEmpresa como compatibilidad legacy.
ancla_estado = '  const [localActivoId, setLocalActivoId] = (0, import_react4.useState)(null);'
if s.count(ancla_estado) != 1:
    raise SystemExit(f'guard estado localActivoId: {s.count(ancla_estado)}')
s = s.replace(ancla_estado, '  const [empresas, setEmpresas] = (0, import_react4.useState)([]);\n' + ancla_estado, 1)

# 2) Añadir empresas a la carga KV sin eliminar configEmpresa legacy.
m = re.search(r'const \[([^\]]*\bce\b[^\]]*)\] = await Promise\.all\(\[', s)
if not m:
    raise SystemExit('guard tuple carga: no encontrado')
nombres = m.group(1)
if ', ce, loc, lai' not in nombres:
    raise SystemExit('guard tuple carga: cola inesperada')
nombres2 = nombres.replace(', ce, loc, lai', ', ce, emps, loc, lai', 1)
s = s[:m.start(1)] + nombres2 + s[m.end(1):]

ancla_load = '        loadKey("configEmpresa", {'
pos = s.find(ancla_load)
if pos < 0:
    raise SystemExit('guard load configEmpresa')
pos_locales = s.find('        loadKey("locales", []),', pos)
if pos_locales < 0:
    raise SystemExit('guard load locales')
s = s[:pos_locales] + '        loadKey("empresas", []),\n' + s[pos_locales:]

# 3) Construir empresas efectivas. Si no existe la colección nueva, usar configEmpresa
# como empresa principal con ID estable, sin escribir automáticamente en nube.
ancla_locales_finales = '      let localesFinales = Array.isArray(loc) ? [...loc] : [];'
if s.count(ancla_locales_finales) != 1:
    raise SystemExit(f'guard localesFinales: {s.count(ancla_locales_finales)}')
bloque_empresas = '''      const empresaLegacy = ce && typeof ce === "object" ? ce : {
        marca: "Chocolatería San Ginés",
        lema: "MADRID 1894",
        razonSocial: "CHOCOLOYOS, S.L.",
        nif: "B87342077",
        web: "",
        redSocial: "@ChocoSanGines",
        pieDocumentos: "GRACIAS POR SU VISITA"
      };
      let empresasFinales = Array.isArray(emps) ? emps.filter((e2) => e2 && e2.id) : [];
      if (empresasFinales.length === 0) {
        empresasFinales = [{ id: "empresa-principal", ...empresaLegacy, activo: true, creadoEn: null, migradaDesdeConfigEmpresa: true }];
      }
      setEmpresas(empresasFinales);
'''
s = s.replace(ancla_locales_finales, bloque_empresas + ancla_locales_finales, 1)

# 4) Guardar colección multiempresa únicamente cuando cambie tras estar ready.
ancla_efecto_locales = '''  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);'''
if s.count(ancla_efecto_locales) != 1:
    raise SystemExit(f'guard efecto locales: {s.count(ancla_efecto_locales)}')
s = s.replace(ancla_efecto_locales, ancla_efecto_locales + '''
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empresas", empresas);
  }, [empresas, ready]);''', 1)

# 5) La empresa efectiva del TPV se deriva SIEMPRE del local activo.
ancla_informe = '  const [localInformeId, setLocalInformeId] = (0, import_react4.useState)("");'
if s.count(ancla_informe) != 1:
    raise SystemExit(f'guard localInformeId: {s.count(ancla_informe)}')
derivada = '''
  const empresaDelLocalActivo = (0, import_react4.useMemo)(() => {
    const principal = empresas[0] || null;
    const localActual = locales.find((l2) => l2.id === localActivoId) || null;
    const empresaId = localActual?.empresaId || principal?.id || null;
    return empresas.find((e2) => e2.id === empresaId) || principal || configEmpresa || null;
  }, [empresas, locales, localActivoId, configEmpresa]);'''
s = s.replace(ancla_informe, ancla_informe + derivada, 1)

# 6) Crear locales con empresaId explícito para nuevos locales.
old_sig_crear = '  function crearLocal({ nombre, direccion }) {'
new_sig_crear = '  function crearLocal({ nombre, direccion, empresaId }) {'
if s.count(old_sig_crear) != 1:
    raise SystemExit(f'guard crearLocal firma: {s.count(old_sig_crear)}')
s = s.replace(old_sig_crear, new_sig_crear, 1)
old_nuevo = '    const nuevo = { id: uid(), nombre: nombreLimpio, direccion: (direccion || "").trim(), activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString() };'
new_nuevo = '    const nuevo = { id: uid(), nombre: nombreLimpio, direccion: (direccion || "").trim(), empresaId: empresaId || null, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString() };'
if s.count(old_nuevo) != 1:
    raise SystemExit(f'guard crearLocal objeto: {s.count(old_nuevo)}')
s = s.replace(old_nuevo, new_nuevo, 1)

# 7) Reemplazar la ficha única por ficha editable por empresa + gestor multiempresa.
inicio = s.find('function FichaEmpresaBasica(')
fin = s.find('function Locales(', inicio)
if inicio < 0 or fin < 0:
    raise SystemExit('guard bloque FichaEmpresa/Locales')

nuevo_bloque = r'''function FichaEmpresaBasica({ empresa, actualizarEmpresa }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const c = empresa || {};
    setForm({
      marca: c.marca || "",
      lema: c.lema || "",
      razonSocial: c.razonSocial || "",
      nif: c.nif || "",
      web: c.web || "",
      redSocial: c.redSocial || "",
      pieDocumentos: c.pieDocumentos || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k, v) {
    setForm((f2) => ({ ...f2, [k]: v }));
    setGuardado(false);
  }
  function guardar() {
    if (!form || !empresa?.id) return;
    const limpio = {};
    Object.entries(form).forEach(([k, v]) => limpio[k] = String(v || "").trim());
    actualizarEmpresa(empresa.id, limpio);
    setForm(limpio);
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Ficha de empresa"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setAbierto(false), title: `Ficha de empresa · ${empresa?.razonSocial || empresa?.marca || "Empresa"}` },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Identidad legal y comercial de esta empresa. Sus locales mantienen aparte nombre, dirección, teléfono y correo."),
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
function GestorEmpresas({ empresas, setEmpresas }) {
  const [mostrarNueva, setMostrarNueva] = import_react4.default.useState(false);
  const [razonSocial, setRazonSocial] = import_react4.default.useState("");
  const [nif, setNif] = import_react4.default.useState("");
  const [marca, setMarca] = import_react4.default.useState("");
  const [error, setError] = import_react4.default.useState("");
  function actualizarEmpresa(id, datos) {
    setEmpresas((s2) => s2.map((e2) => e2.id === id ? { ...e2, ...datos } : e2));
  }
  function crear() {
    const razon = String(razonSocial || "").trim();
    const nifLimpio = String(nif || "").trim().toUpperCase();
    if (!razon) {
      setError("Indica la razón social de la empresa.");
      return;
    }
    if (nifLimpio && empresas.some((e2) => String(e2.nif || "").trim().toUpperCase() === nifLimpio)) {
      setError("Ya existe una empresa con ese NIF/CIF.");
      return;
    }
    const nueva = {
      id: uid(),
      marca: String(marca || "").trim() || razon,
      lema: "",
      razonSocial: razon,
      nif: nifLimpio,
      web: "",
      redSocial: "",
      pieDocumentos: "",
      activo: true,
      creadoEn: (/* @__PURE__ */ new Date()).toISOString()
    };
    setEmpresas((s2) => [...s2, nueva]);
    setRazonSocial("");
    setNif("");
    setMarca("");
    setError("");
    setMostrarNueva(false);
  }
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-3" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[14px]" }, "Empresas"),
      /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setMostrarNueva(true) }, "+ Añadir empresa")
    ),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, empresas.map((e2) => /* @__PURE__ */ import_react4.default.createElement("div", { key: e2.id, className: "rounded-xl border p-3", style: { borderColor: C2.line } },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", null,
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[13px]" }, e2.razonSocial || e2.marca || "Empresa sin nombre"),
          e2.nif && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, `NIF/CIF: ${e2.nif}`)
        ),
        /* @__PURE__ */ import_react4.default.createElement(FichaEmpresaBasica, { empresa: e2, actualizarEmpresa })
      )
    ))),
    mostrarNueva && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setMostrarNueva(false), title: "Añadir empresa" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Crea una sociedad/empresa independiente. Después podrás asignarle uno o varios locales."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Razón social" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: razonSocial, onChange: (e) => setRazonSocial(e.target.value), autoFocus: true })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "NIF / CIF" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: nif, onChange: (e) => setNif(e.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Marca / nombre comercial (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: marca, onChange: (e) => setMarca(e.target.value) })),
      error && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.red } }, error),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: crear }, "Crear empresa"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setMostrarNueva(false) }, "Cancelar")
      )
    )
  );
}
'''
s = s[:inicio] + nuevo_bloque + s[fin:]

# 8) Generalizar pantalla Locales -> Empresas y locales.
old_sig_locales = 'function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo, configEmpresa, setConfigEmpresa }) {'
new_sig_locales = 'function Locales({ locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo, configEmpresa, empresas, setEmpresas }) {'
if s.count(old_sig_locales) != 1:
    raise SystemExit(f'guard Locales firma: {s.count(old_sig_locales)}')
s = s.replace(old_sig_locales, new_sig_locales, 1)

ancla_estado_locales = '  const [confirmarDesactivar, setConfirmarDesactivar] = import_react4.default.useState(null);'
if s.count(ancla_estado_locales) != 1:
    raise SystemExit(f'guard estado Locales: {s.count(ancla_estado_locales)}')
s = s.replace(ancla_estado_locales, ancla_estado_locales + '\n  const [empresaNuevaId, setEmpresaNuevaId] = import_react4.default.useState("");', 1)

ancla_inactivos = '  const inactivos = locales.filter((l2) => l2.activo === false && !l2.fusionadoEn);'
if s.count(ancla_inactivos) != 1:
    raise SystemExit(f'guard inactivos: {s.count(ancla_inactivos)}')
s = s.replace(ancla_inactivos, ancla_inactivos + '''
  const empresaPrincipalId = empresas[0]?.id || null;
  const empresaDeLocal = (l2) => empresas.find((e2) => e2.id === (l2?.empresaId || empresaPrincipalId)) || empresas[0] || null;''', 1)

old_enviar = '    const r = crearLocal({ nombre, direccion });'
new_enviar = '    const r = crearLocal({ nombre, direccion, empresaId: empresaNuevaId || empresaPrincipalId });'
if s.count(old_enviar) != 1:
    raise SystemExit(f'guard enviar local: {s.count(old_enviar)}')
s = s.replace(old_enviar, new_enviar, 1)

# Cambiar título y gestor de empresa existente.
if s.count('SectionTitle, null, "Locales"') < 1:
    raise SystemExit('guard titulo Locales')
s = s.replace('SectionTitle, null, "Locales"', 'SectionTitle, null, "Empresas y locales"', 1)
old_gestor = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3" }, /* @__PURE__ */ import_react4.default.createElement(FichaEmpresaBasica, { configEmpresa, setConfigEmpresa })),'
new_gestor = '/* @__PURE__ */ import_react4.default.createElement(GestorEmpresas, { empresas, setEmpresas }),'
if s.count(old_gestor) != 1:
    raise SystemExit(f'guard gestor antiguo: {s.count(old_gestor)}')
s = s.replace(old_gestor, new_gestor, 1)

# Mostrar empresa a la que pertenece cada local.
old_direccion_card = 'l2.direccion && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, l2.direccion)'
new_direccion_card = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `Empresa: ${empresaDeLocal(l2)?.razonSocial || empresaDeLocal(l2)?.marca || "Sin asignar"}`), l2.direccion && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, l2.direccion)'
if s.count(old_direccion_card) != 1:
    raise SystemExit(f'guard direccion card: {s.count(old_direccion_card)}')
s = s.replace(old_direccion_card, new_direccion_card, 1)

# Añadir selector de empresa al formulario de nuevo local.
old_field_nombre = '/* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: nombre, onChange: (e) => setNombre(e.target.value), placeholder: "Ej: San Gin\\xE9s Centro", autoFocus: true })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Direcci\\xF3n (opcional)" }'
new_field_nombre = '''/* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: nombre, onChange: (e) => setNombre(e.target.value), placeholder: "Ej: San Gin\\xE9s Centro", autoFocus: true })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Empresa" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: empresaNuevaId || empresaPrincipalId || "", onChange: (e) => setEmpresaNuevaId(e.target.value), className: "w-full rounded-xl border px-3 py-2 bg-transparent", style: { borderColor: C2.line, color: C2.ink } }, empresas.map((e2) => /* @__PURE__ */ import_react4.default.createElement("option", { key: e2.id, value: e2.id }, e2.razonSocial || e2.marca || "Empresa")))), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Direcci\\xF3n (opcional)" }'''
if s.count(old_field_nombre) != 1:
    raise SystemExit(f'guard formulario local empresa: {s.count(old_field_nombre)}')
s = s.replace(old_field_nombre, new_field_nombre, 1)

# 9) Pasar empresas al módulo de gestión.
old_inv_loc = 'createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, setConfigEmpresa })'
new_inv_loc = 'createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, empresas, setEmpresas })'
if s.count(old_inv_loc) != 1:
    raise SystemExit(f'guard inv Locales: {s.count(old_inv_loc)}')
s = s.replace(old_inv_loc, new_inv_loc, 1)

# 10) TPV usa la empresa que corresponde al local, no la config global legacy.
old_tpv = 'local: locales.find((l2) => l2.id === localActivoId) || null, configEmpresa })'
new_tpv = 'local: locales.find((l2) => l2.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo })'
if s.count(old_tpv) != 1:
    raise SystemExit(f'guard inv TPV empresa: {s.count(old_tpv)}')
s = s.replace(old_tpv, new_tpv, 1)

# Guardas finales.
checks = [
    'const [empresas, setEmpresas]',
    'loadKey("empresas", [])',
    'function GestorEmpresas(',
    '"+ Añadir empresa"',
    'empresaId: empresaId || null',
    'configEmpresa: empresaDelLocalActivo',
    '"Empresas y locales"',
]
for c in checks:
    if c not in s:
        raise SystemExit(f'guard final ausente: {c}')

p.write_text(s, encoding='utf-8')
print('MULTIEMPRESA_CAPA1_OK=1')
