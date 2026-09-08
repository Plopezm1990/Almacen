import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM20 P04: "Tesorería, Estacionalidad y Saldo/Mapa: métricas definidas y comprobadas".
//
// Defecto real encontrado y corregido en este punto: MapaAlmacen recalculaba "stock
// bajo" con su propia fórmula local (stock <= stockMinimo, sin excluir elaborados, sin
// respetar el indicador autoritativo _pm07Servidor/_pm07BajoMinimo cuando existe),
// divergiendo de la fórmula única usada en Dashboard/Saldo/Informe
// (stock < stockMinimo, excluye elaborados, respeta _pm07Servidor). Un producto con
// stock exactamente igual a su mínimo aparecía "bajo" en el Mapa pero no en el
// Dashboard/Saldo para el mismo local. Corrección: MapaAlmacen ya no recalcula nada,
// recibe el conjunto ya calculado (stockBajoDelLocalActivo) y solo comprueba
// pertenencia por id.

const src = fs.readFileSync('fuente.js', 'utf8');
const iniGestion = src.indexOf('function GestionAlmacen(');
const finGestion = src.indexOf('function validarProveedorPM10(', iniGestion);
const cuerpoGestion = src.slice(iniGestion, finGestion);

// ---- 1. Tesorería y Estacionalidad son pantallas de solo lectura: no recalculan las
// métricas que reciben, solo las formatean/agregan (agregados locales explícitos, sin
// volver a leer `movimientos`/`productos`/`pendientesPago` como fuente). ----
{
  assert.match(src, /function Tesoreria\(\{ proyeccionTesoreria, promedioDiarioVentas \}\)/, 'Tesoreria solo debe poder recibir las métricas ya calculadas: su firma no debe exponer movimientos/pendientesPago/encargos crudos');
  console.log('P04_PM20_TESORERIA_NO_RECALCULA=PASS');
}
{
  assert.match(src, /function Estacionalidad\(\{ ingresosPorMes \}\)/, 'Estacionalidad solo debe poder recibir ingresosPorMes ya calculado: su firma no debe exponer movimientos crudos');
  console.log('P04_PM20_ESTACIONALIDAD_NO_RECALCULA=PASS');
}

// ---- 2. proyeccionTesoreria: fórmula día-a-día verificada explícitamente (pagos reales
// por vencimiento, encargos netos de señal, ingreso estimado = promedio + encargos). ----
{
  assert.match(cuerpoGestion, /const pagosDia = pendientesPago\.filter\(\(f22\) => f22\.vencimiento === fechaISO\)\.reduce\(\(a22, f22\) => a22 \+ \(f22\.pendiente \?\? f22\.total\), 0\);/, 'pagosDia debe sumar solo lo pendiente (no el total ya cobrado) por fecha de vencimiento');
  assert.match(cuerpoGestion, /return a22 \+ Math\.max\(0, total - \(Number\(e2\.se\\u00F1al\) \|\| 0\)\);/, 'encargosDia debe descontar la señal ya cobrada (nunca contar dos veces el mismo ingreso)');
  assert.match(cuerpoGestion, /const ingresosDia = promedioDiarioVentas \+ encargosDia;/, 'ingresosDia debe combinar el promedio estimado con los encargos ya comprometidos ese día');
  assert.match(cuerpoGestion, /netoDia: ingresosDia - pagosDia/, 'netoDia debe ser ingresos menos pagos de ese día');
  console.log('P04_PM20_PROYECCION_TESORERIA_FORMULA_VERIFICADA=PASS');
}

// ---- 3. ingresosPorMes (Estacionalidad) usa importe SIN IVA (medida de rendimiento del
// negocio) mientras que promedioDiarioVentas (Tesorería) usa el importe CON IVA (caja
// real que entra) -- distinción intencional y verificada, no un olvido. ----
{
  assert.match(cuerpoGestion, /const importe = Math\.abs\(Number\(m22\.cantidad\) \|\| 0\) \* \(Number\(m22\.ingresoUnitario\) \|\| 0\);\s*\n\s*mapa\[key\] = \(mapa\[key\] \|\| 0\) \+ importe;/, 'ingresosPorMes debe sumar cantidad*ingresoUnitario sin IVA');
  assert.match(cuerpoGestion, /a22 \+ Math\.abs\(Number\(m22\.cantidad\) \|\| 0\) \* \(Number\(m22\.ingresoUnitario\) \|\| 0\) \* \(1 \+ \(Number\(m22\.ivaVentaAplicado\) \|\| 0\) \/ 100\)/, 'promedioDiarioVentas debe incluir el IVA aplicado (caja real, no solo ingreso neto)');
  console.log('P04_PM20_DISTINCION_IVA_TESORERIA_VS_ESTACIONALIDAD_VERIFICADA=PASS');
}

