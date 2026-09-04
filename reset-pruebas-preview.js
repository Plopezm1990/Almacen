(function () {
  "use strict";

  // Reinicio local seguro de L&A Suite SOLO en Deploy Preview.
  // Producción y cualquier otro dominio quedan fuera por diseño.
  var HOST_PREVIEW = /^(?:deploy-preview-\d+|[a-f0-9]{24})--chic-entremet-9107cf\.netlify\.app$/i;
  if (typeof window === "undefined" || !HOST_PREVIEW.test(window.location.hostname)) return;

  // El Preview trabaja aislado de la nube productiva mientras se prepara QA.
  window.__modoPruebasLocal = true;

  // Defensa adicional: el bundle contiene algunas llamadas fetch() directas a
  // Edge Functions del proyecto real. En Preview se bloquea TODO acceso HTTP
  // al host productivo, aunque una llamada no dependa de NUBE_URL.
  var SUPABASE_PROD_HOST = "flqercbgpgmmfaakrwkc.supabase.co";
  if (typeof window.fetch === "function" && !window.__qaFetchProduccionBloqueado) {
    var fetchOriginal = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var raw = typeof input === "string" ? input : (input && input.url ? input.url : "");
      try {
        var destino = new URL(raw, window.location.href);
        if (destino.hostname === SUPABASE_PROD_HOST) {
          console.warn("[QA] Petición bloqueada al Supabase productivo:", destino.pathname);
          return Promise.reject(new Error("QA_BLOCKED_PRODUCTION_SUPABASE"));
        }
      } catch (e) {
        // Si no se puede interpretar la URL, conserva el comportamiento normal.
      }
      return fetchOriginal(input, init);
    };
    window.__qaFetchProduccionBloqueado = true;
  }

  // v2 = borrado TOTAL del espacio funcional de L&A Suite. La versión anterior
  // conservaba empresas/locales/configuración y ya no sirve para el reinicio a cero.
  var MARCADOR = "la_suite_reset_total_20260904_v2";
  if (localStorage.getItem(MARCADOR) === "1") return;

  // Copiamos las claves antes de borrarlas para no alterar el recorrido.
  var claves = [];
  for (var i = 0; i < localStorage.length; i++) claves.push(localStorage.key(i));

  claves.forEach(function (clave) {
    if (!clave) return;

    // Todo el estado funcional de la aplicación vive bajo almacen:*.
    // Se eliminan también empresa, locales, PIN, diseño, usuario activo y tema:
    // el objetivo solicitado es un arranque realmente a cero.
    if (clave.indexOf("almacen:") === 0) {
      localStorage.removeItem(clave);
      return;
    }

    // Colas, tombstones y avisos auxiliares pueden reinyectar o reintentar datos
    // antiguos; por eso también se borran todos los auxiliares almacen__*.
    if (clave.indexOf("almacen__") === 0) {
      localStorage.removeItem(clave);
      return;
    }

    // Elimina marcadores de campañas de reset antiguas para no dejar estados
    // contradictorios. El marcador v2 actual se escribe al final.
    if (clave.indexOf("la_suite_reset_pruebas_") === 0) {
      localStorage.removeItem(clave);
    }
  });

  // No se hace localStorage.clear(): así se conserva la sesión técnica de
  // Supabase (sb-*-auth-token) y cualquier otra clave ajena a L&A Suite.
  localStorage.setItem(MARCADOR, "1");
  window.__resetPruebasEjecutado = true;
  window.__reinicioLocalSeguroVersion = "20260904-v2";
})();
