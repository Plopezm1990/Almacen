
## setOriginal =

### 1876659
```js
* () {
          var options = _arguments2.length > 0 && _arguments2[0] !== void 0 ? _arguments2[0] : {};
          _this.start(_objectSpread({
            enableRedraw: true,
            ignoreAnimation: true,
            ignoreMouse: true
          }, options));
          yield _this.ready();
          _this.stop();
        })();
      }
      /**
       * Start rendering.
       * @param options - Render options.
       */
      start() {
        var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        var {
          documentElement,
          screen,
          options: baseOptions
        } = this;
        screen.start(documentElement, _objectSpread(_objectSpread({
          enableRedraw: true
        }, baseOptions), options));
      }
      /**
       * Stop rendering.
       */
      stop() {
        this.screen.stop();
      }
      /**
       * Resize SVG to fit in given size.
       * @param width
       * @param height
       * @param preserveAspectRatio
       */
      resize(width) {
        var height = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : width;
        var preserveAspectRatio = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
        this.documentElement.resize(width, height, preserveAspectRatio);
      }
    };
  }
});

// ../edge-auth-patch.js
(function() {
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
  window.fetch = async function(input, init) {
    var url = typeof input === "string" ? input : input && input.url || "";
    if (url.indexOf(ORIGEN_FUNCTIONS) !== 0) return fetchOriginal(input, init);
    var nombreFuncion = url.slice(ORIGEN_FUNCTIONS.length).split(/[?#]/)[0];
    if (!PROTEGIDAS[nombreFuncion]) return fetchOriginal(input, init);
    try {
      if (typeof window.getSupabaseClient !== "function") {
        return respuestaSinSesion("No se pudo comprobar la sesi\xF3n. Recarga la aplicaci\xF3n.");
      }
      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var token = resultadoSesion && resultadoSesion.data && resultadoSesion.data.session ? resultadoSesion.data.session.access_token : null;
      if (!token) return respuestaSinSesion("No hay sesi\xF3n activa \u2014 vuelve a iniciar sesi\xF3n.");
      var opciones = Object.assign({}, init || {});
      var headers = new Headers(
        opciones.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : void 0)
      );
      if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + token);
      opciones.headers = headers;
      return fetchOriginal(input, opciones);
    } catch (e2) {
      return respuestaSinSesion("No se pudo comprobar la sesi\xF3n. Vuelve a iniciar sesi\xF3n.");
    }
  };
})();
(function() {
  "use strict";
  if (window.__contextoRolSeguroInstalado || !window.storage) return;
  window.__contextoRolSeguroInstalado = true;
  var getOriginal = window.storage.get.bind(window.storage);
  var setOriginal = window.storage.set.bind(window.storage);
  var deleteOriginal = typeof window.storage.delete === "function" ? window.storage.delete.bind(window.storage) : null;
  var contextoCache = null;
  var contextoUsuarioId = null;
  var contextoFecha = 0;
  var CONTEXTO_TTL_MS = 3e4;
  var CACHE_LOCAL = "chocoloyos_contexto_operativo_seguro_v1";
  var CLAVES_COMUNES = [
    "productos",
    "disenoMenu",
    "temaOscuro",
    "modoEmpleado",
    "usuarioActivoId",
    "localActivoId",
    "movimientos",
    "fichajes"
  ];
  var CLAVES_ENCARGADO = [
    "proveedores",
    "pedidos",
    "conteos",
    "fichasCosto",
    "albaranes",
    "catalogoProv",
    "registrosAppcc",
    "puntosControl",
    "arqueos",
    "turnos",
    "ordenesProduccion",
    "locales",
    "movimientosCaja",
    "devoluciones",
    "freidoras",
    "registrosAceite",
    "traspasos"
  ];
  var CLAVES_CAJERO = [
    "arqueos",
    "movimientosCaja",
    "devoluciones"
  ];
  var CLAVES_CHURRERO = [
    "pedidos",
    "conteos",
    "albaranes",
    "catalogoProv",
    "ordenesProduccion",
    "freidoras",
    "registrosAceite",
    "traspasos"
  ];
  var CLAVES_SOLO_PROPIETARIO = [
    "historialRespaldos",
    "gastosGenerales",
    "empleados",
    "clientes",
    "encargos",
    "pinPropietario",
    "facturasDirectas",
    "nominas",
    "auditoria",
    "entrevistas"
  ];
  function mapaDe(listas) {
    var mapa = /* @__PURE__ */ Object.create(null);
    listas.forEach(function(lista) {
      lista.forEach(function(key) {
        mapa[key] = true;
      });
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
    if (key === "auditoria") return true;
    if (estaEn(CLAVES_COMUNES, key)) return true;
    if (rol === "Encargado" && estaEn(CLAVES_ENCARGADO, key)) return true;
    if (rol === "Cajero/a" && estaEn(CLAVES_CAJERO, key)) return true;
    if (rol === "Churrero/a" && estaEn(CLAVES_CHURRERO, key)) return true;
    return false;
  }
  async function clienteSupabase() {
    for (var i4 = 0; i4 < 80; i4++) {
      if (typeof window.getSupabaseClient === "function") return window.getSupabaseClient();
      await new Promise(function(resolve) {
        setTimeout(resolve, 25);
      });
    }
    throw new Error("Cliente Supabase no disponible");
  }
  function guardarContextoLocal(userId, contexto) {
    if (!userId || !contexto || !contexto.rol) return;
    try {
      localStorage.setItem(CACHE_LOCAL, JSON.stringify({
        userId,
        contexto,
        verificadoEn: Date.now()
      }));
    } catch (e2) {
    }
  }
  function leerContextoLocal(userId) {
    if (!userId) return null;
    try {
      var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
      if (!guardado || guardado.userId !== userId || !guardado.contexto || !guardado.contexto.rol) return null;
      return guardado.contexto;
    } catch (e2) {
      return null;
    }
  }
  function hayContextoAutenticadoGuardado() {
    try {
      var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
      return !!(guardado && guardado.userId && guardado.contexto && guardado.contexto.rol);
    } catch (e2) {
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
    } catch (e2) {
      return null;
    }
  }
  async function obtenerContexto(forzar) {
    var supabase = await clienteSupabase();
    var sesion = await sesionActual(supabase);
    var userId = sesion && sesion.user ? sesion.user.id : null;
    if (!userId) return null;
    var ahora = Date.now();
    if (!forzar && contextoCache && contextoUsuarioId === userId && ahora - contextoFecha < CONTEXTO_TTL_MS) {
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
      } catch (e2) {
      }
    }
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
    return { key, value: JSON.stringify(valor), shared: false };
  }
  function respuestaVacia(key) {
    return { key, value: "", shared: false };
  }
  function encargosSoloCaja(cobros) {
    if (!Array.isArray(cobros) || cobros.length === 0) return [];
    return [{ id: "contexto-caja", cobros }];
  }
  function empleadoDelContexto(contexto) {
    if (contexto && contexto.empleado && contexto.empleado.id) return contexto.empleado;
    var lista = contexto && Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : [];
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
      return respuestaStorage(key, lista.filter(function(f3) {
        return f3 && f3.empleadoId === empleado.id;
      }));
    } catch (e2) {
      return respuestaStorage(key, []);
    }
  }
  window.storage.get = async function(key, shared) {
    if (!CLAVES_CONTROLADAS[key]) return getOriginal(key, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return getOriginal(key, shared);
      return respuestaVacia(key);
    }
    if (rol === "Propietario") return getOriginal(key, shared);
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
  window.storage.set = async function(key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
      return { key, value, shared: false };
    }
    if (rol !== "Propietario") {
      var resumenSoloLectura = key === "empleados" || key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a") || key === "fichasCosto" && rol === "Churrero/a" || key === "encar
```

