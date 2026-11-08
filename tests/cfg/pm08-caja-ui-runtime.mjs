// Prueba de ejecución de C02 sobre las funciones reales del cliente.
// Verifica que los movimientos manuales usan exclusivamente las RPC ABC con
// caja, sesión, terminal, categoría, motivo y día operativo del servidor.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules (react@18.3.1, react-dom@18.3.1 y jsdom).');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { url: 'https://preview.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
const React = require('react');

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const origen = process.env.CFG_PM08CAJA_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaMovimientosCaja };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const esTexto = (r) => r.ok === false && typeof r.error === 'string' && r.error.length > 0;

const E = 'QA-EMP-A';
const L = 'QA-A1';
const T = '5e100000-0000-4000-8000-0000000000a1';
const S = '9f4b7e76-8d5a-435d-8454-746b24e4d471';
const C = 'ca100000-0000-4000-8000-0000000000a1';
const U = '5003adca-2e30-477e-8afd-ffb3037b034e';
const DIA = '2026-10-09';
const CLAVE = `almacen:pm08:movimiento-caja:${E}:${L}`;

function entorno({ nube = true, rpc = null, auditoriaFalla = false, movimientosIniciales = [] } = {}) {
  localStorage.clear();
  const llamadas = [];
  const auditoria = [];
  let movimientos = [...movimientosIniciales];
  let filasServidor = movimientosIniciales.map((m) => ({
    operation_id: m.operationId || m.id, tipo: m.tipo, empresa_id: E, local_id: L,
    fecha: m.fecha || DIA, importe: m.importe, efecto_efectivo: m.efectoEfectivo,
    medio_pago: 'EFECTIVO', concepto: m.concepto, origen_tipo: m.origen,
    origen_id: m.referenciaId || null, ref_operation_id: m.refOperationId || null,
    payload: { motivo: m.motivo || '', categoria: m.categoria || null }, actor_user_id: U,
    abc_command_id: m.abcCommandId || null, caja_id: m.cajaId || C,
    session_id: m.sessionId || S, terminal_id: m.terminalId || T,
    currency_code: 'EUR', operating_day: DIA, categoria: m.categoria || null,
    created_at: '2026-10-09T10:00:00+00:00'
  }));
  let rpcActual = rpc;

  function datosTabla(tabla) {
    if (tabla === 'terminales_tpv') return [{ id: T, nombre: 'TPV C02', device_key: 'c02-test' }];
    if (tabla === 'caja_sesion_terminales') return [{ session_id: S, terminal_id: T, desde: '2026-10-09T08:00:00Z' }];
    if (tabla === 'caja_sesiones') return [{ id: S, caja_id: C, estado: 'ABIERTA', currency_code: 'EUR', version: 1 }];
    if (tabla === 'caja_operaciones') return filasServidor;
    return [];
  }

  function consulta(tabla) {
    const q = {
      select() { return q; }, eq() { return q; }, is() { return q; }, order() { return q; }, limit() { return q; },
      maybeSingle() { return Promise.resolve({ data: datosTabla(tabla)[0] || null, error: null }); },
      single() { return Promise.resolve({ data: datosTabla(tabla)[0] || null, error: null }); },
      then(resolveThen, rejectThen) { return Promise.resolve({ data: datosTabla(tabla), error: null }).then(resolveThen, rejectThen); }
    };
    return q;
  }

  if (nube) {
    dom.window.NUBE_URL = 'https://qa.invalid';
    dom.window.__nubeActiva = true;
    dom.window.ESPERA_NUBE_MS = 200;
    dom.window.__nubeCliente = {
      auth: { async getSession() { return { data: { session: { user: { id: U } } }, error: null }; } },
      from: consulta,
      async rpc(nombre, params) {
        llamadas.push({ nombre, params });
        if (rpcActual) return rpcActual(nombre, params);
        if (nombre === 'abc_obtener_dia_operativo_local') return { data: { operating_day: DIA }, error: null };
        if (nombre === 'abc_registrar_movimiento_caja') {
          const tipo = ['REPOSICION_CAJA', 'INGRESO_MANUAL'].includes(params.p_categoria) ? 'ENTRADA' : 'RETIRADA';
          const operationId = `abc.cash.manual.${params.p_operation_id}`;
          filasServidor = [{
            operation_id: operationId, tipo, empresa_id: E, local_id: L, fecha: DIA,
            importe: params.p_importe, efecto_efectivo: tipo === 'ENTRADA' ? params.p_importe : -params.p_importe,
            medio_pago: 'EFECTIVO', concepto: params.p_concepto, origen_tipo: 'ABC_CAJA_MANUAL', origen_id: S,
            ref_operation_id: null, payload: { motivo: params.p_motivo, categoria: params.p_categoria }, actor_user_id: U,
            abc_command_id: params.p_operation_id, caja_id: C, session_id: S, terminal_id: T, currency_code: 'EUR',
            operating_day: DIA, categoria: params.p_categoria, created_at: '2026-10-09T10:00:00+00:00'
          }, ...filasServidor.filter((f) => f.operation_id !== operationId)];
          return { data: { ok: true, caja_operation_id: operationId, tipo, categoria: params.p_categoria, importe: params.p_importe, efecto_efectivo: tipo === 'ENTRADA' ? params.p_importe : -params.p_importe, currency_code: 'EUR', session_id: S }, error: null };
        }
        if (nombre === 'abc_revertir_movimiento_caja') {
          const original = filasServidor.find((f) => f.operation_id === params.p_movimiento_operation_id);
          const tipo = original?.tipo === 'ENTRADA' ? 'REVERSO_ENTRADA' : 'REVERSO_RETIRADA';
          const operationId = `abc.cash.manual.reverse.${params.p_operation_id}`;
          filasServidor = [{ ...original, operation_id: operationId, tipo, efecto_efectivo: -(original?.efecto_efectivo || 0), concepto: `Correccion: ${params.p_motivo}`, origen_tipo: 'ABC_CAJA_REVERSO_MANUAL', origen_id: original?.operation_id, ref_operation_id: original?.operation_id, payload: { motivo: params.p_motivo }, abc_command_id: params.p_operation_id, terminal_id: T, operating_day: DIA, categoria: 'CORRECCION_CAJA' }, ...filasServidor];
          return { data: { ok: true, caja_operation_id: operationId, movimiento_original_operation_id: original?.operation_id, tipo, importe: original?.importe, efecto_efectivo: -(original?.efecto_efectivo || 0), session_id: S }, error: null };
        }
        return { data: {}, error: null };
      }
    };
  } else {
    delete dom.window.NUBE_URL;
    delete dom.window.__nubeCliente;
    dom.window.__nubeActiva = false;
  }

  const logica = mod.crearLogicaMovimientosCaja({
    movimientosCaja: movimientosIniciales,
    setMovimientosCaja: (f) => { movimientos = typeof f === 'function' ? f(movimientos) : f; },
    arqueos: [], setArqueos() {},
    registrarAuditoria: (accion, detalle) => { if (auditoriaFalla) throw new Error('auditoria_rota'); auditoria.push({ accion, detalle }); },
    localActivoId: L, empresaId: E
  });
  return { logica, llamadas, auditoria, movimientos: () => movimientos, setRpc: (f) => { rpcActual = f; } };
}

