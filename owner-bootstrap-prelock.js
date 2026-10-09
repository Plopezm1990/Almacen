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
    obtener_contexto_instalacion_ui: true,
    // Plataforma (D01): panel del administrador. Todas comprueban en el servidor que quien llama es
    // administrador de la plataforma; plataforma_estado solo dice si lo es.
    plataforma_estado: true,
    plataforma_listar_empresas: true,
    plataforma_crear_empresa: true,
    plataforma_desactivar_empresa: true,
    plataforma_reactivar_empresa: true,
    plataforma_resumen_eliminacion: true,
    plataforma_exportar_empresa: true,
    plataforma_preparar_eliminacion: true,
    plataforma_eliminar_empresa: true
  };
  // Única Edge Function que puede llamarse por el canal previo a la barrera: la que crea la cuenta del dueño
  // de una empresa cliente (comprueba en el servidor que quien llama es administrador de la plataforma).
  var FUNCIONES_PERMITIDAS = {
    "plataforma-crear-propietario": true
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

  // ---------------------------------------------------------------------------
  // Copia local separada por cuenta (D01, producto multiempresa).
  //
  // La copia local del programa (almacen:*, almacen__*) no pertenece a ninguna cuenta: si otra cuenta entra en el
  // mismo navegador la hereda, y con varias empresas eso deja ver datos de una en la vista de otra aunque el servidor
  // los proteja (la nube no los da, pero el programa cae a la copia local). Aquí, al validar una sesión, la copia viva
  // pasa a ser SOLO de esa cuenta: la de la cuenta anterior se aparta tal cual (no se borra) y se devuelve intacta
  // cuando esa cuenta vuelve a entrar.
  //
  // Usa las primitivas capturadas ANTES de P1. La barrera temprana devuelve null al leer claves del programa y descarta
  // las escrituras mientras no se valida la sesión: mover claves con las funciones normales habría perdido datos.
  // ---------------------------------------------------------------------------
  var storageRemoveNativo = typeof Storage !== "undefined" ? Storage.prototype.removeItem : null;
  var PREFIJO_COPIA_CUENTA = "la_suite_copia_cuenta_v1:"; // la_suite_copia_cuenta_v1:<cuenta>:<clave original>
  var CLAVE_DUENO_COPIA = "la_suite_copia_cuenta_dueno_v1";
  var CLAVE_INDICE_COPIAS = "la_suite_copia_cuenta_indice_v1";
  var CLAVE_CONTEXTO_SEGURO_COPIA = "chocoloyos_contexto_operativo_seguro_v1";
  var COPIA_SIN_DUENO = "sin-dueno";

  function leerNativo(clave) { return storageGetNativo.call(window.localStorage, clave); }
  function escribirNativo(clave, valor) { storageSetNativo.call(window.localStorage, clave, valor); }
  function quitarNativo(clave) { storageRemoveNativo.call(window.localStorage, clave); }
  function clavesDonde(filtro) {
    var lista = [];
    var ls = window.localStorage;
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (k && filtro(k)) lista.push(k);
    }
    return lista;
  }
  function esClaveDeCopiaLocal(k) {
    return k.indexOf("almacen:") === 0 || k.indexOf("almacen__") === 0 || k === CLAVE_CONTEXTO_SEGURO_COPIA;
  }
  function leerIndiceCopias() {
    try {
      var o = JSON.parse(leerNativo(CLAVE_INDICE_COPIAS) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (e) { return {}; }
  }
  function escribirIndiceCopias(o) {
    try { escribirNativo(CLAVE_INDICE_COPIAS, JSON.stringify(o)); } catch (e) {}
  }
  // De quién es la copia viva: la marca propia; si no hay (copia anterior a esta mejora), la cuenta que sembró el
  // contexto la última vez (almacen__ui_context_seed); si tampoco, de nadie conocido.
  function duenoDeLaCopiaViva(vivas) {
    var marca = leerNativo(CLAVE_DUENO_COPIA);
    if (marca) return marca;
    if (!vivas.length) return "";
    try {
      var semilla = JSON.parse(leerNativo("almacen__ui_context_seed") || "null");
      if (semilla && typeof semilla.userId === "string" && semilla.userId) return semilla.userId;
    } catch (e) {}
    return COPIA_SIN_DUENO;
  }
  // Si el navegador se queda sin espacio, la copia apartada MÁS ANTIGUA de otra cuenta se descarta (es solo una caché
  // de lo que ya está en la nube); nunca la copia viva ni la de las cuentas implicadas.
  function liberarCopiaApartadaMasAntigua(protegidos) {
    var duenos = {};
    clavesDonde(function (k) { return k.indexOf(PREFIJO_COPIA_CUENTA) === 0; }).forEach(function (k) {
      duenos[k.slice(PREFIJO_COPIA_CUENTA.length).split(":")[0]] = true;
    });
    var candidatos = Object.keys(duenos).filter(function (d) { return protegidos.indexOf(d) === -1; });
    if (!candidatos.length) return false;
    var indice = leerIndiceCopias();
    candidatos.sort(function (a, b) { return (indice[a] || 0) - (indice[b] || 0); });
    var victima = candidatos[0];
    var prefijo = PREFIJO_COPIA_CUENTA + victima + ":";
    clavesDonde(function (k) { return k.indexOf(prefijo) === 0; }).forEach(quitarNativo);
    delete indice[victima];
    escribirIndiceCopias(indice);
    return true;
  }
  function escribirConEspacio(clave, valor, protegidos) {
    for (var intento = 0; intento < 12; intento++) {
      try { escribirNativo(clave, valor); return; }
      catch (e) { if (!liberarCopiaApartadaMasAntigua(protegidos)) throw e; }
    }
    throw new Error("No hay espacio en el navegador para separar la copia local");
  }

  window.__laOwnerBootstrapSepararCopiaLocal = function (userId) {
    if (!storageGetNativo || !storageSetNativo || !storageRemoveNativo || !window.localStorage) {
      throw new Error("Almacenamiento local no disponible para separar la copia local");
    }
    if (typeof userId !== "string" || !userId || userId.indexOf(":") !== -1) {
      throw new Error("Cuenta no válida para la copia local");
    }
    var vivas = clavesDonde(esClaveDeCopiaLocal);
    var dueno = duenoDeLaCopiaViva(vivas);
    var movidas = 0;
    var restauradas = 0;

    // 1) La copia viva de otra cuenta se aparta entera (nada se borra). Si se interrumpe, la marca de dueño sigue
    //    siendo la anterior y la siguiente pasada la termina.
    if (dueno && dueno !== userId) {
      var protegidos = [dueno, userId];
      vivas.forEach(function (k) {
        var valor = leerNativo(k);
        if (valor !== null) escribirConEspacio(PREFIJO_COPIA_CUENTA + dueno + ":" + k, valor, protegidos);
        quitarNativo(k);
        movidas++;
      });
      if (movidas) {
        var indice = leerIndiceCopias();
        indice[dueno] = Date.now();
        escribirIndiceCopias(indice);
      }
    }

    // 2) Desde aquí la copia viva es de esta cuenta.
    if (leerNativo(CLAVE_DUENO_COPIA) !== userId) escribirConEspacio(CLAVE_DUENO_COPIA, userId, [userId]);

    // 3) Se le devuelve su copia apartada, si la tenía (también termina una devolución interrumpida). Lo que ya
    //    esté vivo manda: es más reciente.
    var prefijoPropio = PREFIJO_COPIA_CUENTA + userId + ":";
    clavesDonde(function (k) { return k.indexOf(prefijoPropio) === 0; }).forEach(function (k) {
      var original = k.slice(prefijoPropio.length);
      if (leerNativo(original) === null) {
        escribirConEspacio(original, leerNativo(k), [userId]);
        restauradas++;
      }
      quitarNativo(k);
    });

    return { cambio: movidas > 0 || restauradas > 0, movidas: movidas, restauradas: restauradas, duenoAnterior: dueno || null };
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

  window.__laOwnerBootstrapFunction = async function (nombre, token, cuerpo) {
    if (!fetchNativo || !FUNCIONES_PERMITIDAS[nombre]) throw new Error("Función de servidor no permitida");
    var base = String(window.NUBE_URL || "").replace(/\/+$/, "");
    var apikey = String(window.NUBE_CLAVE || "");
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) throw new Error("Backend Supabase no válido");
    if (!apikey || !token) throw new Error("Credenciales de sesión no disponibles");

    var respuesta = await fetchNativo(base + "/functions/v1/" + nombre, {
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
      var detalle = datos && (datos.error || datos.message || datos.msg);
      throw new Error(detalle || ("Función de servidor HTTP " + respuesta.status));
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
