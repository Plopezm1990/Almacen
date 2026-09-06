import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const commonIni = src.indexOf('function errorValidacionPM10');
const commonFin = src.indexOf('function crearLogicaProductos', commonIni);
const encIni = src.indexOf('function validarEncargoPM10(');
const encFin = src.indexOf('function crearLogicaVenta({', encIni);
assert.ok(commonIni >= 0 && commonFin > commonIni, 'helpers PM10 presentes');
assert.ok(encIni >= 0 && encFin > encIni, 'bloque Encargos PM10 presente');

const ctx = {
  todayISO: () => '2026-09-05',
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  sincronizarCobroSeñal: (existentes = [], señal = 0, medio = 'Efectivo', fecha = '2026-09-05') => {
    const resto = (existentes || []).filter((x) => x && x.concepto !== 'Señal');
    const n = Number(señal);
    return n > 0 ? [{ id: 'cobro-senal', concepto: 'Señal', importe: n, medioPago: medio, fecha }, ...resto] : resto;
  }
};
vm.createContext(ctx);
vm.runInContext(src.slice(commonIni, commonFin), ctx);
vm.runInContext(src.slice(encIni, encFin), ctx);

const validar = ctx.validarEncargoPM10;
const crearLogica = ctx.crearLogicaEncargos;
assert.equal(typeof validar, 'function');
assert.equal(typeof crearLogica, 'function');

const productos = [
  { id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12 },
  { id: 'p2', nombre: 'Café otro local', localId: 'L2', empresaId: 'E1', precioVenta: 2 }
];
const clientes = [
  { id: 'c1', nombre: 'Cliente A', empresaId: 'E1' },
  { id: 'c2', nombre: 'Cliente B', empresaId: 'E2' }
];
const opts = { productos, clientes, localActivoId: 'L1', empresaId: 'E1', fechaCreacion: '2026-09-05' };
const base = {
  clienteId: 'c1',
  fechaEntrega: '2026-09-05',
  horaEntrega: '12:00',
  localId: 'L1',
  señal: 5,
  señalMedioPago: 'Tarjeta',
  lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }]
};

function ok(data, extra = {}) {
  const r = validar(data, { ...opts, ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r;
}
function fail(data, campo, codigo, extra = {}) {
  const r = validar(data, { ...opts, ...extra });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.campo, campo, JSON.stringify(r));
  assert.equal(r.codigo, codigo, JSON.stringify(r));
  return r;
}

// Camino feliz, decimales y valores finitos grandes.
let r = ok(base);
assert.equal(r.total, 20);
assert.equal(r.datos.lineas[0].cantidad, 2);
assert.equal(r.datos.lineas[0].precioUnitario, 10);
r = ok({ ...base, señal: '', lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: '1.5', precioUnitario: '9.99' }] });
assert.equal(r.datos.señal, 0, 'señal vacía = ausencia de señal');
assert.equal(r.datos.lineas[0].cantidad, 1.5);
assert.equal(r.datos.lineas[0].precioUnitario, 9.99);
ok({ ...base, señal: 0, lineas: [{ productoId: '', descripcion: 'Tarta personalizada', cantidad: 1, precioUnitario: 0 }] });
ok({ ...base, señal: 0, lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 1e6, precioUnitario: 1e6 }] });

// Cabecera.
fail({ ...base, clienteId: '' }, 'clienteId', 'campo_obligatorio');
fail({ ...base, clienteId: 'no-existe' }, 'clienteId', 'referencia_inexistente');
fail({ ...base, clienteId: 'c2' }, 'clienteId', 'referencia_otro_contexto');
fail({ ...base, fechaEntrega: '' }, 'fechaEntrega', 'campo_obligatorio');
fail({ ...base, fechaEntrega: '2026-02-30' }, 'fechaEntrega', 'fecha_invalida');
fail({ ...base, fechaEntrega: '05/09/2026' }, 'fechaEntrega', 'fecha_invalida');
fail({ ...base, fechaEntrega: '2026-09-04' }, 'fechaEntrega', 'valor_fuera_rango');
fail({ ...base, localId: 'L2' }, 'localId', 'referencia_otro_contexto');
fail({ ...base }, 'localId', 'contexto_no_autorizado', { localActivoId: null });

