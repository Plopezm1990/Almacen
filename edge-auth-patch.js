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
  var REDIRECCIONES_RAMA = {
    "entrevista-personal": "entrevista-personal-neutral"
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

      // Solo en la rama de pruebas: la interfaz antigua sigue llamando a
      // entrevista-personal, pero aquí se envía al endpoint neutral nuevo.
      // En producción/main este adaptador no tiene esta redirección.
      var destino = input;
      var nuevoNombre = REDIRECCIONES_RAMA[nombreFuncion];
      if (nuevoNombre) {
        var urlDestino = ORIGEN_FUNCTIONS + nuevoNombre + url.slice((ORIGEN_FUNCTIONS + nombreFuncion).length);
        // El bundle actual llama a estas funciones con URL string + init.
        // Si en el futuro llega un Request, se conserva sin redirigir antes
        // que arriesgarse a alterar su body de forma incorrecta.
        if (typeof input === "string") destino = urlDestino;
      }

      return fetchOriginal(destino, opciones);
    } catch (e) {
      return respuestaSinSesion("No se pudo comprobar la sesión. Vuelve a iniciar sesión.");
    }
  };
})();

// Solo en esta rama: capa visual temporal para que Prefiltros y Entrevistas
// no muestren puntuaciones ni recomendaciones automáticas mientras se adapta
// el bundle principal. No guarda ni modifica datos.
(function () {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();
