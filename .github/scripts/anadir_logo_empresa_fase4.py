from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def reemplaza_en_bloque(texto, old, new, label):
    n = texto.count(old)
    if n != 1:
        raise SystemExit(f'{label}: se esperaban 1 coincidencia y hay {n}')
    return texto.replace(old, new, 1)


def obtener_bloque(texto, inicio, fin, label):
    i = texto.find(inicio)
    if i < 0:
        raise SystemExit(f'{label}: inicio no encontrado')
    j = texto.find(fin, i)
    if j < 0:
        raise SystemExit(f'{label}: fin no encontrado')
    return i, j, texto[i:j]

ancla_ficha = 'function FichaEmpresaBasica({ empresa, actualizarEmpresa }) {'
if 'async function prepararLogoEmpresa(' not in s:
    if s.count(ancla_ficha) != 1:
        raise SystemExit(f'ancla FichaEmpresaBasica: {s.count(ancla_ficha)}')
    helper = '''async function prepararLogoEmpresa(file) {\n  if (!file) return \"\";\n  const tiposPermitidos = [\"image/png\", \"image/jpeg\", \"image/webp\"];\n  if (!tiposPermitidos.includes(file.type)) throw new Error(\"El logo debe ser PNG, JPG o WEBP.\");\n  if (file.size > 8 * 1024 * 1024) throw new Error(\"El archivo es demasiado grande. Elige una imagen de menos de 8 MB.\");\n  const original = await new Promise((resolve, reject) => {\n    const lector = new FileReader();\n    lector.onload = () => resolve(String(lector.result || \"\"));\n    lector.onerror = () => reject(new Error(\"No se pudo leer la imagen.\"));\n    lector.readAsDataURL(file);\n  });\n  const imagen = await new Promise((resolve, reject) => {\n    const img = new Image();\n    img.onload = () => resolve(img);\n    img.onerror = () => reject(new Error(\"La imagen seleccionada no es válida.\"));\n    img.src = original;\n  });\n  const maximo = 512;\n  const anchoNatural = Number(imagen.naturalWidth || imagen.width || 1);\n  const altoNatural = Number(imagen.naturalHeight || imagen.height || 1);\n  const escala = Math.min(1, maximo / Math.max(anchoNatural, altoNatural));\n  const canvas = document.createElement(\"canvas\");\n  canvas.width = Math.max(1, Math.round(anchoNatural * escala));\n  canvas.height = Math.max(1, Math.round(altoNatural * escala));\n  const ctx = canvas.getContext(\"2d\");\n  if (!ctx) throw new Error(\"No se pudo preparar el logo.\");\n  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);\n  const webp = canvas.toDataURL(\"image/webp\", 0.88);\n  return webp.startsWith(\"data:image/webp\") ? webp : canvas.toDataURL(\"image/png\");\n}\n'''
    s = s.replace(ancla_ficha, helper + ancla_ficha, 1)

i, j, ficha = obtener_bloque(s, ancla_ficha, 'function GestorEmpresas(', 'bloque ficha')
ficha = reemplaza_en_bloque(
    ficha,
    '  const [guardado, setGuardado] = import_react4.default.useState(false);',
    '  const [guardado, setGuardado] = import_react4.default.useState(false);\n  const [logoError, setLogoError] = import_react4.default.useState(\"\");\n  const [logoCargando, setLogoCargando] = import_react4.default.useState(false);',
    'estado logo ficha'
)
ficha = reemplaza_en_bloque(
    ficha,
    '      redSocial: c.redSocial || \"\",\n      pieDocumentos: c.pieDocumentos || \"\"\n    });',
    '      redSocial: c.redSocial || \"\",\n      pieDocumentos: c.pieDocumentos || \"\",\n      logo: c.logo || \"\"\n    });',
    'cargar logo ficha'
)
ficha = reemplaza_en_bloque(
    ficha,
    '  function guardar() {',
    '''  async function cambiarLogo(e) {\n    const file = e.target.files?.[0] || null;\n    if (!file) return;\n    setLogoError(\"\");\n    setLogoCargando(true);\n    try {\n      const preparado = await prepararLogoEmpresa(file);\n      campo(\"logo\", preparado);\n    } catch (err) {\n      setLogoError(err?.message || \"No se pudo preparar el logo.\");\n    } finally {\n      setLogoCargando(false);\n      e.target.value = \"\";\n    }\n  }\n  function guardar() {''',
    'handler logo ficha'
)
marca_ficha = '      /* @__PURE__ */ import_react4.default.createElement(Field, { label: \"Marca\" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.marca, onChange: (e) => campo(\"marca\", e.target.value) })),\n'
logo_ficha = '''      /* @__PURE__ */ import_react4.default.createElement(Field, { label: \"Logo de la empresa (opcional)\" },\n        /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"space-y-2\" },\n          form.logo && /* @__PURE__ */ import_react4.default.createElement(\"img\", { src: form.logo, alt: \"Logo de la empresa\", className: \"h-20 max-w-[180px] object-contain rounded-lg border bg-white p-2\", style: { borderColor: C2.line } }),\n          /* @__PURE__ */ import_react4.default.createElement(\"input\", { type: \"file\", accept: \"image/png,image/jpeg,image/webp\", onChange: cambiarLogo, disabled: logoCargando, className: \"block w-full text-[12px]\" }),\n          /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"text-[10.5px]\", style: { color: C2.inkSoft } }, logoCargando ? \"Preparando logo…\" : \"PNG, JPG o WEBP. Se optimiza automáticamente.\"),\n          logoError && /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"text-[11px]\", style: { color: C2.red } }, logoError),\n          form.logo && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: \"ghost\", onClick: () => { campo(\"logo\", \"\"); setLogoError(\"\"); } }, \"Quitar logo\")\n        )\n      ),\n'''
ficha = reemplaza_en_bloque(ficha, marca_ficha, logo_ficha + marca_ficha, 'campo logo ficha')
s = s[:i] + ficha + s[j:]

