// Diagnóstico temporal de las capas de `window.storage`. SOLO Deploy Preview.
//
// POR QUÉ EXISTE
// --------------
// El 20/11/2026, con la cuenta de ensayo `qa.permisos.20261116@qa.invalid`
// (Camarero/a, membresía QA-A1 correcta), la lectura de `locales` responde
// vacío aunque el servidor devuelva `[QA-A1]` y `almacen:locales` lo contenga.
// Recorriendo el código, ninguna de las tres capas —base, puente de contexto y
// puerta de autoridad por cargo— puede producir ese vacío, así que una de esas
// lecturas está mal y hay que verlo correr. La página congela su hilo principal
// a los ~4,8 s, de modo que no se la puede interrogar desde fuera; en cambio
// `localStorage` es del origen y se lee desde cualquier otro documento de él.
// Este guion escribe ahí lo que ve.
//
// QUÉ HACE, EXACTAMENTE
// ---------------------
//  1. Se instala inmediatamente DESPUÉS de `index-storage-bootstrap.js`, que es
//     quien define `window.storage`, y ANTES de las otras dos capas. Así su
//     envoltura queda la más interna de todas: ve lo que responde la base, no
//     lo que acaba recibiendo la aplicación.
//  2. Anota, para cada lectura de `empresas`, `locales` y `localActivoId`: qué
//     devolvió la base, qué hay en ese instante en `localStorage`, qué
//     envoltura es la más externa, y el rol y local del contexto operativo.
//  3. Muestrea aparte la identidad de `window.storage.get` cada 200 ms durante
//     12 s, para ver cuántas veces se reemplaza y cuál queda por fuera.
//
// NO CAMBIA NADA. Solo observa: devuelve tal cual lo que la capa de abajo
// responde, y si su propio registro falla, se calla y sigue.
//
// CÓMO SE LEE
// -----------
// Desde otra pestaña del mismo origen —por ejemplo una página 404 cualquiera,
// que no arranca la aplicación—:
//
//     JSON.parse(localStorage.getItem('diag_capas_almacen_v1'))
//
// CUÁNDO SE QUITA
// ---------------
// En cuanto señale la capa. Es un andamio, no una pieza del programa: no se
// publica fuera del Deploy Preview, y el patrón —y el guardia de host— es el
// mismo que usa `reset-pruebas-preview.js`, que ya existe en el repositorio
// para exactamente esto.