## var setOriginal

### 1876655
```js
tion* () {
          var options = _arguments2.length > 0 && _arguments2[0] !== void 0 ? _arguments2[0] : {};
          _this.start(_objectSpread({
            enableRedraw: true,
            ignoreAnimation: true,
            ignoreMouse: true
          }, options));
          yield _this.ready();
          _this.stop();
        })();
      }
      /**
       * Start rendering.
       * @param options - Render options.
       */
      start() {
        var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        var {
          documentElement,
          screen,
          options: baseOptions
        } = this;
        screen.start(documentElement, _objectSpread(_objectSpread({
          enableRedraw: true
        }, baseOptions), options));
      }
      /**
       * Stop rendering.
       */
      stop() {
        this.screen.stop();
      }
      /**
       * Resize SVG to fit in given size.
       * @param width
       * @param height
       * @param preserveAspectRatio
       */
      resize(width) {
        var height = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : width;
        var preserveAspectRatio = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
        this.documentElement.resize(width, height, preserveAspectRatio);
      }
    };
  }
});

// ../edge-auth-patch.js
(function() {
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
  window.fetch = async function(input, init) {
    var url = typeof input === "string" ? input : input && input.url || "";
    if (url.indexOf(ORIGEN_FUNCTIONS) !== 0) return fetchOriginal(input, init);
    var nombreFuncion = url.slice(ORIGEN_FUNCTIONS.length).split(/[?#]/)[0];
    if (!PROTEGIDAS[nombreFuncion]) return fetchOriginal(input, init);
    try {
      if (typeof window.getSupabaseClient !== "function") {
        return respuestaSinSesion("No se pudo comprobar la sesi\xF3n. Recarga la aplicaci\xF3n.");
      }
      var supabase = await window.getSupabaseClient();
      var resultadoSesion = await supabase.auth.getSession();
      var token = resultadoSesion && resultadoSesion.data && resultadoSesion.data.session ? resultadoSesion.data.session.access_token : null;
      if (!token) return respuestaSinSesion("No hay sesi\xF3n activa \u2014 vuelve a iniciar sesi\xF3n.");
      var opciones = Object.assign({}, init || {});
      var headers = new Headers(
        opciones.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : void 0)
      );
      if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + token);
      opciones.headers = headers;
      return fetchOriginal(input, opciones);
    } catch (e2) {
      return respuestaSinSesion("No se pudo comprobar la sesi\xF3n. Vuelve a iniciar sesi\xF3n.");
    }
  };
})();
(function() {
  "use strict";
  if (window.__contextoRolSeguroInstalado || !window.storage) return;
  window.__contextoRolSeguroInstalado = true;
  var getOriginal = window.storage.get.bind(window.storage);
  var setOriginal = window.storage.set.bind(window.storage);
  var deleteOriginal = typeof window.storage.delete === "function" ? window.storage.delete.bind(window.storage) : null;
  var contextoCache = null;
  var contextoUsuarioId = null;
  var contextoFecha = 0;
  var CONTEXTO_TTL_MS = 3e4;
  var CACHE_LOCAL = "chocoloyos_contexto_operativo_seguro_v1";
  var CLAVES_COMUNES = [
    "productos",
    "disenoMenu",
    "temaOscuro",
    "modoEmpleado",
    "usuarioActivoId",
    "localActivoId",
    "movimientos",
    "fichajes"
  ];
  var CLAVES_ENCARGADO = [
    "proveedores",
    "pedidos",
    "conteos",
    "fichasCosto",
    "albaranes",
    "catalogoProv",
    "registrosAppcc",
    "puntosControl",
    "arqueos",
    "turnos",
    "ordenesProduccion",
    "locales",
    "movimientosCaja",
    "devoluciones",
    "freidoras",
    "registrosAceite",
    "traspasos"
  ];
  var CLAVES_CAJERO = [
    "arqueos",
    "movimientosCaja",
    "devoluciones"
  ];
  var CLAVES_CHURRERO = [
    "pedidos",
    "conteos",
    "albaranes",
    "catalogoProv",
    "ordenesProduccion",
    "freidoras",
    "registrosAceite",
    "traspasos"
  ];
  var CLAVES_SOLO_PROPIETARIO = [
    "historialRespaldos",
    "gastosGenerales",
    "empleados",
    "clientes",
    "encargos",
    "pinPropietario",
    "facturasDirectas",
    "nominas",
    "auditoria",
    "entrevistas"
  ];
  function mapaDe(listas) {
    var mapa = /* @__PURE__ */ Object.create(null);
    listas.forEach(function(lista) {
      lista.forEach(function(key) {
        mapa[key] = true;
      });
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
    if (key === "auditoria") return true;
    if (estaEn(CLAVES_COMUNES, key)) return true;
    if (rol === "Encargado" && estaEn(CLAVES_ENCARGADO, key)) return true;
    if (rol === "Cajero/a" && estaEn(CLAVES_CAJERO, key)) return true;
    if (rol === "Churrero/a" && estaEn(CLAVES_CHURRERO, key)) return true;
    return false;
  }
  async function clienteSupabase() {
    for (var i4 = 0; i4 < 80; i4++) {
      if (typeof window.getSupabaseClient === "function") return window.getSupabaseClient();
      await new Promise(function(resolve) {
        setTimeout(resolve, 25);
      });
    }
    throw new Error("Cliente Supabase no disponible");
  }
  function guardarContextoLocal(userId, contexto) {
    if (!userId || !contexto || !contexto.rol) return;
    try {
      localStorage.setItem(CACHE_LOCAL, JSON.stringify({
        userId,
        contexto,
        verificadoEn: Date.now()
      }));
    } catch (e2) {
    }
  }
  function leerContextoLocal(userId) {
    if (!userId) return null;
    try {
      var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
      if (!guardado || guardado.userId !== userId || !guardado.contexto || !guardado.contexto.rol) return null;
      return guardado.contexto;
    } catch (e2) {
      return null;
    }
  }
  function hayContextoAutenticadoGuardado() {
    try {
      var guardado = JSON.parse(localStorage.getItem(CACHE_LOCAL) || "null");
      return !!(guardado && guardado.userId && guardado.contexto && guardado.contexto.rol);
    } catch (e2) {
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
    } catch (e2) {
      return null;
    }
  }
  async function obtenerContexto(forzar) {
    var supabase = await clienteSupabase();
    var sesion = await sesionActual(supabase);
    var userId = sesion && sesion.user ? sesion.user.id : null;
    if (!userId) return null;
    var ahora = Date.now();
    if (!forzar && contextoCache && contextoUsuarioId === userId && ahora - contextoFecha < CONTEXTO_TTL_MS) {
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
      } catch (e2) {
      }
    }
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
    return { key, value: JSON.stringify(valor), shared: false };
  }
  function respuestaVacia(key) {
    return { key, value: "", shared: false };
  }
  function encargosSoloCaja(cobros) {
    if (!Array.isArray(cobros) || cobros.length === 0) return [];
    return [{ id: "contexto-caja", cobros }];
  }
  function empleadoDelContexto(contexto) {
    if (contexto && contexto.empleado && contexto.empleado.id) return contexto.empleado;
    var lista = contexto && Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : [];
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
      return respuestaStorage(key, lista.filter(function(f3) {
        return f3 && f3.empleadoId === empleado.id;
      }));
    } catch (e2) {
      return respuestaStorage(key, []);
    }
  }
  window.storage.get = async function(key, shared) {
    if (!CLAVES_CONTROLADAS[key]) return getOriginal(key, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return getOriginal(key, shared);
      return respuestaVacia(key);
    }
    if (rol === "Propietario") return getOriginal(key, shared);
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
  window.storage.set = async function(key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
      return { key, value, shared: false };
    }
    if (rol !== "Propietario") {
      var resumenSoloLectura = key === "empleados" || key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a") || key === "fichasCosto" && rol === "Churrero/a" || key === "e
```

