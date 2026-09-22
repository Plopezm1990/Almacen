(function () {
  "use strict";

  if (window.__laServerAuthorityStorageBridgeV2) return;
  window.__laServerAuthorityStorageBridgeV2 = true;

  var TARGETS = Object.freeze({ empleados: true, fichajes: true });
  var capabilityClient = null;
  var capabilityActive = false;

  function keyOf(key) {
    return String(key == null ? "" : key).trim();
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function respuestaStorage(key, value, shared) {
    return { key: key, value: value, shared: !!shared };
  }

  function respuestaEscrituraAutoritativa(key, value, shared) {
    return { key: key, value: value, shared: !!shared, serverAuthoritative: true };
  }

  async function getClient() {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("P2_P06_SUPABASE_NO_DISPONIBLE");
    }
    var client = await window.getSupabaseClient();
    if (!client || typeof client.from !== "function" || typeof client.rpc !== "function") {
      throw new Error("P2_P06_SUPABASE_INVALIDO");
    }
    return client;
  }

  function capabilityOk(data) {
    return !!data
      && data.personal === "pm11"
      && data.fichajes === "pm13"
      && data.legacyPersistence === false;
  }

  async function resolverAutoridad() {
    var client;
    try {
      client = await getClient();
    } catch (_error) {
      return { active: false, client: null };
    }

    if (client === capabilityClient && capabilityActive) {
      return { active: true, client: client };
    }

    var response;
    try {
      response = await client.rpc("p2_server_authority_capabilities");
    } catch (_error2) {
      return { active: false, client: client };
    }

    if (!response || response.error || !capabilityOk(response.data)) {
      return { active: false, client: client };
    }

    capabilityClient = client;
    capabilityActive = true;
    return { active: true, client: client };
  }

  function mapEmpleado(row) {
    var result = Object.assign({}, objectOrEmpty(row && row.datos));
    result.id = row.id;
    result.empresaId = row.empresa_id;
    result.localId = row.local_id;
    result.nombre = row.nombre;
    result.estado = row.estado;
    result.activo = row.estado === "activo";
    if (row.created_at != null) result.createdAt = row.created_at;
    if (row.updated_at != null) result.updatedAt = row.updated_at;
    if (row.baja_at != null) result.bajaAt = row.baja_at;
    if (row.reactivado_at != null) result.reactivadoAt = row.reactivado_at;
    if (row.anonimizado_at != null) result.anonimizadoAt = row.anonimizado_at;
    return result;
  }

  function mapFichaje(row) {
    var result = Object.assign({}, objectOrEmpty(row && row.datos));
    result.id = row.id;
    result.fecha = row.fecha;
    if (row.creado_en != null && result.creadoEn == null) result.creadoEn = row.creado_en;
    return result;
  }

  async function leerAutoritativo(client, key) {
    var response;
    if (key === "empleados") {
      response = await client
        .from("empleados")
        .select("id,empresa_id,local_id,estado,nombre,datos,created_at,updated_at,baja_at,reactivado_at,anonimizado_at");
      if (!response || response.error) {
        throw (response && response.error) || new Error("P2_P06_EMPLEADOS_READ_FALLO");
      }
      return JSON.stringify((Array.isArray(response.data) ? response.data : []).map(mapEmpleado));
    }

    response = await client
      .from("fichajes_registro")
      .select("id,fecha,datos,creado_en");
    if (!response || response.error) {
      throw (response && response.error) || new Error("P2_P06_FICHAJES_READ_FALLO");
    }
    return JSON.stringify((Array.isArray(response.data) ? response.data : []).map(mapFichaje));
  }

  function leerPendientes() {
    var raw = localStorage.getItem("almacen__pendientes");
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  function retirarTargetsPendientes() {
    var actuales = leerPendientes();
    var filtrados = actuales.filter(function (key) {
      return !TARGETS[keyOf(key)];
    });
    if (filtrados.length !== actuales.length) {
      localStorage.setItem("almacen__pendientes", JSON.stringify(filtrados));
      if (typeof window.actualizarIndicador === "function") window.actualizarIndicador();
    }
  }

  function install() {
    var storage = window.storage;
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") return false;
    if (storage.__laServerAuthorityWrappedV2) return true;

    var originalGet = storage.get.bind(storage);
    var originalSet = storage.set.bind(storage);
    var originalDelete = typeof storage.delete === "function" ? storage.delete.bind(storage) : null;
    var originalSubirPendientes = typeof window.subirPendientes === "function"
      ? window.subirPendientes.bind(window) : null;

    storage.get = async function (key, shared) {
      var normalized = keyOf(key);
      if (!TARGETS[normalized]) return originalGet(key, shared);

      var autoridad = await resolverAutoridad();
      if (!autoridad.active) return originalGet(key, shared);

      var value = await leerAutoritativo(autoridad.client, normalized);
      return respuestaStorage(key, value, shared);
    };

    storage.set = async function (key, value, shared) {
      var normalized = keyOf(key);
      if (!TARGETS[normalized]) return originalSet(key, value, shared);

      var autoridad = await resolverAutoridad();
      if (!autoridad.active) return originalSet(key, value, shared);

      return respuestaEscrituraAutoritativa(key, value, shared);
    };

    if (originalDelete) {
      storage.delete = async function (key, shared) {
        var normalized = keyOf(key);
        if (!TARGETS[normalized]) return originalDelete(key, shared);

        var autoridad = await resolverAutoridad();
        if (!autoridad.active) return originalDelete(key, shared);

        return { key: key, deleted: false, shared: !!shared, serverAuthoritative: true };
      };
    }

    if (originalSubirPendientes) {
      window.subirPendientes = async function () {
        var autoridad = await resolverAutoridad();
        if (autoridad.active) retirarTargetsPendientes();
        return originalSubirPendientes.apply(window, arguments);
      };
    }

    Object.defineProperty(storage, "__laServerAuthorityWrappedV2", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return true;
  }

  window.__laInstallServerAuthorityStorageBridge = install;
  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 200) clearInterval(timer);
    }, 10);
  }
})();
