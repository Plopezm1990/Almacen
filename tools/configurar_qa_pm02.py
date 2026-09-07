from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
old = '''  if (window.__modoPruebasLocal) {
    // Deploy Preview: aislamiento total. No leer ni escribir Supabase.
    window.NUBE_URL = "";
    window.NUBE_CLAVE = "";
  }
'''
new = '''  if (window.__modoPruebasQA) {
    // Deploy Preview: usar exclusivamente el proyecto Supabase de QA.
    window.NUBE_URL = window.__qaNubeUrl || "";
    window.NUBE_CLAVE = window.__qaNubeClave || "";
  } else if (window.__modoPruebasLocal) {
    // Modo de pruebas sin backend remoto, conservado como salvaguarda.
    window.NUBE_URL = "";
    window.NUBE_CLAVE = "";
  }
'''
if old not in s:
    if new in s:
        print('PM02_INDEX_QA_YA_APLICADO=1')
        raise SystemExit(0)
    raise SystemExit('No se encontró el bloque esperado de configuración de Preview')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('PM02_INDEX_QA_PATCH_OK=1')
