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

one(
    'const localPorProductoInforme = new Map(productos.map((p2) => [p2.id, p2.localId || null])); const inferirLocalLineasInforme',
    'const localPorProductoInforme = new Map(productos.map((p2) => [p2.id, p2.localId || null])); const idsLocalesEmpresaInforme = new Set(locales.filter((l2) => l2 && l2.empresaId === empresaDelLocalActivo?.id).map((l2) => l2.id)); const localEsDeEmpresaInforme = (id) => !!id && idsLocalesEmpresaInforme.has(id); const inferirLocalLineasInforme',
    'alcance de empresa para informes'
)

replacements = [
    ('const productosInforme = localInformeId ? productos.filter((p2) => p2.localId === localInformeId) : productos;', 'const productosInforme = localInformeId ? productos.filter((p2) => p2.localId === localInformeId) : productos.filter((p2) => localEsDeEmpresaInforme(p2.localId));', 'productos empresa'),
    ('const movimientosInforme = localInformeId ? movimientos.filter((m2) => (m2.localId || localPorProductoInforme.get(m2.productoId) || null) === localInformeId) : movimientos;', 'const movimientosInforme = localInformeId ? movimientos.filter((m2) => (m2.localId || localPorProductoInforme.get(m2.productoId) || null) === localInformeId) : movimientos.filter((m2) => localEsDeEmpresaInforme(m2.localId || localPorProductoInforme.get(m2.productoId) || null));', 'movimientos empresa'),
    ('const albaranesInforme = localInformeId ? albaranes.filter((a2) => (a2.localId || inferirLocalLineasInforme(a2.lineas)) === localInformeId) : albaranes;', 'const albaranesInforme = localInformeId ? albaranes.filter((a2) => (a2.localId || inferirLocalLineasInforme(a2.lineas)) === localInformeId) : albaranes.filter((a2) => localEsDeEmpresaInforme(a2.localId || inferirLocalLineasInforme(a2.lineas)));', 'albaranes empresa'),
    ('const facturasDirectasInforme = localInformeId ? facturasDirectas.filter((f2) => f2.localId === localInformeId) : facturasDirectas;', 'const facturasDirectasInforme = localInformeId ? facturasDirectas.filter((f2) => f2.localId === localInformeId) : facturasDirectas.filter((f2) => localEsDeEmpresaInforme(f2.localId));', 'facturas empresa'),
    ('const gastosGeneralesInforme = localInformeId ? gastosGenerales.filter((g2) => g2.localId === localInformeId) : gastosGenerales;', 'const gastosGeneralesInforme = localInformeId ? gastosGenerales.filter((g2) => g2.localId === localInformeId) : gastosGenerales.filter((g2) => localEsDeEmpresaInforme(g2.localId));', 'gastos empresa'),
    ('const empleadosInforme = localInformeId ? empleados.filter((e) => e.localId === localInformeId) : empleados;', 'const empleadosInforme = localInformeId ? empleados.filter((e) => e.localId === localInformeId) : empleados.filter((e) => localEsDeEmpresaInforme(e.localId));', 'empleados empresa'),
    ('const fichajesAbiertosInforme = localInformeId ? fichajesAbiertos.filter((f2) => idsEmpleadosInforme.has(f2.empleadoId)) : fichajesAbiertos;', 'const fichajesAbiertosInforme = fichajesAbiertos.filter((f2) => idsEmpleadosInforme.has(f2.empleadoId));', 'fichajes empresa'),
    ('const documentosPersonalProntoInforme = localInformeId ? documentosPersonalPronto.filter((d2) => idsEmpleadosInforme.has(d2.empleadoId)) : documentosPersonalPronto;', 'const documentosPersonalProntoInforme = documentosPersonalPronto.filter((d2) => idsEmpleadosInforme.has(d2.empleadoId));', 'documentos personal empresa'),
    ('const pedidosInforme = localInformeId ? pedidos.filter((pe2) => (pe2.localId || inferirLocalLineasInforme(pe2.items)) === localInformeId) : pedidos;', 'const pedidosInforme = localInformeId ? pedidos.filter((pe2) => (pe2.localId || inferirLocalLineasInforme(pe2.items)) === localInformeId) : pedidos.filter((pe2) => localEsDeEmpresaInforme(pe2.localId || inferirLocalLineasInforme(pe2.items)));', 'pedidos empresa'),
    ('const encargosInforme = localInformeId ? encargos.filter((e) => (e.localId || inferirLocalLineasInforme(e.lineas)) === localInformeId) : encargos;', 'const encargosInforme = localInformeId ? encargos.filter((e) => (e.localId || inferirLocalLineasInforme(e.lineas)) === localInformeId) : encargos.filter((e) => localEsDeEmpresaInforme(e.localId || inferirLocalLineasInforme(e.lineas)));', 'encargos empresa'),
    ('const pendientesPagoInforme = localInformeId ? pendientesPago.filter((f2) => idsFacturasInforme.has(f2.id)) : pendientesPago;', 'const pendientesPagoInforme = pendientesPago.filter((f2) => idsFacturasInforme.has(f2.id));', 'pendientes pago empresa'),
    ('const caducanProntoInforme = localInformeId ? caducanPronto.filter((l2) => localPorProductoInforme.get(l2.productoId) === localInformeId) : caducanPronto;', 'const caducanProntoInforme = localInformeId ? caducanPronto.filter((l2) => localPorProductoInforme.get(l2.productoId) === localInformeId) : caducanPronto.filter((l2) => localEsDeEmpresaInforme(localPorProductoInforme.get(l2.productoId)));', 'caducidades empresa'),
    ('const encargosUrgentesInforme = localInformeId ? encargosUrgentes.filter((e) => idsEncargosInforme.has(e.id)) : encargosUrgentes;', 'const encargosUrgentesInforme = encargosUrgentes.filter((e) => idsEncargosInforme.has(e.id));', 'encargos urgentes empresa'),
    ('const pisoVentaBajoInforme = localInformeId ? pisoVentaBajo.filter((p2) => p2.localId === localInformeId) : pisoVentaBajo;', 'const pisoVentaBajoInforme = localInformeId ? pisoVentaBajo.filter((p2) => p2.localId === localInformeId) : pisoVentaBajo.filter((p2) => localEsDeEmpresaInforme(p2.localId));', 'reposición empresa'),
    ('const sugerenciasPedidoInforme = localInformeId ? sugerenciasPedido.filter((p2) => p2.localId === localInformeId) : sugerenciasPedido;', 'const sugerenciasPedidoInforme = localInformeId ? sugerenciasPedido.filter((p2) => p2.localId === localInformeId) : sugerenciasPedido.filter((p2) => localEsDeEmpresaInforme(p2.localId));', 'sugerencias empresa'),
    ('const conteosInforme = localInformeId ? conteos.filter((c2) => c2.localId === localInformeId) : conteos;', 'const conteosInforme = localInformeId ? conteos.filter((c2) => c2.localId === localInformeId) : conteos.filter((c2) => localEsDeEmpresaInforme(c2.localId));', 'conteos empresa'),
    ('const diagnosticoStockInforme = localInformeId ? diagnosticoStock.filter((d2) => localPorProductoInforme.get(d2.productoId) === localInformeId) : diagnosticoStock;', 'const diagnosticoStockInforme = localInformeId ? diagnosticoStock.filter((d2) => localPorProductoInforme.get(d2.productoId) === localInformeId) : diagnosticoStock.filter((d2) => localEsDeEmpresaInforme(localPorProductoInforme.get(d2.productoId)));', 'diagnóstico empresa'),
]

for old, new, label in replacements:
    one(old, new, label)

one(
    'import_react4.default.createElement( Resultados, { movimientos: movimientosInforme, productos: productosInforme, productoPorId, gastosGenerales:',
    'import_react4.default.createElement( Resultados, { movimientos: movimientosInforme, productos: productosInforme, productoPorId: (id) => productosInforme.find((p2) => p2.id === id), gastosGenerales:',
    'lookup de resultados acotado'
)

p.write_text(s, encoding='utf-8')
