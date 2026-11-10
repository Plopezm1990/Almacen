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

  function mapPunto(row) {
    if (!row || !row.id) return null;
    return {
      id: row.id,
      nombre: row.nombre || "",
      tipo: row.tipo || "otro",
      frecuencia: row.frecuencia || "Diaria",
      tempMin: row.temp_min == null ? null : Number(row.temp_min),
      tempMax: row.temp_max == null ? null : Number(row.temp_max),
      activo: row.activo !== false,
      localId: row.local_id || null,
      empresaId: row.empresa_id || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }

  async function leerPuntos(client) {
    var response = await client
      .from("appcc_puntos_control")
      .select("id,empresa_id,local_id,nombre,tipo,frecuencia,temp_min,temp_max,activo,created_at,updated_at")
      .order("nombre", { ascending: true });
    if (!response || response.error) throw (response && response.error) || new Error("A03_PUNTOS_READ_FALLO");
    return JSON.stringify((Array.isArray(response.data) ? response.data : []).map(mapPunto).filter(Boolean));
  }

  async function leerLecturas(client) {
    var response = await client
      .from("appcc_lecturas")
      .select("id,punto_control_id,local_id,punto_nombre,tipo,valor,conforme,observaciones,realizada_en,actor_user_id,actor_empleado_id,actor_nombre,created_at")
      .order("realizada_en", { ascending: false });
    if (!response || response.error) throw (response && response.error) || new Error("A03_LECTURAS_READ_FALLO");
    var cancelaciones = await client
      .from("appcc_lectura_cancelaciones")
      .select("lectura_id,motivo,actor_user_id,actor_empleado_id,actor_nombre,created_at");
    if (!cancelaciones || cancelaciones.error) {
      var errorCode = cancelaciones && cancelaciones.error && cancelaciones.error.code;
      var errorMessage = String(cancelaciones && cancelaciones.error && cancelaciones.error.message || "");
      var tablaAunNoAplicada = errorCode === "42P01" || errorCode === "PGRST205" || /appcc_lectura_cancelaciones/i.test(errorMessage);
      if (!tablaAunNoAplicada) throw (cancelaciones && cancelaciones.error) || new Error("A03_CANCELACIONES_READ_FALLO");
      cancelaciones = { data: [] };
    }
    var lecturas = (Array.isArray(response.data) ? response.data : []).map(mapLectura).filter(Boolean);
    var porId = new Map(lecturas.map(function (lectura) { return [lectura.id, lectura]; }));
    (Array.isArray(cancelaciones.data) ? cancelaciones.data : []).forEach(function (cancelacion) {
      var lectura = porId.get(cancelacion.lectura_id);
      if (!lectura) return;
      lectura.cancelado = true;
      lectura.motivoCancelacion = cancelacion.motivo || "";
      lectura.canceladoPor = cancelacion.actor_nombre || cancelacion.actor_user_id || "";
      lectura.canceladoEn = cancelacion.created_at || null;
    });
    return JSON.stringify(lecturas);
  }

  function install() {
    var storage = window.storage;
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") return false;
    if (storage.__laAppccAuthorityWrappedV1) return true;
    var originalGet = storage.get.bind(storage);
    var originalSet = storage.set.bind(storage);

    storage.get = async function (key, shared) {
      var normalized = String(key || "");
      if (normalized !== "registrosAppcc" && normalized !== "puntosControl") return originalGet(key, shared);
      var authority = await resolverAutoridad();
      if (!authority.active) return originalGet(key, shared);
      if (normalized === "puntosControl") return respuestaStorage(key, await leerPuntos(authority.client), shared);
      return respuestaStorage(key, await leerLecturas(authority.client), shared);
    };

    storage.set = async function (key, value, shared, options) {
      var normalized = String(key || "");
      if (normalized !== "registrosAppcc" && normalized !== "puntosControl") return originalSet(key, value, shared, options);
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
