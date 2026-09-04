from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')
orig = s

legacy_load = '''        loadKey("configEmpresa", {\n            marca: "Chocolatería San Ginés",\n            lema: "MADRID 1894",\n            razonSocial: "CHOCOLOYOS, S.L.",\n            nif: "B87342077",\n            web: "",\n            redSocial: "@ChocoSanGines",\n            pieDocumentos: "GRACIAS POR SU VISITA"\n          }),'''
if legacy_load not in s:
    raise SystemExit('No se encontró el default legacy de configEmpresa')
s = s.replace(legacy_load, '        loadKey("configEmpresa", null),', 1)

old_set = '''      setConfigEmpresa(ce && typeof ce === "object" ? ce : {\n          marca: "Chocolatería San Ginés",\n          lema: "MADRID 1894",\n          razonSocial: "CHOCOLOYOS, S.L.",\n          nif: "B87342077",\n          web: "",\n          redSocial: "@ChocoSanGines",\n          pieDocumentos: "GRACIAS POR SU VISITA"\n        });'''
new_set = '''      setConfigEmpresa(ce && typeof ce === "object" ? ce : {\n          marca: "",\n          lema: "",\n          razonSocial: "",\n          nif: "",\n          web: "",\n          redSocial: "",\n          pieDocumentos: ""\n        });'''
if old_set not in s:
    raise SystemExit('No se encontró el fallback legacy de setConfigEmpresa')
s = s.replace(old_set, new_set, 1)

old_empresa = '''      const empresaLegacy = ce && typeof ce === "object" ? ce : {\n        marca: "Chocolatería San Ginés",\n        lema: "MADRID 1894",\n        razonSocial: "CHOCOLOYOS, S.L.",\n        nif: "B87342077",\n        web: "",\n        redSocial: "@ChocoSanGines",\n        pieDocumentos: "GRACIAS POR SU VISITA"\n      };\n      let empresasFinales = Array.isArray(emps) ? emps.filter((e2) => e2 && e2.id) : [];\n      if (empresasFinales.length === 0) {\n        empresasFinales = [{ id: "empresa-principal", ...empresaLegacy, activo: true, creadoEn: null, migradaDesdeConfigEmpresa: true }];\n      }'''
new_empresa = '''      const configLegacyValida = ce && typeof ce === "object" && Object.values(ce).some((v2) => String(v2 ?? "").trim());\n      const empresaLegacy = configLegacyValida ? ce : null;\n      const hayDatosOperativosLegacy = [p2, pr, pe2, mo, co, fc, al, gg, em, fj, ra, pc, cl, en, aq, tu, au, op, tr, fd2, nom, fre, rac, entr, mc, dev].some((lista) => Array.isArray(lista) && lista.length > 0);\n      let empresasFinales = Array.isArray(emps) ? emps.filter((e2) => e2 && e2.id) : [];\n      if (empresasFinales.length === 0 && (empresaLegacy || hayDatosOperativosLegacy)) {\n        const baseEmpresaLegacy = empresaLegacy || { marca: "", lema: "", razonSocial: "", nif: "", web: "", redSocial: "", pieDocumentos: "" };\n        empresasFinales = [{ id: "empresa-principal", ...baseEmpresaLegacy, activo: true, creadoEn: null, migradaDesdeConfigEmpresa: true }];\n      }'''
if old_empresa not in s:
    raise SystemExit('No se encontró la creación automática de empresa legacy')
s = s.replace(old_empresa, new_empresa, 1)

old_local = '''      if (localesFinales.length === 0) {\n        const primerLocal = { id: uid(), nombre: "Chocoloyos S.L", direccion: "", empresaId: empresaLegacyUnicaId, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString() };\n        localesFinales = [primerLocal];\n        localActivoFinal = primerLocal.id;\n      }'''
new_local = '''      if (localesFinales.length === 0 && hayDatosOperativosLegacy) {\n        const primerLocal = { id: uid(), nombre: "Local principal", direccion: "", empresaId: empresaLegacyUnicaId, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString(), migradoDesdeDatosLegacy: true };\n        localesFinales = [primerLocal];\n        localActivoFinal = primerLocal.id;\n      }'''
if old_local not in s:
    raise SystemExit('No se encontró la creación automática de local legacy')
s = s.replace(old_local, new_local, 1)

if s == orig:
    raise SystemExit('No hubo cambios')

# Garantías mínimas del parche.
assert 'loadKey("configEmpresa", null)' in s
assert 'empresasFinales.length === 0 && (empresaLegacy || hayDatosOperativosLegacy)' in s
assert 'localesFinales.length === 0 && hayDatosOperativosLegacy' in s
assert 'nombre: "Chocoloyos S.L"' not in s

p.write_text(s, encoding='utf-8')
print('PM02_BOOTSTRAP_CERO_PATCH_OK=1')