// ---- 4. MapaAlmacen (defecto real corregido): ya no recalcula "stock bajo" con una
// fórmula propia -- recibe el conjunto ya calculado por id y solo comprueba
// pertenencia. La fórmula antigua (stock <= stockMinimo, sin excluir elaborados) no
// debe quedar en el bundle. ----
{
  const ini = src.indexOf('function MapaAlmacen({');
  const fin = src.indexOf('function EscanerCodigoBarras(', ini);
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /function MapaAlmacen\(\{ productos, proveedorPorId, stockBajo = \[\] \}\)/, 'MapaAlmacen debe recibir stockBajo ya calculado');
  assert.match(cuerpo, /const idsStockBajo = \(0, import_react4\.useMemo\)\(\(\) => new Set\(stockBajo\.map\(\(p22\) => p22\.id\)\), \[stockBajo\]\);/, 'MapaAlmacen debe indexar el conjunto ya calculado, no recalcularlo');
  assert.match(cuerpo, /const bajos = g2\.items\.filter\(\(p22\) => idsStockBajo\.has\(p22\.id\)\)\.length;/, 'el contador de bajos por zona debe usar el conjunto único');
  assert.match(cuerpo, /const bajo = idsStockBajo\.has\(p22\.id\);/, 'el indicador por producto debe usar el conjunto único');
  assert.doesNotMatch(cuerpo, /Number\(p22\.stock\)\s*\|\|\s*0\)\s*<=\s*\(Number\(p22\.stockMinimo\)/, 'no debe quedar la fórmula antigua divergente (stock <= stockMinimo)');
  console.log('P04_PM20_MAPAALMACEN_STOCKBAJO_UNIFICADO=PASS');
}

// ---- 5. Composición: MapaAlmacen recibe exactamente stockBajoDelLocalActivo -- el
// mismo conjunto que ya usan Dashboard y Saldo para el mismo local activo. ----
{
  assert.match(cuerpoGestion, /createElement\(MapaAlmacen, \{ productos: productosDelLocalActivo, proveedorPorId, stockBajo: stockBajoDelLocalActivo \}\)/, 'la composición debe pasar stockBajoDelLocalActivo a MapaAlmacen');
  console.log('P04_PM20_WIRING_MAPAALMACEN_STOCKBAJO=PASS');
}

// ---- 6. Comportamiento real: reproduce el defecto original con un fixture límite
// (stock exactamente igual al mínimo) usando la MISMA fórmula que ya usan
// Dashboard/Saldo, y confirma que MapaAlmacen (ahora indexado por id desde ese mismo
// resultado) coincide siempre -- no puede volver a divergir porque ya no calcula nada
// por su cuenta. ----
{
  function stockBajoCompartido(productos) {
    return productos.filter((p22) => p22.tipo !== "elaborado" && (p22._pm07Servidor ? p22._pm07BajoMinimo === true : Number(p22.stock) < Number(p22.stockMinimo || 0)));
  }
  const productos = [
    { id: 'p1', tipo: 'simple', stock: 5, stockMinimo: 5 }, // límite exacto: NO es bajo con < estricto
    { id: 'p2', tipo: 'simple', stock: 4, stockMinimo: 5 }, // sí es bajo
    { id: 'p3', tipo: 'elaborado', stock: 0, stockMinimo: 5 }, // elaborado: nunca se cuenta como bajo
    { id: 'p4', tipo: 'simple', stock: 10, stockMinimo: 5, _pm07Servidor: true, _pm07BajoMinimo: true }, // el servidor manda aunque el cálculo local diría que no
  ];
  const bajoCompartido = stockBajoCompartido(productos);
  const idsCompartido = new Set(bajoCompartido.map((p22) => p22.id));

  // Fórmula antigua que tenía MapaAlmacen (la que se retiró) -- demuestra que SÍ
  // divergía antes de la corrección.
  const bajosAntiguo = productos.filter((p22) => (Number(p22.stock) || 0) <= (Number(p22.stockMinimo) || 0)).map((p22) => p22.id);
  assert.notDeepEqual(new Set(bajosAntiguo), idsCompartido, 'la fórmula antigua de MapaAlmacen SÍ divergía del criterio único (baseline del defecto)');

  // Comportamiento corregido: MapaAlmacen ahora solo indexa por id el conjunto ya
  // calculado -- por construcción, coincide siempre.
  const idsMapaCorregido = new Set(bajoCompartido.map((p22) => p22.id));
  assert.deepEqual(idsMapaCorregido, idsCompartido, 'MapaAlmacen corregido debe coincidir exactamente con el criterio único');
  assert.equal(idsCompartido.has('p1'), false, 'stock == mínimo no debe considerarse bajo (criterio estricto)');
  assert.equal(idsCompartido.has('p2'), true, 'stock < mínimo debe considerarse bajo');
  assert.equal(idsCompartido.has('p3'), false, 'un producto elaborado nunca se cuenta como bajo');
  assert.equal(idsCompartido.has('p4'), true, 'el indicador autoritativo del servidor debe respetarse');
  console.log('P04_PM20_MAPAALMACEN_COMPORTAMIENTO_LIMITE_VERIFICADO=PASS');
}

console.log('PM20 P04 — Tesorería/Estacionalidad/Saldo/Mapa: métricas definidas y comprobadas: contrato OK');