## const setOriginal

## window.storage =

## from("almacen_kv").upsert

### 4592307
```js
   try {
        const supabase = await window.getSupabaseClient();
        const { data, error: errLectura } = await supabase.from("errores_sistema").select("*").order("fecha", { ascending: false }).limit(100);
        if (!activo) return;
        if (errLectura) {
          setError("No se ha podido cargar el historial.");
        } else {
          setErrores(data || []);
        }
      } catch {
        if (activo) setError("No se ha podido conectar.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Errores del sistema"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, 'Registro autom\xE1tico de fallos inesperados del programa (no de los avisos normales tipo "sin conexi\xF3n", esos ya se gestionan aparte). \xDAltimos 100.')), cargando ? null : error ? /* @__PURE__ */ import_react4.default.createElement(Card, { style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, error)) : errores.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin errores registrados \u2014 buena se\xF1al." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, errores.map((e2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: e2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, new Date(e2.fecha).toLocaleString("es-ES"), " \xB7 ", e2.pantalla || "\u2014"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium mt-1" }, e2.mensaje), e2.dispositivo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, e2.dispositivo)))));
}
function DiagnosticoSincronizacion() {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [pendientes, setPendientes] = import_react4.default.useState([]);
  const [resultados, setResultados] = import_react4.default.useState(null);
  const [reintentando, setReintentando] = import_react4.default.useState(false);
  function leerPendientes() {
    try {
      const lista = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]");
      setPendientes(lista);
      return lista;
    } catch (e2) {
      setPendientes([]);
      return [];
    }
  }
  async function reintentarConDetalle() {
    setReintentando(true);
    setResultados(null);
    const lista = leerPendientes();
    const detalle = [];
    for (const key of lista) {
      try {
        const valorLocal = localStorage.getItem("almacen:" + key);
        if (valorLocal === null) {
          detalle.push({ key, ok: false, error: "No hay ning\xFAn valor guardado en este dispositivo para esta clave." });
          continue;
        }
        if (!window.__nubeCliente) {
          detalle.push({ key, ok: false, error: "No hay conexi\xF3n a la nube en este momento." });
          continue;
        }
        const nuevo = JSON.parse(valorLocal);
        const r2 = await window.__nubeCliente.from("almacen_kv").upsert({ key, value: nuevo });
        if (r2.error) {
          detalle.push({ key, ok: false, error: r2.error.message });
        } else {
          detalle.push({ key, ok: true });
          const listaActualizada = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]").filter((k2) => k2 !== key);
          localStorage.setItem("almacen__pendientes", JSON.stringify(listaActualizada));
        }
      } catch (e2) {
        detalle.push({ key, ok: false, error: e2 && e2.message ? e2.message : String(e2) });
      }
    }
    setResultados(detalle);
    leerPendientes();
    setReintentando(false);
  }
  import_react4.default.useEffect(() => {
    if (abierto) leerPendientes();
  }, [abierto]);
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-medium" }, "Diagn\xF3stico de sincronizaci\xF3n"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAbierto(!abierto) }, abierto ? "Ocultar" : "Ver")), abierto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", style: { color: C2.inkSoft } }, pendientes.length === 0 ? "Nada pendiente de subir en este dispositivo ahora mismo." : `${pendientes.length} cosa(s) sin subir todav\xEDa: ${pendientes.join(", ")}`), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: reintentarConDetalle, disabled: reintentando }, reintentando ? "Reintentando\u2026" : "Reintentar ahora y ver el error real"), resultados && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 space-y-1.5" }, resultados.map((r2) => /* @__PURE__ */ import_react4.default.createElement("div", { key: r2.key, className: "text-[12px]", style: { color: r2.ok ? C2.accent : C2.red } }, r2.ok ? "\u2713" : "\u2717", " ", r2.key, !r2.ok && r2.error ? `: ${r2.error}` : r2.ok ? ": subido con \xE9xito" : "")))));
}
function FichaDatosLocal({ local, actualizarLocal }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const esChocoloyos = String(local?.nombre || "").trim().toLowerCase().replace(/\.$/, "") === "chocoloyos s.l";
    setForm({
      nombreComercial: local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "",
      direccion: local?.direccion || local?.direccionTicket || (esChocoloyos ? "L\xD3PEZ DE HOYOS, 81 \xB7 28002 MADRID (ESPA\xD1A)" : ""),
      telefono: local?.telefono || local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),
      email: local?.email || local?.emailTicket || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  function guardar() {
    if (!form) return;
    actualizarLocal(local.id, {
      nombreComercial: String(form.nombreComercial || "").trim(),
      direccion: String(form.direccion || "").trim(),
      telefono: String(form.telefono || "").trim(),
      email: String(form.email || "").trim()
    });
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(
    import_react4.default.Fragment,
    null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Ficha del local"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(
      Modal,
      { onClose: () => setAbierto(false), title: `Ficha del local \xB7 ${local.nombre}` },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Esta es la identidad com\xFAn de este local. La usar\xE1n el TPV y, progresivamente, inventarios, pedidos, albaranes, caja, informes y documentos que correspondan."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre comercial" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombreComercial, onChange: (e2) => campo("nombreComercial", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Direcci\xF3n del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.direccion, onChange: (e2) => campo("direccion", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tel\xE9fono" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.telefono, onChange: (e2) => campo("telefono", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo electr\xF3nico" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "email", value: form.email, onChange: (e2) => campo("email", e2.target.value), placeholder: "correo@local.es" })),
      guardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.accent } }, "Datos guardados."),
      /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardar }, "Guardar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAbierto(false) }, "Cerrar")
      )
    )
  );
}
async function prepararLogoEmpresa(file) {
  if (!file) return "";
  const tiposPermitidos = ["image/png", "image/jpeg", "image/webp"];
  if (!tiposPermitidos.includes(file.type)) throw new Error("El logo debe ser PNG, JPG o WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo es demasiado grande. Elige una imagen de menos de 8 MB.");
  const original = await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(file);
  });
  const imagen = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen seleccionada no es v\xE1lida."));
    img.src = original;
  });
  const maximo = 512;
  const anchoNatural = Number(imagen.naturalWidth || imagen.width || 1);
  const altoNatural = Number(imagen.naturalHeight || imagen.height || 1);
  const escala = Math.min(1, maximo / Math.max(anchoNatural, altoNatural));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(anchoNatural * escala));
  canvas.height = Math.max(1, Math.round(altoNatural * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el logo.");
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
function FichaEmpresaBasica({ empresa, actualizarEmpresa }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  const [logoError, setLogoError] = import_react4.default.useState("");
  const [logoCargando, setLogoCargando] = import_react4.default.useState(false);
  function abrir() {
    const c4 = empresa || {};
    setForm({
      marca: c4.marca || "",
      lema: c4.lema || "",
      razonSocial: c4.razonSocial || "",
      nif: c4.nif || "",
      web: c4.web || "",
      redSocial: c4.redSocial || "",
      pieDocumentos: c4.pieDocumentos || "",
      logo: c4.logo || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  async function cambiarLogo(e2) {
    const file = e2.target.files?.[0] || null;
    if (!file) return;
    setLogoError("");
    setLogoCargando(true);
    try {
      const preparado = await prepararLogoEmpresa(fil
```

