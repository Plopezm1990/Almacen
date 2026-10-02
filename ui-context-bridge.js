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

      // El servidor puede devolver algo distinto de lo que se le mando: al dar
      // de baja una empresa desactiva tambien sus locales. La semilla de arriba
      // deja eso escrito en el navegador, pero la pantalla ya montada seguiria
      // mostrando el estado anterior hasta recargar, y el siguiente guardado
      // de locales saldria de una lista que el servidor ya no acepta. Se
      // anuncia el contexto confirmado para que la UI adopte el del servidor.
      try {
        window.dispatchEvent(new CustomEvent("contexto-ui-actualizado", {
          detail: { empresas: r.data.empresas, locales: r.data.locales }
        }));
      } catch (e) {}

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

// ABC P3: los productos de la pantalla llegan al catálogo autoritativo del TPV.
//
// La pantalla mantiene los productos en la colección heredada `productos`, pero el
// TPV vende contra `catalogo_tpv_productos` y no existía ningún camino general de una
// a otro (en QA, además, la política de almacen_kv rechaza las listas). Este puente
// observa los guardados de `productos`, calcula qué productos cambiaron en lo que
// afecta a la venta (nombre, unidad, fraccionable, precisión, precio con IVA, IVA,
// activo, tipo, local) y los envía a la RPC transaccional abc_catalogo_guardar_productos.
//
// Reglas de seguridad:
//  - No sustituye ni retrasa el guardado heredado: se ejecuta después de él y en
//    segundo plano; un fallo aquí nunca hace fallar el guardado de la pantalla.
//  - Solo envía cambios hechos por una persona: un guardado de `productos` sin una
//    interacción del usuario en los últimos 3 s se considera de la propia aplicación
//    (al arrancar recarga la lista desde la nube, que en QA puede estar desfasada) y
//    no se envía. Así una recarga nunca devuelve el catálogo a un precio antiguo.
//  - Solo envía diferencias de VENTA contra la última lista conocida: el nombre, la
//    unidad, lo fraccionable, el precio con IVA, el IVA, activo, tipo y local. Los
//    campos que la pantalla añade o quita por su cuenta (empresa, marcas internas de
//    stock) y los números escritos como texto no cuentan. Sin lista de referencia no
//    envía nada.
//  - Nunca desactiva por ausencia: la pantalla borra con «activo: false», no quitando
//    el producto de la lista, y una lista parcial no debe dar de baja nada.
//  - Si un solo guardado cambia más de 25 productos no lo envía solo (puede ser una
//    carga o una importación): avisa y deja el volcado explícito,
//    window.__catalogoTpv.sincronizarTodo().
//  - Si la RPC no existe en el servidor (producción antes de promoverla) el puente
//    se desactiva en silencio y la pantalla sigue como antes.
//  - Reintentos con el mismo operation_id mientras el contenido no cambie.
(function () {
  "use strict";
  if (window.__laCatalogoTpvBridgeV1 || !window.storage) return;
  window.__laCatalogoTpvBridgeV1 = true;

  var CLAVE = "productos";
  var RPC = "abc_catalogo_guardar_productos";
  var MONEDA = "EUR";
  var LS_PENDIENTE = "la_suite_catalogo_tpv_pendiente_v1";
  var ESPERA_MS = 1500;
  var REINTENTOS_MS = [2000, 4000, 8000, 16000, 32000];
  var MAX_LOTE = 200;
  var VENTANA_INTERACCION_MS = 3000;
  var MAX_CAMBIOS_AUTOMATICOS = 25;

  var getAnterior = window.storage.get.bind(window.storage);
  var setAnterior = window.storage.set.bind(window.storage);

  var referencia = null;      // última lista conocida de esta sesión
  var ultimaInteraccion = 0;  // última acción de una persona (clic, tecla, toque)
  var noDisponible = false;   // la RPC no existe en este servidor
  var avisados = {};
  var temporizador = null;
  var enCurso = false;
  var otraVez = false;
  var intentos = 0;

  function aviso(clave, mensaje, detalle) {
    if (avisados[clave]) return;
    avisados[clave] = true;
    try { console.warn("[catálogo TPV] " + mensaje, detalle === undefined ? "" : detalle); } catch (e) {}
  }

  function emitir(tipo, detalle) {
    try {
      if (typeof CustomEvent === "function" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent(tipo, { detail: detalle }));
      }
    } catch (e) {}
  }

  function parsearLista(texto) {
    try {
      var v = JSON.parse(texto);
      return Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }

  function porId(lista) {
    var m = {};
    lista.forEach(function (p) {
      if (p && typeof p === "object" && p.id !== undefined && p.id !== null) m[String(p.id)] = p;
    });
    return m;
  }

  function textoNorm(v) {
    return v === undefined || v === null ? "" : String(v).trim();
  }

  function numeroNorm(v) {
    var t = textoNorm(v);
    if (t === "") return null;
    var n = Number(t);
    return isFinite(n) ? Math.round(n * 1e8) / 1e8 : t;
  }

  function boolNorm(v, porDefecto) {
    if (v === undefined || v === null || v === "") return porDefecto;
    if (typeof v === "string") return ["false", "f", "0"].indexOf(v.trim().toLowerCase()) === -1;
    return !!v;
  }

  // Lo que el servidor usa para vender. No incluye empresa ni marcas internas.
  function firmaVenta(p) {
    var fraccionable = boolNorm(p.fraccionable, false);
    var precio = numeroNorm(p.precioVenta);
    return JSON.stringify([
      textoNorm(p.nombre),
      textoNorm(p.unidad),
      fraccionable,
      fraccionable ? (numeroNorm(p.precisionCantidad) || 0) : 0,
      precio === null ? 0 : precio,
      numeroNorm(p.ivaVenta),
      boolNorm(p.activo, true),
      // La pantalla trata un tipo vacío como «materia_prima» (p.tipo || "materia_prima").
      textoNorm(p.tipo).toLowerCase() || "materia_prima",
      textoNorm(p.localId)
    ]);
  }

  function calcularCambios(anterior, nuevo) {
    var a = porId(anterior);
    var n = porId(nuevo);
    var hayBase = Object.keys(a).length > 0;
    var salida = [];
    Object.keys(n).forEach(function (id) {
      if (!a[id]) {
        // Un producto que no estaba en la lista de referencia es un alta, pero solo
        // si había lista: con una referencia vacía no se distingue un alta de una carga.
        if (hayBase) salida.push(n[id]);
        return;
      }
      if (firmaVenta(a[id]) !== firmaVenta(n[id])) salida.push(n[id]);
    });
    return salida;
  }

  function leerJson(clave) {
    try {
      var t = localStorage.getItem(clave);
      return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }

  function empresaDe(p) {
    if (p.empresaId) return String(p.empresaId);
    var locales = leerJson("almacen:locales");
    if (Array.isArray(locales)) {
      for (var i = 0; i < locales.length; i++) {
        if (locales[i] && String(locales[i].id) === String(p.localId) && locales[i].empresaId) {
          return String(locales[i].empresaId);
        }
      }
    }
    return "";
  }

  function leerPendiente() {
    var o = leerJson(LS_PENDIENTE);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  }

  function guardarPendiente(o) {
    try {
      if (Object.keys(o).length) localStorage.setItem(LS_PENDIENTE, JSON.stringify(o));
      else localStorage.removeItem(LS_PENDIENTE);
    } catch (e) {}
  }

  function registrar(cambios) {
    var pend = leerPendiente();
    var sinContexto = 0;
    cambios.forEach(function (p) {
      var local = p.localId ? String(p.localId) : "";
      var empresa = empresaDe(p);
      if (!local || !empresa) { sinContexto++; return; }
      var g = empresa + "|" + local;
      if (!pend[g]) pend[g] = { empresaId: empresa, localId: local, opId: null, productos: {} };
      pend[g].productos[String(p.id)] = p;
      pend[g].opId = null;   // el contenido cambió: el siguiente envío usa otro operation_id
    });
    if (sinContexto) {
      aviso("sin-contexto", sinContexto + " producto(s) sin empresa o local: no se envían al catálogo del TPV.");
    }
    guardarPendiente(pend);
  }

  function nuevoOpId(local) {
    var azar = "";
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") azar = window.crypto.randomUUID();
    } catch (e) {}
    if (!azar) azar = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return ("p3.cat." + String(local).replace(/[^A-Za-z0-9._:-]/g, "-") + "." + Date.now().toString(36) + "." + azar)
      .slice(0, 190);
  }

  async function esperarBarrera() {
    for (var i = 0; i < 400; i++) {
      if (window.__instalacionSyncPermitida === true) return true;
      await new Promise(function (resolve) { setTimeout(resolve, 25); });
    }
    return false;
  }

  async function clienteConSesion() {
    if (typeof window.getSupabaseClient !== "function") return null;
    var supabase = await window.getSupabaseClient();
    var r = await supabase.auth.getSession();
    var sesion = r && r.data ? r.data.session : null;
    if (!sesion || !sesion.user || !sesion.user.id) return null;
    return supabase;
  }

  function planificar(ms) {
    if (typeof setTimeout !== "function") return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(function () { temporizador = null; vaciar(); }, ms);
  }

  function reintentar() {
    if (intentos < REINTENTOS_MS.length) {
      intentos++;
      planificar(REINTENTOS_MS[intentos - 1]);
    }
  }

  function clasificar(error, g) {
    var msg = String((error && (error.message || error.details || error.hint)) || "");
    var code = String((error && error.code) || "");
    if (code === "PGRST202" || code === "42883" || (error && error.status === 404) ||
        /could not find the function|function .* does not exist/i.test(msg)) {
      return "no_disponible";
    }
    if (/abc_catalogo_no_autorizado/.test(msg) || code === "42501") return "descartar";
    if (/catalogo_contexto_fiscal_(ausente|ambiguo)/.test(msg)) return "configuracion";
    if (/operation_id_conflict/.test(msg)) return "otro_id";
    return "reintentar";
  }

  async function enviarGrupo(supabase, g) {
    var pend = leerPendiente();
    var grupo = pend[g];
    if (!grupo) return "ok";
    if (!grupo.opId) {
      grupo.opId = nuevoOpId(grupo.localId);
      guardarPendiente(pend);
    }
    var ids = Object.keys(grupo.productos).sort();
    var lista = ids.map(function (id) { return grupo.productos[id]; });
    var resumen = { creados: 0, actualizados: 0, sin_cambios: 0, desactivados: 0, omitidos: 0, stock_inicial_creado: 0 };
    var omitidos = [];
    for (var desde = 0, n = 0; desde < lista.length; desde += MAX_LOTE, n++) {
      var r;
      try {
        r = await supabase.rpc(RPC, {
          p_operation_id: grupo.opId + (n ? "." + n : ""),
          p_empresa_id: grupo.empresaId,
          p_local_id: grupo.localId,
          p_currency_code: MONEDA,
          p_productos: lista.slice(desde, desde + MAX_LOTE)
        });
      } catch (e) {
        r = { error: e };
      }
      if (r.error) return { estado: clasificar(r.error, g), error: r.error };
      if (!r.data || r.data.ok !== true) return { estado: "reintentar", error: new Error("respuesta_inesperada") };
      Object.keys(resumen).forEach(function (k) { resumen[k] += Number(r.data.resumen && r.data.resumen[k]) || 0; });
      (r.data.productos || []).forEach(function (x) {
        if (x.resultado === "OMITIDO" && x.motivo !== "no_vendible" && x.motivo !== "inactivo") omitidos.push(x);
      });
    }
    var actual = leerPendiente();
    if (actual[g] && actual[g].opId === grupo.opId) delete actual[g];
    guardarPendiente(actual);
    return { estado: "ok", resumen: resumen, omitidos: omitidos, local: grupo.localId };
  }

  async function vaciar() {
    if (noDisponible) return;
    if (enCurso) { otraVez = true; return; }
    var claves = Object.keys(leerPendiente());
    if (!claves.length) return;
    enCurso = true;
    var hayReintento = false;
    try {
      if (!(await esperarBarrera())) { hayReintento = true; return; }
      var supabase = await clienteConSesion();
      if (!supabase) { hayReintento = true; return; }
      for (var i = 0; i < claves.length; i++) {
        var r = await enviarGrupo(supabase, claves[i]);
        if (r === "ok") continue;
        if (r.estado === "ok") {
          intentos = 0;
          if (r.omitidos.length) aviso("omitidos:" + r.local, "El servidor omitió productos al guardar el catálogo del TPV.", r.omitidos);
          emitir("catalogo-tpv-sincronizado", { local: r.local, resumen: r.resumen, omitidos: r.omitidos });
        } else if (r.estado === "no_disponible") {
          noDisponible = true;
          guardarPendiente({});
          aviso("no-disponible", "El servidor no tiene la ruta del catálogo del TPV; la pantalla sigue como antes.");
          return;
        } else if (r.estado === "descartar") {
          var p1 = leerPendiente(); delete p1[claves[i]]; guardarPendiente(p1);
          aviso("sin-permiso:" + claves[i], "Este usuario no puede guardar el catálogo del TPV de este local; los cambios quedan solo en la pantalla.");
          emitir("catalogo-tpv-error", { motivo: "sin_permiso", local: claves[i] });
        } else if (r.estado === "configuracion") {
          aviso("config:" + claves[i], "El local no tiene contexto fiscal configurado: el catálogo del TPV no se puede guardar todavía.", String(r.error && r.error.message || ""));
          emitir("catalogo-tpv-error", { motivo: "contexto_fiscal", local: claves[i] });
        } else if (r.estado === "otro_id") {
          var p2 = leerPendiente();
          if (p2[claves[i]]) { p2[claves[i]].opId = null; guardarPendiente(p2); }
          hayReintento = true;
        } else {
          hayReintento = true;
        }
      }
    } catch (e) {
      hayReintento = true;
    } finally {
      enCurso = false;
      if (hayReintento) reintentar();
      else if (otraVez) { otraVez = false; planificar(ESPERA_MS); }
    }
  }

  window.storage.get = async function (key, shared) {
    var r = await getAnterior(key, shared);
    if (key === CLAVE && r && typeof r.value === "string") {
      var lista = parsearLista(r.value);
      if (lista) referencia = lista;
    }
    return r;
  };

  window.storage.set = async function (key, value, shared) {
    if (key !== CLAVE) return setAnterior(key, value, shared);
    var previa = referencia;
    var ahora = Date.now();
    var resultado = await setAnterior(key, value, shared);
    var nueva = typeof value === "string" ? parsearLista(value) : null;
    if (nueva) {
      referencia = nueva;
      var porPersona = ahora - ultimaInteraccion <= VENTANA_INTERACCION_MS;
      if (previa && porPersona && !noDisponible && window.__nubeActiva) {
        try {
          var cambios = calcularCambios(previa, nueva);
          if (cambios.length > MAX_CAMBIOS_AUTOMATICOS) {
            aviso("masivo", cambios.length + " productos cambiados de golpe: no se envían solos al catálogo del TPV. Usa window.__catalogoTpv.sincronizarTodo().");
            emitir("catalogo-tpv-cambio-masivo", { cantidad: cambios.length });
          } else if (cambios.length) {
            registrar(cambios);
            planificar(ESPERA_MS);
          }
        } catch (e) {
          aviso("calculo", "No se pudieron calcular los cambios del catálogo.", String(e && e.message || e));
        }
      }
    }
    return resultado;
  };

  window.__catalogoTpv = {
    pendientes: function () { return leerPendiente(); },
    // Volcado completo y explícito de la lista conocida (alta inicial del catálogo).
    sincronizarTodo: async function () {
      if (!referencia) return { ok: false, motivo: "sin_lista" };
      registrar(referencia);
      await vaciar();
      return { ok: Object.keys(leerPendiente()).length === 0, pendientes: leerPendiente() };
    }
  };

  if (typeof window.addEventListener === "function") {
    var marcarInteraccion = function () { ultimaInteraccion = Date.now(); };
    ["pointerdown", "touchstart", "keydown", "input", "change", "click"].forEach(function (tipo) {
      window.addEventListener(tipo, marcarInteraccion, true);
    });
    window.addEventListener("online", function () { intentos = 0; planificar(500); });
  }
  if (Object.keys(leerPendiente()).length) planificar(3000);
})();

