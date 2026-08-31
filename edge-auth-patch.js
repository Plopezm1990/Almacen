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
    "enviar-notificacion": true
  };

  // SOLO EN ESTA RAMA DE PRUEBAS: las notificaciones del navegador se envían
  // a la versión segura aislada. Esa función valida sesión/rol/payload y tiene
  // el envío push real deshabilitado, así que no avisa a ningún dispositivo.
  var REDIRECCIONES_PRUEBA = {
    "enviar-notificacion": "enviar-notificacion-segura"
  };

  function respuestaSinSesion(mensaje) {
    return new Response(
      JSON.stringify({ ok: false, error: mensaje }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";

    if (url.indexOf(ORIGEN_FUNCTIONS) !== 0) {
      return fetchOriginal(input, init);
    }

    var nombreFuncion = url.slice(ORIGEN_FUNCTIONS.length).split(/[?#]/)[0];
    if (!PROTEGIDAS[nombreFuncion]) {
      return fetchOriginal(input, init);
    }

    try {
      if (typeof window.getSupabaseClient !== "function") {
        return respuestaSinSesion("No se pudo comprobar la sesión. Recarga la aplicación.");
      }

      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var token = resultadoSesion && resultadoSesion.data && resultadoSesion.data.session
        ? resultadoSesion.data.session.access_token
        : null;

      if (!token) {
        return respuestaSinSesion("No hay sesión activa — vuelve a iniciar sesión.");
      }

      var opciones = Object.assign({}, init || {});
      var headers = new Headers(
        opciones.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined)
      );

      // Si la propia llamada ya trae Authorization, se respeta. Esto hace que
      // el adaptador sea compatible con una futura recompilación de fuente.jsx.
      if (!headers.has("Authorization")) {
        headers.set("Authorization", "Bearer " + token);
      }

      opciones.headers = headers;

      var destino = REDIRECCIONES_PRUEBA[nombreFuncion];
      if (destino && typeof input === "string") {
        var resto = url.slice((ORIGEN_FUNCTIONS + nombreFuncion).length);
        return fetchOriginal(ORIGEN_FUNCTIONS + destino + resto, opciones);
      }

      return fetchOriginal(input, opciones);
    } catch (e) {
      return respuestaSinSesion("No se pudo comprobar la sesión. Vuelve a iniciar sesión.");
    }
  };

  // AUTOTEST TEMPORAL DE ESTA RAMA: intenta una única llamada SIN Authorization
  // a crear-cuenta-empleado. Se usa fetchOriginal para no añadir la sesión.
  // Incluso si el gateway no la bloqueara, la propia función verifica getUser()
  // antes de leer el payload o crear ninguna cuenta.
  function programarAutotestCrearCuentaSinSesion() {
    var clave = "chocoloyos_crear_cuenta_sin_sesion_autotest_v1";
    try {
      if (window.sessionStorage && window.sessionStorage.getItem(clave) === "hecho") return;
    } catch (_) {}

    setTimeout(async function () {
      try {
        await fetchOriginal(ORIGEN_FUNCTIONS + "crear-cuenta-empleado", {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify({
            empleadoId: "autotest-sin-sesion",
            nombre: "Autotest sin sesión",
            email: "autotest-sin-sesion@example.invalid",
            password: "NoCrear123!",
            rol: "Camarero/a"
          })
        });
      } catch (_) {
        // El rechazo de red/CORS tampoco debe afectar al uso normal.
      } finally {
        try {
          if (window.sessionStorage) window.sessionStorage.setItem(clave, "hecho");
        } catch (_) {}
      }
    }, 1500);
  }

  if (document.readyState === "complete") {
    programarAutotestCrearCuentaSinSesion();
  } else {
    window.addEventListener("load", programarAutotestCrearCuentaSinSesion, { once: true });
  }
})();