## from("almacen_kv").select

### 4005752
```js
 || todayISO(),
    productoId: fila.producto_id || fila.productoId,
    productoNombre: datos.productoNombre || fila.producto_nombre || fila.productoNombre || fila.producto_id || fila.productoId,
    cantidad: Number(fila.cantidad) || 0,
    motivo: fila.motivo || "",
    reembolso: Number(fila.reembolso) || 0,
    medioReembolso: fila.medio_reembolso || fila.medioReembolso || "SIN_REEMBOLSO",
    ventaId: fila.venta_operation_id || fila.ventaId || null,
    proveedorId: fila.proveedor_id || fila.proveedorId || null,
    proveedorNombre: fila.proveedor_nombre || fila.proveedorNombre || datos.proveedorNombre || "",
    actorUserId: fila.actor_user_id || fila.actorUserId || null,
    createdAt: fila.created_at || fila.createdAt || null,
    _pm08Servidor: !!(fila.operation_id || fila.actor_user_id)
  };
}
async function sincronizarCajaPm08({ setArqueos, setMovimientosCaja, setDevoluciones }) {
  if (!modoSincronizadoPM08() || !window.__nubeActiva || !window.__nubeCliente) return { ok: false, offline: true };
  const supabase = window.__nubeCliente;
  const [rCaja, rArqueos, rCliente, rProveedor] = await Promise.all([
    supabase.from("caja_operaciones").select("operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,actor_user_id,created_at").order("created_at", { ascending: false }).limit(2e3),
    supabase.from("arqueos_caja").select("operation_id,empresa_id,local_id,fecha,alcance,efectivo_base,efectivo_esperado,efectivo_contado,diferencia,notas,estado,anulado_por_operation_id,anulado_motivo,actor_user_id,created_at").order("created_at", { ascending: false }).limit(1e3),
    supabase.from("devoluciones_venta").select("operation_id,venta_operation_id,empresa_id,local_id,producto_id,cantidad,reembolso,medio_reembolso,motivo,fecha,payload,actor_user_id,created_at").order("created_at", { ascending: false }).limit(2e3),
    supabase.from("devoluciones_proveedor").select("operation_id,empresa_id,local_id,producto_id,cantidad,proveedor_id,proveedor_nombre,motivo,fecha,payload,actor_user_id,created_at").order("created_at", { ascending: false }).limit(2e3)
  ]);
  const fallo = [rCaja, rArqueos, rCliente, rProveedor].find((r2) => r2.error);
  if (fallo) throw fallo.error;
  const caja = (rCaja.data || []).map(normalizarMovimientoCajaPM08).filter(Boolean);
  const arqueos = (rArqueos.data || []).map(normalizarArqueoPM08).filter(Boolean);
  const clientes = (rCliente.data || []).map((fila) => normalizarDevolucionPM08(fila, "cliente")).filter(Boolean);
  const proveedores = (rProveedor.data || []).map((fila) => normalizarDevolucionPM08(fila, "proveedor")).filter(Boolean);
  if (typeof setMovimientosCaja === "function") setMovimientosCaja(caja);
  if (typeof setArqueos === "function") setArqueos(arqueos);
  if (typeof setDevoluciones === "function") setDevoluciones([...clientes, ...proveedores].sort((a22, b2) => String(b2.createdAt || b2.fecha).localeCompare(String(a22.createdAt || a22.fecha))));
  return { ok: true, movimientosCaja: caja.length, arqueos: arqueos.length, devoluciones: clientes.length + proveedores.length };
}
async function sincronizarContextoPm07(args) {
  const { setEmpresas, setLocales, setLocalActivoId, setProductos } = args || {};
  if (typeof window === "undefined" || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return { ok: false, offline: true };
  const supabase = await window.getSupabaseClient();
  const r2 = await supabase.from("almacen_kv").select("key,value").in("key", ["empresas", "locales", "localActivoId", "productos"]);
  if (r2.error) throw r2.error;
  const porClave = new Map((r2.data || []).map((fila) => [fila.key, fila.value]));
  const empresasNube = porClave.get("empresas");
  const localesNube = porClave.get("locales");
  const localActivoNube = porClave.get("localActivoId");
  const productosNube = porClave.get("productos");
  if (Array.isArray(empresasNube) && empresasNube.length && typeof setEmpresas === "function") setEmpresas(empresasNube.filter((e2) => e2 && e2.id));
  if (Array.isArray(localesNube) && localesNube.length && typeof setLocales === "function") setLocales(localesNube.filter((l3) => l3 && l3.id));
  if (typeof localActivoNube === "string" && localActivoNube && typeof setLocalActivoId === "function") setLocalActivoId(localActivoNube);
  if (Array.isArray(productosNube) && productosNube.length && typeof setProductos === "function") setProductos(productosNube.filter((p3) => p3 && p3.id));
  return { ok: true, empresas: Array.isArray(empresasNube) ? empresasNube.length : 0, locales: Array.isArray(localesNube) ? localesNube.length : 0, productos: Array.isArray(productosNube) ? productosNube.length : 0 };
}
function SelectorLocalInformes({ locales = [], valor = "", onChange }) {
  const activos = locales.filter((l22) => l22 && l22.activo !== false && !l22.fusionadoEn);
  const seleccionado = activos.find((l22) => l22.id === valor);
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 items-end" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Local" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: valor, onChange: (e2) => onChange(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface } }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Todos los locales"), activos.map((l22) => /* @__PURE__ */ import_react4.default.createElement("option", { key: l22.id, value: l22.id }, l22.nombre)))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] pb-2", style: { color: C2.inkSoft } }, seleccionado ? `Mostrando solo ${seleccionado.nombre}.` : "Mostrando datos consolidados de todos los locales.")));
}
function GestionAlmacen() {
  const [ready, setReady] = (0, import_react4.useState)(false);
  const [fallosGuardado, setFallosGuardado] = (0, import_react4.useState)([]);
  (0, import_react4.useEffect)(() => {
    function onFalloGuardado(e2) {
      setFallosGuardado((s22) => [
        { id: uid(), key: e2.detail.key, mensaje: e2.detail.mensaje || "", fecha: (/* @__PURE__ */ new Date()).toISOString() },
        ...s22
      ].slice(0, 20));
    }
    window.addEventListener("fallo-guardado", onFalloGuardado);
    return () => window.removeEventListener("fallo-guardado", onFalloGuardado);
  }, []);
  (0, import_react4.useEffect)(() => {
    function onConflictoFusion(e2) {
      const conflictos = e2.detail && e2.detail.conflictos || [];
      const key = e2.detail && e2.detail.key;
      conflictos.forEach((c22) => {
        registrarErrorSistema(
          `Edici\xF3n simult\xE1nea en "${c22.nombre}" (${key}): dos dispositivos lo cambiaron a la vez sin verse \u2014 se aplic\xF3 el cambio de este dispositivo, se perdi\xF3 el del otro.`,
          "sincronizaci\xF3n",
          JSON.stringify({ key, id: c22.id, mio: c22.mio, delOtro: c22.delOtro })
        );
      });
    }
    window.addEventListener("conflicto-fusion", onConflictoFusion);
    return () => window.removeEventListener("conflicto-fusion", onConflictoFusion);
  }, []);
  const [tab, setTab] = (0, import_react4.useState)("dashboard");
  const [disenoMenu, setDisenoMenu] = (0, import_react4.useState)("B");
  const [temaOscuro, setTemaOscuro] = (0, import_react4.useState)(false);
  const [modoEmpleado, setModoEmpleado] = (0, import_react4.useState)(false);
  const [miPerfil, setMiPerfil] = (0, import_react4.useState)(null);
  (0, import_react4.useEffect)(() => {
    if (!ready || typeof window === "undefined" || !window.__nubeActiva) return;
    let activo = true;
    (async () => {
      try {
        const supabase = await window.getSupabaseClient();
        const { data: sesion } = await supabase.auth.getSession();
        const userId = sesion?.session?.user?.id;
        if (!userId) return;
        const { data: perfil } = await supabase.from("perfiles").select("rol, nombre").eq("user_id", userId).maybeSingle();
        if (!activo || !perfil) return;
        setMiPerfil(perfil);
        if (perfil.rol !== "Propietario") setModoEmpleado(true);
      } catch (e2) {
      }
    })();
    return () => {
      activo = false;
    };
  }, [ready]);
  const [pinPropietario, setPinPropietario] = (0, import_react4.useState)("");
  const [auditoria, setAuditoria] = (0, import_react4.useState)([]);
  const [usuarioActivoId, setUsuarioActivoId] = (0, import_react4.useState)(null);
  const [ordenesProduccion, setOrdenesProduccion] = (0, import_react4.useState)([]);
  const [traspasos, setTraspasos] = (0, import_react4.useState)([]);
  const [facturasDirectas, setFacturasDirectas] = (0, import_react4.useState)([]);
  const [pagosFacturas, setPagosFacturas] = (0, import_react4.useState)([]);
  const [nominas, setNominas] = (0, import_react4.useState)([]);
  const [entrevistas, setEntrevistas] = (0, import_react4.useState)([]);
  const skipSaveRef = import_react4.default.useRef(true);
  const autoSnapshotRef = import_react4.default.useRef(false);
  const [proveedores, setProveedores] = (0, import_react4.useState)([]);
  const [productos, setProductos] = (0, import_react4.useState)([]);
  const [pedidos2, setPedidos] = (0, import_react4.useState)([]);
  const [movimientos, setMovimientos] = (0, import_react4.useState)([]);
  const [conteos, setConteos] = (0, import_react4.useState)([]);
  const [fichasCosto, setFichasCosto] = (0, import_react4.useState)([]);
  const [albaranes, setAlbaranes] = (0, import_react4.useState)([]);
  const [catalogoProv, setCatalogoProv] = (0, import_react4.useState)({});
  const [gastosGenerales, setGastosGenerales] = (0, import_react4.useState)([]);
  const [empleados, setEmpleados] = (0, import_react4.useState)([]);
  const [fichajes, setFichajes] = (0, import_react4.useState)([]);
  const [registrosAppcc, setRegistrosAppcc] = (0, import_react4.useState)([]);
  const [freidoras, setFreidoras] = (0, import_react4.useState)([]);
  const [registrosAceite, setRegistrosAceite] = (0, import_react4.useState)([]);
  const [puntosControl, setPuntosControl] = (0, import_react4.useState)([]);
  const [clientes, setClientes] = (0, import_react4.useState)([]);
  const [encargos, setEncargos] = (0, import_react4.useState)([]);
  const [arqueos, setArqueos] = (0, import_react4.useState)([]);
  const [movimientosCaja, setMovimientosCaja] = (0, import_react4.useState)([]);
  const [devoluciones, setDevoluciones] = (0, import_react4.useState)([]);
  const [locales, setLocales] = (0, import_react4.useState)([]);
  const [configEmpresa, setConfigEmpresa] = (0, import_react4.useState)({
    marca: "Chocolater\xEDa San Gin\xE9s",
    lema: "MADRID 1894",
    razonSocial: "CHOCOLOYOS, S.L.",
    nif: "B87342077",
    web: "",
    redSocial: "@ChocoSanGines",
    pieDocumentos: "GRACIAS POR SU VISITA"
  });
  const [empresas, setEmpresas] = (0, import_react4.useState)([]);
  const [localActivoId, setLocalActivoId] = (0, import_react4.useState)(null);
  const [localInformeId, setLocalInformeId] = (0, import_react4.useState)("");
  (0, import_react4.useEffect)(() => {
    if (!ready || typeof window === "undefined" || !window.__nubeActiva) return;
    let activo = true;
    (async () => {
      try {
        await sincronizarContextoPm07({ setEmpresas, setLocales, setLocalActivoId, setProductos });
        await sincronizarStockPm07({ setProductos, setMovimientos, localActivoId });
        await sincronizarCajaPm08({ setArqueos, setMovimientosCaja, setDevoluciones });
      } catch (e2) {
        if (activo) console.error("PM-08: no se pudo sincronizar contexto, stock o caja autoritativos", e2);
      }
    })();
    return () => {
      activo = false;
    };
  }, [ready, localActivoId]);
  const empresaDelLocalActivo = (0, import_react4.useMe
```

