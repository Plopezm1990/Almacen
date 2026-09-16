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

    // Mantener la elección de este dispositivo si todavía es válida. Para un
    // Propietario todos_locales=true, null representa la vista consolidada.
    var localActivoRaw = storageGetNativo.call(window.localStorage, "almacen:localActivoId");
    var localActivoValido = false;
    var localActivoElegido = contexto.permite_todos_locales === true ? null : contexto.local_id;
    if (localActivoRaw !== null) {
      try {
        var candidato = JSON.parse(localActivoRaw);
        if (candidato === null && contexto.permite_todos_locales === true) {
          localActivoElegido = null;
          localActivoValido = true;
        } else if (typeof candidato === "string") {
          localActivoValido = contexto.locales.some(function (l) {
            return l && l.id === candidato && l.activo !== false;
          });
          if (localActivoValido) localActivoElegido = candidato;
        }
      } catch (e) {}
    }
    var localActivo = JSON.stringify(localActivoElegido);
    if (!localActivoValido || localActivoRaw !== localActivo) {
      escribirSiCambia("almacen:localActivoId", localActivo);
    }

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
      localActivo: localActivoElegido
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

  // PM26 Defecto L v2: la UI histórica considera éxito un INSERT cuando
  // PostgREST no devuelve error, aunque por defecto el INSERT no devuelve la
  // fila persistida. Este guard se instala ANTES de la barrera post-reset y
  // queda por debajo del hotfix de contexto de reset-pruebas-preview.js. Así
  // recibe el body final (empresa/local ya resueltos), obliga al mismo POST a
  // devolver representación y solo deja pasar un 2xx si la fila confirmada
  // coincide exactamente con token, tenant y estado. No hace una segunda
  // lectura ni modifica RLS; el servidor sigue siendo la autoridad final.
  (function instalarConfirmacionPersistenciaPrefiltroPM26() {
    if (typeof window.fetch !== "function" || window.fetch.__pm26PrefiltroPersistenciaV2) return;

    var VERSION_PM26_PERSISTENCIA = "pm26-prefiltro-persistencia-confirmada-v2";
    var fetchAnteriorPM26Persistencia = window.fetch.bind(window);

    function textoPM26Persistencia(valor) {
      return typeof valor === "string" ? valor.trim() : "";
    }

    function resolverDestinoPM26Persistencia(input) {
      try {
        var raw = typeof input === "string" ? input : input && input.url ? input.url : String(input || "");
        var base = window.location && window.location.href ? window.location.href : "https://local.invalid/";
        return new URL(raw, base);
      } catch (e) {
        return null;
      }
    }

    function esInsertPrefiltroPM26Persistencia(input, init) {
      var metodo = textoPM26Persistencia(init && init.method || input && input.method || "GET").toUpperCase();
      if (metodo !== "POST") return false;
      var destino = resolverDestinoPM26Persistencia(input);
      if (!destino || !/\/rest\/v1\/prefiltros_candidatos\/?$/.test(destino.pathname)) return false;

      var nubeUrl = textoPM26Persistencia(window.NUBE_URL);
      if (nubeUrl) {
        try {
          if (destino.hostname !== new URL(nubeUrl).hostname) return false;
        } catch (e) {
          return false;
        }
      } else if (!/\.supabase\.co$/i.test(destino.hostname)) {
        return false;
      }
      return true;
    }

    function filaEsperadaPM26Persistencia(body) {
      if (typeof body !== "string" || !body) return null;
      try {
        var parsed = JSON.parse(body);
        if (Array.isArray(parsed)) {
          if (parsed.length !== 1) return null;
          parsed = parsed[0];
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

        var token = textoPM26Persistencia(parsed.token);
        var empresaId = textoPM26Persistencia(parsed.empresa_id);
        var localId = textoPM26Persistencia(parsed.local_id);
        var estado = textoPM26Persistencia(parsed.estado);
        if (!/^[a-f0-9]{64}$/i.test(token) || !empresaId || !localId || estado !== "pendiente") return null;

        return {
          token: token,
          empresa_id: empresaId,
          local_id: localId,
          estado: estado
        };
      } catch (e) {
        return null;
      }
    }

    function headersConRepresentacionPM26Persistencia(headersEntrada) {
      var salida = {};
      if (headersEntrada && typeof headersEntrada.forEach === "function") {
        headersEntrada.forEach(function (valor, clave) { salida[clave] = valor; });
      } else if (Array.isArray(headersEntrada)) {
        headersEntrada.forEach(function (par) {
          if (Array.isArray(par) && par.length >= 2) salida[String(par[0])] = String(par[1]);
        });
      } else if (headersEntrada && typeof headersEntrada === "object") {
        Object.keys(headersEntrada).forEach(function (clave) { salida[clave] = headersEntrada[clave]; });
      }

      var clavePrefer = Object.keys(salida).find(function (clave) { return clave.toLowerCase() === "prefer"; });
      var actual = clavePrefer ? String(salida[clavePrefer] || "") : "";
      if (clavePrefer) delete salida[clavePrefer];
      var partes = actual.split(",").map(function (parte) { return parte.trim(); }).filter(function (parte) {
        return parte && !/^return\s*=/i.test(parte);
      });
      partes.push("return=representation");
      salida.Prefer = partes.join(",");
      return salida;
    }

    function respuestaFalloPM26Persistencia(motivo) {
      var payload = {
        code: "PREFILTRO_PERSISTENCIA_NO_CONFIRMADA",
        details: motivo || "persistencia_no_confirmada",
        hint: null,
        message: "No se pudo confirmar la persistencia del prefiltro"
      };
      var texto = JSON.stringify(payload);
      if (typeof Response === "function") {
        return new Response(texto, {
          status: 409,
          statusText: "Conflict",
          headers: { "Content-Type": "application/json" }
        });
      }
      return {
        ok: false,
        status: 409,
        statusText: "Conflict",
        headers: { get: function (nombre) { return String(nombre || "").toLowerCase() === "content-type" ? "application/json" : null; } },
        clone: function () { return this; },
        json: function () { return Promise.resolve(payload); },
        text: function () { return Promise.resolve(texto); }
      };
    }

    function representacionCoincidePM26Persistencia(datos, esperada) {
      if (!Array.isArray(datos) || datos.length !== 1 || !esperada) return false;
      var fila = datos[0];
      if (!fila || typeof fila !== "object" || Array.isArray(fila)) return false;
      return textoPM26Persistencia(fila.token) === esperada.token &&
        textoPM26Persistencia(fila.empresa_id) === esperada.empresa_id &&
        textoPM26Persistencia(fila.local_id) === esperada.local_id &&
        textoPM26Persistencia(fila.estado) === esperada.estado;
    }

    var fetchConfirmadoPM26Persistencia = function (input, init) {
      if (!esInsertPrefiltroPM26Persistencia(input, init)) {
        return fetchAnteriorPM26Persistencia(input, init);
      }

      var siguienteInit = Object.assign({}, init || {});
      var esperada = filaEsperadaPM26Persistencia(siguienteInit.body);
      if (!esperada) {
        return Promise.resolve(respuestaFalloPM26Persistencia("solicitud_no_verificable"));
      }

      var destino = resolverDestinoPM26Persistencia(input);
      if (!destino) {
        return Promise.resolve(respuestaFalloPM26Persistencia("destino_no_verificable"));
      }
      destino.searchParams.set("select", "token,empresa_id,local_id,estado");
      siguienteInit.headers = headersConRepresentacionPM26Persistencia(
        siguienteInit.headers || input && input.headers || null
      );

      return fetchAnteriorPM26Persistencia(destino.toString(), siguienteInit).then(function (respuesta) {
        if (!respuesta || !respuesta.ok) return respuesta;
        if (typeof respuesta.clone !== "function") {
          return respuestaFalloPM26Persistencia("respuesta_no_clonable");
        }

        return respuesta.clone().json().then(function (datos) {
          if (!representacionCoincidePM26Persistencia(datos, esperada)) {
            return respuestaFalloPM26Persistencia("representacion_no_coincidente");
          }
          return respuesta;
        }).catch(function () {
          return respuestaFalloPM26Persistencia("representacion_no_json");
        });
      }).catch(function () {
        return respuestaFalloPM26Persistencia("error_de_transporte");
      });
    };

    fetchConfirmadoPM26Persistencia.__pm26PrefiltroPersistenciaV2 = true;
    fetchConfirmadoPM26Persistencia.__original = fetchAnteriorPM26Persistencia;
    window.fetch = fetchConfirmadoPM26Persistencia;
    window.__pm26PrefiltroPersistenciaVersion = VERSION_PM26_PERSISTENCIA;
  })();

  var estilo = document.createElement("style");
  estilo.id = "la-owner-bootstrap-prelock-style";
  estilo.textContent =
    "html.la-installation-checking #root{visibility:hidden!important}" +
    "html.la-installation-needs-setup #root{display:none!important}";
  (document.head || document.documentElement).appendChild(estilo);
  document.documentElement.classList.add("la-installation-checking");
})();