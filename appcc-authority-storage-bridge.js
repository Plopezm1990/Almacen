(function () {
  "use strict";

  if (window.__laAppccAuthorityStorageBridgeV1) return;
  window.__laAppccAuthorityStorageBridgeV1 = true;

  var capabilityClient = null;
  var capabilityActive = false;

  function respuestaStorage(key, value, shared) {
    return { key: key, value: value, shared: !!shared, serverAuthoritative: true };
  }

  async function getClient() {
    if (typeof window.getSupabaseClient !== "function") throw new Error("A03_SUPABASE_NO_DISPONIBLE");
    var client = await window.getSupabaseClient();
    if (!client || typeof client.from !== "function") throw new Error("A03_SUPABASE_INVALIDO");
    return client;
  }

  async function resolverAutoridad() {
    var client;
    try { client = await getClient(); } catch (_error) { return { active: false, client: null }; }
    if (client === capabilityClient && capabilityActive) return { active: true, client: client };
    try {
      var probe = await client.from("appcc_lecturas").select("id").limit(1);
      if (probe && !probe.error) {
        capabilityClient = client;
        capabilityActive = true;
        window.__laAppccAuthorityActive = true;
        return { active: true, client: client };
      }
    } catch (_error2) {}
    window.__laAppccAuthorityActive = false;
    return { active: false, client: client };
  }

  function mapLectura(row) {
    if (!row || !row.id) return null;
    var created = row.realizada_en || row.created_at || null;
    var text = created ? String(created) : "";
    return {
      id: row.id,
      fecha: text ? text.slice(0, 10) : "",
      hora: text.length >= 16 ? text.slice(11, 16) : "",
      puntoId: row.punto_control_id || "",
      puntoNombre: row.punto_nombre || "",
      tipo: row.tipo || "otro",
      valor: row.valor == null ? "" : String(row.valor),
      conforme: row.conforme !== false,
      observaciones: row.observaciones || "",
      responsable: row.actor_nombre || row.actor_user_id || "",
      actorUserId: row.actor_user_id || null,
      actorEmpleadoId: row.actor_empleado_id || null,
      createdAt: created,
      localId: row.local_id || null,
      cancelado: false
    };
  }

  async function leerLecturas(client) {
    var response = await client
      .from("appcc_lecturas")
      .select("id,punto_control_id,local_id,punto_nombre,tipo,valor,conforme,observaciones,realizada_en,actor_user_id,actor_empleado_id,actor_nombre,created_at")
      .order("realizada_en", { ascending: false });
    if (!response || response.error) throw (response && response.error) || new Error("A03_LECTURAS_READ_FALLO");
    return JSON.stringify((Array.isArray(response.data) ? response.data : []).map(mapLectura).filter(Boolean));
  }

  function install() {
    var storage = window.storage;
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") return false;
    if (storage.__laAppccAuthorityWrappedV1) return true;
    var originalGet = storage.get.bind(storage);
    var originalSet = storage.set.bind(storage);

    storage.get = async function (key, shared) {
      if (String(key || "") !== "registrosAppcc") return originalGet(key, shared);
      var authority = await resolverAutoridad();
      if (!authority.active) return originalGet(key, shared);
      return respuestaStorage(key, await leerLecturas(authority.client), shared);
    };

    storage.set = async function (key, value, shared, options) {
      if (String(key || "") !== "registrosAppcc") return originalSet(key, value, shared, options);
      var authority = await resolverAutoridad();
      if (authority.active) return respuestaStorage(key, value, shared);
      return originalSet(key, value, shared, options);
    };

    Object.defineProperty(storage, "__laAppccAuthorityWrappedV1", {
      value: true, configurable: false, enumerable: false, writable: false
    });
    return true;
  }

  window.__laInstallAppccAuthorityStorageBridge = install;
  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 200) clearInterval(timer);
    }, 10);
  }
})();
