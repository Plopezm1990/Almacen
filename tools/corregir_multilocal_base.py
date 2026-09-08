from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')


def pattern_for(text):
    parts = re.split(r'\s+', text.strip())
    return r'\s+'.join(re.escape(part) for part in parts)


def one(old, new, label):
    global s
    pat = pattern_for(old)
    matches = list(re.finditer(pat, s))
    if len(matches) != 1:
        raise SystemExit(f'{label}: esperaba 1 coincidencia y hay {len(matches)}')
    s = re.sub(pat, lambda _: new, s, count=1)
    print('OK', label)


def many(old, new, label):
    global s
    pat = pattern_for(old)
    matches = list(re.finditer(pat, s))
    if not matches:
        raise SystemExit(f'{label}: no se encontró el patrón')
    s = re.sub(pat, lambda _: new, s)
    print('OK', label, len(matches))

one(
    'let localesFinales = Array.isArray(loc) ? [...loc] : []; let localActivoFinal = lai || null;',
    'const empresaLegacyUnicaId = empresasFinales.length === 1 ? empresasFinales[0]?.id || null : null; let localesFinales = Array.isArray(loc) ? loc.map((l2) => l2 && !l2.empresaId && empresaLegacyUnicaId ? { ...l2, empresaId: empresaLegacyUnicaId } : l2) : []; let localActivoFinal = lai || null;',
    'empresaId legacy'
)
one('nombre: "Chocoloyos S.L", direccion: "", activo: true', 'nombre: "Chocoloyos S.L", direccion: "", empresaId: empresaLegacyUnicaId, activo: true', 'local inicial')
one('nombre: "Local recuperado", direccion: "", activo: true', 'nombre: "Local recuperado", direccion: "", empresaId: empresaLegacyUnicaId, activo: true', 'local recuperado')

one(
    'const empresaDelLocalActivo = (0, import_react4.useMemo)(() => { const principal = empresas[0] || null; const localActual = locales.find((l2) => l2.id === localActivoId) || null; const empresaId = localActual?.empresaId || principal?.id || null; return empresas.find((e2) => e2.id === empresaId) || principal || configEmpresa || null; }, [empresas, locales, localActivoId, configEmpresa]); const productosDelLocalActivo',
    'const empresaDelLocalActivo = (0, import_react4.useMemo)(() => { const principal = empresas[0] || null; const localActual = locales.find((l2) => l2.id === localActivoId) || null; if (localActual) { if (localActual.empresaId) return empresas.find((e2) => e2.id === localActual.empresaId) || null; return empresas.length === 1 ? principal || configEmpresa || null : null; } return empresas.length === 1 ? principal || configEmpresa || null : null; }, [empresas, locales, localActivoId, configEmpresa]); const localesEmpresaActiva = (0, import_react4.useMemo)(() => { const empresaId = empresaDelLocalActivo?.id || null; if (!empresaId) return []; return locales.filter((l2) => l2 && l2.empresaId === empresaId && l2.activo !== false && !l2.fusionadoEn); }, [locales, empresaDelLocalActivo]); const productosDelLocalActivo',
    'empresa del local exacta'
)
one(
    'const productosDelLocalActivo = (0, import_react4.useMemo)(() => { if (!localActivoId) return productos; return productos.filter((p2) => !p2.localId || p2.localId === localActivoId); }, [productos, localActivoId]);',
    'const productosDelLocalActivo = (0, import_react4.useMemo)(() => { if (!localActivoId) return productos; return productos.filter((p2) => p2.localId === localActivoId); }, [productos, localActivoId]);',
    'productos estrictos'
)
one(
    'const pedidosDelLocalActivo = (0, import_react4.useMemo)(() => { if (!localActivoId) return pedidos; return pedidos.filter((p2) => !p2.localId || p2.localId === localActivoId); }, [pedidos, localActivoId]);',
    'const pedidosDelLocalActivo = (0, import_react4.useMemo)(() => { if (!localActivoId) return pedidos; return pedidos.filter((p2) => p2.localId === localActivoId); }, [pedidos, localActivoId]);',
    'pedidos estrictos'
)
one('function productoEsDelLocalActivo(prod) { if (!prod) return false; if (!localActivoId) return true; return !prod.localId || prod.localId === localActivoId; }', 'function productoEsDelLocalActivo(prod) { if (!prod) return false; if (!localActivoId) return true; return prod.localId === localActivoId; }', 'guarda producto')
one('function pedidoEsDelLocalActivo(pedido) { if (!pedido) return false; if (!localActivoId) return true; return !pedido.localId || pedido.localId === localActivoId; }', 'function pedidoEsDelLocalActivo(pedido) { if (!pedido) return false; if (!localActivoId) return true; return pedido.localId === localActivoId; }', 'guarda pedido')

one(
    'function crearLocal({ nombre, direccion, empresaId }) { const nombreLimpio = (nombre || "").trim(); if (!nombreLimpio)',
    'function crearLocal({ nombre, direccion, empresaId }) { const nombreLimpio = (nombre || "").trim(); if (!empresaId) return { ok: false, error: "Selecciona la empresa a la que pertenece el local." }; if (!nombreLimpio)',
    'local requiere empresa'
)
one('empresaId: empresaId || null, activo: true', 'empresaId, activo: true', 'persistir empresa del local')
one(
    'const empresaDeLocal = (l2) => empresas.find((e2) => e2.id === (l2?.empresaId || empresaPrincipalId)) || empresas[0] || null; function enviar() { const r = crearLocal({ nombre, direccion, empresaId: empresaNuevaId || empresaPrincipalId });',
    'const empresaDeLocal = (l2) => l2?.empresaId ? empresas.find((e2) => e2.id === l2.empresaId) || null : empresas.length === 1 ? empresas[0] || null : null; function enviar() { const empresaDestinoId = empresaNuevaId || (empresas.length === 1 ? empresaPrincipalId : ""); if (!empresaDestinoId) { setError("Selecciona la empresa a la que pertenece el local."); return; } const r = crearLocal({ nombre, direccion, empresaId: empresaDestinoId });',
    'UI local sin fallback ambiguo'
)

many('import_react4.default.createElement(SelectorLocalInformes, { locales, valor:', 'import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor:', 'selector local por empresa')
one('import_react4.default.createElement( BusquedaGlobal, { productos, proveedores, clientes, fichasCosto, empleados, setTab } )', 'import_react4.default.createElement( BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab } )', 'búsqueda acotada')
one('import_react4.default.createElement( Pedidos, { pedidos: pedidosDelLocalActivo, proveedores, productos: productosDelLocalActivo, crearPedido, actualizarPedido, eliminarPedido, proveedorPorId, productoPorId, sugerenciasPedido:', 'import_react4.default.createElement( Pedidos, { pedidos: pedidosDelLocalActivo, proveedores, productos: productosDelLocalActivo, crearPedido, actualizarPedido, eliminarPedido, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p2) => p2.id === id), sugerenciasPedido:', 'lookup pedido local')
one('import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId, recibirPedido,', 'import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p2) => p2.id === id), recibirPedido,', 'lookup recepción local')

p.write_text(s, encoding='utf-8')
