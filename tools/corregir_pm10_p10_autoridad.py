from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

old = '''        if (!window.__nubeCliente) {\n          detalle.push({ key, ok: false, error: "No hay conexi\\xF3n a la nube en este momento." });\n          continue;\n        }\n        const nuevo = JSON.parse(valorLocal);\n        const r2 = await window.__nubeCliente.from("almacen_kv").upsert({ key, value: nuevo });\n        if (r2.error) {\n          detalle.push({ key, ok: false, error: r2.error.message });\n        } else {\n          detalle.push({ key, ok: true });\n          const listaActualizada = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]").filter((k2) => k2 !== key);\n          localStorage.setItem("almacen__pendientes", JSON.stringify(listaActualizada));\n        }'''

new = '''        if (!window.storage || typeof window.storage.set !== "function") {\n          detalle.push({ key, ok: false, error: "La capa autorizada de almacenamiento no est\\xE1 disponible." });\n          continue;\n        }\n        JSON.parse(valorLocal);\n        await window.storage.set(key, valorLocal, false);\n        detalle.push({ key, ok: true });\n        const listaActualizada = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]").filter((k2) => k2 !== key);\n        localStorage.setItem("almacen__pendientes", JSON.stringify(listaActualizada));'''

if old in s:
    s = s.replace(old, new, 1)
elif 'await window.storage.set(key, valorLocal, false);' not in s:
    raise SystemExit('No se encontró la ruta directa de reintento almacen_kv esperada')

p.write_text(s, encoding='utf-8')
print('PM10 P10: reintento de sincronización pasa por window.storage.set autorizado')
