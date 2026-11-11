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

// Barrera post-reset. Antes de leer o sincronizar datos empresariales, una
// sesión autenticada compara la generación local con la generación emitida por
// el servidor. La generación no es un secreto: solo identifica la instalación
// vigente y permite invalidar una copia local anterior sin tocar las
// credenciales de Supabase Auth.
(function () {
  "use strict";
  if (window.__instalacionPostResetInstalada) return;
  window.__instalacionPostResetInstalada = true;

  var CLAVE_GENERACION = "la_suite_installation_generation_v1";
  var CLAVE_RESET_APLICADO = "la_suite_installation_reset_applied_v1";
  var CLAVE_CONTEXTO_SEGURO = "chocoloyos_contexto_operativo_seguro_v1";

  // Nunca se permite sincronizar hasta haber comprobado la generación para la
  // sesión actual. index.html consulta este indicador antes de procesar
  // almacen__pendientes.
  window.__instalacionSyncPermitida = false;

  function borrarDatosNegocioLocales() {
    var claves = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var clave = localStorage.key(i);
        if (!clave) continue;
        if (
          clave.indexOf("almacen:") === 0 ||
          clave.indexOf("almacen__pendientes") === 0 ||
          clave.indexOf("almacen__borrados:") === 0 ||
          // Con una generación nueva no debe sobrevivir nada de la copia anterior (marcas de rechazo, semilla del contexto...).
          clave.indexOf("almacen__") === 0 ||
          clave === CLAVE_CONTEXTO_SEGURO ||
          // Las copias apartadas de otras cuentas pertenecen a la instalación anterior: tampoco pueden volver.
          clave.indexOf("la_suite_copia_cuenta_v1:") === 0 ||
          clave === "la_suite_copia_cuenta_dueno_v1" ||
          clave === "la_suite_copia_cuenta_indice_v1"
        ) {
          claves.push(clave);
        }
      }
      claves.forEach(function (clave) { localStorage.removeItem(clave); });
    } catch (e) {
      throw new Error("No se pudo limpiar la copia local anterior");
    }
  }

  function leerGeneracionLocal() {
    try { return localStorage.getItem(CLAVE_GENERACION); }
    catch (e) { return null; }
  }

  function guardarGeneracionLocal(generacion) {
    try {
      localStorage.setItem(CLAVE_GENERACION, generacion);
      localStorage.setItem(CLAVE_RESET_APLICADO, JSON.stringify({
        generation: generacion,
        appliedAt: Date.now()
      }));
    } catch (e) {
      throw new Error("No se pudo registrar la generación de instalación");
    }
  }

  // M03: este guard se inicia de forma independiente del componente React de
  // sesión. No puede validar la generación ni abrir la sincronización con una
  // sesión AAL1, porque prepararSesionPostReset() puede habilitar la cola y
  // subirPendientes() puede alcanzar RPC protegidas antes del desafío MFA.
  async function mfaAutorizadaParaAplicacion(supabase) {
    if (!supabase || !supabase.auth || !supabase.auth.mfa) return false;
    var aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.error) throw aal.error;
    var factores = await supabase.auth.mfa.listFactors();
    if (factores && factores.error) throw factores.error;
    var totp = factores && factores.data && Array.isArray(factores.data.totp) ? factores.data.totp : [];
    var phone = factores && factores.data && Array.isArray(factores.data.phone) ? factores.data.phone : [];
    var hayFactorVerificado = totp.concat(phone).some(function (factor) {
      return factor && factor.status === "verified";
    });
    return hayFactorVerificado && aal && aal.data && aal.data.currentLevel === "aal2";
  }

  async function prepararSesionPostReset(supabase, sesion) {
    if (!supabase || !sesion || !sesion.user || !sesion.user.id) {
      throw new Error("Sesión no disponible para validar la instalación");
    }

    // Si después falla la red, modo local no puede reabrir la copia antigua de
    // esta sesión autenticada.
    window.__instalacionSesionConNube = true;
    window.__instalacionSyncPermitida = false;

    var generacion = await supabase.rpc("obtener_generacion_instalacion");
    var valor = generacion && generacion.data && generacion.data.generation;
    if (generacion.error || typeof valor !== "string" || !valor) {
      throw new Error("No se pudo validar la generación de instalación");
    }

    var generacionCambiada = leerGeneracionLocal() !== valor;
    if (generacionCambiada) {
      borrarDatosNegocioLocales();
      guardarGeneracionLocal(valor);
    }

    // Copia local por cuenta (D01): la copia viva del navegador pasa a ser solo de esta cuenta. Si era de otra, se
    // aparta entera (no se borra) y se devuelve la de esta cuenta si la tenía. Si algo cambió, quien llama recarga
    // la página (igual que con un cambio de generación) para que el programa arranque con la copia correcta, y la
    // barrera de sincronización no se abre en esta pasada.
    var copiaCambiada = false;
    if (typeof window.__laOwnerBootstrapSepararCopiaLocal === "function") {
      copiaCambiada = window.__laOwnerBootstrapSepararCopiaLocal(sesion.user.id).cambio === true;
    }

    // Este punto solo decide si la copia local pertenece a la instalación
    // vigente. La autorización de la cuenta continúa en el guard existente.
    // No recreamos perfiles ni promovemos cuentas en esta fase.
    if (!copiaCambiada) window.__instalacionSyncPermitida = true;
    return {
      estado: "generacion_validada",
      generacionCambiada: generacionCambiada || copiaCambiada,
      copiaLocalCambiada: copiaCambiada
    };
  }

  window.__prepararSesionPostReset = prepararSesionPostReset;

  // fuente.js es un bundle histórico. Esta inicialización independiente hace
  // efectiva la barrera sin depender de reconstruir ni alterar su contenido.
  async function iniciarBarreraConSesion() {
    var supabase = null;
    for (var intento = 0; intento < 160; intento++) {
      if (typeof window.getSupabaseClient === "function") {
        try { supabase = await window.getSupabaseClient(); } catch (e) {}
        if (supabase) break;
      }
      await new Promise(function (resolver) { setTimeout(resolver, 25); });
    }
    if (!supabase || !supabase.auth) return;

    var recargar = false;
    async function validar(sesion) {
      if (!sesion || recargar) return;
      try {
        if (!(await mfaAutorizadaParaAplicacion(supabase))) {
          window.__instalacionSyncPermitida = false;
          return;
        }
        var resultado = await prepararSesionPostReset(supabase, sesion);
        if (resultado.generacionCambiada) {
          recargar = true;
          window.location.reload();
          return;
        }
        if (typeof window.subirPendientes === "function") await window.subirPendientes();
      } catch (e) {
        // Fallar cerrado evita reenviar una cola no comprobada.
        window.__instalacionSyncPermitida = false;
      }
    }

    try {
      var actual = await supabase.auth.getSession();
      await validar(actual && actual.data ? actual.data.session : null);
      supabase.auth.onAuthStateChange(function (_evento, sesion) {
        validar(sesion);
      });
    } catch (e) {
      window.__instalacionSyncPermitida = false;
    }
  }

  iniciarBarreraConSesion();
})();

