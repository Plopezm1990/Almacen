// Prueba de ejecución de la pantalla «Reembolso económico» con la aprobación de D13 (nada sale sin aprobar).
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom) y un
// servidor falso en memoria (tests/cfg/lib/servidor-reembolsos-falso.mjs) que imita las reglas de la migración 20261003100000:
//   Parte A · Cajero/a con permiso de solicitar y sin permiso de aprobar: su solicitud queda «Pendiente de aprobación», sin botones.
//   Parte B · Cajero/a sin permiso de solicitar: aviso y botón desactivado.
//   Parte C · Encargado: aprueba, rechaza, confirma el efectivo; sus propias solicitudes se aprueban en el acto; errores en español.
//   Parte D · Propietario, permisos desconocidos y compatibilidad (sin rol, lectura de capacidades que falla).
//   Parte E · La pestaña «Devoluciones» pasa el rol a la pantalla.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom. Por ejemplo:
//   mkdir /tmp/cfg6deps && cd /tmp/cfg6deps && npm init -y && npm i react@18.3.1 react-dom@18.3.1 jsdom
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/d13-ui-runtime.mjs
// CFG_D13_FUENTE (opcional) permite probar otro archivo (por ejemplo una variante rota en las comprobaciones de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crearServidorReembolsosFalso } from './lib/servidor-reembolsos-falso.mjs';

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
// React se carga DESPUÉS de crear el navegador simulado (si no, no detecta los eventos de escritura).
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.CFG_D13_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { ReembolsosEconomicosB08, Devoluciones };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const esperar = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const texto = () => document.getElementById('raiz').textContent;
const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
const botonesTexto = () => [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
async function clic(el) {
  if (!el) throw new Error('clic sobre un elemento que no existe; texto actual: ' + texto().slice(-700));
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await esperar(40);
}
async function escribir(el, valor) {
  if (!el) throw new Error('escribir sobre un campo que no existe; texto actual: ' + texto().slice(-500));
  const proto = el.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}
function campo(etiqueta) {
  const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(etiqueta));
  return lab ? lab.querySelector('input,select') : null;
}
const OPERACION = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let raiz = null;
const UCAJ = 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
const UENC = '5003adca-2e30-477e-8afd-ffb3037b034e';
const UPROP = '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
const USUARIOS = { cajero: { id: UCAJ, rol: 'Cajero/a' }, encargado: { id: UENC, rol: 'Encargado' }, propietario: { id: UPROP, rol: 'Propietario' } };
const CAPS_CAJERO_SOLICITA = {
  ABC_REEMBOLSO_SOLICITAR: { Propietario: true, Encargado: true, 'Cajero/a': true, 'Camarero/a': false },
  ABC_REEMBOLSO_CONFIRMAR: { Propietario: true, Encargado: true, 'Cajero/a': false, 'Camarero/a': false }
};
function entorno(quien, opciones = {}) {
  const srv = crearServidorReembolsosFalso({ usuario: USUARIOS[quien], ...opciones });
  window.getSupabaseClient = async () => srv.cliente;
  window.__nubeActiva = true;
  localStorage.clear();
  return srv;
}
async function montar(srv, props = {}, Componente = mod.ReembolsosEconomicosB08) {
  if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
  document.getElementById('raiz').innerHTML = '';
  raiz = createRoot(document.getElementById('raiz'));
  await act(async () => { raiz.render(React.createElement(Componente, { empresaId: srv.estado.ids.E, localId: srv.estado.ids.L, rolPerfil: srv.estado.usuario.rol, ...props })); });
  await esperar(120);
}
const llamadas = (srv, nombre) => srv.estado.llamadas.filter((c) => c.nombre === nombre);
const reembolso = (srv, id) => srv.estado.tablas.reembolsos.find((r) => r.id === id);
const PENDIENTE_CAJERO = (extra = {}) => ({
  id: 'r-caj-1', empresa_id: 'D13-EMP', local_id: 'D13-L1', pago_id: '50000000-0000-0000-0000-0000000000d1', estado: 'PENDIENTE', payment_currency_code: 'EUR', importe_solicitado: 4,
  provider_code: null, provider_reference: null, motivo: 'cliente pidió devolución', created_at: '2026-10-03T08:00:00Z', resolved_at: null, created_by: UCAJ, aprobado_por: null, aprobado_at: null, ...extra
});
async function solicitar(srv, pagoId, importe, motivo) {
  await escribir(campo('Pago original'), pagoId);
  await escribir(campo('Importe a reembolsar'), String(importe));
  await escribir(campo('Motivo obligatorio'), motivo);
  await clic(boton('Solicitar reembolso'));
}

