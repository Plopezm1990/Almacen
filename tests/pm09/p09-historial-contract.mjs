import fs from 'node:fs';

const source = fs.readFileSync('fuente.js', 'utf8');

function one(needle, name) {
  const n = source.split(needle).length - 1;
  console.log(`PM09_P09_${name}=${n === 1 ? 1 : 0}`);
  if (n !== 1) throw new Error(`${name}_COUNT=${n}`);
}
function yes(cond, name) {
  console.log(`PM09_P09_${name}=${cond ? 1 : 0}`);
  if (!cond) throw new Error(name);
}

one('function datoCorreccionHistorialPM09', 'HELPER_DATO_UNICO');
one('function esDevolucionClienteHistorialPM09', 'HELPER_DEVOLUCION_UNICO');
one('function etiquetaEstadoVentaHistorialPM09', 'HELPER_ESTADO_UNICO');
one('const correccionesPorVenta = {};', 'CORRECCIONES_POR_VENTA_UNICO');
yes(source.includes('const estado = anulada ? "ANULADA"') && source.includes('"DEVUELTA_TOTAL"') && source.includes('"DEVUELTA_PARCIAL"'), 'CUATRO_ESTADOS');
yes(source.includes('importeOriginal, importeNetoGestion, importeAsociadoDevuelto, reembolsoAcumulado'), 'ORIGINAL_Y_NETO_SEPARADOS');
yes(source.includes('unidadesOriginales, unidadesDevueltas, unidadesNetas'), 'UNIDADES_TRAZABLES');
yes(source.includes('"Trazabilidad de correcciones"'), 'UI_TRAZABILIDAD');
yes(source.includes('["Todas", "Activas", "Anuladas", "Dev. parcial", "Dev. total"]'), 'FILTROS_ESTADO');
yes(source.includes('v22.estado === "ACTIVA" && anularVenta'), 'ANULAR_SOLO_ACTIVA');
yes(source.includes('etiquetaEstadoVentaHistorialPM09(v22.estado)'), 'TICKET_ESTADO_ACTUAL');
yes(source.includes('fmt(v22.importe)') && source.includes('Total original'), 'TICKET_CONSERVA_ORIGINAL');
yes(source.includes('const total2 = ventasFiltradas.reduce((a22, v22) => a22 + (Number(v22.importeNetoGestion) || 0), 0);'), 'RESUMEN_USA_NETO');
yes(!source.includes('setMovimientos((s2) => s2.filter((m22) => m22.ventaId'), 'SIN_BORRADO_HISTORICO');

const ingresoUnitario = 5.4545454545;
const iva = 10;
const grossUnit = ingresoUnitario * (1 + iva / 100);
const original = 2 * grossUnit;

function proyectar({ anulada = false, vendidas = 2, devueltas = 0, reembolso = 0 }) {
  const dev = Math.min(vendidas, Math.max(0, devueltas));
  const netUnits = anulada ? 0 : Math.max(0, vendidas - dev);
  const estado = anulada ? 'ANULADA' : dev <= 1e-9 ? 'ACTIVA' : dev >= vendidas - 1e-9 ? 'DEVUELTA_TOTAL' : 'DEVUELTA_PARCIAL';
  const netManagement = anulada ? 0 : Math.max(0, original - dev * grossUnit);
  return { estado, original, netUnits, netManagement, reembolso };
}

const cancelada = proyectar({ anulada: true });
yes(cancelada.estado === 'ANULADA', 'MODELO_ANULADA_ESTADO');
yes(Math.abs(cancelada.original - 12) < 1e-6, 'MODELO_ANULADA_ORIGINAL_12');
yes(cancelada.netUnits === 0 && cancelada.netManagement === 0, 'MODELO_ANULADA_NETO_CERO');

const parcial = proyectar({ devueltas: 1, reembolso: 0 });
yes(parcial.estado === 'DEVUELTA_PARCIAL', 'MODELO_PARCIAL_ESTADO');
yes(parcial.netUnits === 1, 'MODELO_PARCIAL_UNIDAD_NETA_1');
yes(Math.abs(parcial.original - 12) < 1e-6, 'MODELO_PARCIAL_ORIGINAL_12');
yes(Math.abs(parcial.netManagement - 6) < 1e-6, 'MODELO_PARCIAL_NETO_6');
yes(parcial.reembolso === 0, 'MODELO_SIN_REEMBOLSO_SEPARADO');

const total = proyectar({ devueltas: 2, reembolso: 0 });
yes(total.estado === 'DEVUELTA_TOTAL', 'MODELO_TOTAL_ESTADO');
yes(total.netUnits === 0 && Math.abs(total.netManagement) < 1e-6, 'MODELO_TOTAL_NETO_CERO_GESTION');

console.log('PM09_P09_HISTORIAL_CONTRACT_OK=1');
