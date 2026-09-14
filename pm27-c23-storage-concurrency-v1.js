(function () {
  "use strict";

  if (typeof window === "undefined" || window.__pm27C23StorageConcurrencyV1) return;
  window.__pm27C23StorageConcurrencyV1 = true;

  var VERSION = "pm27-c23-storage-concurrency-v1";
  var TARGETS = { clientes: true, encargos: true };
  var BASE_PREFIX = "la-suite:c23:base:";
  var installTimer = null;
  var installedStorage = null;
  var originalSubirPendientes = null;
  var replayEnCurso = null;

  function igual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function copia(v) {
    if (v === undefined) return undefined;
    return JSON.parse(JSON.stringify(v));
  }

  function lista(v) {
    return Array.isArray(v) ? v : [];
  }

  function mapaPorId(items) {
    var out = {};
    lista(items).forEach(function (x) {
      if (x && typeof x === "object" && !Array.isArray(x) && x.id) out[x.id] = x;
    });
    return out;
  }

  function dispatch(nombre, detail) {
    try {
      if (window.dispatchEvent && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent(nombre, { detail: detail }));
      }
    } catch (e) {}
  }

  function pendientes() {
    try {
      var v = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function escribirPendientes(items) {
    try {
      var unicos = [];
      lista(items).forEach(function (k) {
        if (typeof k === "string" && unicos.indexOf(k) === -1) unicos.push(k);
      });
      localStorage.setItem("almacen__pendientes", JSON.stringify(unicos));
      if (typeof window.actualizarIndicador === "function") window.actualizarIndicador();
    } catch (e) {}
  }

  function marcarPendiente(key) {
    var p = pendientes();
    if (p.indexOf(key) === -1) p.push(key);
    escribirPendientes(p);
  }

  function quitarPendiente(key) {
    escribirPendientes(pendientes().filter(function (k) { return k !== key; }));
  }

  async function userId() {
    try {
      if (!window.__nubeCliente || !window.__nubeCliente.auth) return "sin-sesion";
      var r = await window.__nubeCliente.auth.getSession();
      return r && r.data && r.data.session && r.data.session.user && r.data.session.user.id || "sin-sesion";
    } catch (e) {
      return "sin-sesion";
    }
  }

  async function cacheKey(key) {
    if (key !== "clientes") return key;
    return key + "::usuario:" + await userId();
  }

  async function baseKey(key) {
    return BASE_PREFIX + key + ":" + (key === "clientes" ? await userId() : "global");
  }

  async function leerBase(key) {
    try {
      var raw = sessionStorage.getItem(await baseKey(key));
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) {
      return undefined;
    }
  }

  async function guardarBase(key, value) {
    try {
      sessionStorage.setItem(await baseKey(key), JSON.stringify(value));
    } catch (e) {}
  }

  async function guardarLocal(key, value) {
    localStorage.setItem("almacen:" + await cacheKey(key), JSON.stringify(value));
  }

  async function leerLocal(key) {
    var raw = localStorage.getItem("almacen:" + await cacheKey(key));
    if (raw === null) throw new Error("c23_cache_local_ausente:" + key);
    return JSON.parse(raw);
  }

  function fusionarListaConBase(enNube, antes, ahora) {
    enNube = lista(enNube);
    antes = lista(antes);
    ahora = lista(ahora);

    var mb = mapaPorId(antes);
    var mn = mapaPorId(enNube);
    var ma = mapaPorId(ahora);
    var resultado = [];
    var conflictos = [];
    var colocados = {};

    ahora.forEach(function (x) {
      if (!x || !x.id) {
        resultado.push(x);
        return;
      }
      colocados[x.id] = true;
      var previo = mb[x.id];
      var remoto = mn[x.id];
      var yoCambie = !previo || !igual(previo, x);
      var remotoCambio = !!previo && !!remoto && !igual(previo, remoto);

      if (yoCambie && remotoCambio && !igual(remoto, x)) {
        conflictos.push({ id: x.id, mio: x, remoto: remoto, base: previo });
        return;
      }

      if (yoCambie) resultado.push(x);
      else if (remoto) resultado.push(remoto);
      // Si estaba en mi base, no lo cambie y ya no existe remoto, se respeta
      // el borrado remoto. No se resucita un registro eliminado por otra pestaña.
    });

    enNube.forEach(function (x) {
      if (!x || !x.id || colocados[x.id]) return;
      if (Object.prototype.hasOwnProperty.call(mb, x.id)) {
        // Ausente de `ahora` pero presente en mi base => borrado intencional local.
        // Si el remoto cambió mientras tanto, el borrado no es seguro.
        if (!igual(mb[x.id], x)) conflictos.push({ id: x.id, mio: null, remoto: x, base: mb[x.id] });
        return;
      }
      resultado.push(x); // alta remota que esta pestaña nunca vio
    });

    return { resultado: resultado, conflictos: conflictos };
  }

  async function sincronizarEncargos(ahora, base) {
    if (!window.__nubeCliente) throw new Error("c23_nube_no_disponible");
    var r = await window.__nubeCliente.from("almacen_kv").select("value").eq("key", "encargos").maybeSingle();
    if (r.error) throw r.error;
    var remoto = r.data && Array.isArray(r.data.value) ? r.data.value : [];
    var f = fusionarListaConBase(remoto, base, ahora);
    if (f.conflictos.length) {
      dispatch("conflicto-fusion", { key: "encargos", conflictos: f.conflictos, bloqueado: true, c23: true });
      throw new Error("c23_conflicto_concurrente:encargos");
    }
    var up = await window.__nubeCliente.from("almacen_kv").upsert({ key: "encargos", value: f.resultado });
    if (up.error) throw up.error;
    return f.resultado;
  }

  function normalizarClienteFila(fila) {
    var d = fila && fila.datos && typeof fila.datos === "object" ? fila.datos : {};
    if (!d.id && fila && fila.id) d = Object.assign({}, d, { id: fila.id });
    if (!d.empresaId && fila && fila.empresa_id) d = Object.assign({}, d, { empresaId: fila.empresa_id });
    return d;
  }

  async function sincronizarClientes(ahora, base) {
    if (!window.__nubeCliente) throw new Error("c23_nube_no_disponible");
    ahora = lista(ahora);
    base = lista(base);
    var invalidos = ahora.filter(function (x) { return !x || !x.id || !x.empresaId; });
    if (invalidos.length) throw new Error("c23_clientes_contexto_invalido");

    var r = await window.__nubeCliente.from("clientes_empresa").select("id,empresa_id,datos");
    if (r.error) throw r.error;
    var remotos = (r.data || []).map(normalizarClienteFila);
    var mb = mapaPorId(base);
    var ma = mapaPorId(ahora);
    var mr = mapaPorId(remotos);
    var conflictos = [];
    var upserts = [];
    var borrar = [];

    ahora.forEach(function (x) {
      var previo = mb[x.id];
      var remoto = mr[x.id];
      var yoCambie = !previo || !igual(previo, x);
      if (!yoCambie) return;
      if (previo && remoto && !igual(previo, remoto) && !igual(remoto, x)) {
        conflictos.push({ id: x.id, mio: x, remoto: remoto, base: previo });
        return;
      }
      if (!previo && remoto && !igual(remoto, x)) {
        // Sin base verificable (p. ej. recuperación de un pendiente tras recarga),
        // no se pisa un registro remoto del mismo id con contenido distinto.
        conflictos.push({ id: x.id, mio: x, remoto: remoto, base: null });
        return;
      }
      if (!remoto || !igual(remoto, x)) {
        upserts.push({ id: x.id, empresa_id: x.empresaId, datos: x, updated_at: new Date().toISOString() });
      }
    });

    base.forEach(function (previo) {
      if (!previo || !previo.id || ma[previo.id]) return;
      var remoto = mr[previo.id];
      if (!remoto) return;
      if (!igual(previo, remoto)) {
        conflictos.push({ id: previo.id, mio: null, remoto: remoto, base: previo });
      } else {
        borrar.push(previo.id);
      }
    });

    if (conflictos.length) {
      dispatch("conflicto-fusion", { key: "clientes", conflictos: conflictos, bloqueado: true, c23: true });
      throw new Error("c23_conflicto_concurrente:clientes");
    }

    if (upserts.length) {
      var ru = await window.__nubeCliente.from("clientes_empresa").upsert(upserts);
      if (ru.error) throw ru.error;
    }
    if (borrar.length) {
      var rd = await window.__nubeCliente.from("clientes_empresa").delete().in("id", borrar);
      if (rd.error) throw rd.error;
    }

    // Resultado autoritativo post-merge. Se preservan altas remotas que esta pestaña
    // no conocía y no se resucitan borrados remotos de registros no modificados aquí.
    var rr = await window.__nubeCliente.from("clientes_empresa").select("id,empresa_id,datos").order("updated_at", { ascending: true });
    if (rr.error) throw rr.error;
    return (rr.data || []).map(normalizarClienteFila);
  }

  async function syncTarget(key, value, base) {
    if (key === "clientes") return sincronizarClientes(value, base);
    if (key === "encargos") return sincronizarEncargos(value, base);
    return value;
  }

  async function setSeguro(key, valueText) {
    var ahora;
    try {
      ahora = JSON.parse(valueText);
    } catch (e) {
      throw new Error("c23_json_invalido:" + key);
    }
    if (!Array.isArray(ahora)) throw new Error("c23_lista_requerida:" + key);

    var base = await leerBase(key);
    await guardarLocal(key, ahora);

    if (!window.__nubeActiva || !window.__nubeCliente) {
      marcarPendiente(key);
      return { key: key, value: valueText, shared: false, pending: true };
    }

    try {
      var merged = await syncTarget(key, ahora, base === undefined ? [] : base);
      await guardarLocal(key, merged);
      await guardarBase(key, merged);
      quitarPendiente(key);
      return { key: key, value: JSON.stringify(merged), shared: false, c23: true };
    } catch (e) {
      marcarPendiente(key);
      throw e;
    }
  }

  async function replayTarget(key) {
    var actual = await leerLocal(key);
    var base = await leerBase(key);
    var merged = await syncTarget(key, actual, base === undefined ? [] : base);
    await guardarLocal(key, merged);
    await guardarBase(key, merged);
    quitarPendiente(key);
  }

  function instalar() {
    if (!window.storage || typeof window.storage.get !== "function" || typeof window.storage.set !== "function") return false;
    if (window.storage.__pm27C23StorageConcurrencyV1) return true;

    installedStorage = window.storage;
    var getOriginal = window.storage.get.bind(window.storage);
    var setOriginal = window.storage.set.bind(window.storage);

    window.storage.get = async function (key) {
      var r = await getOriginal(key);
      if (TARGETS[key] && r && typeof r.value === "string") {
        try {
          // Si hay cambios pendientes se conserva la última base sincronizada de la
          // pestaña. Un get local no puede promoverse a base remota por accidente.
          if (pendientes().indexOf(key) === -1 || await leerBase(key) === undefined) {
            await guardarBase(key, JSON.parse(r.value));
          }
        } catch (e) {}
      }
      return r;
    };

    window.storage.set = async function (key, value) {
      if (!TARGETS[key]) return setOriginal(key, value);
      return setSeguro(key, value);
    };

    window.storage.__pm27C23StorageConcurrencyV1 = VERSION;

    if (typeof window.subirPendientes === "function" && !window.subirPendientes.__pm27C23StorageConcurrencyV1) {
      originalSubirPendientes = window.subirPendientes.bind(window);
      var subirSeguro = async function () {
        if (replayEnCurso) return replayEnCurso;
        replayEnCurso = (async function () {
          var iniciales = pendientes();
          var fallidos = [];

          for (var i = 0; i < iniciales.length; i++) {
            var key = iniciales[i];
            if (!TARGETS[key]) continue;
            try {
              if (window.__nubeActiva && window.__nubeCliente) await replayTarget(key);
              else fallidos.push(key);
            } catch (e) {
              fallidos.push(key);
            }
          }

          // El sincronizador legado no debe tocar clientes/encargos que C23 dejó
          // pendientes por conflicto: se excluyen temporalmente y se restauran.
          var sinTargets = pendientes().filter(function (k) { return !TARGETS[k]; });
          escribirPendientes(sinTargets);
          try {
            await originalSubirPendientes();
          } finally {
            var despues = pendientes();
            fallidos.forEach(function (k) { if (despues.indexOf(k) === -1) despues.push(k); });
            escribirPendientes(despues);
          }
        })();
        try {
          return await replayEnCurso;
        } finally {
          replayEnCurso = null;
        }
      };
      subirSeguro.__pm27C23StorageConcurrencyV1 = VERSION;
      subirSeguro.__original = originalSubirPendientes;
      window.subirPendientes = subirSeguro;
    }

    return true;
  }

  window.__pm27C23StorageConcurrencyTest = {
    fusionarListaConBase: fusionarListaConBase,
    mapaPorId: mapaPorId,
    igual: igual,
    version: VERSION
  };

  if (!instalar()) {
    installTimer = window.setInterval(function () {
      if (instalar()) {
        window.clearInterval(installTimer);
        installTimer = null;
      }
    }, 5);
  }
})();