// Líneas: ninguna línea inválida puede ser descartada silenciosamente.
fail({ ...base, lineas: [] }, 'lineas', 'campo_obligatorio');
fail({ ...base, lineas: [{ productoId: '', descripcion: '   ', cantidad: 1, precioUnitario: 1 }] }, 'lineas.0.productoId', 'campo_obligatorio');
fail({ ...base, lineas: [{ productoId: 'no-existe', descripcion: '', cantidad: 1, precioUnitario: 1 }] }, 'lineas.0.productoId', 'referencia_inexistente');
fail({ ...base, lineas: [{ productoId: 'p2', descripcion: '', cantidad: 1, precioUnitario: 1 }] }, 'lineas.0.productoId', 'referencia_otro_contexto');
for (const v of [0, -1]) fail({ ...base, lineas: [{ productoId: 'p1', cantidad: v, precioUnitario: 1 }] }, 'lineas.0.cantidad', 'valor_fuera_rango');
for (const v of ['abc', Infinity, -Infinity, NaN]) fail({ ...base, lineas: [{ productoId: 'p1', cantidad: v, precioUnitario: 1 }] }, 'lineas.0.cantidad', 'numero_no_finito');
fail({ ...base, lineas: [{ productoId: 'p1', cantidad: '', precioUnitario: 1 }] }, 'lineas.0.cantidad', 'campo_obligatorio');
fail({ ...base, lineas: [{ productoId: 'p1', cantidad: 1, precioUnitario: -0.01 }] }, 'lineas.0.precioUnitario', 'valor_fuera_rango');
for (const v of ['abc', Infinity, -Infinity, NaN]) fail({ ...base, lineas: [{ productoId: 'p1', cantidad: 1, precioUnitario: v }] }, 'lineas.0.precioUnitario', 'numero_no_finito');
fail({ ...base, lineas: [{ productoId: 'p1', cantidad: 1, precioUnitario: '' }] }, 'lineas.0.precioUnitario', 'campo_obligatorio');

// Señal / anticipo.
fail({ ...base, señal: -1 }, 'señal', 'valor_fuera_rango');
for (const v of ['abc', Infinity, -Infinity, NaN]) fail({ ...base, señal: v }, 'señal', 'numero_no_finito');
fail({ ...base, señal: 20.01 }, 'señal', 'valor_fuera_rango');
fail({ ...base, señal: 1, señalMedioPago: '' }, 'señalMedioPago', 'campo_obligatorio');
fail({ ...base, señal: 1, señalMedioPago: 'Cripto' }, 'señalMedioPago', 'valor_no_permitido');
ok({ ...base, señal: 20, señalMedioPago: 'Efectivo' });

function harness(iniciales = [], { localActivoId = 'L1', empresaId = 'E1' } = {}) {
  let estado = structuredClone(iniciales);
  let mutaciones = 0;
  const setEncargos = (fn) => { mutaciones += 1; estado = fn(estado); };
  const logica = crearLogica({
    encargos: iniciales,
    setEncargos,
    registrarAuditoria: () => {},
    productos,
    clientes,
    setProductos: () => {},
    setMovimientos: () => {},
    venderLineas: () => ({ ok: true }),
    localActivoId,
    empresaId
  });
  return { logica, estado: () => estado, mutaciones: () => mutaciones };
}

// Alta todo-o-nada: una línea mala invalida el lote entero; después una alta válida funciona.
let h = harness();
let res = h.logica.addEncargo({
  ...base,
  señal: 0,
  lineas: [
    { productoId: 'p1', descripcion: 'válida', cantidad: 1, precioUnitario: 10 },
    { productoId: 'p1', descripcion: 'inválida', cantidad: -1, precioUnitario: 10 }
  ]
});
assert.equal(res.ok, false, JSON.stringify(res));
assert.equal(h.mutaciones(), 0, 'no puede persistir solo la línea válida');
assert.equal(h.estado().length, 0);
res = h.logica.addEncargo({ ...base, señal: '5', lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: '2', precioUnitario: '10' }] });
assert.ok(res.id, JSON.stringify(res));
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado().length, 1);
assert.equal(h.estado()[0].estado, 'Pendiente');
assert.equal(h.estado()[0].localId, 'L1');
assert.equal(h.estado()[0].lineas[0].cantidad, 2);
assert.equal(h.estado()[0].señal, 5);
assert.equal(h.estado()[0].cobros[0].importe, 5);

