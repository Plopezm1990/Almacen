(function () {
  "use strict";

  // HOTFIX post-reset P1 (cliente): esta barrera se instala en <head>, antes
  // de cualquier módulo funcional. Hasta que edge-auth-patch.js valide contra
  // el servidor la generación de instalación, ningún dato empresarial local
  // puede leerse/escribirse y ninguna mutación puede salir hacia Supabase.
  //
  // Se permite únicamente:
  // - Auth (para poder iniciar/refrescar sesión),
  // - lecturas HTTP,
  // - los RPC de solo lectura usados para validar generación/contexto.
  //
  // Tras una validación correcta, si durante el primer arranque se bloqueó
  // alguna lectura local, se hace UNA recarga controlada. Esa recarga recibe
  // un permiso de lectura local de un solo uso ligado a la generación recién
  // validada; las escrituras/remotos siguen cerrados hasta revalidar servidor.
  (function instalarBarreraTempranaPostReset() {
    if (typeof window === "undefined" || window.__laPostResetEarlyGateV1) return;
    window.__laPostResetEarlyGateV1 = true;

    var PROD_HOST = "flqercbgpgmmfaakrwkc.supabase.co";
    var CLAVE_GENERACION = "la_suite_installation_generation_v1";
    var CLAVE_ARRANQUE_VALIDADO = "la_suite_post_reset_boot_generation_v1";
    var CLAVE_CONTEXTO_SEGURO = "chocoloyos_contexto_operativo_seguro_v1";
    var HOST_PREVIEW = /^(?:deploy-preview-\d+|[a-f0-9]{24})--chic-entremet-9107cf\.netlify\.app$/i;
    var esPreviewQA = !!(window.location && HOST_PREVIEW.test(window.location.hostname || ""));
    var lecturaLocalBloqueada = false;
    var escrituraLocalBloqueada = false;
    var mutacionRemotaBloqueada = false;
    var lecturaPreautorizadaUnArranque = false;
    var recargaEmitida = false;

    function sincronizacionValidada() {
      return window.__instalacionSyncPermitida === true;
    }

    function esPrefiltroPublico() {
      return !!(window.location && String(window.location.hash || "").indexOf("#/prefiltro/") === 0);
    }

    function mutacionPrefiltroPublicoPermitida(destino, metodo) {
      return esPrefiltroPublico() &&
        metodo === "POST" &&
        /^\\/functions\\/v1\\/prefiltro-candidato\\/?$/i.test((destino && destino.pathname) || "");
    }

    function proteccionActiva() {
      if (esPreviewQA || window.__modoPruebasQA === true || window.__modoPruebasLocal === true) return false;
      return !sincronizacionValidada();
    }

    function esClaveNegocio(clave) {
      clave = String(clave || "");
      return clave.indexOf("almacen:") === 0 ||
        clave.indexOf("almacen__") === 0 ||
        clave === CLAVE_CONTEXTO_SEGURO;
    }

    var protoStorage = window.Storage && window.Storage.prototype;
    var getItemNativo = protoStorage && protoStorage.getItem;
    var setItemNativo = protoStorage && protoStorage.setItem;
    var removeItemNativo = protoStorage && protoStorage.removeItem;
    var clearNativo = protoStorage && protoStorage.clear;

    // Permiso de lectura local de UN solo arranque, emitido únicamente después
    // de validar la misma generación en el arranque inmediatamente anterior.
    try {
      if (getItemNativo && removeItemNativo && window.localStorage && window.sessionStorage) {
        var genLocal = getItemNativo.call(window.localStorage, CLAVE_GENERACION);
        var genArranque = getItemNativo.call(window.sessionStorage, CLAVE_ARRANQUE_VALIDADO);
        if (genLocal && genArranque && genLocal === genArranque) {
          lecturaPreautorizadaUnArranque = true;
          removeItemNativo.call(window.sessionStorage, CLAVE_ARRANQUE_VALIDADO);
        }
      }
    } catch (e) {}

    if (protoStorage && getItemNativo && setItemNativo && !protoStorage.__laPostResetStorageGateV1) {
      protoStorage.getItem = function (clave) {
        if (
          this === window.localStorage &&
          esClaveNegocio(clave) &&
          proteccionActiva() &&
          !lecturaPreautorizadaUnArranque
        ) {
          lecturaLocalBloqueada = true;
          return null;
        }
        return getItemNativo.call(this, clave);
      };

      protoStorage.setItem = function (clave, valor) {
        if (this === window.localStorage && esClaveNegocio(clave) && proteccionActiva()) {
          escrituraLocalBloqueada = true;
          return;
        }
        return setItemNativo.call(this, clave, valor);
      };

      // El borrado se deja pasar: es la operación segura que usa P1 para
      // poner en cuarentena/eliminar la copia anterior cuando cambia generación.
      protoStorage.removeItem = function (clave) {
        return removeItemNativo.call(this, clave);
      };

      if (clearNativo) {
        protoStorage.clear = function () {
          if (this === window.localStorage && proteccionActiva()) {
            escrituraLocalBloqueada = true;
            return;
          }
          return clearNativo.call(this);
        };
      }

      try {
        Object.defineProperty(protoStorage, "__laPostResetStorageGateV1", {
          value: true,
          configurable: true
        });
      } catch (e) {
        protoStorage.__laPostResetStorageGateV1 = true;
      }
    }

    function hostNubeObjetivo() {
      try {
        var url = String(window.NUBE_URL || "").trim();
        return url ? new URL(url).hostname : PROD_HOST;
      } catch (e) {
        return PROD_HOST;
      }
    }

    function rpcLecturaPermitido(pathname) {
      return /^\/rest\/v1\/rpc\/(?:obtener_generacion_instalacion|obtener_contexto_operativo)\/?$/i.test(pathname || "");
    }

    if (typeof window.fetch === "function" && !window.fetch.__laPostResetNetworkGateV1) {
      var fetchAnterior = window.fetch.bind(window);
      var fetchProtegido = function (input, init) {
        if (!proteccionActiva()) return fetchAnterior(input, init);

        var metodo = String(
          (init && init.method) ||
          (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET") ||
          "GET"
        ).toUpperCase();

        var raw = typeof input === "string" ? input : (input && input.url) || "";
        var destino;
        try {
          destino = new URL(raw, window.location && window.location.href ? window.location.href : "https://local.invalid/");
        } catch (e) {
          return fetchAnterior(input, init);
        }

        if (destino.hostname !== hostNubeObjetivo()) return fetchAnterior(input, init);
        // Excepcion minima para el formulario publico: solo su POST a la Edge
        // Function propia. No abre almacenamiento local ni otras mutaciones.
        if (mutacionPrefiltroPublicoPermitida(destino, metodo)) return fetchAnterior(input, init);
        if (/^\/auth\/v1\//i.test(destino.pathname)) return fetchAnterior(input, init);
        if (rpcLecturaPermitido(destino.pathname)) return fetchAnterior(input, init);
        if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return fetchAnterior(input, init);

        mutacionRemotaBloqueada = true;
        return Promise.reject(new Error("POST_RESET_BARRIER_BLOCKED"));
      };
      fetchProtegido.__laPostResetNetworkGateV1 = true;
      fetchProtegido.__original = fetchAnterior;
      window.fetch = fetchProtegido;
    }

    window.__laPostResetEarlyGateEstado = function () {
      return {
        lecturaLocalBloqueada: lecturaLocalBloqueada,
        escrituraLocalBloqueada: escrituraLocalBloqueada,
        mutacionRemotaBloqueada: mutacionRemotaBloqueada,
        lecturaPreautorizadaUnArranque: lecturaPreautorizadaUnArranque,
        syncPermitida: sincronizacionValidada()
      };
    };

    // Si el primer render intentó leer la copia local antes de validar servidor,
    // no dejamos la UI construida sobre fallbacks vacíos. Tras validar la
    // generación se recarga una vez y se consume un permiso de lectura local
    // ligado exactamente a esa generación. Las mutaciones continúan cerradas
    // hasta que el segundo arranque revalide el servidor.
    if (!esPreviewQA) {
      window.setInterval(function () {
        if (recargaEmitida || !lecturaLocalBloqueada || !sincronizacionValidada()) return;
        try {
          if (!getItemNativo || !setItemNativo || !window.localStorage || !window.sessionStorage) return;
          var generacion = getItemNativo.call(window.localStorage, CLAVE_GENERACION);
          if (!generacion) return;
          setItemNativo.call(window.sessionStorage, CLAVE_ARRANQUE_VALIDADO, generacion);
          recargaEmitida = true;
          window.location.reload();
        } catch (e) {}
      }, 25);
    }
  })();

  // PM11 P10: el parche visual de compras es parte de la app y debe cargarse
  // también fuera de QA. El resto de este archivo continúa siendo exclusivo
  // de Deploy Preview.
  if (typeof window !== "undefined" && !window.__pm11CompraMobileLoaderV1) {
    window.__pm11CompraMobileLoaderV1 = true;
    var mobileScript = document.createElement("script");
    mobileScript.src = "./pm11-compra-mobile-layout-v1.js?v=pm11-p10-mobile-v1";
    mobileScript.async = false;
    mobileScript.setAttribute("data-pm11-compra-mobile", "v1");
    (document.head || document.documentElement).appendChild(mobileScript);
  }


  // PM26 Defecto L: compatibilidad temporal del contexto empresa/local.
  // El frontend histórico puede conservar el local activo en caché pero no la
  // colección de empresas. Solo repara contexto inequívoco y solo completa IDs
  // AUSENTES en el POST de prefiltros_candidatos. Nunca sustituye IDs existentes;
  // las políticas RLS del servidor siguen siendo la autoridad final.
  (function instalarHotfixContextoPrefiltroPM26() {
    if (typeof window === "undefined" || window.__pm26PrefiltroHotfixVersion) return;

    var VERSION_PM26 = "pm26-prefiltro-context-hotfix-v1";
    var PREFIJO_PM26 = "almacen:";

    function textoIdPM26(valor) {
      return typeof valor === "string" ? valor.trim() : "";
    }

    function leerJsonPM26(clave, fallback) {
      try {
        var raw = window.localStorage && window.localStorage.getItem(PREFIJO_PM26 + clave);
        if (raw === null || raw === undefined || raw === "") return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }

    function escribirJsonPM26(clave, valor) {
      try {
        if (!window.localStorage) return false;
        window.localStorage.setItem(PREFIJO_PM26 + clave, JSON.stringify(valor));
        return true;
      } catch (e) {
        return false;
      }
    }

    function localOperablePM26(local) {
      return !!local && textoIdPM26(local.id) && local.activo !== false && !local.fusionadoEn;
    }

    function empresaDeLocalPM26(local) {
      if (!local) return "";
      return textoIdPM26(local.empresaId || local.empresa_id || "");
    }

    function resolverContextoPM26(localIdPreferido) {
      var locales = leerJsonPM26("locales", []);
      if (!Array.isArray(locales)) locales = [];
      var activos = locales.filter(localOperablePM26);
      var solicitado = textoIdPM26(localIdPreferido);
      var guardado = textoIdPM26(leerJsonPM26("localActivoId", null));
      var preferido = solicitado || guardado;
      var local = preferido ? activos.find(function (item) { return textoIdPM26(item.id) === preferido; }) || null : null;

      // Si la petición ya trae un local explícito, nunca se sustituye ni se
      // infiere otro. El fallback a un único local activo solo aplica cuando
      // el contexto estaba completamente ausente.
      if (!local && solicitado) return { ok: false, reason: "local_explicito_no_encontrado" };
      if (!local && activos.length === 1) local = activos[0];
      if (!local) return { ok: false, reason: "local_ambiguo_o_ausente" };

      var localId = textoIdPM26(local.id);
      var empresaId = empresaDeLocalPM26(local);
      if (!localId || !empresaId) return { ok: false, reason: "empresa_o_local_ausente" };

      return { ok: true, empresaId: empresaId, localId: localId };
    }

    function repararCacheContextoPM26() {
      var contexto = resolverContextoPM26(null);
      if (!contexto.ok) return contexto;

      var empresas = leerJsonPM26("empresas", []);
      if (!Array.isArray(empresas)) empresas = [];
      if (!empresas.some(function (empresa) { return empresa && textoIdPM26(empresa.id) === contexto.empresaId; })) {
        empresas = empresas.concat([{ id: contexto.empresaId, activo: true, recuperadaDeContextoPrefiltro: true }]);
        escribirJsonPM26("empresas", empresas);
      }

      var localActivoId = textoIdPM26(leerJsonPM26("localActivoId", null));
      if (localActivoId !== contexto.localId) escribirJsonPM26("localActivoId", contexto.localId);

      return contexto;
    }

    function esInsertPrefiltroPM26(input, init) {
      var method = textoIdPM26(init && init.method || input && input.method || "GET").toUpperCase();
      if (method !== "POST") return false;
      var raw = "";
      try {
        raw = typeof input === "string" ? input : input && input.url ? input.url : String(input || "");
        var base = window.location && window.location.href ? window.location.href : "https://local.invalid/";
        var destino = new URL(raw, base);
        var nubeUrl = textoIdPM26(window.NUBE_URL);
        if (nubeUrl) {
          try {
            if (destino.hostname !== new URL(nubeUrl).hostname) return false;
          } catch (e) {
            return false;
          }
        }
        return /\/rest\/v1\/prefiltros_candidatos\/?$/.test(destino.pathname);
      } catch (e) {
        return false;
      }
    }

    function completarFilaPrefiltroPM26(fila) {
      if (!fila || typeof fila !== "object" || Array.isArray(fila)) return fila;
      var existenteEmpresa = textoIdPM26(fila.empresa_id);
      var existenteLocal = textoIdPM26(fila.local_id);
      if (existenteEmpresa && existenteLocal) return fila;

      var contexto = resolverContextoPM26(existenteLocal || null);
      if (!contexto.ok) return fila;

      var salida = Object.assign({}, fila);
      if (!existenteLocal) salida.local_id = contexto.localId;
      if (!existenteEmpresa) salida.empresa_id = contexto.empresaId;
      return salida;
    }

    function completarBodyPM26(body) {
      if (typeof body !== "string" || !body) return body;
      try {
        var parsed = JSON.parse(body);
        if (Array.isArray(parsed)) return JSON.stringify(parsed.map(completarFilaPrefiltroPM26));
        return JSON.stringify(completarFilaPrefiltroPM26(parsed));
      } catch (e) {
        return body;
      }
    }

    window.__resolverContextoPrefiltroPM26 = resolverContextoPM26;
    window.__repararContextoPrefiltroPM26 = repararCacheContextoPM26;
    window.__pm26PrefiltroHotfixVersion = VERSION_PM26;

    repararCacheContextoPM26();

    if (typeof window.fetch === "function" && !window.fetch.__pm26PrefiltroContextHotfix) {
      var fetchOriginalPM26 = window.fetch.bind(window);
      var fetchProtegidoPM26 = function (input, init) {
        if (!esInsertPrefiltroPM26(input, init)) return fetchOriginalPM26(input, init);
        var siguienteInit = Object.assign({}, init || {});
        if (typeof siguienteInit.body === "string") siguienteInit.body = completarBodyPM26(siguienteInit.body);
        return fetchOriginalPM26(input, siguienteInit);
      };
      fetchProtegidoPM26.__pm26PrefiltroContextHotfix = true;
      fetchProtegidoPM26.__original = fetchOriginalPM26;
      window.fetch = fetchProtegidoPM26;
    }
  })();

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