try {
  {
    const env = entorno();
    const r = await env.logica.registrarMovimientoCaja('ENTRADA', 12.5, 'Cambio inicial', DIA, { categoria: 'REPOSICION_CAJA', motivo: 'Preparar el servicio' });
    const alta = env.llamadas.find((x) => x.nombre === 'abc_registrar_movimiento_caja');
    ok('A1 la entrada ABC se confirma y limpia el borrador', r.ok === true && !r.pendiente && localStorage.getItem(CLAVE) === null, r);
    ok('A2 envía caja, sesión, terminal, categoría, motivo y día del servidor', !!alta && alta.params.p_empresa_id === E && alta.params.p_local_id === L && alta.params.p_caja_id === C && alta.params.p_session_id === S && alta.params.p_terminal_id === T && alta.params.p_currency_code === 'EUR' && alta.params.p_categoria === 'REPOSICION_CAJA' && alta.params.p_motivo === 'Preparar el servicio' && alta.params.p_operating_day === DIA, alta);
    ok('A3 no usa la RPC heredada', !env.llamadas.some((x) => x.nombre === 'registrar_movimiento_caja'), env.llamadas);
    ok('A4 sincroniza una fila ligada a sesión y categoría', env.movimientos().length === 1 && env.movimientos()[0].sessionId === S && env.movimientos()[0].categoria === 'REPOSICION_CAJA' && env.movimientos()[0].motivo === 'Preparar el servicio', env.movimientos());
    ok('A5 audita la categoría y el importe confirmado', env.auditoria.length === 1 && env.auditoria[0].detalle === 'REPOSICION_CAJA de €12,50 \xB7 Cambio inicial', env.auditoria);
  }
  {
    const env = entorno();
    const r = await env.logica.registrarMovimientoCaja('SALIDA', 0.05, 'Ticket 184', DIA, { categoria: 'GASTO_CAJA', motivo: 'Compra urgente de hielo' });
    const alta = env.llamadas.find((x) => x.nombre === 'abc_registrar_movimiento_caja');
    ok('B1 salida se convierte en RETIRADA mediante GASTO_CAJA', r.ok === true && alta?.params.p_categoria === 'GASTO_CAJA' && env.movimientos()[0].tipo === 'RETIRADA' && env.movimientos()[0].efectoEfectivo === -0.05, { r, alta, movimientos: env.movimientos() });
  }
  {
    const env = entorno();
    const r = await env.logica.registrarMovimientoCaja('ENTRADA', 2.135, 'Redondeo', DIA, { categoria: 'INGRESO_MANUAL', motivo: 'Prueba de céntimos' });
    const alta = env.llamadas.find((x) => x.nombre === 'abc_registrar_movimiento_caja');
    ok('B2 redondea a dos decimales antes de llamar al servidor', r.ok === true && alta?.params.p_importe === 2.13, alta);
  }
  {
    let intentos = 0;
    const env = entorno({ rpc: async (nombre, params) => {
      if (nombre === 'abc_obtener_dia_operativo_local') return { data: { operating_day: DIA }, error: null };
      if (nombre !== 'abc_registrar_movimiento_caja') return { data: {}, error: null };
      intentos += 1;
      if (intentos === 1) return { data: null, error: { message: 'timeout_pm08' } };
      return { data: { ok: true, caja_operation_id: 'abc.cash.manual.replay', tipo: 'ENTRADA', importe: params.p_importe, efecto_efectivo: params.p_importe, session_id: S }, error: null };
    } });
    let r = await env.logica.registrarMovimientoCaja('ENTRADA', 20, 'Reintento', DIA, { categoria: 'INGRESO_MANUAL', motivo: 'Mismo borrador' });
    ok('C1 timeout conserva el borrador', r.ok === false && r.pendiente === true && localStorage.getItem(CLAVE) !== null, r);
    r = await env.logica.registrarMovimientoCaja('ENTRADA', 20, 'Reintento', DIA, { categoria: 'INGRESO_MANUAL', motivo: 'Mismo borrador' });
    ok('C2 reintento conserva el identificador y no duplica auditoría', r.ok === true && r.replayed === true && env.auditoria.length === 0 && localStorage.getItem(CLAVE) === null, { r, llamadas: env.llamadas });
  }
  {
    const env = entorno({ rpc: async (nombre) => nombre === 'abc_obtener_dia_operativo_local' ? { data: { operating_day: DIA }, error: null } : { data: null, error: { message: 'abc_movimiento_caja_no_autorizado' } } });
    const r = await env.logica.registrarMovimientoCaja('ENTRADA', 5, 'x', DIA, { categoria: 'INGRESO_MANUAL', motivo: 'Sin permiso' });
    ok('D1 rechazo permanente se traduce y limpia el borrador', esTexto(r) && /permiso/.test(r.error) && localStorage.getItem(CLAVE) === null, r);
  }
  {
    const env = entorno({ nube: false });
    const r = await env.logica.registrarMovimientoCaja('RETIRADA', 7, 'Pago proveedor', DIA, { categoria: 'GASTO_CAJA', motivo: 'Factura urgente' });
    ok('E1 modo local conserva el comportamiento sin excepción', r.ok === true && r.local === true && env.movimientos()[0].efectoEfectivo === -7 && env.movimientos()[0].categoria === 'GASTO_CAJA', { r, movimientos: env.movimientos() });
  }
  {
    const env = entorno();
    ok('F1 exige concepto, motivo y categoría coherente antes de llamar al servidor', esTexto(await env.logica.registrarMovimientoCaja('ENTRADA', 5, '', DIA, { categoria: 'REPOSICION_CAJA', motivo: 'x' })) && esTexto(await env.logica.registrarMovimientoCaja('ENTRADA', 5, 'x', DIA, { categoria: 'REPOSICION_CAJA', motivo: '' })) && esTexto(await env.logica.registrarMovimientoCaja('ENTRADA', 5, 'x', DIA, { categoria: 'GASTO_CAJA', motivo: 'x' })) && !env.llamadas.some((x) => x.nombre === 'abc_registrar_movimiento_caja'), env.llamadas);
  }
  {
    const original = { id: 'abc.cash.manual.original', operationId: 'abc.cash.manual.original', tipo: 'ENTRADA', importe: 9, efectoEfectivo: 9, concepto: 'Cambio', motivo: 'Servicio', origen: 'ABC_CAJA_MANUAL', categoria: 'REPOSICION_CAJA', abcCommandId: 'c02.original', cajaId: C, sessionId: S, terminalId: T, currencyCode: 'EUR', fecha: DIA, localId: L, _pm08Servidor: true };
    const env = entorno({ movimientosIniciales: [original] });
    const r = await env.logica.eliminarMovimientoCaja(original.operationId, 'Importe erróneo');
    const reverso = env.llamadas.find((x) => x.nombre === 'abc_revertir_movimiento_caja');
    ok('G1 reverso usa la RPC ABC con terminal, motivo y día del servidor', r.ok === true && !!reverso && reverso.params.p_empresa_id === E && reverso.params.p_local_id === L && reverso.params.p_terminal_id === T && reverso.params.p_motivo === 'Importe erróneo' && reverso.params.p_operating_day === DIA, { r, reverso });
    ok('G2 no usa el reversor heredado y conserva original más reverso', !env.llamadas.some((x) => x.nombre === 'revertir_movimiento_caja') && env.movimientos().some((m) => m.refOperationId === original.operationId), env.movimientos());
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 2000) });
}

const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 12000));
if (fallos.length) process.exit(1);
console.log('pm08-caja-ui-runtime: OK');
