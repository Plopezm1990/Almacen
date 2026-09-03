from pathlib import Path


def reemplaza_uno(texto, old, new, label):
    n = texto.count(old)
    if n != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y hay {n}")
    return texto.replace(old, new, 1)


def bloque_funcion(texto, nombre):
    inicio = texto.find(f"function {nombre}(")
    if inicio < 0:
        raise SystemExit(f"No se encontró function {nombre}")
    siguiente = texto.find("\nfunction ", inicio + 10)
    if siguiente < 0:
        siguiente = len(texto)
    return inicio, siguiente, texto[inicio:siguiente]


# ------------------------------------------------------------------
# INDEX / IDENTIDAD DE ARRANQUE
# ------------------------------------------------------------------
p = Path("index.html")
html = p.read_text(encoding="utf-8")
html = reemplaza_uno(html, "<title>Control de Compras y Almacen</title>", "<title>L&amp;A Suite</title>", "título HTML")
html = reemplaza_uno(
    html,
    '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />',
    '<link rel="icon" type="image/svg+xml" href="la-suite-icon.svg" />',
    "favicon",
)
html = reemplaza_uno(
    html,
    '<link rel="apple-touch-icon" href="apple-touch-icon.png" />',
    '<link rel="apple-touch-icon" href="la-suite-icon.svg" />',
    "apple touch icon",
)
html = reemplaza_uno(
    html,
    "    background: #F7F3E9; color: #17241C; z-index: 9999;",
    "    background: radial-gradient(circle at 50% 34%, #143A24 0%, #0C2714 48%, #071D12 100%); color: #E7D1A5; z-index: 9999;",
    "fondo carga",
)
html = reemplaza_uno(
    html,
    "  #cargando .marca { font-size: 15px; font-weight: 600; }\n  #cargando .paso { font-size: 12.5px; color: #6B7A6E; }\n  #cargando .barra { width: 190px; height: 4px; border-radius: 4px; background: #E2DBC7; overflow: hidden; }\n  #cargando .barra i { display: block; height: 100%; width: 30%; background: #8C6D2A; border-radius: 4px;",
    "  #cargando .logo-suite { width: min(72vw, 330px); height: auto; display: block; filter: drop-shadow(0 6px 12px rgba(0,0,0,.28)); }\n  #cargando .marca { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; letter-spacing: .18em; color: #C49A55; }\n  #cargando .sub { margin-top: -4px; font-size: 12px; letter-spacing: .035em; color: #B8AC91; }\n  #cargando .paso { font-size: 12px; color: #9FB0A5; }\n  #cargando .barra { width: 210px; height: 3px; border-radius: 4px; background: rgba(207,172,105,.18); overflow: hidden; }\n  #cargando .barra i { display: block; height: 100%; width: 30%; background: linear-gradient(90deg,#7F5823,#C69A52,#D2AD68); border-radius: 4px;",
    "estilos carga",
)
html = reemplaza_uno(
    html,
    '<div id="cargando">\n  <div class="marca">Control de Compras y Almacen</div>\n  <div class="barra"><i></i></div>\n  <div class="paso" id="paso">Abriendo…</div>\n</div>',
    '<div id="cargando">\n  <img class="logo-suite" src="la-suite-logo.svg" alt="L&A Suite" />\n  <div class="sub">Gestión integral para tu negocio</div>\n  <div class="barra"><i></i></div>\n  <div class="paso" id="paso">Abriendo…</div>\n</div>',
    "contenido carga",
)
p.write_text(html, encoding="utf-8")


# ------------------------------------------------------------------
# FUENTE / IDENTIDAD GENERAL DE LA APP
# No se modifica LOGO ni LOGO_BLANCO: pertenecen a la empresa.
# ------------------------------------------------------------------
p = Path("fuente.js")
s = p.read_text(encoding="utf-8")

ancla = 'var LOGO = "data:image/png;base64,'
if s.count(ancla) != 1:
    raise SystemExit(f"ancla logo empresa: {s.count(ancla)}")
s = s.replace(
    ancla,
    'var LOGO_PROYECTO = "la-suite-logo.svg";\nvar ICONO_PROYECTO = "la-suite-icon.svg";\nvar NOMBRE_PROYECTO = "L&A Suite";\nvar LEMA_PROYECTO = "Gestión integral para tu negocio";\n' + ancla,
    1,
)