// PM27: Chrome móvil puede desplazar horizontalmente el documento cuando
// un modal React situado dentro del menú horizontal recibe focus(). El modal
// de cierre de sesión está dentro de ese menú; al abrirlo el dashboard queda
// desplazado y aparece una franja vacía a la derecha. Este hotfix se limita a
// diálogos modales en pantallas móviles: evita el scroll producido por focus,
// bloquea el overflow-x mientras exista el diálogo y restaura el estado al
// cerrarlo. No cambia Auth, logout ni datos de negocio.
(function () {
  "use strict";
  if (window.__laMobileDialogFocusFixV1) return;
  if (typeof HTMLElement === "undefined" || !HTMLElement.prototype) return;
  window.__laMobileDialogFocusFixV1 = true;

  var focusNativo = HTMLElement.prototype.focus;
  if (typeof focusNativo !== "function") return;

  var bloqueoActivo = false;
  var overflowHtmlAnterior = "";
  var overflowBodyAnterior = "";

  function esMovil() {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 767px)").matches;
    }
    return typeof window.innerWidth === "number" ? window.innerWidth < 768 : false;
  }

  function esDialogoModal(el) {
    return !!(el && typeof el.getAttribute === "function" &&
      el.getAttribute("role") === "dialog" &&
      el.getAttribute("aria-modal") === "true");
  }

  function xActual() {
    return Number(window.scrollX || window.pageXOffset || 0);
  }

  function yActual() {
    return Number(window.scrollY || window.pageYOffset || 0);
  }

  function corregirScrollHorizontal(y) {
    if (xActual() === 0) return;
    try {
      window.scrollTo({ left: 0, top: y, behavior: "instant" });
    } catch (e) {
      window.scrollTo(0, y);
    }
  }

  HTMLElement.prototype.focus = function () {
    if (!esMovil() || !esDialogoModal(this)) {
      return focusNativo.apply(this, arguments);
    }

    var y = yActual();
    var opciones = {};
    if (arguments[0] && typeof arguments[0] === "object") {
      for (var k in arguments[0]) opciones[k] = arguments[0][k];
    }
    opciones.preventScroll = true;

    try {
      focusNativo.call(this, opciones);
    } catch (e) {
      focusNativo.call(this);
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(function () { corregirScrollHorizontal(y); });
    } else {
      setTimeout(function () { corregirScrollHorizontal(y); }, 0);
    }
  };

  function bloquearOverflow() {
    if (bloqueoActivo || !document.documentElement || !document.body) return;
    overflowHtmlAnterior = document.documentElement.style.overflowX || "";
    overflowBodyAnterior = document.body.style.overflowX || "";
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    bloqueoActivo = true;
  }

  function restaurarOverflow() {
    if (!bloqueoActivo || !document.documentElement || !document.body) return;
    document.documentElement.style.overflowX = overflowHtmlAnterior;
    document.body.style.overflowX = overflowBodyAnterior;
    bloqueoActivo = false;
  }

  function sincronizarBloqueo() {
    var hayDialogo = esMovil() && document.querySelector &&
      document.querySelector('[role="dialog"][aria-modal="true"]');
    if (hayDialogo) {
      bloquearOverflow();
      corregirScrollHorizontal(yActual());
    } else {
      restaurarOverflow();
    }
  }

  if (document.body && typeof MutationObserver === "function") {
    var observer = new MutationObserver(sincronizarBloqueo);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("resize", sincronizarBloqueo);
  }

  window.__laMobileDialogFocusFixApiV1 = {
    sync: sincronizarBloqueo,
    restore: restaurarOverflow
  };
})();