// A-05: bloqueo por inactividad del terminal compartido.
// Este control es deliberadamente independiente de autoRefreshToken: renovar
// un JWT en segundo plano no es actividad humana y no debe prolongar el uso de
// un terminal abandonado. Al caducar se elimina el contexto operativo local y
// se cierra la sesión Auth local, de modo que la siguiente persona debe pasar
// por el login server-side completo.
(function () {
  "use strict";
  if (window.__laA05SessionIdleGuardInstalada) return;
  window.__laA05SessionIdleGuardInstalada = true;

  var A05_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
  var A05_CHECK_INTERVAL_MS = 5000;
  var sessionActiva = false;
  var ultimaActividadAt = 0;
  var cerrandoPorInactividad = false;
  var supabaseActivo = null;
  var intervalo = null;

  function limpiarContextoOperativoLocal() {
    // No se borra la copia empresarial ni la cola de pendientes: solo se
    // impide que el siguiente usuario herede la identidad operativa anterior.
    ["modoEmpleado", "usuarioActivoId"].forEach(function (clave) {
      try { localStorage.removeItem("almacen:" + clave); } catch (e) {}
    });
    try { localStorage.removeItem("chocoloyos_contexto_operativo_seguro_v1"); } catch (e) {}
  }

  function detenerReloj() {
    sessionActiva = false;
    ultimaActividadAt = 0;
    if (intervalo !== null) {
      clearInterval(intervalo);
      intervalo = null;
    }
  }

  async function caducarPorInactividad() {
    if (cerrandoPorInactividad || !supabaseActivo) return;
    cerrandoPorInactividad = true;
    limpiarContextoOperativoLocal();
    try {
      await supabaseActivo.auth.signOut({ scope: "local" });
    } catch (e) {
      // Aunque la red falle, la identidad operativa local ya queda retirada.
      detenerReloj();
    } finally {
      cerrandoPorInactividad = false;
    }
  }

  function comprobarInactividad() {
    if (!sessionActiva || !ultimaActividadAt || cerrandoPorInactividad) return;
    if (Date.now() - ultimaActividadAt >= A05_INACTIVITY_TIMEOUT_MS) {
      caducarPorInactividad();
    }
  }

  function registrarActividadHumana() {
    if (sessionActiva && !cerrandoPorInactividad) ultimaActividadAt = Date.now();
  }

  function iniciarReloj(supabase, reiniciarActividad) {
    supabaseActivo = supabase;
    sessionActiva = true;
    if (reiniciarActividad || !ultimaActividadAt) ultimaActividadAt = Date.now();
    if (intervalo === null) intervalo = setInterval(comprobarInactividad, A05_CHECK_INTERVAL_MS);
  }

  function instalarEventos() {
    ["pointerdown", "keydown", "touchstart", "mousedown", "wheel"].forEach(function (evento) {
      window.addEventListener(evento, registrarActividadHumana, { passive: true });
    });
  }

  async function instalarGuardia() {
    var supabase = null;
    for (var intento = 0; intento < 160; intento++) {
      if (window.__nubeActiva && typeof window.getSupabaseClient === "function") {
        try { supabase = await window.getSupabaseClient(); } catch (e) {}
        if (supabase && supabase.auth) break;
      }
      await new Promise(function (resolver) { setTimeout(resolver, 25); });
    }
    if (!supabase || !supabase.auth) return;
    supabaseActivo = supabase;
    instalarEventos();

    try {
      var actual = await supabase.auth.getSession();
      if (actual && actual.data && actual.data.session) iniciarReloj(supabase, true);
      supabase.auth.onAuthStateChange(function (evento, sesion) {
        if (!sesion || evento === "SIGNED_OUT") {
          detenerReloj();
          return;
        }
        // TOKEN_REFRESHED no representa actividad humana y no reinicia el reloj.
        if (evento === "TOKEN_REFRESHED") {
          if (!sessionActiva) iniciarReloj(supabase, false);
          return;
        }
        if (evento === "SIGNED_IN" || evento === "INITIAL_SESSION") {
          iniciarReloj(supabase, true);
        } else if (!sessionActiva) {
          iniciarReloj(supabase, false);
        }
      });
    } catch (e) {
      detenerReloj();
    }
  }

  instalarGuardia();
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
  var contextoLocalIdUsado = null;
  var permisosConsultaCache = Object.create(null);
  var permisosConsultaEnVuelo = Object.create(null);
  var CONTEXTO_TTL_MS = 30000;
  var PERMISOS_CONSULTA_TTL_MS = 5000;
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

  function clavePermisoConsultaPM13(contexto, clave) {
    return [
      contexto && contexto.empresaId || "",
      contexto && contexto.localId || "",
      contexto && contexto.empleado && contexto.empleado.id || "",
      clave
    ].join("|");
  }

  async function permisoConsultaPM13(contexto, clave) {
    if (!contexto || contexto.rol === "Propietario") return true;
    if (!window.__nubeActiva || !contexto.empresaId || !contexto.localId) return false;
    var cacheKey = clavePermisoConsultaPM13(contexto, clave);
    var ahora = Date.now();
    var cacheado = permisosConsultaCache[cacheKey];
    if (cacheado && ahora - cacheado.fecha < PERMISOS_CONSULTA_TTL_MS) return cacheado.permitido;
    if (permisosConsultaEnVuelo[cacheKey]) return permisosConsultaEnVuelo[cacheKey];
    var promesa = (async function () {
      try {
        var supabase = await clienteSupabase();
        var respuesta = await supabase.rpc("pm13_resolver_cargo_permiso", {
          p_empresa_id: contexto.empresaId,
          p_local_id: contexto.localId,
          p_clave: clave,
          p_accion: "CONSULTAR",
          p_alcance: "LOCAL",
          p_empleado_id: contexto.empleado && contexto.empleado.id || null
        });
        var permitido = !!(respuesta && !respuesta.error && respuesta.data && respuesta.data.ok === true && respuesta.data.permitido === true);
        permisosConsultaCache[cacheKey] = { permitido: permitido, fecha: Date.now() };
        return permitido;
      } catch (e) {
        permisosConsultaCache[cacheKey] = { permitido: false, fecha: Date.now() };
        return false;
      } finally {
        delete permisosConsultaEnVuelo[cacheKey];
      }
    })();
    permisosConsultaEnVuelo[cacheKey] = promesa;
    return promesa;
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

  function leerContextoLocal(userId, localIdSolicitado) {
    if (!userId) return null;
    try {
      var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
      if (!guardado || guardado.userId !== userId || !guardado.contexto || !guardado.contexto.rol) return null;
      if (localIdSolicitado && String(guardado.contexto.localId || "") !== String(localIdSolicitado)) return null;
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
  return window.__nubeActiva === false
    && !window.__instalacionSesionConNube
    && !hayContextoAutenticadoGuardado();
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

    var localIdSolicitado = typeof window.__localActivoIdParaContexto === "string" && window.__localActivoIdParaContexto
      ? window.__localActivoIdParaContexto : null;
    var ahora = Date.now();
    if (
      !forzar && contextoCache && contextoUsuarioId === userId &&
      contextoLocalIdUsado === localIdSolicitado &&
      ahora - contextoFecha < CONTEXTO_TTL_MS
    ) {
      return contextoCache;
    }

    if (window.__nubeActiva) {
      try {
        var respuesta = localIdSolicitado
          ? await supabase.rpc("obtener_contexto_operativo", { p_local_id: localIdSolicitado })
          : await supabase.rpc("obtener_contexto_operativo");
        if (!respuesta.error && respuesta.data && respuesta.data.rol) {
          contextoCache = respuesta.data;
          contextoUsuarioId = userId;
          contextoFecha = ahora;
          contextoLocalIdUsado = localIdSolicitado;
          guardarContextoLocal(userId, contextoCache);
          return contextoCache;
        }
      } catch (e) {}
    }

    // Sin red o ante un fallo transitorio se usa únicamente el contexto
    // REDUCIDO que ya fue verificado para esta misma cuenta. Nunca se recupera
    // aquí un blob empresarial completo.
    var local = leerContextoLocal(userId, localIdSolicitado);
    if (local) {
      contextoCache = local;
      contextoUsuarioId = userId;
      contextoFecha = ahora;
      contextoLocalIdUsado = local.localId || null;
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

  function sanitizarEmpleadosLegacy(value) {
    try {
      var lista = JSON.parse(value || "[]");
      if (!Array.isArray(lista)) return "[]";
      return JSON.stringify(lista.map(function (empleado) {
        var copia = Object.assign({}, empleado || {});
        delete copia.pin;
        copia.pinConfigurado = false;
        return copia;
      }));
    } catch (e) {
      return "[]";
    }
  }

  async function empleadosPropietarioSinSecretos(contexto, shared) {
    var base = [];
    try {
      var original = await getOriginal("empleados", shared);
      if (original && original.value) {
        var parsed = JSON.parse(original.value);
        if (Array.isArray(parsed)) base = parsed.map(function (empleado) {
          var copia = Object.assign({}, empleado || {});
          delete copia.pin;
          copia.pinConfigurado = false;
          return copia;
        });
      }
    } catch (e) {}
    if (!contexto || !contexto.empresaId || !contexto.localId) return respuestaStorage("empleados", base);
    try {
      var supabase = await clienteSupabase();
      var remoto = await supabase.rpc("pm11_listar_empleados_modo", {
        p_empresa_id: contexto.empresaId,
        p_local_id: contexto.localId
      });
      if (remoto.error || !remoto.data || remoto.data.ok !== true || !Array.isArray(remoto.data.empleados)) {
        return respuestaStorage("empleados", base);
      }
      var porId = Object.create(null);
      base.forEach(function (empleado) { if (empleado && empleado.id) porId[String(empleado.id)] = empleado; });
      remoto.data.empleados.forEach(function (seguro) {
        if (!seguro || !seguro.id) return;
        var existente = porId[String(seguro.id)];
        if (existente) {
          existente.pinConfigurado = seguro.pinConfigurado === true;
          existente.activo = seguro.activo !== false;
        } else {
          porId[String(seguro.id)] = seguro;
          base.push(seguro);
        }
      });
      return respuestaStorage("empleados", base);
    } catch (e) {
      return respuestaStorage("empleados", base);
    }
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

  function filtrarListaAlLocal(lista, contexto) {
    var localId = contexto && contexto.localId ? String(contexto.localId) : "";
    if (!Array.isArray(lista) || !localId) return [];
    return lista.filter(function (item) {
      var itemLocalId = item && (item.localId || item.local_id);
      return itemLocalId && String(itemLocalId) === localId;
    });
  }

  async function coleccionDelLocal(key, contexto, shared) {
    try {
      var original = await getOriginal(key, shared);
      if (!original || !original.value) return original || respuestaVacia(key);
      return respuestaStorage(key, filtrarListaAlLocal(JSON.parse(original.value), contexto));
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
    if (modoLocalNoReclamado()) return key === "empleados" ? empleadosPropietarioSinSecretos(null, shared) : getOriginal(key, shared);
    return respuestaVacia(key);
  }

    if (rol === "Propietario") {
      if (key === "empleados") return empleadosPropietarioSinSecretos(contexto, shared);
      return getOriginal(key, shared);
    }

    // Sustituciones de mínimo privilegio: el empleado recibe únicamente la
    // parte necesaria para ejecutar su tarea.
    if (key === "productos") {
      return coleccionDelLocal(key, contexto, shared);
    }
    if (key === "empleados") {
      if (!(await permisoConsultaPM13(contexto, "PM13_PERSONAL_CONSULTAR"))) return respuestaStorage(key, []);
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
      if (!(await permisoConsultaPM13(contexto, "PM13_FICHAJE_CONSULTAR"))) return respuestaStorage(key, []);
      return fichajesDelPropioEmpleado(key, contexto, shared);
    }

    if (key === "fichajes" && rol === "Encargado" && !(await permisoConsultaPM13(contexto, "PM13_FICHAJE_CONSULTAR"))) {
      return respuestaStorage(key, []);
    }
    if (!puedeLeer(rol, key)) return respuestaVacia(key);
    return getOriginal(key, shared);
  };

  window.storage.set = async function (key, value, shared, opcionesP3c) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared, opcionesP3c);

    var contexto = null;
    try { contexto = await obtenerContexto(false); } catch (e) {}
    var rol = contexto && contexto.rol;
    if (!rol) {
    if (modoLocalNoReclamado()) return key === "empleados" ? setOriginal(key, sanitizarEmpleadosLegacy(value), shared, opcionesP3c) : setOriginal(key, value, shared, opcionesP3c);
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

    if (rol === "Propietario" && key === "empleados") {
      return setOriginal(key, sanitizarEmpleadosLegacy(value), shared, opcionesP3c);
    }
    return setOriginal(key, value, shared, opcionesP3c);
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
    contextoLocalIdUsado = null;
    permisosConsultaCache = Object.create(null);
    permisosConsultaEnVuelo = Object.create(null);
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

      var perfil = await supabase
        .from("perfiles")
        .select("activo")
        .eq("user_id", userId)
        .maybeSingle();
      if (perfil.error) return;
      if (perfil.data && perfil.data.activo === true) return;
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

// M-03: segundo factor para los roles que pueden operar sobre caja o gestionar
// la empresa. Esta barrera se mantiene fuera del bundle histórico para que la
// exigencia de AAL2 sea auditable y no dependa de una copia local del rol.
(function () {
  "use strict";
  if (window.__laM03MfaGateInstalada) return;
  window.__laM03MfaGateInstalada = true;

  var ROLES_MFA_OBLIGATORIA = {
    "Propietario": true,
    "Encargado": true,
    "Cajero/a": true
  };
  var overlay = null;
  var supabase = null;
  var ejecucion = 0;
  var factorActual = null;
  var challengeActual = null;

  function nodo(tag, texto) {
    var el = document.createElement(tag);
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function limpiarOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    factorActual = null;
    challengeActual = null;
  }

  function crearOverlay() {
    limpiarOverlay();
    overlay = nodo("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "la-m03-titulo");
    overlay.style.cssText = [
      "position:fixed", "inset:0", "z-index:2147483647", "display:flex",
      "align-items:center", "justify-content:center", "padding:24px",
      "background:rgba(15,23,42,.82)", "font-family:system-ui,sans-serif",
      "color:#0f172a"
    ].join(";");
    var tarjeta = nodo("div");
    tarjeta.style.cssText = [
      "width:min(560px,100%)", "max-height:calc(100vh - 48px)",
      "overflow:auto", "background:#fff", "border-radius:16px", "padding:24px",
      "box-shadow:0 20px 60px rgba(0,0,0,.35)"
    ].join(";");
    overlay.appendChild(tarjeta);
    document.body.appendChild(overlay);
    return tarjeta;
  }

  function boton(texto) {
    var b = nodo("button", texto);
    b.type = "button";
    b.style.cssText = [
      "display:block", "width:100%", "margin-top:14px", "padding:11px 14px",
      "border:0", "border-radius:9px", "background:#0f766e", "color:#fff",
      "font-weight:700", "cursor:pointer"
    ].join(";");
    return b;
  }

  function campoCodigo() {
    var input = nodo("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "one-time-code";
    input.maxLength = 6;
    input.pattern = "[0-9]{6}";
    input.placeholder = "Código de 6 dígitos";
    input.setAttribute("aria-label", "Código del autenticador");
    input.style.cssText = [
      "display:block", "width:100%", "box-sizing:border-box", "margin-top:12px",
      "padding:11px", "border:1px solid #94a3b8", "border-radius:8px",
      "font-size:18px", "letter-spacing:.18em", "text-align:center"
    ].join(";");
    return input;
  }

  function mensajeError(tarjeta, texto) {
    var p = nodo("p", texto);
    p.setAttribute("role", "alert");
    p.style.cssText = "margin:12px 0 0;color:#b91c1c;font-weight:600";
    tarjeta.appendChild(p);
  }

  function encabezado(tarjeta, subtitulo) {
    tarjeta.appendChild(nodo("h2", "Verificación adicional requerida"));
    tarjeta.lastChild.id = "la-m03-titulo";
    var p = nodo("p", subtitulo);
    p.style.cssText = "margin:8px 0 0;color:#334155;line-height:1.45";
    tarjeta.appendChild(p);
  }

  async function verificarCodigo(tarjeta, input, botonVerificar) {
    var codigo = String(input.value || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(codigo)) {
      mensajeError(tarjeta, "Introduce un código de 6 dígitos.");
      return;
    }
    botonVerificar.disabled = true;
    try {
      if (!challengeActual) {
        var desafio = await supabase.auth.mfa.challenge({ factorId: factorActual.id });
        if (desafio.error || !desafio.data || !desafio.data.id) throw desafio.error || new Error("No se pudo crear el desafío");
        challengeActual = desafio.data.id;
      }
      var verificacion = await supabase.auth.mfa.verify({
        factorId: factorActual.id,
        challengeId: challengeActual,
        code: codigo
      });
      if (verificacion.error) throw verificacion.error;
      challengeActual = null;
      await comprobarMfa();
    } catch (e) {
      botonVerificar.disabled = false;
      mensajeError(tarjeta, "El código no se ha podido verificar. Comprueba la hora del dispositivo e inténtalo de nuevo.");
    }
  }

  function renderVerificacion(tarjeta, rol) {
    encabezado(tarjeta, "El rol " + rol + " requiere MFA. Introduce el código de tu aplicación autenticadora para continuar.");
    var input = campoCodigo();
    tarjeta.appendChild(input);
    var b = boton("Verificar y continuar");
    b.addEventListener("click", function () { verificarCodigo(tarjeta, input, b); });
    tarjeta.appendChild(b);
    input.focus();
  }

  function renderEnrolamiento(tarjeta, rol, datos) {
    encabezado(tarjeta, "El rol " + rol + " requiere configurar un autenticador TOTP antes de usar la aplicación.");
    tarjeta.appendChild(nodo("p", "Escanea el código QR con una aplicación autenticadora. Si no puedes escanearlo, usa la URI o el secreto que aparecen debajo. No los compartas."));
    if (datos.totp && datos.totp.qr_code) {
      var qr = nodo("img");
      qr.alt = "Código QR para configurar el autenticador";
      qr.src = datos.totp.qr_code;
      qr.style.cssText = "display:block;width:220px;height:220px;margin:16px auto;object-fit:contain";
      tarjeta.appendChild(qr);
    }
    var uri = datos.totp && datos.totp.uri ? String(datos.totp.uri) : "";
    var secreto = datos.totp && datos.totp.secret ? String(datos.totp.secret) : "";
    var detalles = nodo("details");
    detalles.appendChild(nodo("summary", "Mostrar configuración manual"));
    if (uri) detalles.appendChild(nodo("p", "URI: " + uri));
    if (secreto) detalles.appendChild(nodo("p", "Secreto: " + secreto));
    tarjeta.appendChild(detalles);
    var input = campoCodigo();
    tarjeta.appendChild(input);
    var b = boton("Confirmar autenticador");
    b.addEventListener("click", function () { verificarCodigo(tarjeta, input, b); });
    tarjeta.appendChild(b);
    input.focus();
  }

  async function prepararEnrolamiento(tarjeta, rol) {
    try {
      var alta = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "LA Suite - " + rol });
      if (alta.error || !alta.data || !alta.data.id) throw alta.error || new Error("No se pudo iniciar el alta MFA");
      factorActual = alta.data;
      renderEnrolamiento(tarjeta, rol, alta.data);
    } catch (e) {
      mensajeError(tarjeta, "No se pudo iniciar el alta del autenticador. Revisa la configuración MFA del proyecto.");
    }
  }

  async function comprobarMfa() {
    var esta = ++ejecucion;
    if (!window.__nubeActiva || typeof window.getSupabaseClient !== "function") {
      limpiarOverlay();
      return;
    }
    try {
      supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var session = sesion && sesion.data && sesion.data.session;
      if (!session) { limpiarOverlay(); return; }
      var perfil = await supabase.from("perfiles").select("rol,activo").eq("user_id", session.user.id).maybeSingle();
      if (esta !== ejecucion) return;
      if (perfil.error || !perfil.data || perfil.data.activo !== true) {
        var bloqueado = crearOverlay();
        encabezado(bloqueado, "No se pudo validar el perfil activo en el servidor. La aplicación permanecerá bloqueada hasta que la sesión pueda comprobarse.");
        return;
      }
      var rol = perfil.data.rol;
      if (!ROLES_MFA_OBLIGATORIA[rol]) { limpiarOverlay(); return; }
      var aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.error) throw aal.error;
      if (aal.data && aal.data.currentLevel === "aal2") { limpiarOverlay(); return; }
      var factores = await supabase.auth.mfa.listFactors();
      if (factores.error) throw factores.error;
      var totp = factores.data && Array.isArray(factores.data.totp) ? factores.data.totp : [];
      var verificados = totp.filter(function (factor) { return factor && factor.status === "verified"; });
      var tarjeta = crearOverlay();
      if (verificados.length === 0) {
        encabezado(tarjeta, "El rol " + rol + " requiere configurar un autenticador TOTP.");
        var iniciar = boton("Configurar autenticador TOTP");
        iniciar.addEventListener("click", function () {
          iniciar.disabled = true;
          tarjeta.textContent = "Preparando configuración segura…";
          prepararEnrolamiento(tarjeta, rol);
        });
        tarjeta.appendChild(iniciar);
      } else {
        factorActual = verificados[0];
        challengeActual = null;
        renderVerificacion(tarjeta, rol);
      }
    } catch (e) {
      var errorTarjeta = crearOverlay();
      encabezado(errorTarjeta, "No se pudo comprobar el segundo factor en el servidor. La aplicación permanecerá bloqueada hasta que la verificación esté disponible.");
    }
  }

  window.__m03ComprobarMfa = comprobarMfa;
  (async function iniciar() {
    for (var i = 0; i < 160; i++) {
      if (window.__nubeActiva && typeof window.getSupabaseClient === "function") break;
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    if (!window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      supabase = await window.getSupabaseClient();
      supabase.auth.onAuthStateChange(function (evento) {
        if (evento === "SIGNED_OUT") limpiarOverlay();
        else if (evento === "SIGNED_IN" || evento === "PASSWORD_RECOVERY" || evento === "TOKEN_REFRESHED" || evento === "MFA_CHALLENGE_VERIFIED") comprobarMfa();
      });
      comprobarMfa();
    } catch (e) {}
  })();
})();

// PM17 P04: la neutralización de selección y la UX de autenticación ya viven
// en fuente.js. No se inyectan parches externos desde este runtime.