s = s.replace(
    '// Verde extraído directamente del medallón del logo real (Chocolatería San Ginés).',
    '// Verde bosque de la identidad general L&A Suite. Los logos de cada empresa se gestionan aparte.',
    1,
)

# Sidebar escritorio + marca compacta en móvil.
i, j, bloque = bloque_funcion(s, "SidebarGrupos")
bloque = reemplaza_uno(bloque, "src: LOGO", "src: LOGO_PROYECTO", "logo sidebar")
bloque = reemplaza_uno(
    bloque,
    'className: "rounded-lg px-3 py-3.5 mb-2.5", style: { background: "#fff" }',
    'className: "rounded-xl px-3 py-3.5 mb-2.5", style: { background: "rgba(184,139,69,0.07)", border: "1px solid rgba(184,139,69,0.24)" }',
    "tarjeta logo sidebar",
)
bloque = reemplaza_uno(bloque, '"Control de almac\\xE9n"', 'LEMA_PROYECTO', "lema sidebar")
marker_mobile = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "md:hidden shrink-0 flex items-center gap-1.5 pr-2" }, /* @__PURE__ */ import_react4.default.createElement(SelectorDiseno'
repl_mobile = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "md:hidden shrink-0 flex items-center gap-1.5 pr-2" }, /* @__PURE__ */ import_react4.default.createElement("img", { src: ICONO_PROYECTO, alt: "L&A Suite", style: { width: 30, height: 30, borderRadius: 7, flexShrink: 0 } }), /* @__PURE__ */ import_react4.default.createElement(SelectorDiseno'
bloque = reemplaza_uno(bloque, marker_mobile, repl_mobile, "icono móvil sidebar")
s = s[:i] + bloque + s[j:]

# Barra superior del diseño rápido.
i, j, bloque = bloque_funcion(s, "TopBarC")
bloque = reemplaza_uno(bloque, "src: LOGO", "src: ICONO_PROYECTO", "logo topbar")
bloque = reemplaza_uno(
    bloque,
    'style: { height: 26, width: "auto", background: "#fff", borderRadius: 6, padding: 2 }',
    'style: { height: 30, width: 30, borderRadius: 7, flexShrink: 0 }',
    "estilo topbar",
)
bloque = reemplaza_uno(bloque, '"Control de almac\\xE9n"', 'NOMBRE_PROYECTO', "nombre topbar")
bloque = reemplaza_uno(bloque, 'style: { color: "#9CB6A9" }', 'style: { color: "#C69A52", letterSpacing: "0.02em" }', "color topbar")
s = s[:i] + bloque + s[j:]

# Panel general: marca del software, no documento fiscal/empresarial.
old_panel_logo = '/* @__PURE__ */ import_react4.default.createElement("img", { src: LOGO, alt: "", style: { height: 56, width: "auto" } })'
new_panel_logo = '/* @__PURE__ */ import_react4.default.createElement("img", { src: LOGO_PROYECTO, alt: "L&A Suite", style: { height: 58, width: "auto", maxWidth: 150 } })'
s = reemplaza_uno(s, old_panel_logo, new_panel_logo, "logo panel general")

# Guardas: el logo de empresa debe seguir existiendo y usándose en documentos.
checks = [
    'var LOGO_PROYECTO = "la-suite-logo.svg";',
    'var ICONO_PROYECTO = "la-suite-icon.svg";',
    'var NOMBRE_PROYECTO = "L&A Suite";',
    'var LOGO = "data:image/png;base64,',
    'var LOGO_BLANCO = "data:image/png;base64,',
    'src: LOGO_PROYECTO',
    'src: ICONO_PROYECTO',
    'LEMA_PROYECTO',
]
for item in checks:
    if item not in s:
        raise SystemExit(f"guarda ausente: {item}")

# Deben seguir existiendo muchos usos del LOGO empresarial en informes/documentos.
if s.count("src: LOGO") < 5:
    raise SystemExit("Se han perdido usos del logo empresarial; abortando")

p.write_text(s, encoding="utf-8")
print("OK: identidad L&A Suite aplicada sin sustituir logos empresariales")