// Sin contexto o cliente de otra empresa: cero mutación.
h = harness([], { localActivoId: null, empresaId: 'E1' });
res = h.logica.addEncargo(base);
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);
h = harness();
res = h.logica.addEncargo({ ...base, clienteId: 'c2' });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);

// Edición: candidato completo se valida antes de tocar estado.
const existente = {
  id: 'enc-1',
  estado: 'Pendiente',
  fechaCreacion: '2026-09-05',
  cobros: [],
  ...base,
  señal: 0
};
h = harness([existente]);
res = h.logica.updateEncargo('enc-1', { señal: 99 });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);
assert.equal(h.estado()[0].señal, 0);
res = h.logica.updateEncargo('enc-1', { señal: 10, señalMedioPago: 'Tarjeta' });
assert.equal(res, true);
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado()[0].señal, 10);
assert.equal(h.estado()[0].cobros[0].importe, 10);

// Un legado incoherente no se reescribe al cargar; una edición ordinaria exige corregir el conjunto.
const legado = {
  id: 'legacy', estado: 'Pendiente', fechaCreacion: '2026-09-01', clienteId: 'c1', fechaEntrega: '2026-09-05', localId: 'L1', señal: 0, señalMedioPago: 'Efectivo', cobros: [],
  lineas: [{ productoId: 'p1', descripcion: 'legado', cantidad: -2, precioUnitario: 10 }]
};
h = harness([legado]);
assert.equal(h.mutaciones(), 0);
res = h.logica.updateEncargo('legacy', { notas: 'solo notas' });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);
res = h.logica.updateEncargo('legacy', { lineas: [{ productoId: 'p1', descripcion: 'corregido', cantidad: 2, precioUnitario: 10 }] });
assert.equal(res, true);
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado()[0].lineas[0].cantidad, 2);

// Editar otro local queda bloqueado.
const otroLocal = { ...existente, id: 'enc-L2', localId: 'L2' };
h = harness([otroLocal]);
res = h.logica.updateEncargo('enc-L2', { notas: 'no' });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);

// Fecha en edición se compara con creación del encargo, no con el día actual.
const historicoCoherente = { ...existente, id: 'hist', fechaCreacion: '2026-08-01', fechaEntrega: '2026-08-02' };
h = harness([historicoCoherente]);
res = h.logica.updateEncargo('hist', { notas: 'edición permitida de un encargo históricamente coherente' });
assert.equal(res, true);
assert.equal(h.mutaciones(), 1);

// Evidencia estática UI: no filtra líneas inválidas ni degrada señal con Number(...) antes del dominio.
const uiIni = src.indexOf('function Encargos({');
const uiFin0 = src.indexOf('function Clientes(', uiIni);
const ui = src.slice(uiIni, uiFin0 > uiIni ? uiFin0 : uiIni + 60000);
assert.doesNotMatch(ui, /const validas = form\.lineas\.filter/);
assert.doesNotMatch(ui, /se\\u00F1al: form\.se\\u00F1al === "" \? 0 : Number\(form\.se\\u00F1al\)/);
assert.match(ui, /const datos = \{ \.\.\.form, lineas: form\.lineas\.map/);
assert.match(ui, /const resultado = editingId \? updateEncargo\(editingId, datos\) : addEncargo\(datos\);/);
const resultPos = ui.indexOf('const resultado = editingId ?');
const errorPos = ui.indexOf('resultado.ok === false', resultPos);
const closePos = ui.indexOf('setShowForm(false)', resultPos);
assert.ok(resultPos >= 0 && errorPos > resultPos && closePos > errorPos, 'el formulario solo se cierra tras éxito');

const logic = src.slice(src.indexOf('function crearLogicaEncargos({'), encFin);
assert.match(logic, /function addEncargo\(data\)[\s\S]{0,500}validarEncargoPM10/);
assert.match(logic, /function updateEncargo\(id, data\)[\s\S]{0,900}validarEncargoPM10/);
assert.match(src, /crearLogicaEncargos\(\{ encargos, setEncargos, registrarAuditoria, productos, clientes,[\s\S]{0,360}empresaId: empresaDelLocalActivo\?\.id \|\| null, locales \}\)/);

console.log('PM10 P08 LA-018 Encargos: contrato OK');
