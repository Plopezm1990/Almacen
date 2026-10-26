// Prueba de ejecución del historial de descuentos del TPV (listarAuditoriaDescuentosA09), tras el arreglo del 3/10/2026.
//
// Fallo que corrige: el historial leía la tabla abc_eventos directamente desde el navegador, pero el navegador NO puede leerla (migración
// 20260924004000, ACL parity); salía «permission denied for table abc_eventos» y el historial no cargaba. Ahora los eventos de descuento de la
// cuenta los da la función del servidor abc_listar_eventos_descuento_cuenta (migración 20261003120000).
//
// Carga las funciones REALES de la aplicación (source-recovery/fuente-recuperado.js): listarAuditoriaDescuentosA09 y las que traducen los errores
// (esConflictoVersionA06, respuestaErrorA06, errorRpcA02), tal cual están escritas, y las ejecuta contra un servidor falso que REPRODUCE los
// permisos de QA (las tablas sin lectura para el navegador devuelven «permission denied for table X» y se anota quién las consulta).
// No necesita librerías externas.
//   node tests/cfg/a09-eventos-ui-runtime.mjs
// CFG_A09EV_FUENTE (opcional) permite probar otro archivo (la versión anterior, que debe fallar, o variantes rotas de mutantes).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SIN_ACCESO_QA } from './lib/tablas-sin-acceso-qa.mjs';

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.CFG_A09EV_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');
const fuente = readFileSync(origen, 'utf8');

// ---------- carga de las funciones reales ----------
function trozo(inicio, fin) {
  const i = fuente.indexOf(inicio);
  if (i < 0 || fuente.indexOf(inicio, i + 1) >= 0) throw new Error('inicio no único o ausente: ' + inicio);
  const j = fuente.indexOf(fin, i + inicio.length);
  if (j < 0) throw new Error('fin no encontrado: ' + fin);
  return fuente.slice(i, j);
}
// errores: desde esConflictoVersionA06 hasta el final de errorRpcA02
const iErr = fuente.indexOf('  function esConflictoVersionA06(error) {');
const iErrFin = fuente.indexOf('\n  }\n', fuente.indexOf('  function errorRpcA02(error) {')) + 4;
const bloqueErrores = fuente.slice(iErr, iErrFin);
const bloqueAuditoria = trozo('  async function listarDescuentosAplicadosA09() {', '  function agruparDescuentosAplicadosA09(rows) {');
const fabrica = new Function('local', 'configEmpresa', 'leerContextoCuentaA02', 'window',
  `${bloqueErrores}\n${bloqueAuditoria}\nreturn { listarDescuentosAplicadosA09, listarAuditoriaDescuentosA09, listarEfectosCajaA09, listarEfectosStockA09, listarFiscalizacionA09, errorRpcA02 };`);

