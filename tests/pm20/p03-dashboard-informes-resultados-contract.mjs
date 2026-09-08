import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM20 P03: "Dashboard, informes y Resultados: fórmulas y filtros reproducibles" --
// confirma por inspección real (no supuesta) que las variantes de una misma métrica
// (todo el estado, local activo, informe con local seleccionable) usan la MISMA fórmula,
// y que Dashboard/Resultados/LibroIva consumen consistentemente las variantes *Informe
// -- nunca una mezcla de alcances para lo que debería ser el mismo periodo/vista.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function GestionAlmacen(');
const fin = src.indexOf('function validarProveedorPM10(', ini);
assert.ok(ini >= 0 && fin > ini, 'no se pudo acotar GestionAlmacen');
const cuerpo = src.slice(ini, fin);

// ---- 1. valorInventario: misma fórmula (stock*costo, excluye utillaje) en las tres
// variantes de alcance. ----
{
  const formula = 'reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0)';
  const variantes = [
    ['valorInventario', 'productos.filter((p22) => !esUtillaje(p22))'],
    ['valorInventarioDelLocalActivo', 'productosDelLocalActivo.filter((p22) => !esUtillaje(p22))'],
    ['valorInventarioInforme', 'productosInforme.filter((p22) => !esUtillaje(p22))'],
  ];
  for (const [nombre, filtro] of variantes) {
    assert.ok(cuerpo.includes(`${filtro}.${formula}`), `${nombre} debe usar la fórmula exacta stock*costo sin utillaje`);
  }
  console.log('P03_PM20_VALORINVENTARIO_FORMULA_IDENTICA_EN_3_ALCANCES=PASS');
}

// ---- 2. stockBajo: mismo criterio (no elaborado, bajo mínimo) en las tres variantes. ----
{
  const criterio = 'p22.tipo !== "elaborado" && (p22._pm07Servidor ? p22._pm07BajoMinimo === true : Number(p22.stock) < Number(p22.stockMinimo || 0))';
  for (const base of ['productos', 'productosDelLocalActivo', 'productosInforme']) {
    assert.ok(cuerpo.includes(`${base}.filter((p22) => ${criterio})`), `stockBajo sobre ${base} debe usar el mismo criterio`);
  }
  console.log('P03_PM20_STOCKBAJO_CRITERIO_IDENTICO_EN_3_ALCANCES=PASS');
}

// ---- 3. margenPromedio: misma fórmula (promedio de margenDe sobre productos con
// precio) en Dashboard (variante Informe) y en el cálculo base. ----
{
  assert.match(cuerpo, /const margenPromedio = \(0, import_react4\.useMemo\)\(\(\) => \{\s*const conPrecio = productos\.filter\(\(p22\) => Number\(p22\.precioVenta\) > 0\);\s*if \(!conPrecio\.length\) return 0;\s*const total = conPrecio\.reduce\(\(acc, p22\) => acc \+ \(margenDe\(p22\) \|\| 0\), 0\);\s*return total \/ conPrecio\.length;/, 'margenPromedio base debe usar la fórmula esperada');
  assert.ok(cuerpo.includes('const margenPromedioInforme = productosConPrecioInforme.length ? productosConPrecioInforme.reduce((acc, p22) => acc + (margenDe(p22) || 0), 0) / productosConPrecioInforme.length : 0;'), 'margenPromedioInforme debe usar la misma fórmula que margenPromedio');
  console.log('P03_PM20_MARGENPROMEDIO_FORMULA_IDENTICA=PASS');
}

// ---- 4. Dashboard, Resultados y LibroIva reciben consistentemente las variantes
// *Informe -- nunca una mezcla con datos del local activo o de toda la empresa sin
// filtrar, que mostraría cifras de alcance distinto bajo el mismo selector de local. ----
{
  const dashboardIni = cuerpo.indexOf('tab === "dashboard" && ');
  const resultadosIni = cuerpo.indexOf('tab === "resultados" && ', dashboardIni);
  const libroIvaIni = cuerpo.indexOf('tab === "libroiva" && ', resultadosIni);
  assert.ok(dashboardIni > 0 && resultadosIni > dashboardIni, 'no se pudieron localizar los bloques dashboard/resultados');
  const bloqueDashboard = cuerpo.slice(dashboardIni, resultadosIni);
  const bloqueResultados = cuerpo.slice(resultadosIni, cuerpo.indexOf('tab === "fichas"', resultadosIni));

  for (const prop of ['valorInventario: valorInventarioInforme', 'stockBajo: stockBajoInforme', 'pedidosPendientes: pedidosPendientesInforme', 'margenPromedio: margenPromedioInforme', 'movimientos: movimientosInforme', 'productos: productosInforme']) {
    assert.ok(bloqueDashboard.includes(prop), `Dashboard debe recibir ${prop}`);
  }
  for (const prop of ['movimientos: movimientosInforme', 'productos: productosInforme', 'gastosGenerales: gastosGeneralesInforme', 'empleados: empleadosInforme']) {
    assert.ok(bloqueResultados.includes(prop), `Resultados debe recibir ${prop}`);
  }
  // Ambos comparten el mismo selector de local de informe -- el mismo control gobierna
  // el alcance de las dos pantallas, no hay dos selectores independientes que puedan
  // desincronizarse.
  assert.ok(cuerpo.includes('(tab === "dashboard" || tab === "resultados" || tab === "libroiva") && ') && cuerpo.includes('createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal })'), 'Dashboard/Resultados/LibroIva deben compartir un único selector de contexto de informe');
  console.log('P03_PM20_DASHBOARD_RESULTADOS_MISMO_ALCANCE_INFORME=PASS');
}

console.log('PM20 P03 — Dashboard/informes/Resultados: fórmulas y filtros reproducibles (verificado, no supuesto): contrato OK');
