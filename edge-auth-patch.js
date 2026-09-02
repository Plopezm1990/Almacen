// Compatibilidad de seguridad para el bundle desplegado de Chocoloyos Almacén.
//
// El bundle actual hace algunas llamadas directas con fetch() a Edge Functions.
// Para poder exigir sesión dentro de esas funciones sin recompilar el bundle
// completo, este pequeño adaptador añade el access_token del usuario solamente
// a los endpoints protegidos. La autorización REAL se valida siempre de nuevo
// dentro de cada Edge Function; este archivo solo transporta el token.
(function () {
  "use strict";

  var fetchOriginal = window.fetch.bind(window);
  var ORIGEN_FUNCTIONS = "https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/";
  var PROTEGIDAS = {
    "importar-albaran": true,
    "importar-nomina": true,
    "enviar-notificacion": true,
    "entrevista-personal": true
  };

  function respuestaSinSesion(mensaje) {
    return new Response(
      JSON.stringify({ ok: false, error: mensaje }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.indexOf(ORIGEN_FUNCTIONS) !== 0) return fetchOriginal(input, init);

    var nombreFuncion = url.slice(ORIGEN_FUNCTIONS.length).split(/[?#]/)[0];
    if (!PROTEGIDAS[nombreFuncion]) return fetchOriginal(input, init);

    try {
      if (typeof window.getSupabaseClient !== "function") {
        return respuestaSinSesion("No se pudo comprobar la sesión. Recarga la aplicación.");
      }

      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var token = resultadoSesion && resultadoSesion.data && resultadoSesion.data.session
        ? resultadoSesion.data.session.access_token : null;

      if (!token) return respuestaSinSesion("No hay sesión activa — vuelve a iniciar sesión.");

      var opciones = Object.assign({}, init || {});
      var headers = new Headers(
        opciones.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined)
      );
      if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + token);
      opciones.headers = headers;

      return fetchOriginal(input, opciones);
    } catch (e) {
      return respuestaSinSesion("No se pudo comprobar la sesión. Vuelve a iniciar sesión.");
    }
  };
})();

// Contexto operativo mínimo por rol.
// Evita cargar en el navegador blobs completos de Personal, proveedores,
// fichas de coste o encargos cuando el puesto solo necesita un resumen.
(function () {
  "use strict";
  if (window.__contextoRolSeguroInstalado || !window.storage) return;
  window.__contextoRolSeguroInstalado = true;

  var getOriginal = window.storage.get.bind(window.storage);
  var setOriginal = window.storage.set.bind(window.storage);
  var contextoCache = null;
  var contextoFecha = 0;
  var CONTEXTO_TTL_MS = 30000;

  async function clienteSupabase() {
    for (var i = 0; i < 40; i++) {
      if (typeof window.getSupabaseClient === "function") return window.getSupabaseClient();
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    throw new Error("Cliente Supabase no disponible");
  }

  async function obtenerContexto(forzar) {
    if (!window.__nubeActiva) return null;
    var ahora = Date.now();
    if (!forzar && contextoCache && ahora - contextoFecha < CONTEXTO_TTL_MS) return contextoCache;
    var supabase = await clienteSupabase();
    var respuesta = await supabase.rpc("obtener_contexto_operativo");
    if (respuesta.error) throw respuesta.error;
    contextoCache = respuesta.data || null;
    contextoFecha = ahora;
    return contextoCache;
  }

  function respuestaStorage(key, valor) {
    return { key: key, value: JSON.stringify(valor), shared: false };
  }

  function encargosSoloCaja(cobros) {
    if (!Array.isArray(cobros) || cobros.length === 0) return [];
    return [{ id: "contexto-caja", cobros: cobros }];
  }

  window.storage.get = async function (key, shared) {
    if (!window.__nubeActiva) return getOriginal(key, shared);
    var sensible = key === "empleados" || key === "proveedores" || key === "fichasCosto" || key === "encargos";
    if (!sensible) return getOriginal(key, shared);

    try {
      var contexto = await obtenerContexto(false);
      var rol = contexto && contexto.rol;

      if (key === "empleados" && rol && rol !== "Propietario") {
        return respuestaStorage(key, Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : []);
      }
      if (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) {
        return respuestaStorage(key, Array.isArray(contexto.proveedores) ? contexto.proveedores : []);
      }
      if (key === "fichasCosto" && rol === "Churrero/a") {
        return respuestaStorage(key, Array.isArray(contexto.fichasProduccion) ? contexto.fichasProduccion : []);
      }
      if (key === "encargos" && rol === "Cajero/a") {
        return respuestaStorage(key, encargosSoloCaja(contexto.cobrosEncargos));
      }
    } catch (e) {
      return respuestaStorage(key, []);
    }

    return getOriginal(key, shared);
  };

  window.storage.set = async function (key, value, shared) {
    if (window.__nubeActiva) {
      try {
        var contexto = await obtenerContexto(false);
        var rol = contexto && contexto.rol;
        var soloLectura =
          (key === "empleados" && rol && rol !== "Propietario") ||
          (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) ||
          (key === "fichasCosto" && rol === "Churrero/a") ||
          (key === "encargos" && rol === "Cajero/a");
        if (soloLectura) return { key: key, value: value, shared: false };
      } catch (e) {}
    }
    return setOriginal(key, value, shared);
  };

  window.__recargarContextoOperativo = function () {
    contextoCache = null;
    contextoFecha = 0;
    return obtenerContexto(true);
  };
})();

(function () {
  "use strict";
  if (window.__guardPerfilActivoInstalado) return;
  window.__guardPerfilActivoInstalado = true;
  var bloqueando = false;

  async function comprobarPerfilActivo() {
    if (bloqueando || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      var supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user
        ? sesion.data.session.user.id : null;
      if (!userId) return;
      var perfil = await supabase.from("perfiles").select("activo").eq("user_id", userId).maybeSingle();
      if (perfil.error) return;
      if (!perfil.data || perfil.data.activo !== true) {
        bloqueando = true;
        try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
        window.location.reload();
      }
    } catch (e) {}
  }

  window.setInterval(comprobarPerfilActivo, 30000);
  window.addEventListener("focus", comprobarPerfilActivo);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") comprobarPerfilActivo();
  });
  setTimeout(comprobarPerfilActivo, 1000);
})();

(function () {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();