// ---------- servidor falso con los permisos de QA ----------
const SIN_ACCESO = new Set(SIN_ACCESO_QA);
function consulta(filas, error = null) {
  const q = {
    select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
    then(res, rej) { return Promise.resolve(error ? { data: null, error } : { data: filas, error: null }).then(res, rej); }
  };
  return q;
}
const E = 'QA-EMP-A';
const L = 'QA-A1';
const CUENTA = 'aa53c595-293d-4b5c-8df8-eaf8a3b0fd6a';
const EVENTO = (extra = {}) => ({ operation_id: 'f3.a09.disc.1', event_type: 'CUENTA_DESCUENTO_APLICADO', payload: { tipo: 'PERCENT', valor: 10, importe: 0.5, motivo: 'prueba' }, actor_user_id: '16c79749-a206-47d9-8d56-fbc7a4a49eb7', occurred_at: '2026-10-03T10:00:00+00:00', operating_day: '2026-10-03', ...extra });
function entorno(op = {}) {
  const e = {
    solicitudes: [{ operation_id: 'f3.a09.disc.1', cuenta_id: CUENTA, estado: 'APLICADA' }, { operation_id: 'f3.a09.disc.2', cuenta_id: CUENTA, estado: 'PENDIENTE' }],
    intentos: [{ operation_id: 'f3.a09.disc.1', attempt_id: 'a1', decision: 'APROBADA' }, { operation_id: 'otra.operacion.99', attempt_id: 'a2', decision: 'RECHAZADA' }],
    eventosRpc: [EVENTO()], errorEventos: null, errorSolicitudes: null, ...op
  };
  const prohibidas = [];
  const rpc = [];
  const supabase = {
    from(nombre) {
      if (SIN_ACCESO.has(nombre)) { prohibidas.push(nombre); return consulta([], { message: `permission denied for table ${nombre}` }); }
      if (nombre === 'abc_descuento_autorizaciones') return consulta(e.solicitudes, e.errorSolicitudes);
      if (nombre === 'abc_descuento_aprobacion_intentos') return consulta(e.intentos);
      throw new Error('tabla no simulada: ' + nombre);
    },
    async rpc(nombre, params) {
      rpc.push({ nombre, params });
      if (nombre === 'abc_listar_eventos_descuento_cuenta') return e.errorEventos ? { data: null, error: { message: e.errorEventos } } : { data: e.eventosRpc, error: null };
      return { data: null, error: { message: 'funcion_no_simulada:' + nombre } };
    }
  };
  const ventana = { __nubeActiva: true, getSupabaseClient: async () => supabase };
  const f = fabrica({ id: L }, { id: E }, () => (op.sinContexto ? null : { cuentaId: CUENTA }), op.sinConexion ? { __nubeActiva: false } : ventana);
  return { ...f, prohibidas, rpc };
}

