from pathlib import Path
p=Path('source-recovery/fuente-recuperado.js')
s=p.read_text()
old='async function sincronizarContextoPm07({ setEmpresas, setLocales, setLocalActivoId, setProductos }) {\n'
new='async function sincronizarContextoPm07(args) {\n  const { setEmpresas, setLocales, setLocalActivoId, setProductos } = args || {};\n'
if old not in s:
    raise SystemExit('firma esperada no encontrada')
s=s.replace(old,new,1)
p.write_text(s)