## almacen__pendientes

### 4591445
```js
rgando, variant: suscrito ? "ghost" : "primary" }, cargando ? "Un momento\u2026" : suscrito ? "Desactivar en este dispositivo" : "Activar en este dispositivo"), error && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mt-2", style: { color: C2.red } }, error)));
}
function ErroresSistema() {
  const [errores, setErrores] = import_react4.default.useState([]);
  const [cargando, setCargando] = import_react4.default.useState(true);
  const [error, setError] = import_react4.default.useState("");
  import_react4.default.useEffect(() => {
    let activo = true;
    (async () => {
      if (!window.__nubeActiva) {
        if (activo) {
          setError("El historial de errores en la nube no est\xE1 disponible mientras trabajas solo en este equipo.");
          setCargando(false);
        }
        return;
      }
      try {
        const supabase = await window.getSupabaseClient();
        const { data, error: errLectura } = await supabase.from("errores_sistema").select("*").order("fecha", { ascending: false }).limit(100);
        if (!activo) return;
        if (errLectura) {
          setError("No se ha podido cargar el historial.");
        } else {
          setErrores(data || []);
        }
      } catch {
        if (activo) setError("No se ha podido conectar.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Errores del sistema"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, 'Registro autom\xE1tico de fallos inesperados del programa (no de los avisos normales tipo "sin conexi\xF3n", esos ya se gestionan aparte). \xDAltimos 100.')), cargando ? null : error ? /* @__PURE__ */ import_react4.default.createElement(Card, { style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, error)) : errores.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin errores registrados \u2014 buena se\xF1al." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, errores.map((e2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: e2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, new Date(e2.fecha).toLocaleString("es-ES"), " \xB7 ", e2.pantalla || "\u2014"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium mt-1" }, e2.mensaje), e2.dispositivo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, e2.dispositivo)))));
}
function DiagnosticoSincronizacion() {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [pendientes, setPendientes] = import_react4.default.useState([]);
  const [resultados, setResultados] = import_react4.default.useState(null);
  const [reintentando, setReintentando] = import_react4.default.useState(false);
  function leerPendientes() {
    try {
      const lista = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]");
      setPendientes(lista);
      return lista;
    } catch (e2) {
      setPendientes([]);
      return [];
    }
  }
  async function reintentarConDetalle() {
    setReintentando(true);
    setResultados(null);
    const lista = leerPendientes();
    const detalle = [];
    for (const key of lista) {
      try {
        const valorLocal = localStorage.getItem("almacen:" + key);
        if (valorLocal === null) {
          detalle.push({ key, ok: false, error: "No hay ning\xFAn valor guardado en este dispositivo para esta clave." });
          continue;
        }
        if (!window.__nubeCliente) {
          detalle.push({ key, ok: false, error: "No hay conexi\xF3n a la nube en este momento." });
          continue;
        }
        const nuevo = JSON.parse(valorLocal);
        const r2 = await window.__nubeCliente.from("almacen_kv").upsert({ key, value: nuevo });
        if (r2.error) {
          detalle.push({ key, ok: false, error: r2.error.message });
        } else {
          detalle.push({ key, ok: true });
          const listaActualizada = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]").filter((k2) => k2 !== key);
          localStorage.setItem("almacen__pendientes", JSON.stringify(listaActualizada));
        }
      } catch (e2) {
        detalle.push({ key, ok: false, error: e2 && e2.message ? e2.message : String(e2) });
      }
    }
    setResultados(detalle);
    leerPendientes();
    setReintentando(false);
  }
  import_react4.default.useEffect(() => {
    if (abierto) leerPendientes();
  }, [abierto]);
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-medium" }, "Diagn\xF3stico de sincronizaci\xF3n"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAbierto(!abierto) }, abierto ? "Ocultar" : "Ver")), abierto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", style: { color: C2.inkSoft } }, pendientes.length === 0 ? "Nada pendiente de subir en este dispositivo ahora mismo." : `${pendientes.length} cosa(s) sin subir todav\xEDa: ${pendientes.join(", ")}`), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: reintentarConDetalle, disabled: reintentando }, reintentando ? "Reintentando\u2026" : "Reintentar ahora y ver el error real"), resultados && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 space-y-1.5" }, resultados.map((r2) => /* @__PURE__ */ import_react4.default.createElement("div", { key: r2.key, className: "text-[12px]", style: { color: r2.ok ? C2.accent : C2.red } }, r2.ok ? "\u2713" : "\u2717", " ", r2.key, !r2.ok && r2.error ? `: ${r2.error}` : r2.ok ? ": subido con \xE9xito" : "")))));
}
function FichaDatosLocal({ local, actualizarLocal }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const esChocoloyos = String(local?.nombre || "").trim().toLowerCase().replace(/\.$/, "") === "chocoloyos s.l";
    setForm({
      nombreComercial: local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "",
      direccion: local?.direccion || local?.direccionTicket || (esChocoloyos ? "L\xD3PEZ DE HOYOS, 81 \xB7 28002 MADRID (ESPA\xD1A)" : ""),
      telefono: local?.telefono || local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),
      email: local?.email || local?.emailTicket || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  function guardar() {
    if (!form) return;
    actualizarLocal(local.id, {
      nombreComercial: String(form.nombreComercial || "").trim(),
      direccion: String(form.direccion || "").trim(),
      telefono: String(form.telefono || "").trim(),
      email: String(form.email || "").trim()
    });
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(
    import_react4.default.Fragment,
    null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Ficha del local"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(
      Modal,
      { onClose: () => setAbierto(false), title: `Ficha del local \xB7 ${local.nombre}` },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Esta es la identidad com\xFAn de este local. La usar\xE1n el TPV y, progresivamente, inventarios, pedidos, albaranes, caja, informes y documentos que correspondan."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre comercial" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombreComercial, onChange: (e2) => campo("nombreComercial", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Direcci\xF3n del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.direccion, onChange: (e2) => campo("direccion", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tel\xE9fono" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.telefono, onChange: (e2) => campo("telefono", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo electr\xF3nico" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "email", value: form.email, onChange: (e2) => campo("email", e2.target.value), placeholder: "correo@local.es" })),
      guardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.accent } }, "Datos guardados."),
      /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardar }, "Guardar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAbierto(false) }, "Cerrar")
      )
    )
  );
}
async function prepararLogoEmpresa(file) {
  if (!file) return "";
  const tiposPermitidos = ["image/png", "image/jpeg", "image/webp"];
  if (!tiposPermitidos.includes(file.type)) throw new Error("El logo debe ser PNG, JPG o WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo es demasiado grande. Elige una imagen de menos de 8 MB.");
  const original = await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(file);
  });
  const imagen = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen seleccionada no es v\xE1lida."));
    img.src = original;
  });
  const maximo = 512;
  const anchoNatural = Number(imagen.naturalWidth || imagen.width || 1);
  const altoNatural = Number(imagen.naturalHeight || imagen.height || 1);
  const escala = Math.min(1, maximo / Math.max(anchoNatural, altoNatural));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(anchoNatural * escala));
  canvas.height = Math.max(1, Math.round(altoNatural * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el logo.");
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
function FichaEmpresaBasica({ empresa, actualizarEmpresa }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useS
```

