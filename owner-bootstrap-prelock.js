(function () {
  "use strict";
  if (window.__laOwnerBootstrapPrelockV1) return;
  window.__laOwnerBootstrapPrelockV1 = true;

  var syncSolicitada = false;
  var bootstrapListo = false;
  var fetchNativo = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  var RPC_PERMITIDOS = {
    obtener_estado_instalacion: true,
    bootstrap_owner_instalacion: true
  };

  // Interlock adicional sobre la barrera P1: aunque el código histórico pida
  // habilitar sincronización después de validar la generación, el getter no
  // devuelve true hasta que P4 confirme un contexto empresarial completo.
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

  // Canal estrecho que conserva acceso a fetch antes de que P1 instale su
  // bloqueo global. No expone un fetch genérico: solo admite los dos RPC P4.
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
