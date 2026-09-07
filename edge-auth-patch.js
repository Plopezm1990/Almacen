// Compatibilidad de seguridad para el bundle desplegado de Chocoloyos Almacén.
//
// El bundle actual hace algunas llamadas directas con fetch() a Edge Functions.
// Para poder exigir sesión dentro de esas funciones sin recompilar el bundle
// completo, este pequeño adaptador añade el access_token del usuario solamente
// a los endpoints protegidos. La autorización REAL se valida siempre de nuevo
// dentro de cada Edge Function; este archivo solo transporta el token.
(function () {
  "use strict";

  var fetchOriginal = window.fetch.bind(window);
  var ORIGEN_FUNCTIONS = "https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/";
  var PROTEGIDAS = {
    "importar-albaran": true,
    "importar-nomina": true,
    "enviar-notificacion": true,
    "entrevista-personal": true
  };

  function respuestaSinSesion(mensaje) {
    return new Response(
      JSON.stringify({ ok: false, error: mensaje }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.indexOf(ORIGEN_FUNCTIONS) !== 0) return fetchOriginal(input, init);

    var nombreFuncion = url.slice(ORIGEN_FUNCTIONS.length).split(/[?#]/)[0];
    if (!PROTEGIDAS[nombreFuncion]) return fetchOriginal(input, init);

    try {
      if (typeof window.getSupabaseClient !== "function") {
        return respuestaSinSesion("No se pudo comprobar la sesión. Recarga la aplicación.");
      }

      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var token = resultadoSesion && resultadoSesion.data && resultadoSesion.data.session
        ? resultadoSesion.data.session.access_token : null;

      if (!token) return respuestaSinSesion("No hay sesión activa — vuelve a iniciar sesión.");

      var opciones = Object.assign({}, init || {});
      var headers = new Headers(
        opciones.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined)
      );
      if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + token);
      opciones.headers = headers;

      return fetchOriginal(input, opciones);
    } catch (e) {
      return respuestaSinSesion("No se pudo comprobar la sesión. Vuelve a iniciar sesión.");
    }
  };
})();

// Contexto operativo mínimo + barrera de copias locales por rol.
//
// El programa es local-first: una colección puede seguir existiendo en el
// localStorage aunque el RLS de Supabase ya no permita leerla. Esta capa evita
// que una cuenta de empleado herede datos que dejó un Propietario en el mismo
// navegador. NO borra la copia local: solamente impide entregarla a la app.
(function () {
  "use strict";
  if (window.__contextoRolSeguroInstalado || !window.storage) return;
  window.__contextoRolSeguroInstalado = true;

  var getOriginal = window.storage.get.bind(window.storage);
  var setOriginal = window.storage.set.bind(window.storage);
  var deleteOriginal = typeof window.storage.delete === "function"
    ? window.storage.delete.bind(window.storage) : null;

  var contextoCache = null;
  var contextoUsuarioId = null;
  var contextoFecha = 0;
  var CONTEXTO_TTL_MS = 30000;
  var CACHE_LOCAL = "chocoloyos_contexto_operativo_seguro_v1";

  var CLAVES_COMUNES = [
    "productos", "disenoMenu", "temaOscuro", "modoEmpleado",
    "usuarioActivoId", "localActivoId", "movimientos", "fichajes"
  ];

  var CLAVES_ENCARGADO = [
    "proveedores", "pedidos", "conteos", "fichasCosto", "albaranes",
    "catalogoProv", "registrosAppcc", "puntosControl", "arqueos", "turnos",
    "ordenesProduccion", "locales", "movimientosCaja", "devoluciones",
    "freidoras", "registrosAceite", "traspasos"
  ];

  var CLAVES_CAJERO = [
    "arqueos", "movimientosCaja", "devoluciones"
  ];

  var CLAVES_CHURRERO = [
    "pedidos", "conteos", "albaranes", "catalogoProv", "ordenesProduccion",
    "freidoras", "registrosAceite", "traspasos"
  ];

  var CLAVES_SOLO_PROPIETARIO = [
    "historialRespaldos", "gastosGenerales", "empleados", "clientes",
    "encargos", "pinPropietario", "facturasDirectas", "nominas",
    "auditoria", "entrevistas"
  ];

  function mapaDe(listas) {
    var mapa = Object.create(null);
    listas.forEach(function (lista) {
      lista.forEach(function (key) { mapa[key] = true; });
    });
    return mapa;
  }

  var CLAVES_CONTROLADAS = mapaDe([
    CLAVES_COMUNES,
    CLAVES_ENCARGADO,
    CLAVES_CAJERO,
    CLAVES_CHURRERO,
    CLAVES_SOLO_PROPIETARIO
  ]);

  function estaEn(lista, key) {
    return lista.indexOf(key) !== -1;
  }

  function puedeLeer(rol, key) {
    if (rol === "Propietario") return !!CLAVES_CONTROLADAS[key];
    if (estaEn(CLAVES_COMUNES, key)) return true;
    if (rol === "Encargado" && estaEn(CLAVES_ENCARGADO, key)) return true;
    if (rol === "Cajero/a" && estaEn(CLAVES_CAJERO, key)) return true;
    if (rol === "Churrero/a" && estaEn(CLAVES_CHURRERO, key)) return true;
    return false;
  }

  function puedeEscribir(rol, key) {
    if (rol === "Propietario") return !!CLAVES_CONTROLADAS[key];
    // auditoria_registro permite INSERT a cualquier perfil activo, aunque la
    // lectura del histórico completo siga reservada al Propietario.
    if (key === "auditoria") return true;
    if (estaEn(CLAVES_COMUNES, key)) return true;
    if (rol === "Encargado" && estaEn(CLAVES_ENCARGADO, key)) return true;
    if (rol === "Cajero/a" && estaEn(CLAVES_CAJERO, key)) return true;
    if (rol === "Churrero/a" && estaEn(CLAVES_CHURRERO, key)) return true;
    return false;
  }

  async function clienteSupabase() {
    for (var i = 0; i < 80; i++) {
      if (typeof window.getSupabaseClient === "function") return window.getSupabaseClient();
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    throw new Error("Cliente Supabase no disponible");
  }

  function guardarContextoLocal(userId, contexto) {
    if (!userId || !contexto || !contexto.rol) return;
    try {
      localStorage.setItem(CACHE_LOCAL, JSON.stringify({
        userId: userId,
        contexto: contexto,
        verificadoEn: Date.now()
      }));
    } catch (e) {}
  }

  function leerContextoLocal(userId) {
    if (!userId) return null;
    try {
      var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
      if (!guardado || guardado.userId !== userId || !guardado.contexto || !guardado.contexto.rol) return null;
      return guardado.contexto;
    } catch (e) {
      return null;
    }
  }

  // Compatibilidad con instalaciones que siempre han trabajado sin cuenta:
// si este navegador nunca ha guardado un contexto autenticado, sus datos
// locales siguen siendo un espacio local legítimo. En cuanto una cuenta se
// verifica aquí, CACHE_LOCAL reclama el navegador y cerrar sesión no permite
// saltarse el aislamiento de roles.
function hayContextoAutenticadoGuardado() {
  try {
    var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
    return !!(guardado && guardado.userId && guardado.contexto && guardado.contexto.rol);
  } catch (e) {
    return false;
  }
}

function modoLocalNoReclamado() {
  return window.__nubeActiva === false && !hayContextoAutenticadoGuardado();
}

  async function sesionActual(supabase) {
    try {
      var resultado = await supabase.auth.getSession();
      return resultado && resultado.data ? resultado.data.session : null;
    } catch (e) {
      return null;
    }
  }

  async function obtenerContexto(forzar) {
    var supabase = await clienteSupabase();
    var sesion = await sesionActual(supabase);
    var userId = sesion && sesion.user ? sesion.user.id : null;
    if (!userId) return null;

    var ahora = Date.now();
    if (
      !forzar && contextoCache && contextoUsuarioId === userId &&
      ahora - contextoFecha < CONTEXTO_TTL_MS
    ) {
      return contextoCache;
    }

    if (window.__nubeActiva) {
      try {
        var respuesta = await supabase.rpc("obtener_contexto_operativo");
        if (!respuesta.error && respuesta.data && respuesta.data.rol) {
          contextoCache = respuesta.data;
          contextoUsuarioId = userId;
          contextoFecha = ahora;
          guardarContextoLocal(userId, contextoCache);
          return contextoCache;
        }
      } catch (e) {}
    }

    // Sin red o ante un fallo transitorio se usa únicamente el contexto
    // REDUCIDO que ya fue verificado para esta misma cuenta. Nunca se recupera
    // aquí un blob empresarial completo.
    var local = leerContextoLocal(userId);
    if (local) {
      contextoCache = local;
      contextoUsuarioId = userId;
      contextoFecha = ahora;
      return local;
    }
    return null;
  }

  function respuestaStorage(key, valor) {
    return { key: key, value: JSON.stringify(valor), shared: false };
  }

  // loadKey() usa su fallback cuando res.value está vacío.
  function respuestaVacia(key) {
    return { key: key, value: "", shared: false };
  }

  function encargosSoloCaja(cobros) {
    if (!Array.isArray(cobros) || cobros.length === 0) return [];
    return [{ id: "contexto-caja", cobros: cobros }];
  }

  function empleadoDelContexto(contexto) {
    if (contexto && contexto.empleado && contexto.empleado.id) return contexto.empleado;
    var lista = contexto && Array.isArray(contexto.empleadosFichaje)
      ? contexto.empleadosFichaje : [];
    return lista.length === 1 ? lista[0] : null;
  }

  async function fichajesDelPropioEmpleado(key, contexto, shared) {
    var empleado = empleadoDelContexto(contexto);
    if (!empleado || !empleado.id) return respuestaStorage(key, []);
    try {
      var original = await getOriginal(key, shared);
      if (!original || !original.value) return original || respuestaVacia(key);
      var lista = JSON.parse(original.value);
      if (!Array.isArray(lista)) return respuestaStorage(key, []);
      return respuestaStorage(key, lista.filter(function (f) {
        return f && f.empleadoId === empleado.id;
      }));
    } catch (e) {
      return respuestaStorage(key, []);
    }
  }

  window.storage.get = async function (key, shared) {
    if (!CLAVES_CONTROLADAS[key]) return getOriginal(key, shared);

    var contexto = null;
    try { contexto = await obtenerContexto(false); } catch (e) {}
    var rol = contexto && contexto.rol;

    // Si hay una sesión pero no se ha podido verificar su rol, se falla
    // cerrado para las colecciones empresariales controladas. loadKey aplicará
    // el fallback del módulo sin borrar la copia local.
    if (!rol) {
    if (modoLocalNoReclamado()) return getOriginal(key, shared);
    return respuestaVacia(key);
  }

    if (rol === "Propietario") return getOriginal(key, shared);

    // Sustituciones de mínimo privilegio: el empleado recibe únicamente la
    // parte necesaria para ejecutar su tarea.
    if (key === "empleados") {
      return respuestaStorage(key, Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : []);
    }
    if (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) {
      return respuestaStorage(key, Array.isArray(contexto.proveedores) ? contexto.proveedores : []);
    }
    if (key === "fichasCosto" && rol === "Churrero/a") {
      return respuestaStorage(key, Array.isArray(contexto.fichasProduccion) ? contexto.fichasProduccion : []);
    }
    if (key === "encargos" && rol === "Cajero/a") {
      return respuestaStorage(key, encargosSoloCaja(contexto.cobrosEncargos));
    }
    if (key === "fichajes" && rol !== "Encargado") {
      return fichajesDelPropioEmpleado(key, contexto, shared);
    }

    if (!puedeLeer(rol, key)) return respuestaVacia(key);
    return getOriginal(key, shared);
  };

  window.storage.set = async function (key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);

    var contexto = null;
    try { contexto = await obtenerContexto(false); } catch (e) {}
    var rol = contexto && contexto.rol;
    if (!rol) {
    if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
    return { key: key, value: value, shared: false };
  }

    if (rol !== "Propietario") {
      var resumenSoloLectura =
        key === "empleados" ||
        (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) ||
        (key === "fichasCosto" && rol === "Churrero/a") ||
        (key === "encargos" && rol === "Cajero/a");
      if (resumenSoloLectura || !puedeEscribir(rol, key)) {
        return { key: key, value: value, shared: false };
      }
    }

    return setOriginal(key, value, shared);
  };

  if (deleteOriginal) {
    window.storage.delete = async function (key, shared) {
      if (!CLAVES_CONTROLADAS[key]) return deleteOriginal(key, shared);
      var contexto = null;
      try { contexto = await obtenerContexto(false); } catch (e) {}
      if (!contexto || contexto.rol !== "Propietario") {
        if (!contexto && modoLocalNoReclamado()) return deleteOriginal(key, shared);
        return { key: key, shared: false };
      }
      return deleteOriginal(key, shared);
    };
  }

  window.__recargarContextoOperativo = function () {
    contextoCache = null;
    contextoUsuarioId = null;
    contextoFecha = 0;
    return obtenerContexto(true);
  };
})();

// Si un perfil se desactiva mientras la aplicación está abierta, se elimina
// la sesión LOCAL del navegador y se vuelve a la pantalla de acceso.
(function () {
  "use strict";
  if (window.__guardPerfilActivoInstalado) return;
  window.__guardPerfilActivoInstalado = true;
  var bloqueando = false;

  async function comprobarPerfilActivo() {
    if (bloqueando || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      var supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user
        ? sesion.data.session.user.id : null;
      if (!userId) return;
      var perfil = await supabase.from("perfiles").select("activo").eq("user_id", userId).maybeSingle();
      if (perfil.error) return;
      if (!perfil.data || perfil.data.activo !== true) {
        bloqueando = true;
        try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
        window.location.reload();
      }
    } catch (e) {}
  }

  window.setInterval(comprobarPerfilActivo, 30000);
  window.addEventListener("focus", comprobarPerfilActivo);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") comprobarPerfilActivo();
  });
  setTimeout(comprobarPerfilActivo, 1000);
})();

// Capa visual temporal para que Prefiltros y Entrevistas no muestren
// puntuaciones ni recomendaciones automáticas mientras se adapta el bundle
// principal. No guarda ni modifica datos.
(function () {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();

// UX de autenticación: recuperación de contraseña y cierre de sesión visible
// para Propietario. Se carga como un parche separado para mantener esta capa
// de seguridad pequeña y reversible.
(function () {
  "use strict";
  if (document.querySelector('script[data-auth-ux="1"]')) return;
  var script = document.createElement("script");
  script.src = "./auth-ux-patch.js?v=1";
  script.defer = true;
  script.setAttribute("data-auth-ux", "1");
  (document.head || document.documentElement).appendChild(script);
})();