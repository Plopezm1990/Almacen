(function () {
  "use strict";
  if (window.__laOwnerBootstrapPrelockV1) return;
  window.__laOwnerBootstrapPrelockV1 = true;

  var syncSolicitada = false;
  var bootstrapListo = false;
  var fetchNativo = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  var storageGetNativo = typeof Storage !== "undefined" ? Storage.prototype.getItem : null;
  var storageSetNativo = typeof Storage !== "undefined" ? Storage.prototype.setItem : null;
  var RPC_PERMITIDOS = {
    obtener_estado_instalacion: true,
    bootstrap_owner_instalacion: true,
    obtener_contexto_instalacion_ui: true
  };

  // Interlock adicional sobre la barrera P1: aunque el código histórico pida
  // habilitar sincronización después de validar la generación, el getter no
  // devuelve true hasta que P4/P5 confirmen un contexto empresarial completo.
  try {
    Object.defineProperty(window, "__instalacionSyncPermitida", {
      configurable: false,
      enumerable: true,
      get: function () { return bootstrapListo && syncSolicitada; },
      set: function (valor) { syncSolicitada = valor === true; }
    });
  } catch (e) {
    window.__instalacionSyncPermitida = false;
  }

  window.__laOwnerBootstrapReset = function () {
    bootstrapListo = false;
    syncSolicitada = false;
  };

  window.__laOwnerBootstrapSetReady = function (valor) {
    bootstrapListo = valor === true;
    return bootstrapListo;
  };

  window.__laOwnerBootstrapSyncState = function () {
    return {
      bootstrapListo: bootstrapListo,
      syncSolicitada: syncSolicitada,
      syncPermitida: bootstrapListo && syncSolicitada
    };
  };

  // Semilla estrictamente limitada a las cuatro claves que la UI histórica
  // necesita antes de arrancar. Usa las primitivas capturadas ANTES de P1 para
  // poder escribir el snapshot autorizado sin abrir prematuramente la barrera.
  window.__laOwnerBootstrapSeedUiContext = function (contexto, userId) {
    if (!storageGetNativo || !storageSetNativo || !window.localStorage) {
      throw new Error("Almacenamiento local no disponible para el contexto UI");
    }
    if (!contexto || contexto.state !== "ready" || !contexto.generation) {
      throw new Error("Contexto UI no preparado");
    }
    if (!userId || !Array.isArray(contexto.empresas) || !Array.isArray(contexto.locales)) {
      throw new Error("Contexto UI incompleto");
    }
    if (!contexto.empresas.length || !contexto.locales.length || !contexto.local_id) {
      throw new Error("Contexto UI sin empresa o local operativo");
    }

    var generacionLocal = storageGetNativo.call(window.localStorage, "la_suite_installation_generation_v1") || "";
    if (generacionLocal !== contexto.generation) {
      throw new Error("La generación del contexto UI no coincide");
    }

    var empresas = JSON.stringify(contexto.empresas);
    var locales = JSON.stringify(contexto.locales);
    var localActivo = JSON.stringify(contexto.local_id);
    var cambios = false;

    function escribirSiCambia(clave, valor) {
      var actual = storageGetNativo.call(window.localStorage, clave);
      if (actual !== valor) {
        storageSetNativo.call(window.localStorage, clave, valor);
        cambios = true;
      }
    }

    escribirSiCambia("almacen:empresas", empresas);
    escribirSiCambia("almacen:locales", locales);
    escribirSiCambia("almacen:localActivoId", localActivo);

    // El PIN es deliberadamente local al dispositivo. Ausencia en una
    // instalación nueva significa "todavía no configurado", no error.
    if (storageGetNativo.call(window.localStorage, "almacen:pinPropietario") === null) {
      storageSetNativo.call(window.localStorage, "almacen:pinPropietario", JSON.stringify(""));
      cambios = true;
    }

    var firma = JSON.stringify({
      generation: contexto.generation,
      userId: userId,
      empresas: contexto.empresas,
      locales: contexto.locales,
      localId: contexto.local_id
    });
    storageSetNativo.call(window.localStorage, "almacen__ui_context_seed", JSON.stringify({
      generation: contexto.generation,
      userId: userId,
      seededAt: Date.now()
    }));

    return { changed: cambios, signature: firma };
  };

  // Canal estrecho que conserva acceso a fetch antes de que P1 instale su
  // bloqueo global. No expone un fetch genérico: solo admite RPCs de bootstrap
  // y lectura del contexto UI previo a liberar sincronización.
  window.__laOwnerBootstrapRpc = async function (nombre, token, cuerpo) {
    if (!fetchNativo || !RPC_PERMITIDOS[nombre]) throw new Error("RPC bootstrap no permitido");
    var base = String(window.NUBE_URL || "").replace(/\/+$/, "");
    var apikey = String(window.NUBE_CLAVE || "");
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) throw new Error("Backend Supabase no válido");
    if (!apikey || !token) throw new Error("Credenciales de sesión no disponibles");

    var respuesta = await fetchNativo(base + "/rest/v1/rpc/" + nombre, {
      method: "POST",
      headers: {
        "apikey": apikey,
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(cuerpo || {})
    });

    var texto = await respuesta.text();
    var datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch (e) {}
    if (!respuesta.ok) {
      var detalle = datos && (datos.message || datos.details || datos.hint);
      throw new Error(detalle || ("RPC bootstrap HTTP " + respuesta.status));
    }
    return datos;
  };

  var estilo = document.createElement("style");
  estilo.id = "la-owner-bootstrap-prelock-style";
  estilo.textContent =
    "html.la-installation-checking #root{visibility:hidden!important}" +
    "html.la-installation-needs-setup #root{display:none!important}";
  (document.head || document.documentElement).appendChild(estilo);
  document.documentElement.classList.add("la-installation-checking");
})();
