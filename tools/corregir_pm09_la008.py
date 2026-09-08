from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

if 'function esCorreccionVentaPM09' in s:
    raise SystemExit('LA008: la correccion ya parece aplicada; se aborta para no duplicarla')

anchor = '''function cantidadConSigno(m22) {
  if (!m22) return 0;
  if (esMovimientoNuevo(m22)) return Number(m22.cantidad) || 0;
  const base = Number(m22.cantidad) || 0;
  return m22.tipo === "salida" ? -base : base;
}'''
if s.count(anchor) != 1:
    raise SystemExit(f'LA008 anchor cantidadConSigno: esperaba 1 y hay {s.count(anchor)}')

helpers = r'''
// PM-09 / LA-008: contrato comun de unidades economicas de venta.
// VENTA suma; REVERSO y DEVOLUCION_CLIENTE trazables restan. La operacion
// original se conserva: no se borra ni se reescribe para cuadrar informes.
function esCorreccionVentaPM09(m22) {
  if (!m22) return false;
  if (esMovimientoNuevo(m22)) {
    if (m22.tipo === "DEVOLUCION_CLIENTE") return !!(m22.ventaId || m22.documentoOrigenId || m22.movimientoOriginalId);
    if (m22.tipo === "REVERSO") return !!(m22.anulaVentaId || m22.ventaId || m22.documentoOrigenId || m22.movimientoOriginalId);
    return false;
  }
  return m22.tipo === "entrada" && Number(m22.ingresoUnitario) < 0 && !!(m22.anulaVentaId || m22.ventaId || m22.documentoOrigenId || m22.movimientoOriginalId);
}
function unidadesVentaConSignoPM09(m22) {
  const unidades = Math.abs(Number(m22?.cantidad) || 0);
  if (esVenta(m22)) return unidades;
  if (esCorreccionVentaPM09(m22)) return -unidades;
  return 0;
}
function idVentaRaizPM09(m22) {
  if (!m22) return null;
  if (esVenta(m22)) return m22.operationId || m22.ventaId || m22.id || null;
  if (esCorreccionVentaPM09(m22)) return m22.anulaVentaId || m22.ventaId || m22.documentoOrigenId || null;
  return null;
}
function costoUnitarioHistoricoVentaPM09(m22, movimientos = []) {
  if (!m22) return 0;
  if (m22.costoUnitario !== "" && m22.costoUnitario !== null && m22.costoUnitario !== void 0 && Number.isFinite(Number(m22.costoUnitario))) {
    return Math.abs(Number(m22.costoUnitario));
  }
  if (m22.movimientoOriginalId !== "" && m22.movimientoOriginalId !== null && m22.movimientoOriginalId !== void 0) {
    const originalPorId = movimientos.find((x3) => x3 && (x3.id === m22.movimientoOriginalId || x3.id === `pm07-${m22.movimientoOriginalId}`));
    if (originalPorId && originalPorId.costoUnitario !== "" && originalPorId.costoUnitario !== null && originalPorId.costoUnitario !== void 0 && Number.isFinite(Number(originalPorId.costoUnitario))) {
      return Math.abs(Number(originalPorId.costoUnitario));
    }
  }
  const raiz = idVentaRaizPM09(m22);
  if (raiz) {
    const originalVenta = movimientos.find((x3) => x3 && esVenta(x3) && x3.productoId === m22.productoId && (x3.operationId || x3.ventaId || x3.id) === raiz);
    if (originalVenta && originalVenta.costoUnitario !== "" && originalVenta.costoUnitario !== null && originalVenta.costoUnitario !== void 0 && Number.isFinite(Number(originalVenta.costoUnitario))) {
      return Math.abs(Number(originalVenta.costoUnitario));
    }
  }
  return 0;
}
function aporteConsumoInventarioPM09(m22) {
  if (!m22) return 0;
  if (esVenta(m22)) return Math.abs(Number(m22.cantidad) || 0);
  if (esCorreccionVentaPM09(m22)) return -Math.abs(Number(m22.cantidad) || 0);
  if (esSalida(m22)) return Math.abs(Number(m22.cantidad) || 0);
  return 0;
}
function resumenConsumoProductoPM09(movs = []) {
  const familias = /* @__PURE__ */ new Map();
  let otrasSalidas = 0;
  const fechas = [];
  movs.forEach((m22) => {
    if (esVenta(m22) || esCorreccionVentaPM09(m22)) {
      const raiz = idVentaRaizPM09(m22) || `sin-raiz-${m22.id || m22.operationId || Math.random()}`;
      const actual = familias.get(raiz) || { unidades: 0, fecha: null };
      actual.unidades += unidadesVentaConSignoPM09(m22);
      if (esVenta(m22) && m22.fecha && (!actual.fecha || new Date(m22.fecha) < new Date(actual.fecha))) actual.fecha = m22.fecha;
      familias.set(raiz, actual);
      return;
    }
    if (esSalida(m22)) {
      otrasSalidas += Math.abs(Number(m22.cantidad) || 0);
      if (m22.fecha) fechas.push(m22.fecha);
    }
  });
  let cantidad = otrasSalidas;
  familias.forEach((f2) => {
    const netas = Math.max(0, Number(f2.unidades) || 0);
    if (netas <= 0) return;
    cantidad += netas;
    if (f2.fecha) fechas.push(f2.fecha);
  });
  let primeraFecha = null;
  fechas.forEach((fecha) => {
    if (!primeraFecha || new Date(fecha) < new Date(primeraFecha)) primeraFecha = fecha;
  });
  return { cantidad, primeraFecha };
}'''

