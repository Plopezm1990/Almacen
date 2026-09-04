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

  // Deploy Preview usa nube QA real. No debe marcarse a la vez como modo local,
  // porque varias rutas funcionales interpretan __modoPruebasLocal=true como
  // "sin sincronización" aunque el cliente Supabase esté conectado.
  window.__modoPruebasLocal = false;
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
  // v6: además de limpiar la caché antigua, deja un bootstrap funcional QA
  // mínimo para que el selector de locales y los productos existan desde el
  // primer render. El stock autoritativo se sigue sincronizando después desde
  // Supabase QA mediante PM-07; esto NO afecta a producción.
  var MARCADOR = "la_suite_reset_total_20260904_v6_qa";
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

  var empresas = [
    { id: "QA-EMP-A", razonSocial: "QA Empresa A, S.L.", nif: "QA000000A", marca: "L&A Suite QA", nombreComercial: "L&A Suite QA", activo: true }
  ];
  var locales = [
    { id: "QA-A1", nombre: "QA Local A1", direccion: "QA A1", empresaId: "QA-EMP-A", activo: true },
    { id: "QA-A2", nombre: "QA Local A2", direccion: "QA A2", empresaId: "QA-EMP-A", activo: true },
    { id: "QA-A-CERRADO", nombre: "QA Local A Cerrado", direccion: "QA Cerrado", empresaId: "QA-EMP-A", activo: false }
  ];
  var productos = [
    { id: "QA-PROD-A-AGUA", nombre: "QA Agua A1", localId: "QA-A1", empresaId: "QA-EMP-A", stock: 23, stockPisoVenta: 5, stockMinimo: 3, costo: 3, coste: 3, precio: 6, precioVenta: 6, iva: 10, ivaVenta: 10, unidad: "ud", tipo: "materia_prima", activo: true },
    { id: "QA-PROD-A-AGUA-A2-SMOKE", nombre: "QA Agua A2", localId: "QA-A2", empresaId: "QA-EMP-A", stock: 10, stockPisoVenta: 2, stockMinimo: 3, costo: 3, coste: 3, precio: 6, precioVenta: 6, iva: 10, ivaVenta: 10, unidad: "ud", tipo: "materia_prima", activo: true }
  ];

  localStorage.setItem("almacen:empresas", JSON.stringify(empresas));
  localStorage.setItem("almacen:locales", JSON.stringify(locales));
  localStorage.setItem("almacen:localActivoId", JSON.stringify("QA-A1"));
  localStorage.setItem("almacen:productos", JSON.stringify(productos));
  localStorage.setItem("almacen:movimientos", JSON.stringify([]));

  localStorage.setItem(MARCADOR, "1");
  window.__resetPruebasEjecutado = true;
  window.__reinicioLocalSeguroVersion = "20260904-v6-qa";
})();
