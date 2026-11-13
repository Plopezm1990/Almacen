/**
 * Barrido de apertura de vistas en el preview de QA.
 * ---------------------------------------------------------------------------
 * Abre cada vista del plan, la mide y la cierra. Pensado para gastar lo menos
 * posible de la ventana de sesion, que son quince minutos (A-05).
 *
 * Se pega entero en la consola del navegador con la sesion ya iniciada, y
 * despues se llama:
 *
 *     await LABarrido.correr(LABarrido.PLAN.filter(v => v.id.startsWith('tpv')))
 *
 * Reglas de seguridad, que son el motivo de que esto sea un guion y no clics a
 * mano:
 *
 * 1. Solo pulsa los disparadores que el plan nombra. Nunca busca un boton
 *    «parecido» ni recorre la pantalla pulsando cosas.
 * 2. Antes de cada clic comprueba la etiqueta contra una lista de verbos que
 *    escriben. Si coincide y el paso no lo declara con `escribe: true`, no
 *    pulsa y lo anota como omitido. Asi un error del plan no acaba en un
 *    cobro, un cierre de caja o un borrado.
 * 3. Para cerrar solo usa Cancelar, Cerrar, Volver, la X o la tecla Escape.
 *
 * Cada vista sale con un veredicto explicito, y «no encontrada» es un
 * resultado, no un fallo del guion: puede significar que la vista no existe
 * todavia, que depende de un dato que QA no tiene, o que su acceso es otro.
 */
