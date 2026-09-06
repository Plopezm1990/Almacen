// PM11 · Personal / Empleados · P10 smoke real
// Capa de mínimo privilegio para cuentas de empleado sobre el bundle actual.
// La autorización real sigue en Supabase/RLS/RPC; esta capa evita que cachés
// locales o navegación heredada muestren información fuera del contexto.
(function () {
  "use strict";
  if (window.__pm11AccesoOperativoInstalado || !window.storage) return;
  window.__pm11AccesoOperativoInstalado = true;

  var getOriginal = window.storage.get.bind(window.storage);
  var setOriginal = window.storage.set.bind(window.storage);
  var deleteOriginal = typeof window.storage.delete === "function"
    ? window.storage.delete.bind(window.storage) : null;

  var CACHE = "la_suite_contexto_operativo_seguro_v2";
  var TTL_MS = 30000;
  var contextoCache = null;
  var contextoUserId = null;
  var contextoFecha = 0;

  var CLAVES_SCOPE = {
    empresas: true,
    locales: true,
    localActivoId: true,
    productos: true,
    movimientos: true,
    fichajes: true
  };

  function vacio(key) {
    return { key: key, value: "", shared: false };
  }

  function respuesta(key, valor) {
    return { key: key, value: JSON.stringify(valor), shared: false };
  }

  function leerJson(raw, fallback) {
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function guardarCache(userId, contexto) {
    if (!userId || !contexto || !contexto.rol) return;
    try {
      localStorage.setItem(CACHE, JSON.stringify({
        userId: userId,
        contexto: contexto,
        verificadoEn: Date.now()
      }));
    } catch (e) {}
  }

  function leerCache(userId) {
    if (!userId) return null;
    try {
      var x = JSON.parse(localStorage.getItem(CACHE) || "null");
      if (!x || x.userId !== userId || !x.contexto || !x.contexto.rol) return null;
      return x.contexto;
    } catch (e) {
      return null;
    }
  }

  async function clienteSupabase() {
    for (var i = 0; i < 120; i++) {
      if (typeof window.getSupabaseClient === "function") {
        return await window.getSupabaseClient();
      }
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    return null;
  }

  async function sesionActual(supabase) {
    if (!supabase) return null;
    try {
      var r = await supabase.auth.getSession();
      return r && r.data ? r.data.session : null;
    } catch (e) {
      return null;
    }
  }

  async function obtenerContexto(forzar) {
    var supabase = await clienteSupabase();
    var sesion = await sesionActual(supabase);
    var userId = sesion && sesion.user ? sesion.user.id : null;
    if (!userId) return null;

    var ahora = Date.now();
    if (!forzar && contextoCache && contextoUserId === userId && ahora - contextoFecha < TTL_MS) {
      return contextoCache;
    }

    try {
      var r = await supabase.rpc("obtener_contexto_operativo");
      if (!r.error && r.data && r.data.ok !== false && r.data.rol) {
        contextoCache = r.data;
        contextoUserId = userId;
        contextoFecha = ahora;
        guardarCache(userId, contextoCache);
        window.__pm11ContextoOperativo = contextoCache;
        return contextoCache;
      }
    } catch (e) {}

    var local = leerCache(userId);
    if (local) {
      contextoCache = local;
      contextoUserId = userId;
      contextoFecha = ahora;
      window.__pm11ContextoOperativo = local;
      return local;
    }

    return { __sesionSinContexto: true };
  }

  function idsLocales(contexto) {
    var mapa = Object.create(null);
    var lista = contexto && Array.isArray(contexto.locales) ? contexto.locales : [];
    lista.forEach(function (l) {
      if (l && l.id) mapa[String(l.id)] = true;
    });
    if (contexto && contexto.localId) mapa[String(contexto.localId)] = true;
    return mapa;
  }

  function localFijo(contexto) {
    if (contexto && contexto.localId) return contexto.localId;
    var lista = contexto && Array.isArray(contexto.locales) ? contexto.locales : [];
    return lista.length === 1 && lista[0] && lista[0].id ? lista[0].id : null;
  }

  function filtrarFilasPorLocal(lista, contexto) {
    if (!Array.isArray(lista)) return [];
    var permitidos = idsLocales(contexto);
    return lista.filter(function (x) {
      if (!x || typeof x !== "object") return false;
      var localId = x.localId || x.local_id || x.locationId || x.location_id;
      return !!(localId && permitidos[String(localId)]);
    });
  }

  function filtrarFichajesPropios(lista, contexto) {
    if (!Array.isArray(lista)) return [];
    var empleadoId = contexto && contexto.empleado && contexto.empleado.id
      ? String(contexto.empleado.id) : null;
    var permitidos = idsLocales(contexto);
    if (!empleadoId) return [];
    return lista.filter(function (x) {
      if (!x || String(x.empleadoId || x.empleado_id || "") !== empleadoId) return false;
      var localId = x.localId || x.local_id || x.locationId || x.location_id;
      return !localId || !!permitidos[String(localId)];
    });
  }

  async function originalFiltrado(key, shared, filtro, contexto) {
    try {
      var r = await getOriginal(key, shared);
      if (!r || !r.value) return respuesta(key, []);
      var lista = leerJson(r.value, []);
      return respuesta(key, filtro(lista, contexto));
    } catch (e) {
      return respuesta(key, []);
    }
  }

  window.storage.get = async function (key, shared) {
    if (!CLAVES_SCOPE[key]) return getOriginal(key, shared);

    var contexto = await obtenerContexto(false);
    if (!contexto) return getOriginal(key, shared); // modo local sin sesión
    if (contexto.__sesionSinContexto) return vacio(key); // sesión sin autorización verificable
    if (contexto.rol === "Propietario") return getOriginal(key, shared);

    if (key === "empresas") {
      var empresaId = contexto.empresaId;
      if (!empresaId) return respuesta(key, []);
      try {
        var re = await getOriginal(key, shared);
        var empresas = re && re.value ? leerJson(re.value, []) : [];
        var filtradas = Array.isArray(empresas)
          ? empresas.filter(function (e) { return e && String(e.id) === String(empresaId); })
          : [];
        if (!filtradas.length) filtradas = [{ id: empresaId, nombre: empresaId, activo: true }];
        return respuesta(key, filtradas);
      } catch (e) {
        return respuesta(key, [{ id: empresaId, nombre: empresaId, activo: true }]);
      }
    }

    if (key === "locales") {
      return respuesta(key, Array.isArray(contexto.locales) ? contexto.locales : []);
    }

    if (key === "localActivoId") {
      return respuesta(key, localFijo(contexto));
    }

    if (key === "productos" || key === "movimientos") {
      return originalFiltrado(key, shared, filtrarFilasPorLocal, contexto);
    }

    if (key === "fichajes") {
      if (contexto.rol === "Encargado") {
        return originalFiltrado(key, shared, filtrarFilasPorLocal, contexto);
      }
      return originalFiltrado(key, shared, filtrarFichajesPropios, contexto);
    }

    return vacio(key);
  };

  function valorLocalPermitido(value, contexto) {
    var propuesto = leerJson(value, value);
    var fijo = localFijo(contexto);
    return fijo && String(propuesto) === String(fijo);
  }

  function listaDentroScope(value, contexto, propio) {
    var lista = leerJson(value, null);
    if (!Array.isArray(lista)) return false;
    var permitidos = idsLocales(contexto);
    var empleadoId = contexto && contexto.empleado && contexto.empleado.id
      ? String(contexto.empleado.id) : null;
    return lista.every(function (x) {
      if (!x || typeof x !== "object") return false;
      if (propio && String(x.empleadoId || x.empleado_id || "") !== empleadoId) return false;
      var localId = x.localId || x.local_id || x.locationId || x.location_id;
      return !!(localId && permitidos[String(localId)]);
    });
  }

  window.storage.set = async function (key, value, shared) {
    if (!CLAVES_SCOPE[key]) return setOriginal(key, value, shared);

    var contexto = await obtenerContexto(false);
    if (!contexto) return setOriginal(key, value, shared);
    if (contexto.__sesionSinContexto) throw new Error("PM11_CONTEXT_SCOPE_UNAVAILABLE");
    if (contexto.rol === "Propietario") return setOriginal(key, value, shared);

    if (key === "localActivoId") {
      if (!valorLocalPermitido(value, contexto)) throw new Error("PM11_LOCAL_SCOPE_DENIED");
      return setOriginal(key, JSON.stringify(localFijo(contexto)), shared);
    }

    if (key === "locales" || key === "empresas") {
      return { key: key, value: value, shared: false };
    }

    if (key === "productos" || key === "movimientos") {
      if (!listaDentroScope(value, contexto, false)) throw new Error("PM11_LOCAL_SCOPE_DENIED");
      return setOriginal(key, value, shared);
    }

    if (key === "fichajes") {
      var soloPropio = contexto.rol !== "Encargado";
      if (!listaDentroScope(value, contexto, soloPropio)) throw new Error("PM11_FICHAJE_SCOPE_DENIED");
      return setOriginal(key, value, shared);
    }

    return { key: key, value: value, shared: false };
  };

  if (deleteOriginal) {
    window.storage.delete = async function (key, shared) {
      if (!CLAVES_SCOPE[key]) return deleteOriginal(key, shared);
      var contexto = await obtenerContexto(false);
      if (!contexto) return deleteOriginal(key, shared);
      if (contexto.__sesionSinContexto) return { key: key, deleted: false, shared: false };
      if (contexto.rol === "Propietario") return deleteOriginal(key, shared);
      return { key: key, deleted: false, shared: false };
    };
  }

  window.__pm11ObtenerContextoOperativo = function (forzar) {
    return obtenerContexto(!!forzar);
  };
})();

// Barrera visual del bundle actual. Para Camarero/a el contrato del smoke es
// TPV + Fichajes, sin Dashboard y sin selector a otros locales.
(function () {
  "use strict";
  if (window.__pm11BarreraVisualInstalada) return;
  window.__pm11BarreraVisualInstalada = true;

  var MASTER = "./la-suite-logo.svg";
  var contexto = null;
  var redirigiendo = false;

  function norm(v) {
    return String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function controles() {
    return Array.from(document.querySelectorAll("button,a,[role='button']"));
  }

  function controlExacto(etiquetas) {
    var wanted = etiquetas.map(norm);
    return controles().find(function (el) {
      return wanted.indexOf(norm(el.textContent)) !== -1 && getComputedStyle(el).display !== "none";
    }) || null;
  }

  function ocultarControl(etiquetas) {
    var wanted = etiquetas.map(norm);
    controles().forEach(function (el) {
      if (wanted.indexOf(norm(el.textContent)) !== -1) {
        // Una vez corregido el desbordamiento real de TopBarC, retirar el
        // control del flujo es lo correcto: no deja huecos fantasma en el
        // menú inferior y los elementos visibles se redistribuyen a todo ancho.
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("pointer-events", "none", "important");
        el.setAttribute("aria-hidden", "true");
        el.tabIndex = -1;
        el.dataset.pm11Oculto = "1";
      }
    });
  }

  function instalarEstilosLayoutMovil() {
    if (document.getElementById("pm11-layout-movil-seguro")) return;
    var style = document.createElement("style");
    style.id = "pm11-layout-movil-seguro";
    style.textContent = `
      html[data-pm11-layout-seguro="1"],
      html[data-pm11-layout-seguro="1"] body,
      html[data-pm11-layout-seguro="1"] #root {
        max-width: 100%;
        overflow-x: hidden;
      }
      [data-pm11-shell-rapido="1"] {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: hidden;
        box-sizing: border-box;
      }
      [data-pm11-main-rapido="1"],
      [data-pm11-bottomnav-rapido="1"] {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      @media (max-width: 640px) {
        [data-pm11-topbar-rapido="1"] {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          flex-wrap: wrap;
          gap: 6px;
          padding-left: 12px !important;
          padding-right: 12px !important;
          overflow: hidden;
          box-sizing: border-box;
        }
        [data-pm11-topbar-marca="1"] {
          display: none !important;
        }
        [data-pm11-topbar-controles="1"] {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          flex: 1 1 100%;
          flex-wrap: wrap;
          justify-content: flex-start;
          box-sizing: border-box;
        }
        [data-pm11-topbar-controles="1"] > :last-child {
          margin-left: auto;
          max-width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function repararLayoutMovilRapido() {
    instalarEstilosLayoutMovil();

    // TopBarC no tenía contención horizontal: SelectorDiseno, tema y el botón
    // de cuenta son nowrap/shrink-0. Con un nombre de usuario real la suma es
    // mayor que un móvil y ensancha todo el documento. Se marca la estructura
    // real del modo Rápido para contenerla sin tocar el bundle generado.
    var rapido = controlExacto(["Rápido"]);
    if (!rapido) return;
    var selector = rapido.parentElement;
    var grupoControles = selector && selector.parentElement;
    var topbar = grupoControles && grupoControles.parentElement;
    var shell = topbar && topbar.parentElement;
    if (!shell || !Array.from(shell.children).some(function (x) { return x.tagName === "MAIN"; })) return;

    document.documentElement.dataset.pm11LayoutSeguro = "1";
    shell.dataset.pm11ShellRapido = "1";
    topbar.dataset.pm11TopbarRapido = "1";
    grupoControles.dataset.pm11TopbarControles = "1";
    if (topbar.firstElementChild && topbar.firstElementChild !== grupoControles) {
      topbar.firstElementChild.dataset.pm11TopbarMarca = "1";
    }

    Array.from(shell.children).forEach(function (x) {
      if (x.tagName === "MAIN") x.dataset.pm11MainRapido = "1";
    });
    var main = Array.from(shell.children).find(function (x) { return x.tagName === "MAIN"; });
    var bottom = main && main.nextElementSibling;
    if (bottom && bottom.tagName === "DIV") bottom.dataset.pm11BottomnavRapido = "1";

    // Si el navegador conservó scroll horizontal del DOM ancho anterior,
    // devolver únicamente ese eje al origen sin alterar la posición vertical.
    if (document.documentElement.scrollLeft) document.documentElement.scrollLeft = 0;
    if (document.body.scrollLeft) document.body.scrollLeft = 0;
  }

  function repararLogoDashboard() {
    var hojas = Array.from(document.querySelectorAll("h1,h2,h3,div,span"));
    var heading = hojas.find(function (el) {
      if (el.children && el.children.length) return false;
      var t = norm(el.textContent);
      return t === "panel general" || t === "resumen general";
    });
    if (!heading) return;
    var p = heading.parentElement;
    for (var i = 0; i < 5 && p; i++, p = p.parentElement) {
      var img = p.querySelector && p.querySelector("img");
      if (img) {
        img.src = MASTER;
        img.alt = "L&A Suite";
        img.title = "L&A Suite";
        break;
      }
    }
  }

  function repararMarcasObvias() {
    Array.from(document.querySelectorAll("img")).forEach(function (img) {
      var marca = norm((img.getAttribute("alt") || "") + " " + (img.getAttribute("title") || "") + " " + (img.getAttribute("src") || ""));
      if (marca.indexOf("san gin") !== -1 || marca.indexOf("chocoloyos") !== -1) {
        img.src = MASTER;
        img.alt = "L&A Suite";
        img.title = "L&A Suite";
      }
    });
    repararLogoDashboard();
  }

  function podarSelectoresLocales(ctx) {
    if (!ctx || ctx.rol === "Propietario") return;
    var permitidos = Object.create(null);
    (Array.isArray(ctx.locales) ? ctx.locales : []).forEach(function (l) {
      if (l && l.id) permitidos[String(l.id)] = true;
    });
    document.querySelectorAll("select option").forEach(function (op) {
      var valor = String(op.value || "");
      if (/^QA-|^local/i.test(valor)) {
        op.hidden = !permitidos[valor];
        op.disabled = !permitidos[valor];
      }
    });
  }

  function estaEnDashboard() {
    var texto = norm((document.querySelector("main") || document.body).innerText || "");
    return texto.indexOf("panel general") !== -1 || texto.indexOf("resumen general") !== -1;
  }

  function aplicarCamarero(ctx) {
    document.documentElement.dataset.pm11Rol = "camarero";
    ocultarControl(["Inicio", "Hoy", "Panel general", "Resumen general"]);
    podarSelectoresLocales(ctx);

    if (estaEnDashboard() && !redirigiendo) {
      var destino = controlExacto(["TPV"] ) || controlExacto(["Fichajes"]);
      if (destino) {
        redirigiendo = true;
        destino.click();
        setTimeout(function () { redirigiendo = false; }, 500);
      }
    }
  }

  async function refrescarContexto() {
    if (typeof window.__pm11ObtenerContextoOperativo !== "function") return;
    try {
      var c = await window.__pm11ObtenerContextoOperativo(false);
      if (c && !c.__sesionSinContexto && c.rol) contexto = c;
    } catch (e) {}
  }

  function aplicar() {
    repararLayoutMovilRapido();
    repararMarcasObvias();
    if (contexto && contexto.rol === "Camarero/a") aplicarCamarero(contexto);
  }

  var programado = false;
  function programar() {
    if (programado) return;
    programado = true;
    requestAnimationFrame(function () {
      programado = false;
      aplicar();
    });
  }

  var mo = new MutationObserver(programar);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", programar);
  window.addEventListener("focus", function () {
    refrescarContexto().then(programar);
  });

  refrescarContexto().then(programar);
  setInterval(function () {
    refrescarContexto().then(programar);
  }, 30000);
})();