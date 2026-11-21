/*
 * L&A Suite · registro de plantillas Órbita
 *
 * La pantalla aporta datos y capacidades; esta capa aporta la composición.
 * No crea rutas, no ejecuta RPC y no sustituye handlers: únicamente añade
 * marcas semánticas al DOM que ya montan el producto y deja que la hoja común
 * aplique la misma escala en escritorio y móvil.
 */
(function () {
  "use strict";
  if (window.__laPlantillasOrbita) return;
  window.__laPlantillasOrbita = true;

  var PLANTILLAS = [
    "panel", "listado", "ficha", "formulario", "tabla",
    "detalle", "tpv", "cola-operativa", "configuracion", "movil"
  ];
  var MODULOS = [
    "inicio", "tpv", "pase", "cocina", "caja", "clientes", "compras",
    "inventario", "personal", "configuracion", "plataforma", "acceso"
  ];
  var POR_MODULO = {
    inicio: "panel",
    tpv: "tpv",
    pase: "cola-operativa",
    cocina: "cola-operativa",
    caja: "detalle",
    clientes: "listado",
    compras: "listado",
    inventario: "tabla",
    personal: "listado",
    configuracion: "configuracion",
    plataforma: "configuracion",
    acceso: "formulario"
  };

  function poner(nodo, plantilla) {
    if (!nodo || !plantilla) return;
    nodo.setAttribute("data-la-orbita-template", plantilla);
    nodo.setAttribute("data-la-plantilla", plantilla);
    nodo.classList.add("la-orbita-template-" + plantilla.replace(/[^a-z0-9]+/g, "-"));
  }

  function marcarSubplantillas(main) {
    Array.prototype.forEach.call(main.querySelectorAll("form"), function (nodo) {
      poner(nodo, "formulario");
    });
    Array.prototype.forEach.call(main.querySelectorAll("table"), function (nodo) {
      poner(nodo, "tabla");
    });
    Array.prototype.forEach.call(main.querySelectorAll('[role="dialog"], dialog'), function (nodo) {
      poner(nodo, "detalle");
    });
    Array.prototype.forEach.call(main.querySelectorAll('[role="list"], [role="listbox"], [data-la-pase-cola], .la-pase-cola'), function (nodo) {
      poner(nodo, "cola-operativa");
    });
  }

  function plantillaPrincipal(main) {
    var modulo = String(main.getAttribute("data-la-orbita-module") || "").toLowerCase();
    if (POR_MODULO[modulo]) return POR_MODULO[modulo];
    if (main.querySelector(".tpv-layout")) return "tpv";
    if (main.querySelector("#la-pase, .la-pase, .la-pase-cola")) return "cola-operativa";
    if (main.querySelector("table")) return "tabla";
    if (main.querySelector("form, input, select, textarea")) return "formulario";
    return "panel";
  }

  function esRaiz(nodo) {
    return nodo.matches("main[data-la-orbita-module], #la-plataforma-root, [data-la-orbita-external]");
  }

  function pasada() {
    var raiz = document.getElementById("root") || document.body;
    var raices = Array.prototype.filter.call(
      raiz.querySelectorAll("main[data-la-orbita-module], #la-plataforma-root, [data-la-orbita-external]"),
      esRaiz,
    );
    Array.prototype.forEach.call(raices, function (main) {
      var plantilla = plantillaPrincipal(main);
      poner(main, plantilla);
      main.setAttribute("data-la-orbita-mobile-template", "movil");
      main.setAttribute("data-la-plantillas-version", "1");
      marcarSubplantillas(main);
    });
  }

  function auditoria() {
    var raiz = document.getElementById("root") || document.body;
    var raices = Array.prototype.filter.call(
      raiz.querySelectorAll("main[data-la-orbita-module], #la-plataforma-root, [data-la-orbita-external]"),
      esRaiz,
    );
    var modulos = {};
    var plantillas = {};
    raices.forEach(function (main) {
      var modulo = main.getAttribute("data-la-orbita-module") || "externa";
      var plantilla = main.getAttribute("data-la-orbita-template") || "sin-clasificar";
      modulos[modulo] = plantilla;
      plantillas[plantilla] = (plantillas[plantilla] || 0) + 1;
    });
    var overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    return {
      version: 1,
      plantillas: PLANTILLAS.slice(),
      modulos: modulos,
      sinClasificar: MODULOS.filter(function (modulo) { return !modulos[modulo]; }),
      plantillasEncontradas: plantillas,
      movil: { ancho: document.documentElement.clientWidth, overflow: overflow }
    };
  }

  function arrancar() {
    pasada();
    var raiz = document.getElementById("root") || document.body;
    if (typeof MutationObserver === "function") {
      new MutationObserver(function () { window.requestAnimationFrame ? requestAnimationFrame(pasada) : setTimeout(pasada, 0); })
        .observe(raiz, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();

  window.LAPlantillasOrbita = {
    pasada: pasada,
    auditoria: auditoria,
    plantillas: PLANTILLAS.slice(),
    modulos: MODULOS.slice(),
    porModulo: Object.assign({}, POR_MODULO)
  };
})();
