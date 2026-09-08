import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const commonIni = src.indexOf('function errorValidacionPM10');
const commonFin = src.indexOf('function crearLogicaProductos', commonIni);
const encIni = src.indexOf('function validarEncargoPM10(');
const encFin = src.indexOf('function crearLogicaVenta({', encIni);
assert.ok(commonIni >= 0 && commonFin > commonIni, 'helpers PM10 presentes');
assert.ok(encIni >= 0 && encFin > encIni, 'bloque Encargos presente');

const ctx = {
  todayISO: () => '2026-09-08',
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  sincronizarCobroSeñal: (existentes = [], señal = 0, medio = 'Efectivo', fecha = '2026-09-08') => {
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

const productos = [
  { id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12 }
];
const clientes = [{ id: 'c1', nombre: 'Cliente A', empresaId: 'E1' }];
const base = {
  clienteId: 'c1',
  fechaEntrega: '2026-09-08',
  localId: 'L1',
  señal: 5,
  señalMedioPago: 'Tarjeta',
  lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }]
};

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

// Caso positivo: el alta persiste empresaId y total como campos propios y estables,
// no como algo que haya que recalcular en cada pantalla.
let h = harness();
let res = h.logica.addEncargo(base);
assert.ok(res.id, JSON.stringify(res));
assert.equal(h.estado()[0].empresaId, 'E1', 'empresaId debe quedar grabado en el propio encargo');
assert.equal(h.estado()[0].total, 20, 'total debe quedar grabado en el propio encargo (2 x 10)');

// Caso negativo: sin empresa resuelta en el contexto (local sin empresaId asociado,
// o empresa activa no determinada) no se crea el encargo. La identidad de empresa
// pasa a ser obligatoria igual que ya lo era el local activo.
h = harness([], { localActivoId: 'L1', empresaId: null });
res = h.logica.addEncargo(base);
assert.equal(res.ok, false, 'sin empresaId en contexto no debe poder crear el encargo');
assert.equal(res.campo, 'empresaId');
assert.equal(h.mutaciones(), 0);

// Edición: total y empresaId se recalculan de forma consistente al cambiar líneas,
// no quedan congelados con el valor de alta si las líneas cambian.
const existente = { id: 'enc-1', estado: 'Pendiente', fechaCreacion: '2026-09-08', cobros: [], ...base, señal: 0, empresaId: 'E1', total: 20 };
h = harness([existente]);
res = h.logica.updateEncargo('enc-1', { lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 3, precioUnitario: 10 }] });
assert.equal(res, true, JSON.stringify(res));
assert.equal(h.estado()[0].total, 30, 'el total debe recalcularse tras editar las líneas');
assert.equal(h.estado()[0].empresaId, 'E1');

// Legado sin empresaId/total: no se reescribe solo por leerlo, pero una edición
// ordinaria lo deja con identidad completa (ver PM10 p08: "un legado incoherente
// no se reescribe al cargar; una edición ordinaria exige corregir el conjunto").
const legado = {
  id: 'legacy', estado: 'Pendiente', fechaCreacion: '2026-09-01', clienteId: 'c1',
  fechaEntrega: '2026-09-08', localId: 'L1', señal: 0, señalMedioPago: 'Efectivo', cobros: [],
  lineas: [{ productoId: 'p1', descripcion: 'legado', cantidad: 1, precioUnitario: 10 }]
  // sin empresaId ni total: registro anterior a este cambio.
};
h = harness([legado]);
assert.equal(h.estado()[0].empresaId, undefined, 'un legado no se reescribe solo por estar en memoria');
res = h.logica.updateEncargo('legacy', { notas: 'confirmar datos' });
assert.equal(res, true, JSON.stringify(res));
assert.equal(h.estado()[0].empresaId, 'E1', 'una edición ordinaria completa la identidad del legado');
assert.equal(h.estado()[0].total, 10);

console.log('PM14 P01 Encargos — identidad estable (empresaId/total): contrato OK');
