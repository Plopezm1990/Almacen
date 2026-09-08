import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM18 P01: confirma, por inspección estática, que la clasificación de identidad fiscal
// está realmente conectada -- no basta con que existan las funciones si el ticket, la
// ficha de empresa o el estado inicial siguen fabricando/mostrando un dato falso.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- Los dos placeholders retirados no aparecen en ningún sitio del bundle. ----
{
  assert.doesNotMatch(src, /B87342077/, 'el CIF de relleno debe estar completamente retirado');
  assert.doesNotMatch(src, /CHOCOLOYOS, S\.L\./, 'la razón social de relleno debe estar completamente retirada');
  console.log('P01_PM18_PLACEHOLDERS_RETIRADOS=PASS');
}

// ---- Estado inicial de configEmpresa: sin NIF/razón social de relleno. ----
{
  const ini = src.indexOf('const [configEmpresa, setConfigEmpresa] = (0, import_react4.useState)({');
  assert.ok(ini >= 0, 'estado inicial configEmpresa no encontrado');
  const fin = src.indexOf('});', ini);
  const bloque = src.slice(ini, fin);
  assert.match(bloque, /razonSocial: ""/, 'el estado inicial no debe fabricar una razón social');
  assert.match(bloque, /nif: ""/, 'el estado inicial no debe fabricar un NIF');
  console.log('P01_PM18_SEMILLA_INICIAL_SIN_IDENTIDAD_FALSA=PASS');
}

// ---- Ticket de venta: usa la clasificación real, no rellenos fijos. ----
{
  const ini = src.indexOf('function renderTicketVenta() {');
  assert.ok(ini >= 0, 'renderTicketVenta no encontrada');
  const fin = src.indexOf('function ', ini + 10);
  const bloque = src.slice(ini, fin);

  assert.match(bloque, /const estadoNifEmpresa = estadoIdentidadFiscalPM18\(nifOriginalEmpresa\);/, 'el ticket debe clasificar el NIF real de la empresa');
  assert.match(bloque, /nifEmpresa = estadoNifEmpresa === "sin_verificar" \? nifOriginalEmpresa : ""/, 'solo debe mostrarse el NIF tal cual cuando el formato es válido');
  assert.match(bloque, /etiquetaEstadoIdentidadFiscalPM18\(estadoNifEmpresa\)/, 'debe mostrar el estado real cuando no hay NIF válido, no ocultarlo sin más');
  assert.match(bloque, /Raz\\xF3n social no configurada/, 'una razón social ausente debe decirlo, no inventar una');
  assert.match(bloque, /tieneNumeroFiscal && estadoNifEmpresa === "sin_verificar" \? "FACTURA SIMPLIFICADA"/, 'nunca debe etiquetarse como factura simplificada sin un NIF con formato válido detrás');
  console.log('P01_PM18_TICKET_USA_CLASIFICACION_REAL=PASS');
}

// ---- Ficha de empresa, alta de empresa y listado: muestran el estado real. ----
{
  assert.match(src, /style: \{ color: estadoIdentidadFiscalPM18\(form\.nif\) === "invalido" \? C2\.red : C2\.inkSoft \} \}, etiquetaEstadoIdentidadFiscalPM18\(estadoIdentidadFiscalPM18\(form\.nif\)\)/, 'la ficha de empresa debe mostrar el estado real del NIF que se está editando');
  assert.match(src, /style: \{ color: estadoIdentidadFiscalPM18\(nif\) === "invalido" \? C2\.red : C2\.inkSoft \} \}, etiquetaEstadoIdentidadFiscalPM18\(estadoIdentidadFiscalPM18\(nif\)\)/, 'el alta de empresa nueva debe mostrar el estado real del NIF mientras se escribe');
  assert.match(src, /etiquetaEstadoIdentidadFiscalPM18\(estadoIdentidadFiscalPM18\(e2\.nif\)\)\)/, 'el listado de empresas debe mostrar el estado real de cada una');
  console.log('P01_PM18_GESTOR_EMPRESAS_MUESTRA_ESTADO_REAL=PASS');
}

console.log('PM18 P01 (wiring) — identidad fiscal conectada de punta a punta: contrato OK');
