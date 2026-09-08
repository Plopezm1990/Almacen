import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM20 P07: revalidación acumulada de los módulos con cobertura histórica fuerte
// (Login/sesiones, Empresas/locales, Productos/movimientos, Inventarios/conteos/
// traspasos, Caja/TPV/devoluciones, Gastos/pagos/IVA, Personal, Clientes/encargos,
// Producción/fichas/mermas, APPCC/aceite). No se reabre ningún paquete cerrado: este
// contrato solo confirma, sobre el HEAD actual, que la evidencia histórica sigue
// presente y que un hallazgo nuevo real (TPV bloqueado en "Todos") queda fijado con
// prueba.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- Hallazgo verificado en este punto (sin defecto, TPV ya bloqueado en "Todos"): la
// composición no permite abrir VentaRapida sin un local activo concreto -- el mismo
// criterio NR-07/"Todos nunca destino" ya cerrado en PM19 P05, aplicado también a nivel
// de navegación de pantalla completa, no solo a las mutaciones individuales. ----
{
  assert.match(src, /tab === "venta" && \(localInformeId && localActivoId === localInformeId \? .*createElement\(VentaRapida, \{ productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo/, 'VentaRapida debe recibir datos ya filtrados por local activo y las funciones probadas del motor, sin reimplementar nada');
  assert.match(src, /El TPV no puede abrirse en Todos los locales\. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \\xFAnico local\./, 'debe existir el bloqueo explícito de TPV en modo "Todos"');
  console.log('P07_PM20_TPV_BLOQUEADO_EN_TODOS=PASS');
}

// ---- Inventario de evidencia histórica por módulo de la matriz -- confirma que los
// documentos de cierre de los paquetes que sustentan cada módulo siguen presentes en el
// árbol (no se han perdido ni movido silenciosamente). ----
{
  const evidencia = {
    'Login, recuperación y sesiones': ['tests/g1/P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md'],
    'Empresas, locales y configuración': ['tests/pm19/P05_CIERRE_CONTEXTO_ESCRITURA_UNICO.md', 'tests/pm18/P01_CIERRE_LA021_IDENTIDAD_FISCAL.md'],
    'Productos y movimientos': ['tests/pm10/P04_LA011_PRODUCTOS_EVIDENCIA.md'],
    'Inventarios, conteos y traspasos': ['tests/pm12/P05_AJUSTES_TRAZABLES.md', 'tests/pm19/P03_CIERRE_TRASPASO_LOCAL_CERRADO.md'],
    'Caja, TPV, historial y devoluciones': ['tests/pm08'],
    'Gastos, pagos, facturas e IVA': ['tests/pm11-compra/P05_FACTURA_IDENTIDAD.md', 'tests/pm11-compra/P06_PAGO_REVERSO_E2E.md'],
    'Personal y submódulos': ['tests/pm13/P06_CIERRE.md'],
    'Clientes y encargos': ['tests/pm14/P08_CIERRE_HISTORIAL_INFORMES_MOVIL_REGRESION.md'],
    'Producción, fichas de coste y mermas': ['tests/pm19/P04_CIERRE_MERMA_DESCUENTA_UNA_VEZ.md'],
    'APPCC y aceite de freidoras': ['tests/pm19/P01_CIERRE_APPCC_HISTORICO_TRAZABLE.md', 'tests/pm19/P02_CIERRE_ACEITE_RESPONSABLE.md'],
  };
  for (const [modulo, rutas] of Object.entries(evidencia)) {
    for (const ruta of rutas) {
      assert.ok(fs.existsSync(ruta), `${modulo}: evidencia esperada ausente en ${ruta}`);
    }
  }
  console.log('P07_PM20_EVIDENCIA_HISTORICA_POR_MODULO_PRESENTE=PASS');
}

console.log('PM20 P07 — revalidación acumulada de módulos con cobertura histórica fuerte: contrato OK');
