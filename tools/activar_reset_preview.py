from pathlib import Path

path = Path("index.html")
text = path.read_text(encoding="utf-8")
original = text

# 1) Cargar el reset antes de inicializar el puente de almacenamiento/nube.
anchor_script = '''  // no se cargan desde ningún CDN en tiempo real.\n</script>\n\n<script>\n  /* =========================================================='''
replacement_script = '''  // no se cargan desde ningún CDN en tiempo real.\n</script>\n<script src="./reset-pruebas-preview.js"></script>\n\n<script>\n  /* =========================================================='''
if anchor_script in text:
    text = text.replace(anchor_script, replacement_script, 1)
elif 'src="./reset-pruebas-preview.js"' not in text:
    raise SystemExit("No se encontró el punto seguro para cargar reset-pruebas-preview.js")

# 2) En Deploy Preview se fuerza aislamiento total respecto a Supabase.
anchor_nube = '''  window.NUBE_URL = NUBE_URL;\n  window.NUBE_CLAVE = NUBE_CLAVE;\n  window.ESPERA_NUBE_MS = ESPERA_NUBE_MS;'''
replacement_nube = '''  window.NUBE_URL = NUBE_URL;\n  window.NUBE_CLAVE = NUBE_CLAVE;\n  window.ESPERA_NUBE_MS = ESPERA_NUBE_MS;\n  if (window.__modoPruebasLocal) {\n    // Deploy Preview: aislamiento total. No leer ni escribir Supabase.\n    window.NUBE_URL = "";\n    window.NUBE_CLAVE = "";\n  }'''
if anchor_nube in text and replacement_nube not in text:
    text = text.replace(anchor_nube, replacement_nube, 1)
elif replacement_nube not in text:
    raise SystemExit("No se encontró la inicialización de la nube")

# 3) En Preview local no generar una cola de pendientes que pueda subirse después.
anchor_pending = '''      } else {\n        marcarPendiente(key);\n      }\n\n      // Si no cupo en el equipo, se avisa AHORA'''
replacement_pending = '''      } else if (!window.__modoPruebasLocal) {\n        marcarPendiente(key);\n      }\n\n      // Si no cupo en el equipo, se avisa AHORA'''
if anchor_pending in text:
    text = text.replace(anchor_pending, replacement_pending, 1)
elif replacement_pending not in text:
    raise SystemExit("No se encontró la rama local de window.storage.set")

# Invariantes de seguridad: exactamente una carga, un guard de nube y un guard de pendientes.
assert text.count('src="./reset-pruebas-preview.js"') == 1
assert text.count('if (window.__modoPruebasLocal) {') == 1
assert text.count('else if (!window.__modoPruebasLocal)') == 1
assert text.index('src="./reset-pruebas-preview.js"') < text.index('var NUBE_URL =')

if text == original:
    print("index.html ya estaba preparado; sin cambios")
else:
    path.write_text(text, encoding="utf-8")
    print("index.html preparado para reset local seguro en Deploy Preview")