### 4592578
```js
      setError("No se ha podido cargar el historial.");
        } else {
          setErrores(data || []);
        }
      } catch {
        if (activo) setError("No se ha podido conectar.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Errores del sistema"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, 'Registro autom\xE1tico de fallos inesperados del programa (no de los avisos normales tipo "sin conexi\xF3n", esos ya se gestionan aparte). \xDAltimos 100.')), cargando ? null : error ? /* @__PURE__ */ import_react4.default.createElement(Card, { style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, error)) : errores.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin errores registrados \u2014 buena se\xF1al." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, errores.map((e2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: e2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, new Date(e2.fecha).toLocaleString("es-ES"), " \xB7 ", e2.pantalla || "\u2014"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium mt-1" }, e2.mensaje), e2.dispositivo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, e2.dispositivo)))));
}
function DiagnosticoSincronizacion() {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [pendientes, setPendientes] = import_react4.default.useState([]);
  const [resultados, setResultados] = import_react4.default.useState(null);
  const [reintentando, setReintentando] = import_react4.default.useState(false);
  function leerPendientes() {
    try {
      const lista = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]");
      setPendientes(lista);
      return lista;
    } catch (e2) {
      setPendientes([]);
      return [];
    }
  }
  async function reintentarConDetalle() {
    setReintentando(true);
    setResultados(null);
    const lista = leerPendientes();
    const detalle = [];
    for (const key of lista) {
      try {
        const valorLocal = localStorage.getItem("almacen:" + key);
        if (valorLocal === null) {
          detalle.push({ key, ok: false, error: "No hay ning\xFAn valor guardado en este dispositivo para esta clave." });
          continue;
        }
        if (!window.__nubeCliente) {
          detalle.push({ key, ok: false, error: "No hay conexi\xF3n a la nube en este momento." });
          continue;
        }
        const nuevo = JSON.parse(valorLocal);
        const r2 = await window.__nubeCliente.from("almacen_kv").upsert({ key, value: nuevo });
        if (r2.error) {
          detalle.push({ key, ok: false, error: r2.error.message });
        } else {
          detalle.push({ key, ok: true });
          const listaActualizada = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]").filter((k2) => k2 !== key);
          localStorage.setItem("almacen__pendientes", JSON.stringify(listaActualizada));
        }
      } catch (e2) {
        detalle.push({ key, ok: false, error: e2 && e2.message ? e2.message : String(e2) });
      }
    }
    setResultados(detalle);
    leerPendientes();
    setReintentando(false);
  }
  import_react4.default.useEffect(() => {
    if (abierto) leerPendientes();
  }, [abierto]);
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-medium" }, "Diagn\xF3stico de sincronizaci\xF3n"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAbierto(!abierto) }, abierto ? "Ocultar" : "Ver")), abierto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", style: { color: C2.inkSoft } }, pendientes.length === 0 ? "Nada pendiente de subir en este dispositivo ahora mismo." : `${pendientes.length} cosa(s) sin subir todav\xEDa: ${pendientes.join(", ")}`), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: reintentarConDetalle, disabled: reintentando }, reintentando ? "Reintentando\u2026" : "Reintentar ahora y ver el error real"), resultados && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 space-y-1.5" }, resultados.map((r2) => /* @__PURE__ */ import_react4.default.createElement("div", { key: r2.key, className: "text-[12px]", style: { color: r2.ok ? C2.accent : C2.red } }, r2.ok ? "\u2713" : "\u2717", " ", r2.key, !r2.ok && r2.error ? `: ${r2.error}` : r2.ok ? ": subido con \xE9xito" : "")))));
}
function FichaDatosLocal({ local, actualizarLocal }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const esChocoloyos = String(local?.nombre || "").trim().toLowerCase().replace(/\.$/, "") === "chocoloyos s.l";
    setForm({
      nombreComercial: local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "",
      direccion: local?.direccion || local?.direccionTicket || (esChocoloyos ? "L\xD3PEZ DE HOYOS, 81 \xB7 28002 MADRID (ESPA\xD1A)" : ""),
      telefono: local?.telefono || local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),
      email: local?.email || local?.emailTicket || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  function guardar() {
    if (!form) return;
    actualizarLocal(local.id, {
      nombreComercial: String(form.nombreComercial || "").trim(),
      direccion: String(form.direccion || "").trim(),
      telefono: String(form.telefono || "").trim(),
      email: String(form.email || "").trim()
    });
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(
    import_react4.default.Fragment,
    null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Ficha del local"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(
      Modal,
      { onClose: () => setAbierto(false), title: `Ficha del local \xB7 ${local.nombre}` },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Esta es la identidad com\xFAn de este local. La usar\xE1n el TPV y, progresivamente, inventarios, pedidos, albaranes, caja, informes y documentos que correspondan."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre comercial" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombreComercial, onChange: (e2) => campo("nombreComercial", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Direcci\xF3n del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.direccion, onChange: (e2) => campo("direccion", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tel\xE9fono" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.telefono, onChange: (e2) => campo("telefono", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo electr\xF3nico" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "email", value: form.email, onChange: (e2) => campo("email", e2.target.value), placeholder: "correo@local.es" })),
      guardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.accent } }, "Datos guardados."),
      /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardar }, "Guardar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAbierto(false) }, "Cerrar")
      )
    )
  );
}
async function prepararLogoEmpresa(file) {
  if (!file) return "";
  const tiposPermitidos = ["image/png", "image/jpeg", "image/webp"];
  if (!tiposPermitidos.includes(file.type)) throw new Error("El logo debe ser PNG, JPG o WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo es demasiado grande. Elige una imagen de menos de 8 MB.");
  const original = await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(file);
  });
  const imagen = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen seleccionada no es v\xE1lida."));
    img.src = original;
  });
  const maximo = 512;
  const anchoNatural = Number(imagen.naturalWidth || imagen.width || 1);
  const altoNatural = Number(imagen.naturalHeight || imagen.height || 1);
  const escala = Math.min(1, maximo / Math.max(anchoNatural, altoNatural));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(anchoNatural * escala));
  canvas.height = Math.max(1, Math.round(altoNatural * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el logo.");
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
function FichaEmpresaBasica({ empresa, actualizarEmpresa }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  const [logoError, setLogoError] = import_react4.default.useState("");
  const [logoCargando, setLogoCargando] = import_react4.default.useState(false);
  function abrir() {
    const c4 = empresa || {};
    setForm({
      marca: c4.marca || "",
      lema: c4.lema || "",
      razonSocial: c4.razonSocial || "",
      nif: c4.nif || "",
      web: c4.web || "",
      redSocial: c4.redSocial || "",
      pieDocumentos: c4.pieDocumentos || "",
      logo: c4.logo || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  async function cambiarLogo(e2) {
    const file = e2.target.files?.[0] || null;
    if (!file) return;
    setLogoError("");
    setLogoCargando(true);
    try {
      const preparado = await prepararLogoEmpresa(file);
      campo("logo", preparado);
    } catch (err2) {
      setLogoError(err2?.message || "No se pudo preparar el logo.");
    } finally {
      setLogoCargando(false);
      e2.target.value = "";
    }
  }
  function guardar() {
    if (!form || !empresa?.id) return;
```

