// PM11 · corrección geométrica móvil v3
// Objetivo: eliminar la reserva lateral que estrecha TODO el shell en móvil
// (TopBar, main, navegación inferior y overlays), sin alterar permisos ni lógica.
(function () {
  "use strict";

  if (window.__pm11MobileLayoutV3Installed) return;
  window.__pm11MobileLayoutV3Installed = true;

  var MEDIA = "(max-width: 640px)";
  var MIN_GAP = 20;
  var MAX_GAP = 120;
  var programado = false;
  var observer = null;

  function esMovil() {
    return !window.matchMedia || window.matchMedia(MEDIA).matches;
  }

  function anchoViewport() {
    return Math.round(
      (document.documentElement && document.documentElement.clientWidth) ||
      window.innerWidth ||
      0
    );
  }

  function px(v) {
    var n = parseFloat(v || "0");
    return Number.isFinite(n) ? n : 0;
  }

  function datosRect(el, vw) {
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      width: r.width,
      gapRight: vw - r.right
    };
  }

  function pareceReservaLateral(el, vw) {
    var d = datosRect(el, vw);
    if (!d || vw < 280) return false;
    return d.left >= -3 && d.left <= 10 &&
      d.width >= vw * 0.62 &&
      d.gapRight >= MIN_GAP && d.gapRight <= MAX_GAP;
  }

  function marcarAnchoCompleto(el, modoViewport) {
    if (!el || !el.style) return;
    el.dataset.pm11MobileFullWidthV3 = "1";
    el.style.setProperty("min-width", "0", "important");
    el.style.setProperty("max-width", modoViewport ? "100vw" : "100%", "important");
    el.style.setProperty("width", modoViewport ? "100vw" : "100%", "important");
    el.style.setProperty("margin-left", "0", "important");
    el.style.setProperty("margin-right", "0", "important");
    el.style.setProperty("box-sizing", "border-box", "important");

    // Si la franja coincide con una reserva grande del propio shell, se retira.
    // No se eliminan paddings normales de 12/16/20 px de contenido.
    try {
      var cs = getComputedStyle(el);
      var pr = px(cs.paddingRight);
      if (pr >= 28 && pr <= 80) {
        el.style.setProperty("padding-right", "0", "important");
      }
    } catch (e) {}
  }

  function marcarFijoCompleto(el) {
    if (!el || !el.style) return;
    el.dataset.pm11MobileFixedFullWidthV3 = "1";
    el.style.setProperty("left", "0", "important");
    el.style.setProperty("right", "0", "important");
    el.style.setProperty("width", "auto", "important");
    el.style.setProperty("max-width", "none", "important");
    el.style.setProperty("margin-left", "0", "important");
    el.style.setProperty("margin-right", "0", "important");
    el.style.setProperty("box-sizing", "border-box", "important");
  }

  function shellDeMain(root, main) {
    if (!root || !main) return null;
    var p = main;
    while (p.parentElement && p.parentElement !== root) p = p.parentElement;
    return p && p.parentElement === root ? p : null;
  }

  function unicos(lista) {
    var vistos = new Set();
    return lista.filter(function (x) {
      if (!x || vistos.has(x)) return false;
      vistos.add(x);
      return true;
    });
  }

  function reparar() {
    programado = false;
    if (!esMovil()) return;

    var vw = anchoViewport();
    var root = document.getElementById("root");
    if (!root || !vw) return;

    document.documentElement.dataset.pm11MobileLayoutV3 = "1";
    [document.documentElement, document.body, root].forEach(function (el) {
      if (!el || !el.style) return;
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("max-width", "100%", "important");
      el.style.setProperty("min-width", "0", "important");
      el.style.setProperty("margin-left", "0", "important");
      el.style.setProperty("margin-right", "0", "important");
      el.style.setProperty("box-sizing", "border-box", "important");
    });
    document.documentElement.style.setProperty("overflow-x", "hidden", "important");
    document.body.style.setProperty("overflow-x", "hidden", "important");
    root.style.setProperty("overflow-x", "hidden", "important");

    var main = root.querySelector("main");
    var shell = shellDeMain(root, main);
    var candidatos = [];

    if (shell) {
      candidatos.push(shell);
      Array.from(shell.children || []).forEach(function (x) { candidatos.push(x); });
    }
    if (main) {
      candidatos.push(main);
      var p = main.parentElement;
      while (p && p !== root) {
        candidatos.push(p);
        p = p.parentElement;
      }
    }

    unicos(candidatos).forEach(function (el) {
      if (pareceReservaLateral(el, vw)) {
        marcarAnchoCompleto(el, el === shell);
      }
    });

    // Salvaguarda adicional: si el shell raíz sigue midiendo menos que el
    // viewport, forzarlo aunque la reserva no caiga exactamente en el rango.
    if (shell) {
      var ds = datosRect(shell, vw);
      if (ds && ds.left <= 10 && ds.width >= vw * 0.62 && ds.width < vw - 12) {
        marcarAnchoCompleto(shell, true);
      }
    }

    // Barras/overlays fixed que hereden el mismo ancho estrecho.
    // Solo se actúa sobre elementos grandes y con una franja derecha anómala.
    Array.from(root.querySelectorAll("*")).forEach(function (el) {
      var d = datosRect(el, vw);
      if (!d || d.width < vw * 0.62) return;
      if (!(d.left >= -3 && d.left <= 10 && d.gapRight >= MIN_GAP && d.gapRight <= MAX_GAP)) return;
      var pos;
      try { pos = getComputedStyle(el).position; } catch (e) { return; }
      if (pos === "fixed") marcarFijoCompleto(el);
    });

    // Si el DOM venía desplazado horizontalmente desde el layout anterior,
    // devolver solo el eje X al origen.
    if (document.documentElement.scrollLeft) document.documentElement.scrollLeft = 0;
    if (document.body.scrollLeft) document.body.scrollLeft = 0;
    if (window.scrollX) window.scrollTo(0, window.scrollY || 0);

    var despues = shell ? datosRect(shell, vw) : null;
    window.__pm11MobileLayoutV3 = {
      version: "pm11-mobile-layout-v3",
      viewport: vw,
      shellEncontrado: !!shell,
      shellWidth: despues ? Math.round(despues.width) : null,
      gapRight: despues ? Math.round(despues.gapRight) : null,
      aplicadoEn: new Date().toISOString()
    };
  }

  function programar() {
    if (programado) return;
    programado = true;
    requestAnimationFrame(reparar);
  }

  function iniciar() {
    var root = document.getElementById("root");
    if (!root) {
      setTimeout(iniciar, 40);
      return;
    }
    if (!observer) {
      observer = new MutationObserver(programar);
      observer.observe(root, { childList: true, subtree: true });
    }
    programar();
  }

  window.addEventListener("load", programar);
  window.addEventListener("resize", programar);
  window.addEventListener("orientationchange", programar);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", programar);

  iniciar();
})();