s = s.replace(anchor, anchor + helpers, 1)

# Margen real de 90 dias: usa venta y correcciones con signo y snapshots historicos.
rx_margen = re.compile(
    r'  const margenPorProducto = \(0, import_react4\.useMemo\)\(\(\) => \{[\s\S]*?\n  \}, \[productos, movimientos\]\);'
)
mm = list(rx_margen.finditer(s))
if len(mm) != 1:
    raise SystemExit(f'LA008 margenPorProducto: esperaba 1 bloque y hay {len(mm)}')
new_margen = '''  const margenPorProducto = (0, import_react4.useMemo)(() => {
    const hace90 = /* @__PURE__ */ new Date();
    hace90.setDate(hace90.getDate() - 90);
    return productos.map((p22) => {
      const operacionesVenta = movimientos.filter(
        (m22) => m22.productoId === p22.id && (esVenta(m22) || esCorreccionVentaPM09(m22)) && new Date(m22.fecha) >= hace90
      );
      const unidadesVendidas = operacionesVenta.reduce((a22, m22) => a22 + unidadesVentaConSignoPM09(m22), 0);
      const ingresos = operacionesVenta.reduce((a22, m22) => a22 + unidadesVentaConSignoPM09(m22) * Math.abs(Number(m22.ingresoUnitario) || 0), 0);
      const costes = operacionesVenta.reduce((a22, m22) => a22 + unidadesVentaConSignoPM09(m22) * costoUnitarioHistoricoVentaPM09(m22, movimientos), 0);
      const beneficio = ingresos - costes;
      const margenPct = ingresos > 0 ? beneficio / ingresos * 100 : null;
      return { ...p22, unidadesVendidas, ingresos, beneficio, margenPct, _pm09OperacionesVenta: operacionesVenta.length };
    }).filter((p22) => p22._pm09OperacionesVenta > 0 && (Math.abs(p22.unidadesVendidas) > 1e-9 || Math.abs(p22.ingresos) > 1e-9 || Math.abs(p22.beneficio) > 1e-9)).sort((a22, b2) => b2.beneficio - a22.beneficio);
  }, [productos, movimientos]);'''
s = rx_margen.sub(new_margen, s, count=1)

# Rotacion: agrupa la familia venta/correcciones para que una anulacion completa
# no consuma unidades ni extienda artificialmente el periodo de rotacion.
rx_rot = re.compile(
    r'  const rotacionPorProducto = \(0, import_react4\.useMemo\)\(\(\) => \{[\s\S]*?\n  \}, \[productos, movimientos\]\);'
)
mr = list(rx_rot.finditer(s))
if len(mr) != 1:
    raise SystemExit(f'LA008 rotacionPorProducto: esperaba 1 bloque y hay {len(mr)}')
