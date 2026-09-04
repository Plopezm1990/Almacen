from pathlib import Path
import json

INDEX = Path('index.html')
DASH = Path('dashboard-premium-v2.js')
MANIFEST = Path('manifest.json')

index = INDEX.read_text(encoding='utf-8')
dash = DASH.read_text(encoding='utf-8')
manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))

# 1) Identidad PWA / navegador. La query cambia la URL del manifest para
# obligar al navegador a refrescar metadatos tras la antigua marca.
index = index.replace(
    '<link rel="manifest" href="manifest.json" />',
    '<link rel="manifest" href="manifest.json?v=la-suite-20260904" />'
)

if '<meta name="application-name" content="L&amp;A Suite" />' not in index:
    index = index.replace(
        '<title>L&amp;A Suite</title>',
        '<title>L&amp;A Suite</title>\n<meta name="application-name" content="L&amp;A Suite" />\n<meta name="apple-mobile-web-app-title" content="L&amp;A Suite" />'
    )

# 2) Login: solo cambia la cabecera de producto dentro de la tarjeta de acceso.
# No se hace un replace global de "Chocoloyos" para no tocar nombres reales de
# empresas/tenants que puedan existir en datos operativos.
old = "const lr=loginRoot();if(lr){const img=lr.querySelector('img');if(img){img.src=MASTER;img.alt='L&A Suite';img.classList.add('la-brand-master');img.style.width='min(72vw,300px)';img.style.height='auto'}}"
new = "const lr=loginRoot();if(lr){all('h1,h2,h3,strong,b,div,span',lr).forEach(el=>{if(el.children.length===0&&norm(el.textContent)==='chocoloyos')el.textContent='L&A Suite'});const img=lr.querySelector('img');if(img){img.src=MASTER;img.alt='L&A Suite';img.classList.add('la-brand-master');img.style.width='min(72vw,300px)';img.style.height='auto'}}"

if old in dash:
    dash = dash.replace(old, new, 1)
elif new not in dash:
    raise SystemExit('No se encontró el punto exacto de branding del login; no se modifica nada.')

# 3) Manifest canónico.
manifest['name'] = 'L&A Suite'
manifest['short_name'] = 'L&A Suite'
manifest['description'] = 'Gestión integral para tu negocio'

INDEX.write_text(index, encoding='utf-8')
DASH.write_text(dash, encoding='utf-8')
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Validaciones de seguridad/identidad.
assert '<title>L&amp;A Suite</title>' in index
assert 'manifest.json?v=la-suite-20260904' in index
assert 'application-name' in index and 'apple-mobile-web-app-title' in index
assert manifest['name'] == 'L&A Suite'
assert manifest['short_name'] == 'L&A Suite'
assert "norm(el.textContent)==='chocoloyos'" in dash
assert "el.textContent='L&A Suite'" in dash

print('IDENTIDAD_LA_SUITE_OK=1')
print('LOGIN_PRODUCTO_LA_SUITE_OK=1')
print('PWA_LA_SUITE_OK=1')
print('REPLACE_GLOBAL_CHOCOLoyos=0')
