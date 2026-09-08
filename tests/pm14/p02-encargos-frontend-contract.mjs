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
assert.equal(typeof crearLogica, 'function');

const productos = [{ id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12 }];
const clientes = [{ id: 'c1', nombre: 'Cliente A', empresaId: 'E1' }];
const locales = [{ id: 'L1', empresaId: 'E1', activo: true }];

function harness(iniciales = [], { localActivoId = 'L1', empresaId = 'E1' } = {}) {
  let estado = structuredClone(iniciales);
  const setEncargos = (fn) => { estado = fn(estado); };
  return {
    logica: crearLogica({
      encargos: estado,
      setEncargos,
      registrarAuditoria: () => {},
      productos,
      clientes,
      setProductos: () => {},
      setMovimientos: () => {},
      venderLote: () => ({ ok: true }),
      localActivoId,
      empresaId,
      locales
    }),
    estado: () => estado
  };
}

const base = {
  id: 'enc-1', estado: 'Pendiente', clienteId: 'c1', localId: 'L1', empresaId: 'E1',
  fechaCreacion: '2026-09-01', fechaEntrega: '2026-09-08', total: 20, señal: 5,
  cobros: [], lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }]
};

// ---- Sin conexión (window ausente): registrarAnticipoEncargo se niega sin tocar nada. ----
delete ctx.window;
let h = harness([base]);
let r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 5, medioPago: 'Tarjeta' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'sin_conexion');

// addEncargo sigue siendo síncrono y no revienta aunque no haya "window" (offline real).
r = h.logica.addEncargo({ ...base, id: undefined, señal: 0, lineas: base.lineas });
assert.ok(r.id, JSON.stringify(r));
console.log('P02_FRONT_SIN_CONEXION=PASS');

// ---- Camino feliz: SEÑAL con RPC real (simulada), id/operationId deterministas. ----
const llamadas = [];
ctx.window = {
  __nubeActiva: true,
  getSupabaseClient: async () => ({
    rpc: async (nombre, args) => {
      llamadas.push({ nombre, args });
      if (nombre === 'registrar_encargo') return { data: { ok: true, encargo: {} }, error: null };
      if (nombre === 'registrar_pago_encargo') {
        return { data: { ok: true, replayed: false, pago: { id: args.p_id }, pagado: args.p_importe, pendiente: 20 - args.p_importe }, error: null };
      }
      throw new Error('rpc inesperada: ' + nombre);
    }
  })
};
h = harness([base]);
r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 5, medioPago: 'Tarjeta' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.pendiente, 15);
const pagoLlamada = llamadas.find((l) => l.nombre === 'registrar_pago_encargo');
assert.equal(pagoLlamada.args.p_id, 'pago-encargo:enc-1:senal');
assert.equal(pagoLlamada.args.p_operation_id, 'anticipo-encargo:enc-1:senal');
assert.equal(pagoLlamada.args.p_empresa_id, 'E1');
assert.equal(pagoLlamada.args.p_local_id, 'L1');
assert.equal(pagoLlamada.args.p_concepto, 'SEÑAL');
console.log('P02_FRONT_SEÑAL_OK=PASS');

// El mismo id/operationId se reutiliza en una segunda llamada equivalente (replay real
// lo decide el backend, pero el cliente no debe generar un id distinto cada vez).
llamadas.length = 0;
r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 5, medioPago: 'Tarjeta' });
assert.equal(llamadas.find((l) => l.nombre === 'registrar_pago_encargo').args.p_id, 'pago-encargo:enc-1:senal');
console.log('P02_FRONT_ID_DETERMINISTA_REPETIDO=PASS');

// ---- RESTO_ENTREGA usa su propio id determinista, distinto del de la señal. ----
llamadas.length = 0;
r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'RESTO_ENTREGA', importe: 15, medioPago: 'Efectivo' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(llamadas.find((l) => l.nombre === 'registrar_pago_encargo').args.p_id, 'pago-encargo:enc-1:resto');
console.log('P02_FRONT_RESTO_ID_DISTINTO=PASS');