new_rot = '''  const rotacionPorProducto = (0, import_react4.useMemo)(() => {
    const hoy = /* @__PURE__ */ new Date();
    return productos.map((p22) => {
      const movimientosProducto = movimientos.filter((m22) => m22.productoId === p22.id);
      const resumen = resumenConsumoProductoPM09(movimientosProducto);
      const cantSalidas = resumen.cantidad;
      if (cantSalidas <= 0 || !resumen.primeraFecha) {
        return { ...p22, cantSalidas: 0, consumoDiario: null, dias: null, rotacion: null };
      }
      const primera = new Date(resumen.primeraFecha);
      const diasTranscurridos = Math.max(1, Math.round((hoy - primera) / 864e5) + 1);
      const consumoDiario = cantSalidas / diasTranscurridos;
      const dias = consumoDiario > 0 ? (Number(p22.stock) || 0) / consumoDiario : null;
      const rotacion = dias ? 365 / dias : null;
      return { ...p22, cantSalidas, consumoDiario, dias, rotacion, diasConDatos: diasTranscurridos };
    });
  }, [productos, movimientos]);'''
s = rx_rot.sub(new_rot, s, count=1)

# ABC: mismas unidades netas de consumo dentro de la ventana de 12 meses.
old_global = '''    movimientos.forEach((m22) => {
      if (!esSalida(m22)) return;
      if (new Date(m22.fecha) < hace12meses) return;
      consumo[m22.productoId] = (consumo[m22.productoId] || 0) + Math.abs(Number(m22.cantidad) || 0);
    });'''
new_global = '''    movimientos.forEach((m22) => {
      if (new Date(m22.fecha) < hace12meses) return;
      const aporte = aporteConsumoInventarioPM09(m22);
      if (!aporte) return;
      consumo[m22.productoId] = (consumo[m22.productoId] || 0) + aporte;
    });'''
if s.count(old_global) != 1:
    raise SystemExit(f'LA008 ABC global: esperaba 1 y hay {s.count(old_global)}')
s = s.replace(old_global, new_global, 1)

old_local = '''    movimientosDelLocalActivo.forEach((m22) => {
      if (!esSalida(m22)) return;
      if (new Date(m22.fecha) < hace12meses) return;
      consumo[m22.productoId] = (consumo[m22.productoId] || 0) + Math.abs(Number(m22.cantidad) || 0);
    });'''
new_local = '''    movimientosDelLocalActivo.forEach((m22) => {
      if (new Date(m22.fecha) < hace12meses) return;
      const aporte = aporteConsumoInventarioPM09(m22);
      if (!aporte) return;
      consumo[m22.productoId] = (consumo[m22.productoId] || 0) + aporte;
    });'''
if s.count(old_local) != 1:
    raise SystemExit(f'LA008 ABC local: esperaba 1 y hay {s.count(old_local)}')
s = s.replace(old_local, new_local, 1)

old_unidades = '      const unidades = consumo[p22.id] || 0;'
if s.count(old_unidades) != 2:
    raise SystemExit(f'LA008 ABC unidades: esperaba 2 y hay {s.count(old_unidades)}')
s = s.replace(old_unidades, '      const unidades = Math.max(0, consumo[p22.id] || 0);', 2)

# Guardas finales.
for marker, expected in [
    ('function esCorreccionVentaPM09', 1),
    ('function unidadesVentaConSignoPM09', 1),
    ('function costoUnitarioHistoricoVentaPM09', 1),
    ('function resumenConsumoProductoPM09', 1),
    ('const operacionesVenta = movimientos.filter', 1),
    ('const resumen = resumenConsumoProductoPM09(movimientosProducto);', 1),
]:
    if s.count(marker) != expected:
        raise SystemExit(f'LA008 guarda {marker}: esperado {expected}, hay {s.count(marker)}')

p.write_text(s, encoding='utf-8')
print('PM09_LA008_PATCH_OK=1')
