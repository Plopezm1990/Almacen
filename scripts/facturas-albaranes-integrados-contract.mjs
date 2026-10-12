import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const repo = process.cwd();
const runtimes = [
  join(repo, 'fuente.js'),
  join(repo, 'source-recovery', 'fuente-recuperado.js'),
];

function cargarContrato(source, runtime) {
  const inicio = source.indexOf('function calcularTotalesFacturaDirecta');
  const fin = source.indexOf('function normalizarPagoPM06', inicio);
  assert.ok(inicio >= 0 && fin > inicio, `${runtime}: no se pudo aislar el contrato de facturas agrupadas`);
  const codigo = `${source.slice(inicio, fin)}\nthis.api={calcularTotalesFacturaDirecta,claveFacturaProveedorAgrupada,clasificarAlbaranesFacturaAgrupada,validarFacturaAgrupada};`;
  const contexto = {
    redondearDineroPM06: (valor) => Math.round((Number(valor) || 0) * 100) / 100,
    fechaFacturaValidaPM11: (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')),
  };
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto, { filename: runtime });
  return contexto.api;
}

for (const runtime of runtimes) {
  const source = readFileSync(runtime, 'utf8');
  assert.match(source, /function Facturas\(\{[^}]*confirmarFacturaConAlbaranes/, `${runtime}: falta la pantalla integrada`);
  assert.match(source, /functions\.invoke\("importar-factura"/, `${runtime}: falta el extractor agrupado`);
  assert.match(source, /Confirmar factura y recepcionar/, `${runtime}: falta la confirmación conjunta`);
  assert.match(source, /VINCULAR_RECIBIDO/, `${runtime}: falta la vinculación sin movimiento`);
  assert.match(source, /estado === "ACTIVA"/, `${runtime}: los totales no excluyen borradores`);
  assert.match(source, /const esBorrador = data\?\.estado === "BORRADOR"/, `${runtime}: los borradores incompletos no están contemplados`);
  assert.match(source, /codigoProveedor: ln2\?\.codigoProveedor \|\| ln2\?\.codigo/, `${runtime}: las referencias del proveedor no llegan a recepción`);
  assert.match(source, /productosCreadosRecepcion\.has\(claveProductoRecepcion\)/, `${runtime}: una factura con varios albaranes puede duplicar productos nuevos`);
  assert.match(source, /registrarProductoSnapshot\(nuevo\)/, `${runtime}: el motor de stock no comparte las altas del lote`);
  execFileSync(process.execPath, ['--check', runtime], { cwd: repo, stdio: 'pipe' });

  const api = cargarContrato(source, runtime);
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.calcularTotalesFacturaDirecta({ tiposIva: [{ tipo: 10, base: 50, cuota: 5 }, { tipo: 21, base: 50, cuota: 10.5 }] }))),
    { base: 100, iva: 15.5, total: 115.5, porTipo: { 10: { base: 50, cuota: 5 }, 21: { base: 50, cuota: 10.5 } } },
    `${runtime}: cálculo multi IVA incorrecto`,
  );
  assert.notEqual(
    api.claveFacturaProveedorAgrupada({ empresaId: 'e', localId: 'l', proveedorId: 'p', serie: 'A', numeroFactura: '10', fecha: '2026-01-01' }),
    api.claveFacturaProveedorAgrupada({ empresaId: 'e', localId: 'l', proveedorId: 'p', serie: 'B', numeroFactura: '10', fecha: '2026-01-01' }),
    `${runtime}: la serie no participa en la identidad`,
  );

  const existentes = [{ id: 'recibido', empresaId: 'e', localId: 'l', proveedorId: 'p', numero: 'ALB-1', estado: 'confirmado' }];
  const clasificados = api.clasificarAlbaranesFacturaAgrupada({
    empresaId: 'e', localId: 'l', proveedorId: 'p', albaranes: existentes,
    albaranesImportados: [
      { numeroAlbaran: 'ALB-1', totalAlbaran: 55, lineas: [{ descripcion: 'Café', cantidad: 1 }] },
      { numeroAlbaran: 'ALB-2', totalAlbaran: 60.5, lineas: [{ descripcion: 'Leche', cantidad: 2 }] },
    ],
  });
  assert.equal(clasificados[0].estadoConciliacion, 'VINCULAR_RECIBIDO', `${runtime}: un albarán recibido movería stock otra vez`);
  assert.equal(clasificados[1].estadoConciliacion, 'CREAR_Y_RECEPCIONAR', `${runtime}: un albarán nuevo no se prepara para recepción`);
  const validacion = api.validarFacturaAgrupada({
    factura: { proveedorId: 'p', numeroFactura: 'F-1', fecha: '2026-10-12', tiposIva: [{ tipo: 10, base: 105, cuota: 10.5 }], totalFacturaDocumento: 115.5 },
    albaranesClasificados: clasificados,
  });
  assert.equal(validacion.ok, true, `${runtime}: una factura agrupada válida se bloquea`);
  const duplicados = api.clasificarAlbaranesFacturaAgrupada({ empresaId: 'e', localId: 'l', proveedorId: 'p', albaranes: [], albaranesImportados: [{ numeroAlbaran: 'A-1', lineas: [{ descripcion: 'x', cantidad: 1 }] }, { numeroAlbaran: 'A1', lineas: [{ descripcion: 'x', cantidad: 1 }] }] });
  assert.equal(duplicados[1].estadoConciliacion, 'DUPLICADO', `${runtime}: no detecta duplicados normalizados`);
}

const principal = readFileSync(runtimes[0], 'utf8');
const recuperado = readFileSync(runtimes[1], 'utf8');
const bloque = (source) => source.slice(source.indexOf('function calcularTotalesFacturaDirecta'), source.indexOf('function normalizarPagoPM06'));
assert.equal(bloque(principal), bloque(recuperado), 'las reglas de facturas agrupadas difieren entre las dos fuentes');

const edgePath = join(repo, 'supabase', 'functions', 'importar-factura', 'index.ts');
const edge = readFileSync(edgePath, 'utf8');
assert.match(edge, /MAX_PAGINAS = 36/, 'el extractor no admite facturas largas');
assert.match(edge, /"albaranes": \[/, 'el extractor no exige agrupación por albarán');
assert.match(edge, /"tiposIva": \[/, 'el extractor no exige desglose multi IVA');
assert.match(edge, /SERVICE_ROLE_KEY/, 'falta la comprobación de autorización del servidor');
assert.match(edge, /requiereRevision: hayBloqueo/, 'el servidor no marca lecturas ambiguas');
assert.match(edge, /max_tokens: 8000/, 'la respuesta puede truncar facturas mensuales');

console.log('FACTURAS_ALBARANES_INTEGRADOS_CONTRACT_PASS');