(function () {
  "use strict";

  // Mismo guardia de host que reset-pruebas-preview.js. Producción y cualquier
  // otro dominio quedan fuera por diseño, antes de tocar nada.
  var HOST_PREVIEW = /^(?:deploy-preview-\d+|[a-f0-9]{24}|qa-fase2-\d{8})--chic-entremet-9107cf\.netlify\.app$/i;
  if (typeof window === "undefined" || !window.location) return;
  if (!HOST_PREVIEW.test(window.location.hostname || "")) return;
  if (window.__diagCapasAlmacenV1 || !window.storage) return;
  window.__diagCapasAlmacenV1 = true;

  var CLAVE_REGISTRO = "diag_capas_almacen_v1";
  var VIGILADAS = { empresas: true, locales: true, localActivoId: true };
  var t0 = Date.now();
  var registro = { arranque: new Date().toISOString(), lecturas: [], envolturas: [] };

  function volcar() {
    try { localStorage.setItem(CLAVE_REGISTRO, JSON.stringify(registro)); }
    catch (e) { /* si no cabe o está bloqueado, no es asunto de este guion */ }
  }

  function recortar(v, n) {
    if (v === null || v === undefined) return v === null ? "NULO" : "INDEFINIDO";
    var s = String(v);
    return s.length > n ? s.slice(0, n) + "…(" + s.length + ")" : s;
  }

  // Qué función es la más externa ahora mismo, en una línea reconocible.
  function quienEsLaExterna() {
    try {
      var s = String(window.storage.get).replace(/\s+/g, " ");
      if (s.indexOf("CLAVES_CONTROLADAS") !== -1) return "puerta-autoridad";
      if (s.indexOf("pinPropietario") !== -1) return "puente-contexto";
      if (s.indexOf("__diagCapas") !== -1) return "este-diagnostico";
      if (s.indexOf("historialRespaldos") !== -1) return "base";
      return "desconocida: " + s.slice(0, 60);
    } catch (e) { return "no-legible"; }
  }

  function contextoSeguro() {
    try {
      var p = JSON.parse(localStorage.getItem("chocoloyos_contexto_operativo_seguro_v1") || "null");
      if (!p) return "sin-cache";
      var c = p.contexto || {};
      return "rol=" + c.rol + " localId=" + c.localId + " solicitado=" + p.localIdSolicitado;
    } catch (e) { return "no-legible"; }
  }

  function barrera() {
    try {
      var s = window.__laOwnerBootstrapSyncState && window.__laOwnerBootstrapSyncState();
      return s ? (s.bootstrapListo ? "listo" : "no") + "/" + (s.syncSolicitada ? "solicitada" : "no") : "sin-estado";
    } catch (e) { return "no-legible"; }
  }

  // Qué capa es la que tengo justo debajo, para poder decir quién respondió.
  function nombrarCapa(fn) {
    try {
      var s = String(fn).replace(/\s+/g, " ");
      if (s.indexOf("CLAVES_CONTROLADAS") !== -1) return "puerta-autoridad";
      if (s.indexOf("pinPropietario") !== -1) return "puente-contexto";
      if (s.indexOf("var r = await getAnterior(key") !== -1) return "puente-catalogo-tpv";
      if (s.indexOf("var normalized = String(key") !== -1) return "puente-appcc";
      if (s.indexOf("historialRespaldos") !== -1) return "base";
      return "desconocida: " + s.slice(0, 60);
    } catch (e) { return "no-legible"; }
  }

  // La pila de envolturas se reconstruye durante el arranque: medido el
  // 20/11/2026, a los 371 ms manda el puente APPCC, a los 1371 el observador
  // del catálogo TPV y a los 2386 la puerta de autoridad. Un sondeo fijo queda
  // enterrado y no ve lo que recibe la aplicación. Así que este se vuelve a
  // poner encima cada vez que lo desplazan, y anota a quién delegó.
  var dentro = null;
  var nombreDentro = null;

  function envolver(motivo) {
    dentro = window.storage.get.bind(window.storage);
    nombreDentro = nombrarCapa(window.storage.get);
    window.storage.get = async function (key, shared) {
      var inner = dentro;
      var nombre = nombreDentro;
      if (!VIGILADAS[key] || !window.__diagCapasAlmacenV1) return inner(key, shared);

      var enDispositivo;
      try { enDispositivo = localStorage.getItem("almacen:" + key); }
      catch (e) { enDispositivo = "LANZA " + (e && e.message); }

      var respuesta, fallo = null;
      try { respuesta = await inner(key, shared); }
      catch (e) { fallo = (e && e.message) ? e.message : String(e); }

      registro.lecturas.push({
        ms: Date.now() - t0,
        clave: key,
        respondio: nombre,
        devuelve: fallo ? ("LANZA: " + recortar(fallo, 140)) : recortar(respuesta && respuesta.value, 140),
        en_dispositivo: recortar(enDispositivo, 140),
        barrera: barrera(),
        contexto: contextoSeguro()
      });
      volcar();

      if (fallo) throw new Error(fallo);
      return respuesta;
    };
    registro.envolturas.push({ ms: Date.now() - t0, puesto_encima_de: nombreDentro, motivo: motivo, barrera: barrera() });
    volcar();
  }

  envolver("instalación inicial, sobre la base");

  var vueltas = 0;
  var reloj = window.setInterval(function () {
    vueltas++;
    if (quienEsLaExterna() !== "este-diagnostico") envolver("me desplazaron; vuelvo arriba");
    if (vueltas > 90) window.clearInterval(reloj);
  }, 150);
})();
