(function () {
  "use strict";
  if (window.__laUiContextBridgeV1 || !window.storage) return;
  window.__laUiContextBridgeV1 = true;

  var getAnterior = window.storage.get.bind(window.storage);
  var setAnterior = window.storage.set.bind(window.storage);
  var deleteAnterior = typeof window.storage.delete === "function"
    ? window.storage.delete.bind(window.storage) : null;

  var CLAVES_CONTEXTO = {
    empresas: true,
    locales: true,
    localActivoId: true
  };

  function claveLocal(key) {
    return "almacen:" + key;
  }

  async function esperarBarrera() {
    for (var i = 0; i < 400; i++) {
      if (window.__instalacionSyncPermitida === true) return true;
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    return false;
  }

  function respuesta(key, value) {
    return { key: key, value: value || "", shared: false };
  }

  function leerLocal(key) {
    try { return localStorage.getItem(claveLocal(key)) || ""; }
    catch (e) { return ""; }
  }

  function guardarLocal(key, value) {
    localStorage.setItem(claveLocal(key), value);
    return { key: key, value: value, shared: false };
  }

  async function clienteConSesion() {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("Cliente Supabase no disponible");
    }
    var supabase = await window.getSupabaseClient();
    var rSesion = await supabase.auth.getSession();
    var sesion = rSesion && rSesion.data ? rSesion.data.session : null;
    if (!sesion || !sesion.user || !sesion.user.id) {
      throw new Error("Sesión requerida para guardar empresa/local");
    }
    return { supabase: supabase, sesion: sesion };
  }

  function generacionLocal() {
    try { return localStorage.getItem("la_suite_installation_generation_v1") || ""; }
    catch (e) { return ""; }
  }

  window.storage.get = async function (key, shared) {
    if (key === "pinPropietario") {
      await esperarBarrera();
      return respuesta(key, leerLocal(key));
    }

    if (CLAVES_CONTEXTO[key]) {
      await esperarBarrera();
      return respuesta(key, leerLocal(key));
    }

    return getAnterior(key, shared);
  };

  window.storage.set = async function (key, value, shared) {
    if (key === "pinPropietario") {
      if (!(await esperarBarrera())) throw new Error("Instalación no validada");
      // El propio texto de la UI define este PIN como código local del
      // dispositivo; no se crea un bloque global en almacen_kv.
      return guardarLocal(key, value);
    }

    if (CLAVES_CONTEXTO[key]) {
      if (!(await esperarBarrera())) throw new Error("Instalación no validada");
      var actual = await clienteConSesion();
      var parsed;
      try { parsed = JSON.parse(value); }
      catch (e) { throw new Error("Contexto empresa/local inválido"); }

      var r = await actual.supabase.rpc("guardar_contexto_instalacion_ui", {
        p_clave: key,
        p_valor: parsed
      });
      if (r.error) throw r.error;
      if (!r.data || r.data.state !== "ready" || r.data.generation !== generacionLocal()) {
        throw new Error("El servidor no confirmó el contexto empresa/local");
      }

      if (key === "localActivoId") {
        // La RPC valida que el local elegido pertenece al Propietario. La
        // selección concreta es preferencia de este dispositivo.
        return guardarLocal(key, value);
      }

      if (typeof window.__laOwnerBootstrapSeedUiContext !== "function") {
        throw new Error("Semilla segura del contexto UI no disponible");
      }
      window.__laOwnerBootstrapSeedUiContext(r.data, actual.sesion.user.id);
      return respuesta(key, leerLocal(key));
    }

    return setAnterior(key, value, shared);
  };

  if (deleteAnterior) {
    window.storage.delete = async function (key, shared) {
      if (key === "pinPropietario") {
        if (!(await esperarBarrera())) throw new Error("Instalación no validada");
        localStorage.removeItem(claveLocal(key));
        return { key: key, shared: false };
      }
      // Las colecciones empresa/local nunca se borran como bloques globales.
      // Sus operaciones funcionales pasan por guardar_contexto_instalacion_ui.
      if (CLAVES_CONTEXTO[key]) {
        throw new Error("Borrado directo de contexto empresa/local no permitido");
      }
      return deleteAnterior(key, shared);
    };
  }
})();

