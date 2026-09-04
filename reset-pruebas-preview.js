(function () {
  "use strict";

  // QA de L&A Suite SOLO en Deploy Preview.
  // Producción y cualquier otro dominio quedan fuera por diseño.
  var HOST_PREVIEW = /^(?:deploy-preview-\d+|[a-f0-9]{24})--chic-entremet-9107cf\.netlify\.app$/i;
  if (typeof window === "undefined" || !HOST_PREVIEW.test(window.location.hostname)) return;

  var SUPABASE_PROD_HOST = "flqercbgpgmmfaakrwkc.supabase.co";
  var SUPABASE_QA_HOST = "qjqorixtkilwsndqayyx.supabase.co";
  var SUPABASE_QA_URL = "https://" + SUPABASE_QA_HOST;
  var SUPABASE_QA_KEY = "sb_publishable__PApb45EaLdiR4tGcXFrzQ_LtZcxqK8";

  window.__modoPruebasLocal = true;
  window.__modoPruebasQA = true;
  window.__qaNubeUrl = SUPABASE_QA_URL;
  window.__qaNubeClave = SUPABASE_QA_KEY;

  // Algunas rutas de Edge Functions siguen compiladas con el host productivo.
  // En Preview nunca se permite salir a producción: las funciones conocidas se
  // redirigen al proyecto QA y cualquier otra ruta productiva se bloquea.
  var RUTAS_QA = {
    "importar-albaran": "importar-albaran",
    "importar-nomina": "importar-nomina",
    "entrevista-personal": "entrevista-personal",
    "prefiltro-candidato": "prefiltro-candidato",
    "enviar-notificacion": "enviar-notificacion",
    "crear-cuenta-empleado": "qa-crear-empleado"
  };

  if (typeof window.fetch === "function" && !window.__qaFetchProduccionBloqueado) {
    var fetchOriginal = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var raw = typeof input === "string" ? input : (input && input.url ? input.url : "");
      try {
        var destino = new URL(raw, window.location.href);
        if (destino.hostname === SUPABASE_PROD_HOST) {
          var prefijo = "/functions/v1/";
          if (destino.pathname.indexOf(prefijo) === 0) {
            var slug = destino.pathname.slice(prefijo.length).split("/")[0];
            var slugQA = RUTAS_QA[slug];
            if (slugQA && typeof input === "string") {
              destino.hostname = SUPABASE_QA_HOST;
              destino.pathname = prefijo + slugQA + destino.pathname.slice((prefijo + slug).length);
              console.info("[QA] Edge Function redirigida a QA:", slug, "->", slugQA);
              return fetchOriginal(destino.toString(), init);
            }
          }
          console.warn("[QA] Petición bloqueada al Supabase productivo:", destino.pathname);
          return Promise.reject(new Error("QA_BLOCKED_PRODUCTION_SUPABASE"));
        }
      } catch (e) {
        if (e && e.message === "QA_BLOCKED_PRODUCTION_SUPABASE") return Promise.reject(e);
      }
      return fetchOriginal(input, init);
    };
    window.__qaFetchProduccionBloqueado = true;
  }

  // Reinicio total del estado funcional local, una sola vez por navegador.
  // v4: refresca el navegador QA después de preparar los fixtures cloud de PM-07,
  // evitando que una caché/pending vacío creado antes de esos fixtures oculte
  // los locales ya existentes en Supabase QA. Solo afecta a Deploy Preview.
  var MARCADOR = "la_suite_reset_total_20260904_v4_qa";
  if (localStorage.getItem(MARCADOR) === "1") return;

  var claves = [];
  for (var i = 0; i < localStorage.length; i++) claves.push(localStorage.key(i));

  claves.forEach(function (clave) {
    if (!clave) return;
    if (clave.indexOf("almacen:") === 0 || clave.indexOf("almacen__") === 0) {
      localStorage.removeItem(clave);
      return;
    }
    if (clave.indexOf("la_suite_reset_pruebas_") === 0 || clave.indexOf("la_suite_reset_total_") === 0) {
      localStorage.removeItem(clave);
    }
  });

  localStorage.setItem(MARCADOR, "1");
  window.__resetPruebasEjecutado = true;
  window.__reinicioLocalSeguroVersion = "20260904-v4-qa";
})();
