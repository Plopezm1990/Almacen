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
  uid: (() => { let n = 0; return () => `enc-${++n}`; })(),
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
assert.equal(typeof validar, 'function');
assert.equal(typeof crearLogica, 'function');

const productos = [
  { id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 20 },
  { id: 'p2', nombre: 'Producto A2', localId: 'L2', empresaId: 'E1', precioVenta: 10 },
  { id: 'pB', nombre: 'Producto B1', localId: 'LB1', empresaId: 'E2', precioVenta: 10 }
];
const clientes = [
  { id: 'c1', nombre: 'Cliente A', empresaId: 'E1' },
  { id: 'c2', nombre: 'Cliente B', empresaId: 'E2' }
];
const locales = [
  { id: 'L1', empresaId: 'E1', activo: true },
  { id: 'L2', empresaId: 'E1', activo: true },
  { id: 'LC', empresaId: 'E1', activo: false },
  { id: 'LB1', empresaId: 'E2', activo: true }
];
const base = {
  clienteId: 'c1',
  numero: 'E-001',
  fechaEntrega: '2026-09-10',
  horaEntrega: '12:30',
  señal: 5,
  señalMedioPago: 'Tarjeta',
  lineas: [{ productoId: 'p1', descripcion: 'Tarta especial', cantidad: 2, precioUnitario: 10 }]
};
const opts = { productos, clientes, locales, localActivoId: 'L1', empresaId: 'E1', fechaCreacion: '2026-09-08' };

let r = validar(base, opts);
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.total, 20);
assert.equal(r.datos.localId, 'L1');

r = validar({ ...base, empresaId: 'E2' }, opts);
assert.equal(r.ok, false);
assert.equal(r.campo, 'empresaId');
assert.equal(r.codigo, 'referencia_otro_contexto');

r = validar({ ...base, localId: 'L2' }, opts);
assert.equal(r.ok, false);
assert.equal(r.campo, 'localId');

r = validar(base, { ...opts, empresaId: null });
assert.equal(r.ok, false, 'la empresa de una escritura nueva debe ser explícita');
assert.equal(r.campo, 'empresaId');

r = validar(base, { ...opts, localActivoId: 'LC' });
assert.equal(r.ok, false, 'un local inactivo no admite un encargo nuevo');
assert.equal(r.codigo, 'local_inactivo');

r = validar({ ...base, clienteId: 'c2' }, opts);
assert.equal(r.ok, false, 'cliente de otra empresa bloqueado');
assert.equal(r.campo, 'clienteId');

function harness(iniciales = [], conf = {}) {
  let estado = structuredClone(iniciales);
  let mutaciones = 0;
  const setEncargos = (fn) => { mutaciones += 1; estado = fn(estado); };
  const localActivoId = Object.prototype.hasOwnProperty.call(conf, 'localActivoId') ? conf.localActivoId : 'L1';
  const empresaId = Object.prototype.hasOwnProperty.call(conf, 'empresaId') ? conf.empresaId : 'E1';
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
    empresaId,
    locales
  });
  return { logica, estado: () => estado, mutaciones: () => mutaciones };
}

let h = harness();
const nuevo = h.logica.addEncargo(base);
assert.ok(nuevo && nuevo.id, JSON.stringify(nuevo));
assert.equal(nuevo.estado, 'Pendiente');
assert.equal(nuevo.empresaId, 'E1');
assert.equal(nuevo.localId, 'L1');
assert.equal(nuevo.fechaCreacion, '2026-09-08');
assert.equal(nuevo.total, 20);
assert.equal(nuevo.lineas[0].precioUnitario, 10);
assert.equal(nuevo.clienteId, 'c1');
assert.equal(h.mutaciones(), 1);

// El precio actual del catálogo no reinterpreta el documento ya creado.
productos[0].precioVenta = 999;
assert.equal(h.estado()[0].lineas[0].precioUnitario, 10);
assert.equal(h.estado()[0].total, 20);

const existente = structuredClone(h.estado()[0]);
h = harness([existente]);

for (const [cambio, campo] of [
  [{ id: 'otro-id' }, 'encargoId'],
  [{ empresaId: 'E2' }, 'empresaId'],
  [{ localId: 'L2' }, 'localId'],
  [{ fechaCreacion: '2026-09-09' }, 'fechaCreacion']
]) {
  const antes = h.mutaciones();
  const res = h.logica.updateEncargo(existente.id, cambio);
  assert.equal(res.ok, false, JSON.stringify(res));
  assert.equal(res.codigo, 'campo_inmutable');
  assert.equal(res.campo, campo);
  assert.equal(h.mutaciones(), antes, `no mutar al intentar cambiar ${campo}`);
}

const resEdicion = h.logica.updateEncargo(existente.id, { notas: 'Preparar a las 12:00' });
assert.equal(resEdicion, true);
assert.equal(h.mutaciones(), 1);
const editado = h.estado()[0];
assert.equal(editado.id, existente.id);
assert.equal(editado.empresaId, 'E1');
assert.equal(editado.localId, 'L1');
assert.equal(editado.fechaCreacion, '2026-09-08');
assert.equal(editado.total, 20);

// Legado sin empresa explícita: una edición ordinaria no lo repara por el selector actual.
const legado = {
  id: 'legacy-1',
  estado: 'Pendiente',
  fechaCreacion: '2026-09-01',
  clienteId: 'c1',
  localId: 'L1',
  fechaEntrega: '2026-09-10',
  horaEntrega: '',
  señal: 0,
  señalMedioPago: 'Efectivo',
  cobros: [],
  lineas: [{ productoId: 'p1', descripcion: 'Legado', cantidad: 1, precioUnitario: 10 }]
};
h = harness([legado]);
const resLegado = h.logica.updateEncargo('legacy-1', { notas: 'mantener identidad histórica' });
assert.equal(resLegado, true, JSON.stringify(resLegado));
assert.equal(h.estado()[0].empresaId ?? null, null, 'no inferir empresa histórica solo desde el selector actual');
assert.equal(h.estado()[0].localId, 'L1');
assert.equal(h.estado()[0].id, 'legacy-1');

// "Todos" / sin local concreto sigue bloqueado para escritura.
h = harness([], { localActivoId: null, empresaId: 'E1' });
const sinLocal = h.logica.addEncargo(base);
assert.equal(sinLocal.ok, false);
assert.equal(h.mutaciones(), 0);

// Barreras estáticas mínimas de P01.
const logic = src.slice(encIni, encFin);
assert.match(logic, /const nuevo = \{ \.\.\.datos, id: uid\(\), empresaId, localId: localActivoId, estado: "Pendiente", fechaCreacion: fecha, total: validacion\.total, cobros \};/);
assert.match(logic, /campo_inmutable", "empresaId"/);
assert.match(logic, /campo_inmutable", "localId"/);
assert.match(logic, /campo_inmutable", "fechaCreacion"/);
assert.match(logic, /total: validacion\.total/);

console.log('PM14_P01_DOCUMENTO_IDENTIDAD=PASS');
