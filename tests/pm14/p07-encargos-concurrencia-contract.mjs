import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const commonIni = src.indexOf('function errorValidacionPM10');
const commonFin = src.indexOf('function crearLogicaProductos', commonIni);
const encIni = src.indexOf('function validarEncargoPM10(');
const encFin = src.indexOf('function crearLogicaVenta({', encIni);

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
const base = {
  id: 'enc-1', estado: 'Pendiente', clienteId: 'c1', localId: 'L1', empresaId: 'E1',
  fechaCreacion: '2026-09-01', fechaEntrega: '2026-09-08', total: 20, señal: 5,
  cobros: [], lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }]
};

function harness(iniciales) {
  let estado = structuredClone(iniciales);
  return {
    logica: crearLogica({
      encargos: estado, setEncargos: (fn) => { estado = fn(estado); }, registrarAuditoria: () => {},
      productos, clientes, setProductos: () => {}, setMovimientos: () => {}, venderLote: () => ({ ok: true }),
      localActivoId: 'L1', empresaId: 'E1', locales
    }),
    estado: () => estado
  };
}

// ---- Dos llamadas concurrentes (Promise.all real, no secuenciales) generan SIEMPRE el
// mismo operationId/id de fila: la seguridad ante la carrera no depende de que el
// servidor gane una condición de carrera del cliente, sino de que el cliente nunca
// pueda generar dos identidades distintas para la misma intención (determinismo, no
// azar). El servidor (ya probado con un lock real en p07-postgres-concurrencia-contract.mjs)
// es quien decide cuál de las dos llegó primero y cuál es un replay. ----
{
  const llamadas = [];
  let enCurso = 0;
  ctx.window = {
    __nubeActiva: true,
    getSupabaseClient: async () => ({
      rpc: async (nombre, args) => {
        llamadas.push({ nombre, args });
        if (nombre === 'registrar_encargo') return { data: { ok: true }, error: null };
        enCurso++;
        // Simula latencia de red para maximizar el solape real entre las dos llamadas.
        await new Promise((resolve) => setTimeout(resolve, 5));
        const esPrimera = enCurso === 1;
        return { data: { ok: true, replayed: !esPrimera, pago: { id: args.p_id }, pagado: 5, pendiente: 15 }, error: null };
      }
    })
  };
  const h = harness([base]);
  const [r1, r2] = await Promise.all([
    h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 5, medioPago: 'Tarjeta' }),
    h.logica.registrarAnticipoEncargo('enc-1', { concepto: 'SEÑAL', importe: 5, medioPago: 'Tarjeta' })
  ]);
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(r2.ok, true, JSON.stringify(r2));
  const idsPago = llamadas.filter((l) => l.nombre === 'registrar_pago_encargo').map((l) => l.args.p_id);
  assert.equal(idsPago.length, 2, 'ambas llamadas concurrentes llegan a intentar la RPC');
  assert.equal(idsPago[0], idsPago[1], 'la carrera real no produce dos identidades distintas: el servidor decide con un lock real cuál es el replay');
  console.log('P07_CONCURRENCIA_MISMO_ID_BAJO_PROMISE_ALL=PASS');
}

delete ctx.window;

// ---- Riesgo documentado y cuantificado (no resuelto en este punto): el documento
// completo del encargo sigue viviendo en un blob de fila unica (almacen_kv, clave
// "encargos"), guardado con una sobrescritura completa (saveKey -> window.storage.set).
// Dos pestañas/dispositivos que carguen el array antes de que el otro guarde sufren
// una perdida de actualizacion clasica: quien guarda en segundo lugar borra el cambio
// del primero sin ningun aviso. Esto es indefendible con "cambio minimo" dentro de
// PM14 porque window.storage es un primitivo externo sin compare-and-swap expuesto
// a fuente.js; se documenta aqui como reproducible y cuantificado, no se oculta.
{
  let servidor = { encargos: [base] };
  function abrirPestaña() {
    // Cada "pestaña" es una copia local independiente, como ocurre en un navegador real
    // tras loadKey("encargos", []) al arrancar la app.
    return structuredClone(servidor.encargos);
  }
  function guardar(copiaLocal) {
    // saveKey("encargos", encargos) es una sobrescritura total, no un merge.
    servidor.encargos = copiaLocal;
  }

  const pestañaA = abrirPestaña();
  const pestañaB = abrirPestaña();

  // Pestaña A añade un encargo nuevo y guarda.
  pestañaA.push({ ...base, id: 'enc-2', clienteId: 'c1' });
  guardar(pestañaA);
  assert.equal(servidor.encargos.length, 2, 'el encargo nuevo de A esta en el servidor');

  // Pestaña B, que cargó ANTES del guardado de A, cancela el encargo original y guarda
  // su propia copia (que nunca vio el alta de A) -- una operación legítima en sí misma.
  pestañaB[0] = { ...pestañaB[0], estado: 'Cancelado', motivoCancelacion: 'Cliente cambió de opinión' };
  guardar(pestañaB);

  // El encargo nuevo de A desaparece sin ningún error ni aviso: perdida de actualizacion real.
  assert.equal(servidor.encargos.length, 1, 'el alta de A se perdio silenciosamente al guardar B');
  assert.equal(servidor.encargos.some((e) => e.id === 'enc-2'), false);
  console.log('P07_RIESGO_DOCUMENTADO_PERDIDA_ACTUALIZACION_BLOB_CROSS_TAB=DOCUMENTADO_NO_RESUELTO');
}

console.log('PM14 P07 Encargos — concurrencia real probada donde importa (caja), riesgo de fondo documentado donde no se resuelve (documento en blob): contrato OK');
