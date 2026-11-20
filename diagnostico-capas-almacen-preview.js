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
  function envolver(motivo) {
    // La capa de debajo se captura AQUÍ, en el ámbito de esta instalación. La
    // primera versión de este guion la guardaba en una variable compartida y la
    // reasignaba en cada vuelta, así que las envolturas antiguas acababan
    // apuntando a la nueva y se llamaban en círculo: «Maximum call stack size
    // exceeded», 606 veces en una sola carga. Un fallo mío de cierre, no del
    // programa.
    var inner = window.storage.get.bind(window.storage);
    var nombre = nombrarCapa(window.storage.get);
    var nombreDentro = nombre;
    window.storage.get = async function (key, shared) {
      if (!VIGILADAS[key] || !window.__diagCapasAlmacenV1) return inner(key, shared);

      var enDispositivo;
      try { enDispositivo = localStorage.getItem("almacen:" + key); }
      catch (e) { enDispositivo = "LANZA " + (e && e.message); }

      var respuesta, fallo = null;
      try { respuesta = await inner(key, shared); }
      catch (e) { fallo = (e && e.message) ? e.message : String(e); }

      if (registro.lecturas.length < 40) registro.lecturas.push({
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
  var ultimoTic = Date.now();
  registro.atascos = [];
  registro.tareasLargas = [];

  var reloj = window.setInterval(function () {
    vueltas++;

    // Deriva del reloj: si entre dos tics de 150 ms han pasado muchos más, el
    // hilo principal estuvo ocupado en medio. Es la medida más tosca y la que
    // nunca falla, y sirve para fechar el bloqueo que deja la página sin
    // responder a `read_page` ni a la ejecución de JavaScript.
    var ahora = Date.now();
    var deriva = ahora - ultimoTic - 150;
    ultimoTic = ahora;
    if (deriva > 400 && registro.atascos.length < 40) {
      registro.atascos.push({ ms: ahora - t0, bloqueado_ms: deriva, envoltura: quienEsLaExterna() });
      volcar();
    }

    if (quienEsLaExterna() !== "este-diagnostico") envolver("me desplazaron; vuelvo arriba");
    if (vueltas > 260) window.clearInterval(reloj);
  }, 150);

  // QUÉ HAY ENCIMA DE LA PANTALLA
  // -----------------------------
  // El usuario informa de que, entrando en el Deploy Preview con la cuenta de
  // ensayo, «no se puede hacer nada» en el programa, y que **en Firefox pasa lo
  // mismo**. Eso descarta que sea la herramienta —que es lo que yo había
  // concluido, y queda corregido en el acta— y encaja con lo medido: el hilo
  // principal está vivo (el peor atasco de un arranque de 40 s es de unos dos
  // segundos y la tarea más larga dura 336 ms), así que no es un cuelgue: es
  // algo que TAPA la interfaz.
  //
  // Hay varios candidatos en el propio arranque, todos a pantalla completa:
  //   · edge-auth-patch.js, la capa de MFA, con z-index 2147483647;
  //   · owner-bootstrap-post-reset.js, el marco «Instalación bloqueada de forma
  //     segura», z-index 10050, con un botón «Reintentar comprobación»;
  //   · plataforma-panel.js, el panel del administrador, 10040/10045/10050.
  //
  // En vez de adivinar cuál, se pregunta al navegador quién recibiría el clic:
  // `elementFromPoint` en el centro y en cuatro esquinas, más el inventario de
  // las capas fijas con z-index alto. Eso nombra al culpable, con su texto.
  function quienRecibeElClic() {
    var an = window.innerWidth || 0;
    var al = window.innerHeight || 0;
    var puntos = [
      ["centro", Math.round(an / 2), Math.round(al / 2)],
      ["arriba-izq", 40, 80],
      ["arriba-der", Math.max(0, an - 40), 80],
      ["abajo-izq", 40, Math.max(0, al - 60)],
      ["abajo-der", Math.max(0, an - 40), Math.max(0, al - 60)]
    ];
    return puntos.map(function (p) {
      var el = null;
      try { el = document.elementFromPoint(p[1], p[2]); } catch (e) {}
      if (!el) return p[0] + ": (nada)";
      var señas = el.tagName.toLowerCase()
        + (el.id ? "#" + el.id : "")
        + (el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 3).join(".") : "");
      var z = "";
      try { z = window.getComputedStyle(el).zIndex; } catch (e) {}
      return p[0] + ": " + señas + (z && z !== "auto" ? " z=" + z : "");
    }).join(" | ");
  }

  function capasQueTapan() {
    var fuera = [];
    try {
      var todos = document.body ? document.body.querySelectorAll("*") : [];
      for (var i = 0; i < todos.length && fuera.length < 12; i++) {
        var el = todos[i];
        var s = window.getComputedStyle(el);
        if (s.position !== "fixed" && s.position !== "absolute") continue;
        var z = parseInt(s.zIndex, 10);
        if (!(z >= 1000)) continue;
        var r = el.getBoundingClientRect();
        var cubre = r.width >= (window.innerWidth || 0) * 0.8 && r.height >= (window.innerHeight || 0) * 0.8;
        if (!cubre) continue;
        fuera.push({
          señas: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : ""),
          z: z,
          tamaño: Math.round(r.width) + "x" + Math.round(r.height),
          papel: el.getAttribute("role") || "",
          eventos: s.pointerEvents,
          visible: s.visibility + "/" + s.opacity + "/" + s.display,
          texto: (el.innerText || "").replace(/\s+/g, " ").slice(0, 160)
        });
      }
    } catch (e) {
      fuera.push({ señas: "error al inventariar: " + (e && e.message ? e.message : e) });
    }
    return fuera;
  }

  registro.pantalla = [];
  [3000, 8000, 20000].forEach(function (cuando) {
    window.setTimeout(function () {
      try {
        registro.pantalla.push({
          ms: Date.now() - t0,
          clases_html: document.documentElement.className || "(ninguna)",
          raiz_visible: (function () {
            var r = document.getElementById("root");
            if (!r) return "no hay #root";
            var s = window.getComputedStyle(r);
            return s.visibility + "/" + s.display + "/" + s.opacity;
          })(),
          recibe_el_clic: quienRecibeElClic(),
          capas_que_tapan: capasQueTapan(),
          titulo: document.title
        });
        volcar();
      } catch (e) {}
    }, cuando);
  });

  // Latido, con reloj de pared y en su propia clave.
  //
  // Para qué: el panel del navegador agota el tiempo de espera en `read_page`,
  // en las capturas y en la ejecución de JavaScript sobre esta página —`1 + 1`
  // se come 45 segundos—, y de ahí dedujé que la página congelaba su hilo
  // principal. **Era falso**: la deriva del reloj medida aquí dice que el
  // atasco más largo de todo el arranque es de unos dos segundos, y las
  // lecturas siguen registrándose a los 15 segundos. Así que lo que está
  // atascado es el canal, no la página.
  //
  // Este latido lo deja probado en vez de deducido: si una llamada por el panel
  // agota su espera y justo después este latido tiene una marca de hace un
  // segundo, la página estaba viva mientras el canal no respondía. Se lee desde
  // cualquier otro documento del mismo origen.
  try {
    var latidos = 0;
    var relojLatido = window.setInterval(function () {
      latidos++;
      try {
        localStorage.setItem("diag_latido_v1", JSON.stringify({
          latidos: latidos,
          hora: new Date().toISOString(),
          desde_el_arranque_ms: Date.now() - t0
        }));
      } catch (e) {}
      if (latidos > 600) window.clearInterval(relojLatido);
    }, 1000);
  } catch (e) {}

  // Atribución: las tareas largas sí dicen de dónde salen (qué documento o
  // marco las ejecuta). `longtask` solo existe en navegadores que lo soportan,
  // así que va en try y su ausencia no es un fallo del diagnóstico.
  try {
    if (typeof PerformanceObserver === "function") {
      var observador = new PerformanceObserver(function (lista) {
        lista.getEntries().forEach(function (e) {
          if (registro.tareasLargas.length >= 40) return;
          var atribucion = [];
          try {
            (e.attribution || []).forEach(function (a) {
              atribucion.push([a.name, a.containerType, a.containerName, a.containerSrc].filter(Boolean).join(" · "));
            });
          } catch (err) {}
          registro.tareasLargas.push({
            ms: Math.round(e.startTime),
            duracion_ms: Math.round(e.duration),
            nombre: e.name,
            atribucion: atribucion.join(" | ") || "(sin atribucion)"
          });
        });
        volcar();
      });
      observador.observe({ type: "longtask", buffered: true });
      registro.observadorTareasLargas = "activo";
    } else {
      registro.observadorTareasLargas = "PerformanceObserver no disponible";
    }
  } catch (e) {
    registro.observadorTareasLargas = "no soportado: " + (e && e.message ? e.message : e);
  }
  volcar();
})();