try {
  // ================= Parte A · Cajero/a que solicita (sin permiso de aprobar) =================
  {
    const srv = entorno('cajero', { capacidades: CAPS_CAJERO_SOLICITA });
    await montar(srv);
    ok('A1 se leen los permisos del servidor con los parámetros exactos', llamadas(srv, 'abc_obtener_capacidades_rol').some((c) => JSON.stringify(c.params) === JSON.stringify({ p_empresa_id: 'D13-EMP', p_local_id: 'D13-L1' })), srv.estado.llamadas);
    ok('A2 aviso «lo que solicites quedará pendiente de aprobación»', !!document.querySelector('[data-aviso-reembolso="con-aprobacion"]') && texto().includes('Lo que solicites quedará pendiente de aprobación: no sale dinero hasta que un Encargado o el Propietario lo apruebe.'), texto().slice(0, 600));
    ok('A3 no sale el aviso de «sin permiso»', !document.querySelector('[data-aviso-reembolso="sin-permiso"]'));
    await escribir(campo('Pago original'), srv.estado.ids.PAGO_TARJETA);
    ok('A4 con un pago elegido, «Solicitar reembolso» está activo', boton('Solicitar reembolso')?.disabled === false);
    await solicitar(srv, srv.estado.ids.PAGO_TARJETA, 4, 'cliente pidió devolución');
    const c = llamadas(srv, 'abc_solicitar_reembolso')[0];
    ok('A5 la solicitud envía los parámetros exactos de siempre (sin parámetros nuevos)', c && Object.keys(c.params).join() === 'p_operation_id,p_empresa_id,p_local_id,p_reembolso_id,p_pago_id,p_importe_solicitado,p_motivo,p_terminal_id,p_operating_day'
      && OPERACION.test(c.params.p_operation_id) && c.params.p_operation_id.startsWith('b08.ui.request.') && UUID.test(c.params.p_reembolso_id) && c.params.p_pago_id === srv.estado.ids.PAGO_TARJETA
      && c.params.p_importe_solicitado === 4 && c.params.p_motivo === 'cliente pidió devolución' && c.params.p_terminal_id === srv.estado.ids.TERMINAL && c.params.p_operating_day === '2026-10-03', c);
    ok('A6 el mensaje dice que queda pendiente de aprobación y que no sale dinero', texto().includes('Solicitud creada y pendiente de aprobación: no sale dinero hasta que un Encargado o el Propietario la apruebe.') && !texto().includes('Solicitud creada como PENDIENTE'), texto().slice(0, 900));
    ok('A7 la fila sale «Pendiente de aprobación» y no «Pendiente»', texto().includes('Pendiente de aprobación') && !/Pendiente(?! de aprobación)/.test(texto().replace('Esperando a que la apruebe', '')), texto().slice(0, 1200));
    ok('A8 dice que espera a un Encargado o al Propietario', !!document.querySelector('[data-aviso-aprobacion]') && texto().includes('Esperando a que la apruebe un Encargado o el Propietario. Hasta entonces no sale dinero.'));
    const bt = botonesTexto();
    ok('A9 sin botones de Aprobar, Rechazar, Cancelar ni Confirmar efectivo', !bt.includes('Aprobar') && !bt.includes('Rechazar solicitud') && !bt.includes('Cancelar solicitud') && !bt.includes('Confirmar efectivo'), bt);
    ok('A10 la fila nueva queda sin aprobar en el servidor', reembolso(srv, c.params.p_reembolso_id)?.aprobado_at === null && reembolso(srv, c.params.p_reembolso_id)?.created_by === UCAJ);
    const cols = srv.estado.consultas.filter((q) => q.tabla === 'reembolsos').map((q) => q.columnas).pop() || '';
    ok('A11 la pantalla pide las columnas de aprobación (created_by, aprobado_por, aprobado_at)', ['created_by', 'aprobado_por', 'aprobado_at'].every((k) => cols.split(',').includes(k)), cols);
  }
  // ================= Parte B · Cajero/a sin permiso de solicitar =================
  {
    const srv = entorno('cajero');
    await montar(srv);
    ok('B1 aviso «sin permiso» con la indicación de dónde activarlo', !!document.querySelector('[data-aviso-reembolso="sin-permiso"]') && texto().includes('Tu usuario no tiene permiso para solicitar reembolsos. El Propietario puede activarlo en Sistema → Configuración → Permisos.'), texto().slice(0, 600));
    ok('B2 no sale el aviso de «pendiente de aprobación»', !document.querySelector('[data-aviso-reembolso="con-aprobacion"]'));
    await escribir(campo('Pago original'), srv.estado.ids.PAGO_TARJETA);
    ok('B3 aunque elija un pago, «Solicitar reembolso» sigue desactivado', boton('Solicitar reembolso')?.disabled === true);
    await escribir(campo('Importe a reembolsar'), '2');
    await escribir(campo('Motivo obligatorio'), 'x');
    await clic(boton('Solicitar reembolso'));
    ok('B4 y no se llama al servidor', llamadas(srv, 'abc_solicitar_reembolso').length === 0, srv.estado.llamadas);
  }
  // ================= Parte C · Encargado =================
  {
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO()] });
    await montar(srv);
    ok('C1 ve la solicitud del cajero «Pendiente de aprobación» con «Aprobar» y «Rechazar solicitud»', texto().includes('Pendiente de aprobación') && !!boton('Aprobar') && !!boton('Rechazar solicitud') && !boton('Cancelar solicitud'), botonesTexto());
    ok('C2 el texto le dice que la revise y que no sale dinero hasta aprobarla', texto().includes('Revisa la solicitud y apruébala o recházala. Hasta que se apruebe no sale dinero.'));
    ok('C3 no ve el aviso de que sus solicitudes necesitan aprobación', !document.querySelector('[data-aviso-reembolso]'));
    const antes = srv.estado.consultas.filter((q) => q.tabla === 'reembolsos').length;
    await clic(boton('Aprobar'));
    const a = llamadas(srv, 'abc_aprobar_reembolso')[0];
    ok('C4 «Aprobar» llama a abc_aprobar_reembolso con los parámetros exactos', a && Object.keys(a.params).join() === 'p_operation_id,p_empresa_id,p_local_id,p_reembolso_id,p_terminal_id,p_operating_day'
      && a.params.p_operation_id === 'b08.ui.approve.r-caj-1' && a.params.p_empresa_id === 'D13-EMP' && a.params.p_local_id === 'D13-L1' && a.params.p_reembolso_id === 'r-caj-1'
      && a.params.p_terminal_id === srv.estado.ids.TERMINAL && a.params.p_operating_day === '2026-10-03', a);
    ok('C5 mensaje de aprobación (pago con tarjeta: el simulador no envía dinero)', texto().includes('Solicitud aprobada. El simulador no envía dinero a un proveedor real.'), texto().slice(0, 700));
    ok('C6 la fila ya no está «Pendiente de aprobación»: dice «Aprobada el 2026-10-03 09:00»', !texto().includes('Pendiente de aprobación') && texto().includes('Aprobada el 2026-10-03 09:00'), texto().slice(0, 900));
    ok('C7 se recargó la lista y desaparecen «Aprobar» y «Rechazar solicitud» (queda «Cancelar solicitud», como antes)', srv.estado.consultas.filter((q) => q.tabla === 'reembolsos').length > antes && !boton('Aprobar') && !boton('Rechazar solicitud') && !!boton('Cancelar solicitud'), botonesTexto());
  }
  {
    // efectivo: antes de aprobar no hay «Confirmar efectivo»; tras aprobar, sí
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO({ id: 'r-caj-efe', pago_id: '50000000-0000-0000-0000-0000000000d2', importe_solicitado: 6 })] });
    await montar(srv);
    ok('C8 un efectivo pendiente de aprobación NO ofrece «Confirmar efectivo» (solo Aprobar y Rechazar)', !boton('Confirmar efectivo') && !!boton('Aprobar') && !!boton('Rechazar solicitud'), botonesTexto());
    await clic(boton('Aprobar'));
    ok('C9 al aprobar un efectivo, el mensaje dice que ya se puede confirmar el efectivo', texto().includes('Solicitud aprobada. Ahora se puede confirmar el efectivo.'), texto().slice(0, 700));
    ok('C10 y aparece «Confirmar efectivo»', !!boton('Confirmar efectivo'), botonesTexto());
    await clic(boton('Confirmar efectivo'));
    const e = llamadas(srv, 'abc_confirmar_reembolso_efectivo')[0];
    ok('C11 «Confirmar efectivo» llama con los parámetros de siempre y confirma', e && e.params.p_reembolso_id === 'r-caj-efe' && e.params.p_caja_id === srv.estado.ids.CAJA && e.params.p_session_id === srv.estado.ids.SESION && reembolso(srv, 'r-caj-efe').estado === 'CONFIRMADO'
      && texto().includes('Reembolso en efectivo confirmado. Se ha creado un único movimiento negativo de caja.'), e);
  }
  {
    // rechazar
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO()] });
    await montar(srv);
    await clic(boton('Rechazar solicitud'));
    await escribir(campo('Motivo de cancelación'), 'no procede');
    await clic(boton('Confirmar cancelación'));
    const c = llamadas(srv, 'abc_cancelar_reembolso')[0];
    ok('C12 «Rechazar solicitud» usa abc_cancelar_reembolso con el motivo', c && c.params.p_reembolso_id === 'r-caj-1' && c.params.p_motivo_cancelacion === 'no procede' && c.params.p_operation_id === 'b08.ui.cancel.r-caj-1', c);
    ok('C13 el mensaje dice «rechazada» (no «cancelada») y la fila queda Cancelado', texto().includes('Solicitud rechazada y saldo liberado.') && !texto().includes('Solicitud cancelada y saldo liberado.') && reembolso(srv, 'r-caj-1').estado === 'CANCELADO' && texto().includes('Cancelado'), texto().slice(0, 800));
  }
  {
    // una solicitud ya aprobada se «cancela» como siempre
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO({ id: 'r-ya', aprobado_por: UPROP, aprobado_at: '2026-10-03T08:05:00Z' })] });
    await montar(srv);
    ok('C14 una solicitud ya aprobada conserva «Cancelar solicitud» y no pide aprobar', !!boton('Cancelar solicitud') && !boton('Aprobar') && !boton('Rechazar solicitud') && texto().includes('Aprobada el 2026-10-03 08:05'), botonesTexto());
    await clic(boton('Cancelar solicitud'));
    await escribir(campo('Motivo de cancelación'), 'cliente cambió');
    await clic(boton('Confirmar cancelación'));
    ok('C15 y su mensaje es el de siempre: «cancelada»', texto().includes('Solicitud cancelada y saldo liberado.') && !texto().includes('rechazada'), texto().slice(0, 800));
  }
  {
    // lo que solicita el propio Encargado se aprueba en el acto
    const srv = entorno('encargado');
    await montar(srv);
    await solicitar(srv, srv.estado.ids.PAGO_TARJETA, 5, 'cobro duplicado');
    ok('C16 su solicitud se aprueba en el acto: mensaje de siempre y no «pendiente de aprobación»', texto().includes('Solicitud creada como PENDIENTE. El simulador no envía dinero a un proveedor real.') && !texto().includes('Pendiente de aprobación'), texto().slice(0, 900));
    ok('C17 la fila muestra «Aprobada el …» y «Cancelar solicitud», sin «Aprobar»', /Aprobada el 2026-10-03 08:0\d/.test(texto()) && !!boton('Cancelar solicitud') && !boton('Aprobar'), botonesTexto());
  }
  {
    // una solicitud pendiente que hizo el propio usuario (caso forzado): no la puede aprobar
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO({ id: 'r-mia', created_by: UENC })] });
    await montar(srv);
    ok('C18 no se le ofrece «Aprobar» lo que solicitó él mismo y se le dice que lo apruebe otra persona', !boton('Aprobar') && texto().includes('Tiene que aprobarla otra persona. Hasta entonces no sale dinero.') && !!boton('Rechazar solicitud'), botonesTexto());
  }
  {
    // errores del servidor, en español
    for (const [codigo, esperado] of [
      ['reembolso_aprobador_distinto_solicitante', 'No puedes aprobar una solicitud que hiciste tú: tiene que aprobarla otra persona.'],
      ['abc_aprobar_reembolso_no_autorizado', 'Tu usuario no tiene permiso para aprobar reembolsos.'],
      ['reembolso_ya_aprobado', 'Este reembolso ya estaba aprobado. Actualiza la pantalla.'],
      ['reembolso_no_aprobable', 'Este reembolso ya no se puede aprobar (está resuelto o cancelado). Actualiza la pantalla.']
    ]) {
      const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO()] });
      srv.estado.fallos.abc_aprobar_reembolso = codigo;
      await montar(srv);
      await clic(boton('Aprobar'));
      ok(`C19 error «${codigo}» se explica en español y la fila sigue pendiente`, texto().includes(esperado) && !texto().includes(codigo) && texto().includes('Pendiente de aprobación'), texto().slice(0, 700));
    }
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO({ id: 'r-efe-2', pago_id: '50000000-0000-0000-0000-0000000000d2', importe_solicitado: 3 })] });
    srv.estado.fallos.abc_confirmar_reembolso_efectivo = 'reembolso_pendiente_aprobacion';
    await montar(srv);
    // forzamos que la pantalla ofrezca el botón (aprobada en pantalla pero el servidor lo rechaza)
    srv.estado.tablas.reembolsos[0].aprobado_at = '2026-10-03T08:10:00Z';
    srv.estado.tablas.reembolsos[0].aprobado_por = UPROP;
    await montar(srv);
    await clic(boton('Confirmar efectivo'));
    ok('C20 si el servidor dice «pendiente de aprobación» al confirmar efectivo, se explica', texto().includes('Este reembolso todavía no está aprobado: un Encargado o el Propietario tiene que aprobarlo antes.'), texto().slice(0, 700));
  }
  // ================= Parte D · Propietario, permisos desconocidos y compatibilidad =================
  {
    const srv = entorno('propietario', { reembolsos: [PENDIENTE_CAJERO()] });
    await montar(srv);
    ok('D1 el Propietario también aprueba y rechaza', !!boton('Aprobar') && !!boton('Rechazar solicitud') && !document.querySelector('[data-aviso-reembolso]'), botonesTexto());
  }
  {
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO()] });
    await montar(srv, { rolPerfil: '' });
    ok('D2 sin rol (versión anterior de la pantalla): se ven todos los botones y no hay avisos de permiso (decide el servidor)', !!boton('Aprobar') && !!boton('Rechazar solicitud') && !document.querySelector('[data-aviso-reembolso]') && llamadas(srv, 'abc_obtener_capacidades_rol').length === 0, botonesTexto());
  }
  {
    const srv = entorno('cajero', { reembolsos: [PENDIENTE_CAJERO({ created_by: UPROP })] });
    srv.estado.fallos.abc_obtener_capacidades_rol = 'fallo_de_red';
    await montar(srv);
    ok('D3 si no se pueden leer los permisos, se comporta como antes (botones visibles; el servidor decide)', !!boton('Aprobar') && !document.querySelector('[data-aviso-reembolso]'), botonesTexto());
    await escribir(campo('Pago original'), srv.estado.ids.PAGO_TARJETA);
    ok('D3b y con los permisos desconocidos, «Solicitar reembolso» está activo (el servidor decide)', boton('Solicitar reembolso')?.disabled === false, botonesTexto());
    await clic(boton('Aprobar'));
    ok('D4 y si el servidor rechaza, se explica', texto().includes('Tu usuario no tiene permiso para aprobar reembolsos.'), texto().slice(0, 700));
  }
  {
    // cambiar de rol relee los permisos
    const srv = entorno('cajero', { capacidades: CAPS_CAJERO_SOLICITA });
    await montar(srv);
    const lecturas = llamadas(srv, 'abc_obtener_capacidades_rol').length;
    ok('D5 como Cajero/a con permiso aparece el aviso de aprobación', !!document.querySelector('[data-aviso-reembolso="con-aprobacion"]'));
    await act(async () => { raiz.render(React.createElement(mod.ReembolsosEconomicosB08, { empresaId: 'D13-EMP', localId: 'D13-L1', rolPerfil: 'Propietario' })); });
    await esperar(120);
    ok('D6 al cambiar a Propietario se vuelven a leer los permisos y desaparece el aviso', llamadas(srv, 'abc_obtener_capacidades_rol').length > lecturas && !document.querySelector('[data-aviso-reembolso]'));
  }
  {
    // una capacidad que el servidor no devuelve cuenta como «no»
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO()], capacidades: { ABC_REEMBOLSO_SOLICITAR: { Propietario: true, Encargado: true, 'Cajero/a': false, 'Camarero/a': false } } });
    await montar(srv);
    ok('D7 si el servidor no devuelve el permiso de aprobar, se trata como «no»: sin «Aprobar» ni «Rechazar solicitud» y con el aviso de espera', !boton('Aprobar') && !boton('Rechazar solicitud') && texto().includes('Esperando a que la apruebe un Encargado o el Propietario'), botonesTexto());
  }
  {
    // «Aprobada el …» solo en lo pendiente: una fila ya resuelta no lo muestra
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO({ id: 'r-resuelta', estado: 'CONFIRMADO', aprobado_por: UPROP, aprobado_at: '2026-10-03T08:05:00Z', resolved_at: '2026-10-03T08:20:00Z' })] });
    await montar(srv);
    ok('D8 una solicitud ya confirmada no muestra «Aprobada el»', !texto().includes('Aprobada el') && texto().includes('Confirmado'), texto().slice(0, 700));
  }
  {
    // mientras una aprobación está en curso, volver a lanzarla no hace nada (aunque el botón esté desactivado, el control no depende de él)
    const srv = entorno('encargado', { reembolsos: [PENDIENTE_CAJERO()] });
    srv.estado.retardos.abc_aprobar_reembolso = 300;
    await montar(srv);
    await clic(boton('Aprobar'));
    const enCurso = boton('Aprobando…');
    ok('D9 mientras se aprueba, el botón dice «Aprobando…» y está desactivado', !!enCurso && enCurso.disabled === true, botonesTexto());
    const propiedades = enCurso[Object.keys(enCurso).find((k) => k.startsWith('__reactProps'))];
    await act(async () => { propiedades.onClick(); });
    await esperar(500);
    ok('D10 volver a lanzar la aprobación mientras sigue en curso no envía una segunda llamada al servidor', llamadas(srv, 'abc_aprobar_reembolso').length === 1, llamadas(srv, 'abc_aprobar_reembolso'));
  }
  // ================= Parte E · la pestaña Devoluciones pasa el rol =================
  {
    const srv = entorno('cajero', { capacidades: CAPS_CAJERO_SOLICITA });
    await montar(srv, { rolPerfil: 'Cajero/a' }, (props) => React.createElement(mod.Devoluciones, { empresaId: props.empresaId, localId: props.localId, rolPerfil: props.rolPerfil }));
    await clic(boton('Reembolso económico'));
    await esperar(120);
    ok('E1 desde «Devoluciones → Reembolso económico» la pantalla conoce el rol (sale el aviso de aprobación)', !!document.querySelector('[data-aviso-reembolso="con-aprobacion"]'), texto().slice(0, 600));
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1500) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('d13-ui-runtime: OK');