const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
try {
  {
    const env = entorno();
    const r = await env.listarAuditoriaDescuentosA09();
    ok('A1 el historial carga (antes: «permission denied for table abc_eventos»)', r.ok === true, r);
    ok('A2 trae las solicitudes de la cuenta, tal cual', r.solicitudes?.length === 2 && r.solicitudes[0].operation_id === 'f3.a09.disc.1', r);
    ok('A3 trae solo los intentos de aprobación de esas solicitudes', r.intentos?.length === 1 && r.intentos[0].attempt_id === 'a1', r);
    ok('A4 trae los eventos de descuento que da el servidor, con sus seis columnas', r.eventos?.length === 1 && r.eventos[0].event_type === 'CUENTA_DESCUENTO_APLICADO'
      && ['operation_id', 'event_type', 'payload', 'actor_user_id', 'occurred_at', 'operating_day'].every((k) => k in r.eventos[0]) && r.eventos[0].payload.motivo === 'prueba', r);
    const llamadas = env.rpc.filter((c) => c.nombre === 'abc_listar_eventos_descuento_cuenta');
    ok('A5 los eventos se piden a la función del servidor, una vez y con los parámetros exactos', llamadas.length === 1
      && Object.keys(llamadas[0].params).join() === 'p_empresa_id,p_local_id,p_cuenta_id' && llamadas[0].params.p_empresa_id === E && llamadas[0].params.p_local_id === L && llamadas[0].params.p_cuenta_id === CUENTA, env.rpc);
    ok('A6 el navegador no consulta ninguna tabla sin permiso (en concreto, nunca abc_eventos)', env.prohibidas.length === 0 && !env.prohibidas.includes('abc_eventos'), env.prohibidas);
  }
  {
    const env = entorno({ eventosRpc: [EVENTO({ operation_id: 'f3.a09.disc.3', occurred_at: '2026-10-03T12:00:00+00:00' }), EVENTO()] });
    const r = await env.listarAuditoriaDescuentosA09();
    ok('B1 varios eventos llegan todos y en el orden que da el servidor', r.ok === true && r.eventos?.map((x) => x.operation_id).join() === 'f3.a09.disc.3,f3.a09.disc.1', r);
  }
  {
    let env = entorno({ eventosRpc: [] });
    let r = await env.listarAuditoriaDescuentosA09();
    ok('C1 sin descuentos aplicados: el historial carga con la lista de eventos vacía', r.ok === true && Array.isArray(r.eventos) && r.eventos.length === 0 && r.solicitudes.length === 2, r);
    env = entorno({ eventosRpc: null });
    r = await env.listarAuditoriaDescuentosA09();
    ok('C2 si el servidor no manda lista (nulo), se trata como vacía y no se rompe', r.ok === true && Array.isArray(r.eventos) && r.eventos.length === 0, r);
    env = entorno({ eventosRpc: { no: 'una lista' } });
    r = await env.listarAuditoriaDescuentosA09();
    ok('C3 si el servidor manda algo que no es una lista, se ignora', r.ok === true && Array.isArray(r.eventos) && r.eventos.length === 0, r);
  }
  {
    // errores del servidor, en español
    let env = entorno({ errorEventos: 'descuento_eventos_no_autorizado' });
    let r = await env.listarAuditoriaDescuentosA09();
    ok('D1 sin permiso para ver el historial: error en español y sin el código del servidor', r.ok === false && r.error === 'Tu perfil no tiene permiso para ver el historial de descuentos de esta cuenta.' && typeof r.error === 'string', r);
    env = entorno({ errorEventos: 'descuento_eventos_parametros_invalidos' });
    r = await env.listarAuditoriaDescuentosA09();
    ok('D2 cuenta no identificada: error en español', r.ok === false && r.error === 'No se pudo identificar la cuenta para mostrar su historial de descuentos.', r);
    env = entorno({ errorEventos: 'fallo_de_red_inesperado' });
    r = await env.listarAuditoriaDescuentosA09();
    ok('D3 un error cualquiera del servidor devuelve ok:false (no un historial a medias)', r.ok === false && typeof r.error === 'string' && r.error.length > 0 && r.solicitudes === undefined, r);
    env = entorno({ errorSolicitudes: { message: 'abc_error_solicitudes' } });
    r = await env.listarAuditoriaDescuentosA09();
    ok('D4 si falla la lectura de las solicitudes, también devuelve ok:false', r.ok === false, r);
    ok('D5 el error siempre es un TEXTO (la pantalla lo dibuja tal cual: si fuera un objeto, React se rompería al pintarlo)', r.ok === false && typeof r.error === 'string', r);
  }
  {
    // los cinco cargadores del panel de descuentos devuelven el error como texto cuando falla la conexión con el servidor
    const rota = { __nubeActiva: true, getSupabaseClient: async () => { throw new Error('fallo_de_red_inesperado'); } };
    const f = fabrica({ id: L }, { id: E }, () => ({ cuentaId: CUENTA }), rota);
    for (const nombre of ['listarDescuentosAplicadosA09', 'listarAuditoriaDescuentosA09', 'listarEfectosCajaA09', 'listarEfectosStockA09', 'listarFiscalizacionA09']) {
      const r = await f[nombre]();
      ok(`F1 ${nombre}: si falla la conexión, devuelve ok:false con el error como texto (no como objeto)`, r.ok === false && typeof r.error === 'string' && r.error.length > 0, r);
    }
  }
  {
    // casos de uso del propio cargador
    let env = entorno({ sinContexto: true });
    let r = await env.listarAuditoriaDescuentosA09();
    ok('E1 sin cuenta guardada en el navegador, no consulta nada y devuelve un error', r.ok === false && env.rpc.length === 0 && env.prohibidas.length === 0, r);
    env = entorno({ sinConexion: true });
    r = await env.listarAuditoriaDescuentosA09();
    ok('E2 sin conexión con el servidor, lo dice y no consulta nada', r.ok === false && /conexión/.test(r.error) && env.rpc.length === 0, r);
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1500) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('a09-eventos-ui-runtime: OK');
