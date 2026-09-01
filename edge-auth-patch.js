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
      return fetchOriginal(input, opciones);
    } catch (e) {
      return respuestaSinSesion("No se pudo comprobar la sesión. Vuelve a iniciar sesión.");
    }
  };

  // AUTOTEST TEMPORAL SOLO EN ESTA RAMA.
  // Llama al endpoint definitivo enviar-notificacion con la sesión real del
  // usuario, pero el servidor mantiene ENVIO_REAL_HABILITADO=false, por lo que
  // no lee suscripciones ni envía ningún push.
  async function probarEndpointDefinitivoNotificacion() {
    var clave = "chocoloyos_notificacion_definitiva_simulacion_v1";
    try {
      if (window.sessionStorage && window.sessionStorage.getItem(clave) === "hecho") return true;
    } catch (_) {}

    if (typeof window.getSupabaseClient !== "function") return false;

    try {
      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var sesion = resultadoSesion && resultadoSesion.data ? resultadoSesion.data.session : null;
      if (!sesion || !sesion.access_token) return false;

      var respuesta = await fetchOriginal(ORIGEN_FUNCTIONS + "enviar-notificacion", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + sesion.access_token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          titulo: "Error en el programa",
          cuerpo: "Prueba segura del endpoint definitivo de notificaciones.",
          url: "/"
        })
      });

      var datos = {};
      try { datos = await respuesta.json(); } catch (_) {}

      try {
        if (window.sessionStorage) window.sessionStorage.setItem(clave, "hecho");
      } catch (_) {}

      if (respuesta.status === 200 && datos && datos.ok === true && datos.simulacion === true && datos.enviado === false) {
        window.alert("PRUEBA SEGURA OK: endpoint definitivo validado en simulación. No se envió ninguna notificación.");
      } else {
        window.alert("PRUEBA SEGURA: respuesta inesperada del endpoint definitivo (HTTP " + respuesta.status + ").");
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  var intentosAutotest = 0;
  var temporizadorAutotest = window.setInterval(async function () {
    intentosAutotest++;
    var terminado = await probarEndpointDefinitivoNotificacion();
    if (terminado || intentosAutotest >= 60) {
      window.clearInterval(temporizadorAutotest);
    }
  }, 1000);
})();
