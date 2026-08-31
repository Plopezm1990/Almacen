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

  // AUTOTEST TEMPORAL DE ESTA RAMA.
  // Comprueba que un Propietario autenticado NO pueda crear otro Propietario.
  // La contraseña deliberadamente tiene menos de 6 caracteres: incluso si la
  // validación del rol fallara, la función debe detenerse antes de createUser().
  async function probarBloqueoNuevoPropietario() {
    var clave = "chocoloyos_bloqueo_nuevo_propietario_v1";
    try {
      if (window.sessionStorage && window.sessionStorage.getItem(clave) === "hecho") return true;
    } catch (_) {}

    if (typeof window.getSupabaseClient !== "function") return false;

    try {
      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var sesion = resultadoSesion && resultadoSesion.data ? resultadoSesion.data.session : null;
      if (!sesion) return false;

      var resultado = await supabase.functions.invoke("crear-cuenta-empleado", {
        body: {
          empleadoId: "autotest-propietario-bloqueado",
          nombre: "Autotest Propietario Bloqueado",
          email: "autotest-propietario-bloqueado@example.invalid",
          password: "x",
          rol: "Propietario"
        }
      });

      var mensaje = "";
      if (resultado && resultado.data && typeof resultado.data.error === "string") {
        mensaje = resultado.data.error;
      } else if (resultado && resultado.error && resultado.error.context) {
        try {
          var respuesta = resultado.error.context.clone ? resultado.error.context.clone() : resultado.error.context;
          var cuerpo = await respuesta.json();
          mensaje = cuerpo && cuerpo.error ? cuerpo.error : "";
        } catch (_) {}
      }

      try {
        if (window.sessionStorage) window.sessionStorage.setItem(clave, "hecho");
      } catch (_) {}

      if (mensaje === "Ese rol no es válido.") {
        window.alert("PRUEBA SEGURA OK: no se puede crear otro Propietario.");
      } else {
        window.alert("PRUEBA SEGURA: respuesta recibida: " + (mensaje || "sin mensaje legible"));
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  var intentosAutotest = 0;
  var temporizadorAutotest = window.setInterval(async function () {
    intentosAutotest++;
    var terminado = await probarBloqueoNuevoPropietario();
    if (terminado || intentosAutotest >= 60) {
      window.clearInterval(temporizadorAutotest);
    }
  }, 1000);
})();