i, j, gestor = obtener_bloque(s, 'function GestorEmpresas(', 'function Locales(', 'bloque gestor empresas')
gestor = reemplaza_en_bloque(
    gestor,
    '  const [marca, setMarca] = import_react4.default.useState(\"\");\n  const [error, setError] = import_react4.default.useState(\"\");',
    '  const [marca, setMarca] = import_react4.default.useState(\"\");\n  const [logo, setLogo] = import_react4.default.useState(\"\");\n  const [logoErrorNueva, setLogoErrorNueva] = import_react4.default.useState(\"\");\n  const [logoCargandoNueva, setLogoCargandoNueva] = import_react4.default.useState(false);\n  const [error, setError] = import_react4.default.useState(\"\");',
    'estado logo nueva empresa'
)
gestor = reemplaza_en_bloque(
    gestor,
    '  function crear() {',
    '''  async function cambiarLogoNueva(e) {\n    const file = e.target.files?.[0] || null;\n    if (!file) return;\n    setLogoErrorNueva(\"\");\n    setLogoCargandoNueva(true);\n    try {\n      setLogo(await prepararLogoEmpresa(file));\n    } catch (err) {\n      setLogoErrorNueva(err?.message || \"No se pudo preparar el logo.\");\n    } finally {\n      setLogoCargandoNueva(false);\n      e.target.value = \"\";\n    }\n  }\n  function crear() {''',
    'handler logo nueva'
)
gestor = reemplaza_en_bloque(
    gestor,
    '      marca: String(marca || \"\").trim() || razon,\n      lema: \"\",',
    '      marca: String(marca || \"\").trim() || razon,\n      logo,\n      lema: \"\",',
    'guardar logo nueva'
)
gestor = reemplaza_en_bloque(
    gestor,
    '    setNif(\"\");\n    setMarca(\"\");\n    setError(\"\");\n    setMostrarNueva(false);',
    '    setNif(\"\");\n    setMarca(\"\");\n    setLogo(\"\");\n    setLogoErrorNueva(\"\");\n    setError(\"\");\n    setMostrarNueva(false);',
    'reset logo nueva'
)
marca_nueva = '      /* @__PURE__ */ import_react4.default.createElement(Field, { label: \"Marca / nombre comercial (opcional)\" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: marca, onChange: (e) => setMarca(e.target.value) })),\n'
logo_nueva = '''      /* @__PURE__ */ import_react4.default.createElement(Field, { label: \"Logo de la empresa (opcional)\" },\n        /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"space-y-2\" },\n          logo && /* @__PURE__ */ import_react4.default.createElement(\"img\", { src: logo, alt: \"Vista previa del logo\", className: \"h-20 max-w-[180px] object-contain rounded-lg border bg-white p-2\", style: { borderColor: C2.line } }),\n          /* @__PURE__ */ import_react4.default.createElement(\"input\", { type: \"file\", accept: \"image/png,image/jpeg,image/webp\", onChange: cambiarLogoNueva, disabled: logoCargandoNueva, className: \"block w-full text-[12px]\" }),\n          /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"text-[10.5px]\", style: { color: C2.inkSoft } }, logoCargandoNueva ? \"Preparando logo…\" : \"PNG, JPG o WEBP. Se optimiza automáticamente.\"),\n          logoErrorNueva && /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"text-[11px]\", style: { color: C2.red } }, logoErrorNueva),\n          logo && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: \"ghost\", onClick: () => { setLogo(\"\"); setLogoErrorNueva(\"\"); } }, \"Quitar logo\")\n        )\n      ),\n'''
gestor = reemplaza_en_bloque(gestor, marca_nueva, marca_nueva + logo_nueva, 'campo logo nueva empresa')
old_card = '''        /* @__PURE__ */ import_react4.default.createElement(\"div\", null,\n          /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"font-semibold text-[13px]\" }, e2.razonSocial || e2.marca || \"Empresa sin nombre\"),\n          e2.nif && /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"text-[11px]\", style: { color: C2.inkSoft } }, `NIF/CIF: ${e2.nif}`)\n        ),'''
new_card = '''        /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"flex items-center gap-3 min-w-0\" },\n          e2.logo && /* @__PURE__ */ import_react4.default.createElement(\"img\", { src: e2.logo, alt: \"\", className: \"w-12 h-12 shrink-0 object-contain rounded-lg border bg-white p-1\", style: { borderColor: C2.line } }),\n          /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"min-w-0\" },\n            /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"font-semibold text-[13px]\" }, e2.razonSocial || e2.marca || \"Empresa sin nombre\"),\n            e2.nif && /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"text-[11px]\", style: { color: C2.inkSoft } }, `NIF/CIF: ${e2.nif}`)\n          )\n        ),'''
gestor = reemplaza_en_bloque(gestor, old_card, new_card, 'miniatura tarjeta empresa')
s = s[:i] + gestor + s[j:]

checks = [
    'async function prepararLogoEmpresa(file)',
    'label: \"Logo de la empresa (opcional)\"',
    'accept: \"image/png,image/jpeg,image/webp\"',
    'logo: c.logo || \"\"',
    'setLogo(await prepararLogoEmpresa(file))',
    '      logo,\n      lema: \"\"',
    'e2.logo &&',
]
for check in checks:
    if check not in s:
        raise SystemExit(f'guarda final ausente: {check}')

p.write_text(s, encoding='utf-8')
print('OK: soporte de logo por empresa añadido')
