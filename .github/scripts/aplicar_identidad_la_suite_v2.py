from pathlib import Path


def uno(texto, old, new, label):
    n = texto.count(old)
    if n != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y hay {n}")
    return texto.replace(old, new, 1)


def bloque_funcion(texto, nombre):
    i = texto.find(f"function {nombre}(")
    if i < 0:
        raise SystemExit(f"No se encontró function {nombre}")
    j = texto.find("\nfunction ", i + 10)
    if j < 0:
        j = len(texto)
    return i, j, texto[i:j]


# Pantalla de arranque + identidad del navegador.
p = Path("index.html")
h = p.read_text(encoding="utf-8")
h = uno(h, "<title>Control de Compras y Almacen</title>", "<title>L&amp;A Suite</title>", "título")
h = uno(h, '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />', '<link rel="icon" type="image/svg+xml" href="la-suite-icon.svg" />', "favicon")
h = uno(h, '<link rel="apple-touch-icon" href="apple-touch-icon.png" />', '<link rel="apple-touch-icon" href="la-suite-icon.svg" />', "apple icon")
h = uno(h, "    background: #F7F3E9; color: #17241C; z-index: 9999;", "    background: radial-gradient(circle at 50% 34%, #143A24 0%, #0C2714 48%, #071D12 100%); color: #E7D1A5; z-index: 9999;", "fondo carga")
h = uno(h,
"  #cargando .marca { font-size: 15px; font-weight: 600; }\n  #cargando .paso { font-size: 12.5px; color: #6B7A6E; }\n  #cargando .barra { width: 190px; height: 4px; border-radius: 4px; background: #E2DBC7; overflow: hidden; }\n  #cargando .barra i { display: block; height: 100%; width: 30%; background: #8C6D2A; border-radius: 4px;",
"  #cargando .logo-suite { width: min(72vw, 330px); height: auto; display: block; filter: drop-shadow(0 6px 12px rgba(0,0,0,.28)); }\n  #cargando .sub { margin-top: -4px; font-size: 12px; letter-spacing: .035em; color: #B8AC91; }\n  #cargando .paso { font-size: 12px; color: #9FB0A5; }\n  #cargando .barra { width: 210px; height: 3px; border-radius: 4px; background: rgba(207,172,105,.18); overflow: hidden; }\n  #cargando .barra i { display: block; height: 100%; width: 30%; background: linear-gradient(90deg,#7F5823,#C69A52,#D2AD68); border-radius: 4px;",
"estilos carga")
h = uno(h,
'<div id="cargando">\n  <div class="marca">Control de Compras y Almacen</div>\n  <div class="barra"><i></i></div>\n  <div class="paso" id="paso">Abriendo…</div>\n</div>',
'<div id="cargando">\n  <img class="logo-suite" src="la-suite-logo.svg" alt="L&A Suite" />\n  <div class="sub">Gestión integral para tu negocio</div>\n  <div class="barra"><i></i></div>\n  <div class="paso" id="paso">Abriendo…</div>\n</div>',
"contenido carga")
p.write_text(h, encoding="utf-8")

# Identidad de aplicación. LOGO/LOGO_BLANCO siguen siendo de la empresa.
p = Path("fuente.js")
s = p.read_text(encoding="utf-8")
ancla = 'var LOGO = "data:image/png;base64,'
if s.count(ancla) != 1:
    raise SystemExit(f"ancla logo empresa: {s.count(ancla)}")
s = s.replace(ancla, 'var LOGO_PROYECTO = "la-suite-logo.svg";\nvar ICONO_PROYECTO = "la-suite-icon.svg";\nvar NOMBRE_PROYECTO = "L&A Suite";\nvar LEMA_PROYECTO = "Gestión integral para tu negocio";\n' + ancla, 1)
s = s.replace('// Verde extraído directamente del medallón del logo real (Chocolatería San Ginés).', '// Verde bosque de la identidad general L&A Suite. Los logos de cada empresa se gestionan aparte.', 1)

# Sidebar de escritorio y marca compacta en móvil.
i, j, b = bloque_funcion(s, "SidebarGrupos")
b = uno(b, "src: LOGO", "src: LOGO_PROYECTO", "logo sidebar")
b = uno(b, 'className: "rounded-lg px-3 py-3.5 mb-2.5", style: { background: "#fff" }', 'className: "rounded-xl px-3 py-3.5 mb-2.5", style: { background: "rgba(184,139,69,0.07)", border: "1px solid rgba(184,139,69,0.24)" }', "tarjeta sidebar")
b = uno(b, '"Control de almac\\xE9n"', 'LEMA_PROYECTO', "lema sidebar")
old_mobile = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "md:hidden shrink-0 flex items-center gap-1.5 pr-2" }, /* @__PURE__ */ import_react4.default.createElement(SelectorDiseno'
new_mobile = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "md:hidden shrink-0 flex items-center gap-1.5 pr-2" }, /* @__PURE__ */ import_react4.default.createElement("img", { src: ICONO_PROYECTO, alt: "L&A Suite", style: { width: 30, height: 30, borderRadius: 7, flexShrink: 0 } }), /* @__PURE__ */ import_react4.default.createElement(SelectorDiseno'
b = uno(b, old_mobile, new_mobile, "marca móvil")
s = s[:i] + b + s[j:]

# Cabecera del diseño Rápido (la que se ve en móvil actualmente).
i, j, b = bloque_funcion(s, "TopBarC")
b = uno(b, "src: LOGO", "src: ICONO_PROYECTO", "logo topbar")
b = uno(b, 'style: { height: 26, width: "auto", background: "#fff", borderRadius: 6, padding: 2 }', 'style: { height: 30, width: 30, borderRadius: 7, flexShrink: 0 }', "estilo topbar")
b = uno(b, '"Control de almac\\xE9n"', 'NOMBRE_PROYECTO', "nombre topbar")
b = uno(b, 'style: { color: "#9CB6A9" }', 'style: { color: "#C69A52", letterSpacing: "0.02em" }', "color topbar")
s = s[:i] + b + s[j:]

# Guardas de separación: no sustituir identidad de empresas.
for item in ['var LOGO_PROYECTO = "la-suite-logo.svg";', 'var ICONO_PROYECTO = "la-suite-icon.svg";', 'var LOGO = "data:image/png;base64,', 'var LOGO_BLANCO = "data:image/png;base64,', 'LEMA_PROYECTO']:
    if item not in s:
        raise SystemExit(f"guarda ausente: {item}")
if s.count("src: LOGO") < 5:
    raise SystemExit("Se han perdido usos del logo empresarial; abortando")
p.write_text(s, encoding="utf-8")
print("OK: identidad L&A Suite aplicada en puntos inequívocos")