(function () {
  "use strict";

  var ESPERA_TAB = 3200;
  var ESPERA_CLIC = 1400;

  /* Verbos que escriben. No se pulsan salvo que el paso lo declare. */
  var ESCRIBEN = /\b(guardar|cobrar|confirmar|anular|eliminar|borrar|retirar|aprobar|rechazar|aplicar|restaurar|traspasar|enviar|desactivar|reimprimir|facturar|unir|reabrir|relevar|vincular|iniciar cierre|registrar)\b/i;
  var CIERRAN = /^(cancelar|cerrar|volver|descartar|salir|×|✕|✖|x)$/i;

  var esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var raiz = function () { return document.querySelector("#root main") || document.querySelector("#root"); };

  function texto(nodo) {
    return (nodo.textContent || "").replace(/\s+/g, " ").trim();
  }

  function visibles(ambito, selector) {
    return [].slice.call((ambito || raiz()).querySelectorAll(selector || "button"))
      .filter(function (b) { return b.offsetParent; });
  }

  /* La superficie viva: el modal de arriba si hay alguno, si no el main. */
  function superficie() {
    var nodos = visibles(document.querySelector("#root"), "[role=dialog], .fixed");
    for (var i = nodos.length - 1; i >= 0; i--) {
      if (nodos[i].querySelector("button")) return nodos[i];
    }
    return raiz();
  }

  function nombreAccesible(e) {
    if (e.getAttribute("aria-label")) return e.getAttribute("aria-label");
    var lb = e.getAttribute("aria-labelledby");
    if (lb) { var n = document.getElementById(lb); if (n) return texto(n); }
    if (e.labels && e.labels.length) return texto(e.labels[0]);
    if (e.title) return e.title;
    return null;
  }

  function medir(nombre, ambito) {
    var campos = visibles(ambito, "input:not([type=checkbox]):not([type=radio]),select,textarea");
    var botones = visibles(ambito, "button");
    var tablas = visibles(ambito, "table");
    var corto = function (r) { return r.height > 0 && (r.height < 44 || r.width < 44); };
    return {
      superficie: nombre,
      campos: campos.length,
      camposSinNombre: campos.filter(function (c) { return !nombreAccesible(c); }).length,
      camposBajo44: campos.filter(function (c) { return corto(c.getBoundingClientRect()); })
        .map(function (c) { return (c.type || c.tagName) + " " + Math.round(c.getBoundingClientRect().height); }),
      botones: botones.length,
      botonesBajo44: botones.filter(function (b) { return corto(b.getBoundingClientRect()); })
        .map(function (b) { return texto(b).slice(0, 18) + " " + Math.round(b.getBoundingClientRect().height); }),
      tablas: tablas.length,
      tablasEnFichas: tablas.filter(function (t) { return t.classList.contains("la-tabla-fichas"); }).length,
      titulos: visibles(ambito, "h1,h2,h3").map(function (h) { return texto(h).slice(0, 48); }).slice(0, 6),
      desbordaH: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }

  async function cerrarTodo() {
    for (var intento = 0; intento < 4; intento++) {
      var s = superficie();
      if (s === raiz()) return;
      var b = visibles(s, "button").filter(function (x) { return CIERRAN.test(texto(x)); })[0];
      if (!b) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await esperar(500);
        continue;
      }
      b.click();
      await esperar(700);
    }
  }

  async function pulsar(patron, escribe) {
    var s = superficie();
    var candidatos = visibles(s, "button").filter(function (b) { return patron.test(texto(b)); });
    if (!candidatos.length && s !== raiz()) {
      candidatos = visibles(raiz(), "button").filter(function (b) { return patron.test(texto(b)); });
    }
    if (!candidatos.length) return { ok: false, motivo: "disparador no encontrado: " + patron };
    var destino = candidatos[0];
    var etiqueta = texto(destino);
    if (ESCRIBEN.test(etiqueta) && !escribe) {
      return { ok: false, motivo: "omitido por seguridad, la etiqueta escribe: " + etiqueta };
    }
    destino.click();
    await esperar(ESPERA_CLIC);
    return { ok: true, etiqueta: etiqueta };
  }

  async function abrir(vista) {
    var registro = { id: vista.id, pantalla: vista.pantalla, tab: vista.tab, pasos: [] };
    try {
      await cerrarTodo();
      if (!window.__laPuenteRediseno.puedeConsultar(vista.tab)) {
        registro.veredicto = "sin permiso de navegacion";
        return registro;
      }
      window.__laPuenteRediseno.irA(vista.tab);
      await esperar(ESPERA_TAB);
      for (var i = 0; i < (vista.pasos || []).length; i++) {
        var paso = vista.pasos[i];
        var r = await pulsar(paso.clic, paso.escribe);
        registro.pasos.push(r.ok ? r.etiqueta : r.motivo);
        if (!r.ok) {
          registro.veredicto = /seguridad/.test(r.motivo) ? "no abierta, requiere una operacion que escribe" : "no abierta, disparador no encontrado";
          return registro;
        }
      }
      var ambito = vista.enModal === false ? raiz() : superficie();
      if (vista.enModal !== false && ambito === raiz() && (vista.pasos || []).length) {
        registro.veredicto = "disparador pulsado pero no abrio superficie propia";
        registro.medida = medir(vista.id, raiz());
        return registro;
      }
      registro.medida = medir(vista.id, ambito);
      registro.veredicto = "abierta";
      return registro;
    } catch (error) {
      registro.veredicto = "error del guion: " + (error && error.message);
      return registro;
    } finally {
      try { await cerrarTodo(); } catch (e) {}
    }
  }

  async function correr(plan) {
    var salida = [];
    for (var i = 0; i < plan.length; i++) {
      salida.push(await abrir(plan[i]));
    }
    window.__barrido = (window.__barrido || []).concat(salida);
    return salida.map(function (r) {
      return {
        id: r.id,
        veredicto: r.veredicto,
        campos: r.medida ? r.medida.campos : null,
        sinNombre: r.medida ? r.medida.camposSinNombre : null,
        cortos: r.medida ? r.medida.camposBajo44.length + r.medida.botonesBajo44.length : null,
        tablas: r.medida ? r.medida.tablas + "/" + r.medida.tablasEnFichas : null,
        titulo: r.medida && r.medida.titulos.length ? r.medida.titulos[0] : "",
        pasos: r.pasos.join(" > ")
      };
    });
  }

  window.LABarrido = { correr: correr, abrir: abrir, medir: medir, cerrarTodo: cerrarTodo, PLAN: [] };
})();
