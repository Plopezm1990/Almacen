(function () {
  "use strict";

  // PM27: adaptación del hotfix PM26 del Defecto L a la arquitectura actual.
  // Este loader ya es universal y se ejecuta antes de reset-pruebas-preview.js
  // y antes del bundle principal, por lo que el hotfix no vuelve a mezclarse
  // con el código exclusivo de Deploy Preview.
  if (typeof window === "undefined") return;

  (function instalarHotfixContextoPrefiltroPM26() {
    if (window.__pm26PrefiltroHotfixVersion) return;

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

  // PM11 P10: el parche visual de compras es parte de la app y debe
  // cargarse en todos los entornos, incluida producción. Separado de
  // reset-pruebas-preview.js (exclusivo de Deploy Preview) en PM26 P04b.
  if (window.__pm11CompraMobileLoaderV1) return;
  window.__pm11CompraMobileLoaderV1 = true;
  var mobileScript = document.createElement("script");
  mobileScript.src = "./pm11-compra-mobile-layout-v1.js?v=pm11-p10-mobile-v1";
  mobileScript.async = false;
  mobileScript.setAttribute("data-pm11-compra-mobile", "v1");
  (document.head || document.documentElement).appendChild(mobileScript);
})();
