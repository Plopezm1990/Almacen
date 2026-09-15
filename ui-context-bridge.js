(function () {
  "use strict";
  if (window.__laUiContextBridgeV1 || !window.storage) return;
  window.__laUiContextBridgeV1 = true;

  var getAnterior = window.storage.get.bind(window.storage);
  var setAnterior = window.storage.set.bind(window.storage);
  var deleteAnterior = typeof window.storage.delete === "function"
    ? window.storage.delete.bind(window.storage) : null;

  var CLAVES_CONTEXTO = {
    empresas: true,
    locales: true,
    localActivoId: true
  };

  function claveLocal(key) {
    return "almacen:" + key;
  }

  async function esperarBarrera() {
    for (var i = 0; i < 400; i++) {
      if (window.__instalacionSyncPermitida === true) return true;
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    return false;
  }

  function respuesta(key, value) {
    return { key: key, value: value || "", shared: false };
  }

  function leerLocal(key) {
    try { return localStorage.getItem(claveLocal(key)) || ""; }
    catch (e) { return ""; }
  }

  function guardarLocal(key, value) {
    localStorage.setItem(claveLocal(key), value);
    return { key: key, value: value, shared: false };
  }

  async function clienteConSesion() {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("Cliente Supabase no disponible");
    }
    var supabase = await window.getSupabaseClient();
    var rSesion = await supabase.auth.getSession();
    var sesion = rSesion && rSesion.data ? rSesion.data.session : null;
    if (!sesion || !sesion.user || !sesion.user.id) {
      throw new Error("Sesión requerida para guardar empresa/local");
    }
    return { supabase: supabase, sesion: sesion };
  }

  function generacionLocal() {
    try { return localStorage.getItem("la_suite_installation_generation_v1") || ""; }
    catch (e) { return ""; }
  }

  window.storage.get = async function (key, shared) {
    if (key === "pinPropietario") {
      await esperarBarrera();
      return respuesta(key, leerLocal(key));
    }

    if (CLAVES_CONTEXTO[key]) {
      await esperarBarrera();
      return respuesta(key, leerLocal(key));
    }

    return getAnterior(key, shared);
  };

  window.storage.set = async function (key, value, shared) {
    if (key === "pinPropietario") {
      if (!(await esperarBarrera())) throw new Error("Instalación no validada");
      // El propio texto de la UI define este PIN como código local del
      // dispositivo; no se crea un bloque global en almacen_kv.
      return guardarLocal(key, value);
    }

    if (CLAVES_CONTEXTO[key]) {
      if (!(await esperarBarrera())) throw new Error("Instalación no validada");
      var actual = await clienteConSesion();
      var parsed;
      try { parsed = JSON.parse(value); }
      catch (e) { throw new Error("Contexto empresa/local inválido"); }

      var r = await actual.supabase.rpc("guardar_contexto_instalacion_ui", {
        p_clave: key,
        p_valor: parsed
      });
      if (r.error) throw r.error;
      if (!r.data || r.data.state !== "ready" || r.data.generation !== generacionLocal()) {
        throw new Error("El servidor no confirmó el contexto empresa/local");
      }

      if (key === "localActivoId") {
        // La RPC valida que el local elegido pertenece al Propietario. La
        // selección concreta es preferencia de este dispositivo.
        return guardarLocal(key, value);
      }

      if (typeof window.__laOwnerBootstrapSeedUiContext !== "function") {
        throw new Error("Semilla segura del contexto UI no disponible");
      }
      window.__laOwnerBootstrapSeedUiContext(r.data, actual.sesion.user.id);
      return respuesta(key, leerLocal(key));
    }

    return setAnterior(key, value, shared);
  };

  if (deleteAnterior) {
    window.storage.delete = async function (key, shared) {
      if (key === "pinPropietario") {
        if (!(await esperarBarrera())) throw new Error("Instalación no validada");
        localStorage.removeItem(claveLocal(key));
        return { key: key, shared: false };
      }
      // Las colecciones empresa/local nunca se borran como bloques globales.
      // Sus operaciones funcionales pasan por guardar_contexto_instalacion_ui.
      if (CLAVES_CONTEXTO[key]) {
        throw new Error("Borrado directo de contexto empresa/local no permitido");
      }
      return deleteAnterior(key, shared);
    };
  }
})();
