// PM11 · P10 · Guard de sesión autoritativo v4
//
// Hallazgo smoke real 06/09/2026:
// tras dar de baja a un empleado vinculado, Supabase Auth puede seguir aceptando
// sus credenciales (esto es deliberado en P08), pero la aplicación NO puede
// conservar una sesión operativa ni reutilizar contexto cacheado anterior.
//
// Este guard llama SIEMPRE al RPC autoritativo obtener_contexto_operativo()
// para validar una sesión autenticada. No confía en localStorage, querystring,
// rol local ni en el cache del patch de compatibilidad. Si el servidor no
// devuelve un contexto operativo válido, falla cerrado: tapa la UI, limpia el
// cache de contexto, cierra la sesión local y recarga al acceso.
(function () {
  "use strict";

  if (window.__pm11SessionGuardV4Installed) return;
  window.__pm11SessionGuardV4Installed = true;

  var CACHE_LEGACY = "la_suite_contexto_operativo_seguro_v2";
  var BLOQUEO_ID = "pm11-session-guard-v4-bloqueo";
  var STYLE_ID = "pm11-session-guard-v4-style";
  var validando = false;
  var bloqueando = false;
  var supabaseRef = null;
  var ultimaSesionUserId = null;
  var ultimoContexto = null;
  var ultimaVerificacion = 0;
  var TTL_LOCAL_MS = 4000;

  function instalarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html[data-pm11-session-validando="1"] #root {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      #${BLOQUEO_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: #f7f2e7;
        color: #18251d;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${BLOQUEO_ID} > div {
        width: min(460px, 100%);
        background: white;
        border: 1px solid #ddd3bd;
        border-radius: 22px;
        padding: 26px;
        box-sizing: border-box;
        box-shadow: 0 14px 40px rgba(0,0,0,.12);
      }
      #${BLOQUEO_ID} strong {
        display: block;
        font-size: 20px;
        margin-bottom: 8px;
      }
      #${BLOQUEO_ID} p {
        margin: 0;
        font-size: 15px;
        line-height: 1.5;
        color: #5f6b63;
      }
    `;
    document.head.appendChild(style);
  }

  function marcarValidando(si) {
    if (si) document.documentElement.dataset.pm11SessionValidando = "1";
    else delete document.documentElement.dataset.pm11SessionValidando;
  }

  function limpiarCacheContexto() {
    ultimoContexto = null;
    ultimaVerificacion = 0;
    window.__pm11ContextoOperativo = null;
    window.__pm11RuntimeScopeV3Contexto = null;
    try { localStorage.removeItem(CACHE_LEGACY); } catch (e) {}
  }

  function mostrarBloqueo() {
    instalarEstilo();
    var existente = document.getElementById(BLOQUEO_ID);
    if (existente) return existente;
    var overlay = document.createElement("div");
    overlay.id = BLOQUEO_ID;
    overlay.setAttribute("role", "alert");
    overlay.innerHTML = '<div><strong>Acceso suspendido</strong><p>Esta cuenta ya no tiene un contexto operativo activo. Se cerrará la sesión de forma segura.</p></div>';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function ocultarBloqueo() {
    var el = document.getElementById(BLOQUEO_ID);
    if (el) el.remove();
  }

  async function clienteSupabase() {
    if (supabaseRef) return supabaseRef;
    for (var i = 0; i < 200; i++) {
      if (typeof window.getSupabaseClient === "function") {
        try {
          supabaseRef = await window.getSupabaseClient();
          return supabaseRef;
        } catch (e) {
          return null;
        }
      }
      await new Promise(function (resolve) { setTimeout(resolve, 20); });
    }
    return null;
  }

  async function sesionActual(supabase) {
    if (!supabase || !supabase.auth) return null;
    try {
      var r = await supabase.auth.getSession();
      return r && r.data ? r.data.session : null;
    } catch (e) {
      return null;
    }
  }

  function contextoValido(data) {
    return !!(data && data.ok !== false && data.rol);
  }

  async function rpcContextoDirecto(supabase) {
    try {
      var r = await supabase.rpc("obtener_contexto_operativo");
      if (!r || r.error || !contextoValido(r.data)) {
        return { ok: false, error: r && r.error ? r.error : null };
      }
      return { ok: true, data: r.data };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  async function cerrarSesionNoOperativa(supabase, motivo) {
    if (bloqueando) return;
    bloqueando = true;
    marcarValidando(false);
    limpiarCacheContexto();
    mostrarBloqueo();
    window.__pm11SessionGuardV4Estado = {
      autorizado: false,
      bloqueado: true,
      motivo: motivo || "contexto_no_operativo",
      verificadoEn: new Date().toISOString()
    };

    try { sessionStorage.setItem("la_suite_pm11_acceso_suspendido_v4", "1"); } catch (e) {}

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      try { await supabase.auth.signOut(); } catch (e2) {}
    }

    // La recarga elimina cualquier estado React ya hidratado y vuelve al login.
    setTimeout(function () { window.location.reload(); }, 120);
  }

  async function validarSesion(forzar) {
    if (validando || bloqueando) return ultimoContexto;
    validando = true;
    instalarEstilo();

    try {
      var supabase = await clienteSupabase();
      if (!supabase) {
        marcarValidando(false);
        return null;
      }

      var session = await sesionActual(supabase);
      var userId = session && session.user ? session.user.id : null;

      if (!userId) {
        ultimaSesionUserId = null;
        limpiarCacheContexto();
        ocultarBloqueo();
        marcarValidando(false);
        window.__pm11SessionGuardV4Estado = { autorizado: false, sinSesion: true };
        return null;
      }

      marcarValidando(true);

      var ahora = Date.now();
      if (!forzar && ultimoContexto && ultimaSesionUserId === userId && ahora - ultimaVerificacion < TTL_LOCAL_MS) {
        marcarValidando(false);
        return ultimoContexto;
      }

      // IMPORTANTE: validación directa al servidor; no usar el contexto cacheado
      // de pm11-access-patch.js para decidir si una cuenta sigue operativa.
      var verificacion = await rpcContextoDirecto(supabase);
      if (!verificacion.ok) {
        await cerrarSesionNoOperativa(supabase, "rpc_contexto_rechazado");
        return null;
      }

      ultimaSesionUserId = userId;
      ultimoContexto = verificacion.data;
      ultimaVerificacion = ahora;
      window.__pm11SessionGuardV4Contexto = ultimoContexto;
      window.__pm11SessionGuardV4Estado = {
        autorizado: true,
        rol: ultimoContexto.rol,
        localId: ultimoContexto.localId || null,
        verificadoEn: new Date().toISOString()
      };
      ocultarBloqueo();
      marcarValidando(false);
      return ultimoContexto;
    } finally {
      validando = false;
    }
  }

  // Sustituye únicamente la puerta pública de consulta que consumen las capas
  // posteriores. El storage patch original conserva su compatibilidad interna,
  // pero ninguna decisión de sesión depende ya de su cache persistente.
  window.__pm11ObtenerContextoOperativoSeguroV4 = function (forzar) {
    return validarSesion(!!forzar);
  };

  // Una vez instalado el guard, Runtime v3 debe recibir el contexto validado
  // directamente por servidor, no el fallback cacheado de la capa antigua.
  window.__pm11ObtenerContextoOperativo = function (forzar) {
    return validarSesion(!!forzar);
  };

  async function instalarAuthWatch() {
    var supabase = await clienteSupabase();
    if (!supabase || !supabase.auth) {
      marcarValidando(false);
      return;
    }

    try {
      supabase.auth.onAuthStateChange(function (event, session) {
        if (event === "SIGNED_OUT") {
          ultimaSesionUserId = null;
          limpiarCacheContexto();
          ocultarBloqueo();
          marcarValidando(false);
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || (session && session.user)) {
          setTimeout(function () { validarSesion(true); }, 0);
        }
      });
    } catch (e) {}
  }

  instalarEstilo();
  marcarValidando(true);
  instalarAuthWatch();
  validarSesion(true).then(function () {
    if (!bloqueando) marcarValidando(false);
  });

  window.addEventListener("focus", function () { validarSesion(true); });
  window.addEventListener("pageshow", function () { validarSesion(true); });

  // Revalidación frecuente: una baja realizada desde otra sesión debe suspender
  // la cuenta abierta sin esperar a que expire un cache de 30 segundos.
  setInterval(function () { validarSesion(true); }, 5000);
})();
