from pathlib import Path

ruta = Path('tools/aplicar_pm12_p07.py')
script = ruta.read_text(encoding='utf-8')
needle = "'''  }), /* @__PURE__ */ import_react4.default.createElement(BloqueAplicarAjustes, {"
replacement = "'''/* @__PURE__ */ import_react4.default.createElement(BloqueAplicarAjustes, {"
if script.count(needle) != 2:
    raise SystemExit(f'fix P07: se esperaban 2 anclas y hay {script.count(needle)}')
script = script.replace(needle, replacement)
exec(compile(script, str(ruta), 'exec'), {'__name__': '__main__'})
