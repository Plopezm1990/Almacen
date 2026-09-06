// PM11 · P10 · Runtime de alcance v3
// Corrige dos fallos observados en el smoke móvil real del 06/09/2026:
// 1) una sesión de Camarero/a podía autenticarse después de que React ya hubiera
//    hidratado el estado global del modo anónimo/propietario;
// 2) el selector podía seguir en "Todos los locales" y Dashboard podía quedar
//    visible aunque el contexto autoritativo ya fuera Camarero/a.
//
// Esta capa NO concede permisos. El contexto se obtiene exclusivamente de la
// RPC autoritativa instalada por pm11-access-patch.js. Producción/main no se toca.
(function () {
  "use strict";
  if (window.__pm11RuntimeScopeV3Installed || !window.storage) return;
  window.__pm11RuntimeScopeV3Installed = true;

  var getAnterior = window.storage.get.bind(window.storage);
  var setAnterior = window.storage.set.bind(window.storage);
  var deleteAnterior = typeof window.storage.delete === "function"
    ? window.storage.delete.bind(window.storage) : null;
  var RELOAD_PREFIX = "la_suite_pm11_scope_rehidratado_v3:";
  var contexto = null;
  var redirigiendo = false;
  var programado = false;
  var authSuscrito = false;

  function norm(v) {
    return String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function respuesta(key, valor) {
    return { key: key, value: JSON.stringify(valor), shared: false };
  }

  function leerJson(raw, fallback) {
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function localFijo(ctx) {
    if (ctx && ctx.localId) return String(ctx.localId);
    var lista = ctx && Array.isArray(ctx.locales) ? ctx.locales : [];
    return lista.length === 1 && lista[0] && lista[0].id ? String(lista[0].id) : null;
  }

  function idsLocales(ctx) {
    var mapa = Object.create(null);
    (ctx && Array.isArray(ctx.locales) ? ctx.locales : []).forEach(function (l) {
      if (l && l.id) mapa[String(l.id)] = true;
    });
    var fijo = localFijo(ctx);
    if (fijo) mapa[fijo] = true;
    return mapa;
  }

  function empleadosPermitidos(ctx) {
    if (!ctx) return [];
    if (Array.isArray(ctx.empleadosFichaje) && ctx.empleadosFichaje.length) {
      return ctx.empleadosFichaje;
    }
    return ctx.empleado ? [ctx.empleado] : [];
  }

  async function obtenerContexto(forzar) {
    if (typeof window.__pm11ObtenerContextoOperativo !== "function") return null;
    try {
      var c = await window.__pm11ObtenerContextoOperativo(!!forzar);
      if (c && !c.__sesionSinContexto && c.rol) {
        contexto = c;
        window.__pm11RuntimeScopeV3Contexto = c;
        return c;
      }
      return c || null;
    } catch (e) {
      return { __sesionSinContexto: true };
    }
  }

  // Empleados era la colección crítica que faltaba en la primera barrera.
  // Camarero/a recibe exclusivamente la identidad de fichaje devuelta por la
  // RPC. Encargado queda limitado a sus locales autorizados.
  window.storage.get = async function (key, shared) {
    if (key !== "empleados") return getAnterior(key, shared);

    var ctx = await obtenerContexto(false);
    if (!ctx) return getAnterior(key, shared); // sin sesión: comportamiento local histórico
    if (ctx.__sesionSinContexto) return respuesta(key, []);
    if (ctx.rol === "Propietario") return getAnterior(key, shared);
    if (ctx.rol === "Camarero/a") return respuesta(key, empleadosPermitidos(ctx));

    try {
      var r = await getAnterior(key, shared);
      var lista = r && r.value ? leerJson(r.value, []) : [];
      var permitidos = idsLocales(ctx);
      var filtrada = Array.isArray(lista) ? lista.filter(function (e) {
        if (!e || typeof e !== "object") return false;
        var lid = e.localId || e.local_id;
        return !!(lid && permitidos[String(lid)]);
      }) : [];
      return respuesta(key, filtrada);
    } catch (e) {
      return respuesta(key, []);
    }
  };

  window.storage.set = async function (key, value, shared) {
    if (key !== "empleados") return setAnterior(key, value, shared);
    var ctx = await obtenerContexto(false);
    if (!ctx) return setAnterior(key, value, shared);
    if (ctx.__sesionSinContexto) throw new Error("PM11_CONTEXT_SCOPE_UNAVAILABLE");
    if (ctx.rol === "Propietario") return setAnterior(key, value, shared);
    // Un empleado operativo nunca puede sustituir desde el cliente la colección
    // maestra de Personal. Las mutaciones autorizadas siguen sus RPC/RLS.
    return { key: key, value: value, shared: false };
  };

  if (deleteAnterior) {
    window.storage.delete = async function (key, shared) {
      if (key !== "empleados") return deleteAnterior(key, shared);
      var ctx = await obtenerContexto(false);
      if (!ctx) return deleteAnterior(key, shared);
      if (ctx.__sesionSinContexto || ctx.rol !== "Propietario") {
        return { key: key, deleted: false, shared: false };
      }
      return deleteAnterior(key, shared);
    };
  }

  function limpiarMarcasRehidratacion() {
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(RELOAD_PREFIX) === 0) sessionStorage.removeItem(k);
      }
    } catch (e) {}
  }

  function rehidratarUnaVez(userId, ctx) {
    if (!userId || !ctx || ctx.rol === "Propietario") return false;
    var key = RELOAD_PREFIX + userId;
    try {
      if (sessionStorage.getItem(key) === "1") return false;
      sessionStorage.setItem(key, "1");
      window.__pm11RuntimeScopeV3Reload = "post-login";
      setTimeout(function () { window.location.reload(); }, 30);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function clienteSupabase() {
    for (var i = 0; i < 160; i++) {
      if (typeof window.getSupabaseClient === "function") {
        try { return await window.getSupabaseClient(); } catch (e) { return null; }
      }
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    return null;
  }

  async function procesarSesion(session, forzar) {
    var userId = session && session.user ? session.user.id : null;
    if (!userId) {
      contexto = null;
      limpiarMarcasRehidratacion();
      programar();
      return;
    }
    var ctx = await obtenerContexto(!!forzar);
    if (!ctx || ctx.__sesionSinContexto || !ctx.rol) {
      programar();
      return;
    }
    if (rehidratarUnaVez(userId, ctx)) return;
    programar();
  }

  async function instalarAuthWatch() {
    if (authSuscrito) return;
    var supabase = await clienteSupabase();
    if (!supabase || !supabase.auth) return;
    authSuscrito = true;

    try {
      var r = await supabase.auth.getSession();
      await procesarSesion(r && r.data ? r.data.session : null, true);
    } catch (e) {}

    try {
      supabase.auth.onAuthStateChange(function (event, session) {
        if (event === "SIGNED_OUT") limpiarMarcasRehidratacion();
        setTimeout(function () {
          procesarSesion(session, event === "SIGNED_IN" || event === "TOKEN_REFRESHED");
        }, 0);
      });
    } catch (e) {}
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

  function selectorEsDeLocales(sel, fijo) {
    var opciones = Array.from(sel.options || []);
    return opciones.some(function (op) {
      return norm(op.textContent) === "todos los locales" ||
        (fijo && String(op.value || "") === String(fijo));
    });
  }

  function fijarSelectoresLocales(ctx) {
    if (!ctx || ctx.rol === "Propietario") return;
    var fijo = localFijo(ctx);
    if (!fijo) return;
    var permitidos = idsLocales(ctx);

    document.querySelectorAll("select").forEach(function (sel) {
      if (!selectorEsDeLocales(sel, fijo)) return;
      var opciones = Array.from(sel.options || []);
      var existeFijo = false;

      opciones.forEach(function (op) {
        var valor = String(op.value || "");
        var esTodos = norm(op.textContent) === "todos los locales" || valor === "";
        if (valor === fijo) existeFijo = true;
        if (esTodos || (valor && !permitidos[valor])) {
          op.hidden = true;
          op.disabled = true;
        } else if (permitidos[valor]) {
          op.hidden = false;
          op.disabled = false;
        }
      });

      if (existeFijo && String(sel.value || "") !== fijo) {
        sel.value = fijo;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        sel.dataset.pm11LocalFijadoV3 = fijo;
      }
    });
  }

  function estaEnDashboard() {
    var main = document.querySelector("main") || document.body;
    var texto = norm(main.innerText || "");
    return texto.indexOf("panel general") !== -1 || texto.indexOf("resumen general") !== -1;
  }

  function irAModuloPermitido() {
    if (redirigiendo) return;
    var destino = controlExacto(["TPV", "Fichajes", "Registro horario"]);
    if (destino) {
      redirigiendo = true;
      destino.click();
      setTimeout(function () { redirigiendo = false; }, 700);
      return;
    }

    var mas = controlExacto(["Más"]);
    if (!mas) return;
    redirigiendo = true;
    mas.click();
    setTimeout(function () {
      var dentro = controlExacto(["TPV"]) || controlExacto(["Registro horario", "Fichajes"]);
      if (dentro) dentro.click();
      setTimeout(function () { redirigiendo = false; }, 650);
    }, 80);
  }

  function ocultarTodosLocalesResidual() {
    document.querySelectorAll("select option").forEach(function (op) {
      if (norm(op.textContent) === "todos los locales") {
        op.hidden = true;
        op.disabled = true;
      }
    });
  }

  function aplicar() {
    if (!contexto || contexto.__sesionSinContexto || contexto.rol === "Propietario") return;
    fijarSelectoresLocales(contexto);
    ocultarTodosLocalesResidual();

    if (contexto.rol === "Camarero/a" && estaEnDashboard()) {
      irAModuloPermitido();
    }

    window.__pm11RuntimeScopeV3Estado = {
      rol: contexto.rol,
      localFijo: localFijo(contexto),
      dashboard: estaEnDashboard(),
      aplicado: true
    };
  }

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
    obtenerContexto(true).then(programar);
  });

  instalarAuthWatch();
  setInterval(function () {
    obtenerContexto(false).then(programar);
  }, 10000);
})();
