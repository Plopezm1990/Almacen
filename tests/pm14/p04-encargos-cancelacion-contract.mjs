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
  uid: (() => { let n = 0; return () => `uid-${++n}`; })(),
  sincronizarCobroSeñal: (existentes = [], señal = 0, medio = 'Efectivo', fecha = '2026-09-08') => {
    const resto = (existentes || []).filter((x) => x && x.concepto !== 'Señal');
    const n = Number(señal);
    return n > 0 ? [{ id: 'cobro-senal', concepto: 'Señal', importe: n, medioPago: medio, fecha }, ...resto] : resto;
  },
  console,
  setTimeout,
  clearTimeout
};
vm.createContext(ctx);
vm.runInContext(src.slice(commonIni, commonFin), ctx);
vm.runInContext(src.slice(encIni, encFin), ctx);
const crearLogica = ctx.crearLogicaEncargos;

const productos = [{ id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12 }];
const clientes = [{ id: 'c1', nombre: 'Cliente A', empresaId: 'E1' }];
const locales = [{ id: 'L1', empresaId: 'E1', activo: true }];

function harness(iniciales = [], { localActivoId = 'L1', empresaId = 'E1' } = {}) {
  let estado = structuredClone(iniciales);
  const auditoria = [];
  const setEncargos = (fn) => { estado = fn(estado); };
  // Cada llamada reconstruye la lógica sobre el estado actual: igual que en React,
  // el cierre de una instancia previa de crearLogicaEncargos no ve mutaciones
  // posteriores del array "encargos" (closure de un único render).
  function logicaActual() {
    return crearLogica({
      encargos: estado,
      setEncargos,
      registrarAuditoria: (accion, detalle) => auditoria.push({ accion, detalle }),
      productos,
      clientes,
      setProductos: () => {},
      setMovimientos: () => {},
      venderLote: () => ({ ok: true }),
      localActivoId,
      empresaId,
      locales
    });
  }
  return {
    cancelar: (encargoOrId, opts) => logicaActual().cancelarEncargo(encargoOrId, opts),
    eliminar: (id) => logicaActual().deleteEncargo(id),
    estado: () => estado,
    auditoria
  };
}

function encargoBase(overrides = {}) {
  return {
    id: 'enc-1', estado: 'Pendiente', clienteId: 'c1', localId: 'L1', empresaId: 'E1',
    fechaCreacion: '2026-09-01', fechaEntrega: '2026-09-08', total: 20, señal: 5, señalMedioPago: 'Tarjeta',
    cobros: [{ id: 'cobro-senal', concepto: 'Señal', importe: 5, medioPago: 'Tarjeta', fecha: '2026-09-01' }],
    lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }],
    ...overrides
  };
}

// ---- Caso feliz: cancelar un Pendiente lo marca Cancelado sin borrarlo, motivo trazable. ----
let h = harness([encargoBase()]);
let r = h.cancelar('enc-1', { motivo: 'El cliente ya no lo quiere' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.tieneCobrosPendientesDeResolver, true, 'la señal cobrada debe señalarse para resolver');
assert.equal(r.cobros.length, 1);
assert.equal(h.estado().length, 1, 'el encargo no se borra');
assert.equal(h.estado()[0].estado, 'Cancelado');
assert.equal(h.estado()[0].motivoCancelacion, 'El cliente ya no lo quiere');
assert.equal(h.estado()[0].fechaCancelacion, '2026-09-08');
assert.ok(h.auditoria.some((a) => a.accion === 'Cancelar encargo'));
console.log('P04_CANCELAR_PENDIENTE_OK=PASS');

// ---- Sin señal cobrada: no hace falta resolver nada. ----
h = harness([encargoBase({ señal: 0, cobros: [] })]);
r = h.cancelar('enc-1', { motivo: 'Duplicado por error' });
assert.equal(r.ok, true);
assert.equal(r.tieneCobrosPendientesDeResolver, false);
console.log('P04_CANCELAR_SIN_COBROS=PASS');

// ---- Motivo obligatorio: sin motivo no cambia nada. ----
h = harness([encargoBase()]);
r = h.cancelar('enc-1', { motivo: '  ' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'motivo_requerido');
assert.equal(h.estado()[0].estado, 'Pendiente');
console.log('P04_MOTIVO_OBLIGATORIO=PASS');

// ---- No se puede cancelar un encargo ya entregado. ----
h = harness([encargoBase({ estado: 'Entregado' })]);
r = h.cancelar('enc-1', { motivo: 'Intento tardío' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'estado_no_permitido');
assert.equal(h.estado()[0].estado, 'Entregado');
console.log('P04_NO_CANCELA_ENTREGADO=PASS');

// ---- Replay: cancelar dos veces el mismo encargo no falla ni repite efectos. ----
h = harness([encargoBase()]);
r = h.cancelar('enc-1', { motivo: 'Primera vez' });
assert.equal(r.ok, true);
r = h.cancelar('enc-1', { motivo: 'Segunda vez' });
assert.equal(r.ok, true);
assert.equal(r.replayed, true);
assert.equal(r.yaCancelado, true);
assert.equal(h.estado()[0].motivoCancelacion, 'Primera vez', 'un segundo intento no debe reescribir el motivo original');
console.log('P04_REPLAY_CANCELACION_IDEMPOTENTE=PASS');

// ---- Encargo inexistente / de otro local: rechazado. ----
h = harness([]);
r = h.cancelar('no-existe', { motivo: 'x' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'referencia_inexistente');

h = harness([encargoBase({ localId: 'L2' })]);
r = h.cancelar('enc-1', { motivo: 'x' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'contexto_no_autorizado');
console.log('P04_INEXISTENTE_Y_OTRO_LOCAL_RECHAZADOS=PASS');

// ---- Acepta también el objeto completo (igual que entregarEncargo). ----
h = harness([encargoBase()]);
r = h.cancelar(encargoBase(), { motivo: 'Objeto completo' });
assert.equal(r.ok, true, JSON.stringify(r));
console.log('P04_ACEPTA_OBJETO_COMPLETO=PASS');

// ---- deleteEncargo deja de borrar físicamente un encargo con cobros confirmados. ----
h = harness([encargoBase()]);
let eliminado = h.eliminar('enc-1');
assert.equal(eliminado, false, 'un encargo con señal cobrada no debe poder borrarse físicamente');
assert.equal(h.estado().length, 1);
console.log('P04_DELETE_BLOQUEADO_CON_COBROS=PASS');

// ---- deleteEncargo sigue permitiendo borrar un borrador realmente vacío (sin cobros). ----
h = harness([encargoBase({ señal: 0, cobros: [] })]);
eliminado = h.eliminar('enc-1');
assert.equal(eliminado, true, 'un encargo sin ningún cobro sigue pudiendo eliminarse como borrador');
assert.equal(h.estado().length, 0);
console.log('P04_DELETE_PERMITIDO_SIN_COBROS=PASS');

console.log('PM14 P04 Encargos — cancelación trazable, no destructiva: contrato OK');
