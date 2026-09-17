(function () {
  "use strict";

  if (window.__laServerAuthorityStorageBridgeV1) return;
  window.__laServerAuthorityStorageBridgeV1 = true;

  var TARGETS = Object.freeze({ empleados: true, fichajes: true });
  var authoritative = Object.create(null);
  var capabilityPromise = null;

  function keyOf(key) {
    return String(key == null ? "" : key).trim();
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

  async function serverAuthorityAvailable(client) {
    if (!capabilityPromise) {
      capabilityPromise = Promise.resolve(client.rpc("p2_server_authority_capabilities"))
        .then(function (response) {
          if (!response || response.error || !capabilityOk(response.data)) {
            throw (response && response.error) || new Error("P2_P06_CAPABILITY_NO_DISPONIBLE");
          }
          return true;
        })
        .catch(function (error) {
          capabilityPromise = null;
          throw error;
        });
    }
    return capabilityPromise;
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

  async function authoritativeRead(key) {
    var client = await getClient();
    await serverAuthorityAvailable(client);

    var response;
    if (key === "empleados") {
      response = await client
        .from("empleados")
        .select("id,empresa_id,local_id,estado,nombre,datos,created_at,updated_at,baja_at,reactivado_at,anonimizado_at");
      if (!response || response.error) throw (response && response.error) || new Error("P2_P06_EMPLEADOS_READ_FALLO");
      return JSON.stringify((Array.isArray(response.data) ? response.data : []).map(mapEmpleado));
    }

    response = await client
      .from("fichajes_registro")
      .select("id,fecha,datos,creado_en");
    if (!response || response.error) throw (response && response.error) || new Error("P2_P06_FICHAJES_READ_FALLO");
    return JSON.stringify((Array.isArray(response.data) ? response.data : []).map(mapFichaje));
  }

  function install() {
    var storage = window.storage;
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") return false;
    if (storage.__laServerAuthorityWrappedV1) return true;

    var originalGet = storage.get.bind(storage);
    var originalSet = storage.set.bind(storage);

    storage.get = async function (key) {
      var args = Array.prototype.slice.call(arguments, 1);
      var normalized = keyOf(key);
      if (!TARGETS[normalized]) return originalGet.apply(null, [key].concat(args));

      try {
        var value = await authoritativeRead(normalized);
        authoritative[normalized] = true;
        return value;
      } catch (_error) {
        authoritative[normalized] = false;
        return originalGet.apply(null, [key].concat(args));
      }
    };

    storage.set = async function (key, value) {
      var args = Array.prototype.slice.call(arguments, 2);
      var normalized = keyOf(key);
      if (!TARGETS[normalized]) return originalSet.apply(null, [key, value].concat(args));

      if (!authoritative[normalized]) {
        try {
          var client = await getClient();
          await serverAuthorityAvailable(client);
          authoritative[normalized] = true;
        } catch (_error) {
          authoritative[normalized] = false;
        }
      }

      if (authoritative[normalized]) {
        return { ok: true, serverAuthoritative: true, key: normalized };
      }
      return originalSet.apply(null, [key, value].concat(args));
    };

    Object.defineProperty(storage, "__laServerAuthorityWrappedV1", {
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