// ---- addEncargo dispara en segundo plano registrar_encargo sin bloquear el alta local. ----
llamadas.length = 0;
h = harness([]);
const antes = Date.now();
const nuevo = h.logica.addEncargo({ ...base, id: undefined, señal: 0 });
assert.ok(Date.now() - antes < 50, 'addEncargo no debe esperar a la RPC');
assert.ok(nuevo.id);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.ok(llamadas.some((l) => l.nombre === 'registrar_encargo' && l.args.p_id === nuevo.id));
console.log('P02_FRONT_SYNC_ENCARGO_EN_SEGUNDO_PLANO=PASS');

// ---- Errores del backend se traducen a mensajes legibles y no rompen la promesa. ----
ctx.window = {
  __nubeActiva: true,
  getSupabaseClient: async () => ({
    rpc: async (nombre) => {
      if (nombre === 'registrar_encargo') return { data: { ok: true }, error: null };
      return { data: null, error: { message: 'pago_supera_saldo' } };
    }
  })
};
h = harness([base]);
r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 999 });
assert.equal(r.ok, false);
assert.match(r.error, /supera el saldo/);
console.log('P02_FRONT_ERROR_SOBRECOBRO_LEGIBLE=PASS');

// ---- Encargo de otro local: rechazado antes de intentar la RPC. ----
ctx.window = {
  __nubeActiva: true,
  getSupabaseClient: async () => ({ rpc: async () => { throw new Error('no debería llamarse'); } })
};
h = harness([{ ...base, localId: 'L2' }]);
r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 1 });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'contexto_no_autorizado');
console.log('P02_FRONT_OTRO_LOCAL_RECHAZADO=PASS');

// ---- Concepto inválido rechazado localmente. ----
ctx.window = { __nubeActiva: true, getSupabaseClient: async () => ({ rpc: async () => { throw new Error('no debería llamarse'); } }) };
h = harness([base]);
r = await h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'OTRO', importe: 1 });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'concepto_invalido');
console.log('P02_FRONT_CONCEPTO_INVALIDO=PASS');

// ---- revertirAnticipoEncargo: motivo obligatorio, éxito, error mapeado. ----
ctx.window = { __nubeActiva: true, getSupabaseClient: async () => ({ rpc: async () => { throw new Error('no debería llamarse'); } }) };
h = harness([base]);
r = await h.logica.revertirAnticipoEncargo('pago-encargo:enc-1:senal', '');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'motivo_requerido');

let reversoArgs;
ctx.window = {
  __nubeActiva: true,
  getSupabaseClient: async () => ({
    rpc: async (nombre, args) => {
      reversoArgs = args;
      return { data: { ok: true, replayed: false, pago: { id: reversoArgs.p_id } }, error: null };
    }
  })
};
h = harness([base]);
r = await h.logica.revertirAnticipoEncargo('pago-encargo:enc-1:senal', 'Cliente canceló');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(reversoArgs.p_id, 'reverso-encargo:pago-encargo:enc-1:senal');
assert.equal(reversoArgs.p_operation_id, 'reverso-encargo:pago-encargo:enc-1:senal');
console.log('P02_FRONT_REVERSO_OK_Y_MOTIVO_OBLIGATORIO=PASS');

ctx.window = {
  __nubeActiva: true,
  getSupabaseClient: async () => ({ rpc: async () => ({ data: null, error: { message: 'pago_ya_revertido' } }) })
};
h = harness([base]);
r = await h.logica.revertirAnticipoEncargo('pago-encargo:enc-1:senal', 'Reintento');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'pago_ya_revertido');
console.log('P02_FRONT_REVERSO_DUPLICADO_MAPEADO=PASS');

delete ctx.window;
console.log('PM14 P02 Encargos — enganche frontend (RPC anticipo/saldo): contrato OK');