### 4592669
```js
es(data || []);
        }
      } catch {
        if (activo) setError("No se ha podido conectar.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Errores del sistema"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, 'Registro autom\xE1tico de fallos inesperados del programa (no de los avisos normales tipo "sin conexi\xF3n", esos ya se gestionan aparte). \xDAltimos 100.')), cargando ? null : error ? /* @__PURE__ */ import_react4.default.createElement(Card, { style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, error)) : errores.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin errores registrados \u2014 buena se\xF1al." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, errores.map((e2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: e2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, new Date(e2.fecha).toLocaleString("es-ES"), " \xB7 ", e2.pantalla || "\u2014"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium mt-1" }, e2.mensaje), e2.dispositivo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, e2.dispositivo)))));
}
function DiagnosticoSincronizacion() {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [pendientes, setPendientes] = import_react4.default.useState([]);
  const [resultados, setResultados] = import_react4.default.useState(null);
  const [reintentando, setReintentando] = import_react4.default.useState(false);
  function leerPendientes() {
    try {
      const lista = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]");
      setPendientes(lista);
      return lista;
    } catch (e2) {
      setPendientes([]);
      return [];
    }
  }
  async function reintentarConDetalle() {
    setReintentando(true);
    setResultados(null);
    const lista = leerPendientes();
    const detalle = [];
    for (const key of lista) {
      try {
        const valorLocal = localStorage.getItem("almacen:" + key);
        if (valorLocal === null) {
          detalle.push({ key, ok: false, error: "No hay ning\xFAn valor guardado en este dispositivo para esta clave." });
          continue;
        }
        if (!window.__nubeCliente) {
          detalle.push({ key, ok: false, error: "No hay conexi\xF3n a la nube en este momento." });
          continue;
        }
        const nuevo = JSON.parse(valorLocal);
        const r2 = await window.__nubeCliente.from("almacen_kv").upsert({ key, value: nuevo });
        if (r2.error) {
          detalle.push({ key, ok: false, error: r2.error.message });
        } else {
          detalle.push({ key, ok: true });
          const listaActualizada = JSON.parse(localStorage.getItem("almacen__pendientes") || "[]").filter((k2) => k2 !== key);
          localStorage.setItem("almacen__pendientes", JSON.stringify(listaActualizada));
        }
      } catch (e2) {
        detalle.push({ key, ok: false, error: e2 && e2.message ? e2.message : String(e2) });
      }
    }
    setResultados(detalle);
    leerPendientes();
    setReintentando(false);
  }
  import_react4.default.useEffect(() => {
    if (abierto) leerPendientes();
  }, [abierto]);
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-medium" }, "Diagn\xF3stico de sincronizaci\xF3n"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAbierto(!abierto) }, abierto ? "Ocultar" : "Ver")), abierto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", style: { color: C2.inkSoft } }, pendientes.length === 0 ? "Nada pendiente de subir en este dispositivo ahora mismo." : `${pendientes.length} cosa(s) sin subir todav\xEDa: ${pendientes.join(", ")}`), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: reintentarConDetalle, disabled: reintentando }, reintentando ? "Reintentando\u2026" : "Reintentar ahora y ver el error real"), resultados && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3 space-y-1.5" }, resultados.map((r2) => /* @__PURE__ */ import_react4.default.createElement("div", { key: r2.key, className: "text-[12px]", style: { color: r2.ok ? C2.accent : C2.red } }, r2.ok ? "\u2713" : "\u2717", " ", r2.key, !r2.ok && r2.error ? `: ${r2.error}` : r2.ok ? ": subido con \xE9xito" : "")))));
}
function FichaDatosLocal({ local, actualizarLocal }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  function abrir() {
    const esChocoloyos = String(local?.nombre || "").trim().toLowerCase().replace(/\.$/, "") === "chocoloyos s.l";
    setForm({
      nombreComercial: local?.nombreComercial || local?.nombreComercialTicket || local?.nombre || "",
      direccion: local?.direccion || local?.direccionTicket || (esChocoloyos ? "L\xD3PEZ DE HOYOS, 81 \xB7 28002 MADRID (ESPA\xD1A)" : ""),
      telefono: local?.telefono || local?.telefonoTicket || (esChocoloyos ? "91 603 43 19" : ""),
      email: local?.email || local?.emailTicket || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  function guardar() {
    if (!form) return;
    actualizarLocal(local.id, {
      nombreComercial: String(form.nombreComercial || "").trim(),
      direccion: String(form.direccion || "").trim(),
      telefono: String(form.telefono || "").trim(),
      email: String(form.email || "").trim()
    });
    setGuardado(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement(
    import_react4.default.Fragment,
    null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrir }, "Ficha del local"),
    abierto && form && /* @__PURE__ */ import_react4.default.createElement(
      Modal,
      { onClose: () => setAbierto(false), title: `Ficha del local \xB7 ${local.nombre}` },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Esta es la identidad com\xFAn de este local. La usar\xE1n el TPV y, progresivamente, inventarios, pedidos, albaranes, caja, informes y documentos que correspondan."),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre comercial" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombreComercial, onChange: (e2) => campo("nombreComercial", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Direcci\xF3n del local" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.direccion, onChange: (e2) => campo("direccion", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tel\xE9fono" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.telefono, onChange: (e2) => campo("telefono", e2.target.value) })),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo electr\xF3nico" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "email", value: form.email, onChange: (e2) => campo("email", e2.target.value), placeholder: "correo@local.es" })),
      guardado && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.accent } }, "Datos guardados."),
      /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { className: "flex gap-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: guardar }, "Guardar"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAbierto(false) }, "Cerrar")
      )
    )
  );
}
async function prepararLogoEmpresa(file) {
  if (!file) return "";
  const tiposPermitidos = ["image/png", "image/jpeg", "image/webp"];
  if (!tiposPermitidos.includes(file.type)) throw new Error("El logo debe ser PNG, JPG o WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo es demasiado grande. Elige una imagen de menos de 8 MB.");
  const original = await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(file);
  });
  const imagen = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen seleccionada no es v\xE1lida."));
    img.src = original;
  });
  const maximo = 512;
  const anchoNatural = Number(imagen.naturalWidth || imagen.width || 1);
  const altoNatural = Number(imagen.naturalHeight || imagen.height || 1);
  const escala = Math.min(1, maximo / Math.max(anchoNatural, altoNatural));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(anchoNatural * escala));
  canvas.height = Math.max(1, Math.round(altoNatural * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el logo.");
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
function FichaEmpresaBasica({ empresa, actualizarEmpresa }) {
  const [abierto, setAbierto] = import_react4.default.useState(false);
  const [form, setForm] = import_react4.default.useState(null);
  const [guardado, setGuardado] = import_react4.default.useState(false);
  const [logoError, setLogoError] = import_react4.default.useState("");
  const [logoCargando, setLogoCargando] = import_react4.default.useState(false);
  function abrir() {
    const c4 = empresa || {};
    setForm({
      marca: c4.marca || "",
      lema: c4.lema || "",
      razonSocial: c4.razonSocial || "",
      nif: c4.nif || "",
      web: c4.web || "",
      redSocial: c4.redSocial || "",
      pieDocumentos: c4.pieDocumentos || "",
      logo: c4.logo || ""
    });
    setGuardado(false);
    setAbierto(true);
  }
  function campo(k2, v3) {
    setForm((f22) => ({ ...f22, [k2]: v3 }));
    setGuardado(false);
  }
  async function cambiarLogo(e2) {
    const file = e2.target.files?.[0] || null;
    if (!file) return;
    setLogoError("");
    setLogoCargando(true);
    try {
      const preparado = await prepararLogoEmpresa(file);
      campo("logo", preparado);
    } catch (err2) {
      setLogoError(err2?.message || "No se pudo preparar el logo.");
    } finally {
      setLogoCargando(false);
      e2.target.value = "";
    }
  }
  function guardar() {
    if (!form || !empresa?.id) return;
    const limpio = {};
    Object.entries(form).forEach(([k2, v3]) => limpio[k2] = String(
```

## localStorage.setItem("almacen:"