// PM27: Chrome móvil puede desplazar horizontalmente el documento cuando
// un modal React situado dentro del menú horizontal recibe focus(). El modal
// de cierre de sesión está dentro de ese menú; al abrirlo el dashboard queda
// desplazado y aparece una franja vacía a la derecha. Este hotfix se limita a
// diálogos modales en pantallas móviles: evita el scroll producido por focus,
// bloquea el overflow-x mientras exista el diálogo y restaura el estado al
// cerrarlo. No cambia Auth, logout ni datos de negocio.
(function () {
  "use strict";
  if (window.__laMobileDialogFocusFixV1) return;
  if (typeof HTMLElement === "undefined" || !HTMLElement.prototype) return;
  window.__laMobileDialogFocusFixV1 = true;

  var focusNativo = HTMLElement.prototype.focus;
  if (typeof focusNativo !== "function") return;

  var bloqueoActivo = false;
  var overflowHtmlAnterior = "";
  var overflowBodyAnterior = "";

  function esMovil() {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 767px)").matches;
    }
    return typeof window.innerWidth === "number" ? window.innerWidth < 768 : false;
  }

  function esDialogoModal(el) {
    return !!(el && typeof el.getAttribute === "function" &&
      el.getAttribute("role") === "dialog" &&
      el.getAttribute("aria-modal") === "true");
  }

  function xActual() {
    return Number(window.scrollX || window.pageXOffset || 0);
  }

  function yActual() {
    return Number(window.scrollY || window.pageYOffset || 0);
  }

  function corregirScrollHorizontal(y) {
    if (xActual() === 0) return;
    try {
      window.scrollTo({ left: 0, top: y, behavior: "instant" });
    } catch (e) {
      window.scrollTo(0, y);
    }
  }

  HTMLElement.prototype.focus = function () {
    if (!esMovil() || !esDialogoModal(this)) {
      return focusNativo.apply(this, arguments);
    }

    var y = yActual();
    var opciones = {};
    if (arguments[0] && typeof arguments[0] === "object") {
      for (var k in arguments[0]) opciones[k] = arguments[0][k];
    }
    opciones.preventScroll = true;

    try {
      focusNativo.call(this, opciones);
    } catch (e) {
      focusNativo.call(this);
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(function () { corregirScrollHorizontal(y); });
    } else {
      setTimeout(function () { corregirScrollHorizontal(y); }, 0);
    }
  };

  function bloquearOverflow() {
    if (bloqueoActivo || !document.documentElement || !document.body) return;
    overflowHtmlAnterior = document.documentElement.style.overflowX || "";
    overflowBodyAnterior = document.body.style.overflowX || "";
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    bloqueoActivo = true;
  }

  function restaurarOverflow() {
    if (!bloqueoActivo || !document.documentElement || !document.body) return;
    document.documentElement.style.overflowX = overflowHtmlAnterior;
    document.body.style.overflowX = overflowBodyAnterior;
    bloqueoActivo = false;
  }

  function sincronizarBloqueo() {
    var hayDialogo = esMovil() && document.querySelector &&
      document.querySelector('[role="dialog"][aria-modal="true"]');
    if (hayDialogo) {
      bloquearOverflow();
      corregirScrollHorizontal(yActual());
    } else {
      restaurarOverflow();
    }
  }

  if (document.body && typeof MutationObserver === "function") {
    var observer = new MutationObserver(sincronizarBloqueo);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("resize", sincronizarBloqueo);
  }

  window.__laMobileDialogFocusFixApiV1 = {
    sync: sincronizarBloqueo,
    restore: restaurarOverflow
  };
})();
