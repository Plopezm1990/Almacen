// L&A Suite — Plataforma (decisión D01: producto multiempresa).
//
// Dos pantallas que se muestran ANTES de abrir la aplicación, desde owner-bootstrap-post-reset.js:
//   1. «Elige tu contraseña»: se muestra al dueño de una empresa cliente la primera vez que entra
//      (su cuenta se creó con una contraseña inicial que le dio el administrador de la plataforma).
//   2. «Plataforma»: panel del administrador de la plataforma para dar de alta, desactivar, reactivar,
//      copiar y eliminar empresas clientes.
//
// Todo lo importante se decide en el SERVIDOR (funciones plataforma_* con comprobación de administrador,
// operation_id, plazo de gracia, código de un solo uso). Este archivo solo es la pantalla: si se
// manipulara en el navegador, el servidor seguiría rechazando lo que no corresponde.
//
// Las llamadas salen por los canales estrechos de owner-bootstrap-prelock.js (__laOwnerBootstrapRpc y
// __laOwnerBootstrapFunction), que conservan el fetch original aunque la barrera post-reset esté cerrada.
// Todo texto que viene del servidor (nombres, correos) se pinta con textContent, nunca como HTML.
(function () {
  "use strict";
  if (window.__laPlataformaPanelV1) return;
  window.__laPlataformaPanelV1 = true;

  var ROOT_PANEL_ID = "la-plataforma-root";
  var ROOT_CAMBIO_ID = "la-plataforma-cambio-root";
  var ATAJO_ID = "la-plataforma-atajo";
  var ESTILO_ID = "la-plataforma-estilos";
  var FUNCION_PROPIETARIO = "plataforma-crear-propietario";

  // ---------------------------------------------------------------------------
  // Funciones puras (se prueban sin navegador)
  // ---------------------------------------------------------------------------
  function limpiar(valor, max) {
    return typeof valor === "string" ? valor.trim().slice(0, max) : "";
  }

  // Misma regla que la función de servidor (supabase/functions/_shared/plataforma-propietario.js):
  // el servidor vuelve a comprobarla; esto solo avisa antes de enviar.
  function contrasenaDebil(password, email) {
    if (typeof password !== "string" || password.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
    if (password.length > 200) return "La contraseña es demasiado larga.";
    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/[0-9]/.test(password)) {
      return "La contraseña debe mezclar letras y números.";
    }
    var local = String(email || "").split("@")[0].toLowerCase();
    if (local.length >= 4 && password.toLowerCase().indexOf(local) !== -1) {
      return "La contraseña no puede contener el correo.";
    }
    return null;
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var OPERATION_RE = /^[A-Za-z0-9._:-]{8,120}$/;

  function bytesAleatorios(n) {
    var c = window.crypto || window.msCrypto;
    if (!c || typeof c.getRandomValues !== "function") throw new Error("Este navegador no puede generar números aleatorios seguros.");
    var a = new Uint8Array(n);
    c.getRandomValues(a);
    return a;
  }

  function hex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return s;
  }

  // Identificador de operación: único por intento; si se repite la misma orden (por ejemplo tras
  // perder la respuesta) el servidor devuelve el mismo resultado en vez de hacerlo dos veces.
  function idOperacion(prefijo) {
    var id = String(prefijo || "op") + ":" + hex(bytesAleatorios(12));
    if (!OPERATION_RE.test(id)) throw new Error("Identificador de operación no válido.");
    return id;
  }

  // Contraseña inicial legible: sin 0/O/1/l/I, en tres grupos (xxxx-xxxx-xxxx) para dictarla fácilmente.
  var LETRAS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  var CIFRAS = "23456789";
  function generarContrasena(email, aleatorios) {
    var rng = aleatorios || bytesAleatorios;
    for (var intento = 0; intento < 50; intento++) {
      var b = rng(24);
      var chars = [];
      for (var i = 0; i < 12; i++) {
        var alfabeto = (i % 4 === 3) ? CIFRAS : (LETRAS + CIFRAS);
        // 256 no es múltiplo del tamaño del alfabeto: se descarta el sobrante para no sesgar.
        var limite = 256 - (256 % alfabeto.length);
        var v = b[i];
        if (v >= limite) v = b[12 + i] % alfabeto.length; else v = v % alfabeto.length;
        chars.push(alfabeto.charAt(v));
      }
      var pass = chars.slice(0, 4).join("") + "-" + chars.slice(4, 8).join("") + "-" + chars.slice(8, 12).join("");
      if (!contrasenaDebil(pass, email)) return pass;
    }
    throw new Error("No se pudo generar una contraseña válida.");
  }

  function validarAlta(d) {
    var errores = {};
    var nombre = limpiar(d && d.nombre, 160);
    var local = limpiar(d && d.local, 160);
    var cif = limpiar(d && d.cif, 40);
    var dueno = limpiar(d && d.dueno, 160);
    var email = limpiar(d && d.email, 320).toLowerCase();
    var password = d && typeof d.password === "string" ? d.password : "";
    if (nombre.length < 2) errores.nombre = "Escribe el nombre de la empresa.";
    if (local.length < 2) errores.local = "Escribe el nombre del primer local.";
    if (cif && !/^[A-Za-z0-9][A-Za-z0-9 .-]{3,24}$/.test(cif)) errores.cif = "El CIF/NIF no parece válido.";
    var errDueno = validarDueno({ dueno: dueno, email: email, password: password });
    for (var k in errDueno) errores[k] = errDueno[k];
    return { ok: Object.keys(errores).length === 0, errores: errores, datos: { nombre: nombre, local: local, cif: cif, dueno: dueno, email: email, password: password } };
  }

  function validarDueno(d) {
    var errores = {};
    if (limpiar(d && d.dueno, 160).length < 2) errores.dueno = "Escribe el nombre del dueño.";
    var email = limpiar(d && d.email, 320).toLowerCase();
    if (!EMAIL_RE.test(email)) errores.email = "El correo no es válido.";
    var debil = contrasenaDebil(d && typeof d.password === "string" ? d.password : "", email);
    if (debil) errores.password = debil;
    return errores;
  }

  // Cambio de contraseña inicial por el propio dueño.
  function validarCambioContrasena(p1, p2, email) {
    if (typeof p1 !== "string" || p1.length < 10) return "Usa al menos 10 caracteres.";
    if (p1.length > 200) return "La contraseña es demasiado larga.";
    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(p1) || !/[0-9]/.test(p1)) return "Mezcla letras y números.";
    var local = String(email || "").split("@")[0].toLowerCase();
    if (local.length >= 4 && p1.toLowerCase().indexOf(local) !== -1) return "La contraseña no puede contener tu correo.";
    if (p1 !== p2) return "Las dos contraseñas no coinciden.";
    return null;
  }

  function debeCambiarContrasena(sesion) {
    var meta = sesion && sesion.user && sesion.user.user_metadata;
    return !!meta && meta.debe_cambiar_contrasena === true;
  }

  function fechaCorta(valor) {
    if (!valor) return "";
    var d = new Date(valor);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" });
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function horaCorta(valor) {
    var d = new Date(valor);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
    } catch (e) {
      return d.toISOString().slice(11, 16);
    }
  }

  function numero(n) {
    var v = Number(n);
    if (!isFinite(v)) return "0";
    try { return v.toLocaleString("es-ES"); } catch (e) { return String(v); }
  }

  // Marcas de acento sueltas (U+0300 a U+036F) que deja normalize("NFD").
  var ACENTOS = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");

  function nombreFicheroCopia(nombre, cuando) {
    var base = String(nombre || "empresa").toLowerCase();
    if (typeof base.normalize === "function") base = base.normalize("NFD").replace(ACENTOS, "");
    base = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "empresa";
    var fecha = (cuando instanceof Date ? cuando : new Date()).toISOString().slice(0, 10);
    return "copia-" + base + "-" + fecha + ".json";
  }

  // Qué botones tiene cada empresa según su estado.
  function accionesDe(emp) {
    if (!emp) return [];
    if (emp.activa === true) return ["desactivar", "anadir_dueno"];
    if (emp.baja_en) return ["reactivar", "copia", "eliminar"];
    return ["reactivar", "registrar_baja"];
  }

  function textoBloqueo(clave, resumen) {
    var dias = resumen && resumen.dias_gracia != null ? resumen.dias_gracia : 30;
    var hasta = resumen && resumen.plazo_hasta ? fechaCorta(resumen.plazo_hasta) : "";
    switch (clave) {
      case "empresa_activa": return "La empresa sigue activa: primero hay que desactivarla.";
      case "sin_registro_de_baja": return "No consta la fecha de baja. Pulsa «Registrar la baja» en la tarjeta de la empresa para que empiece a contar el plazo.";
      case "plazo_de_gracia": return "Todavía no ha pasado el plazo de gracia de " + dias + " días." + (hasta ? " Se podrá borrar a partir del " + hasta + "." : "");
      case "sin_copia": return "Todavía no has descargado una copia de seguridad después de la baja.";
      default: return "Bloqueo: " + clave;
    }
  }

  function traducirError(e) {
    var m = String(e && e.message ? e.message : (e == null ? "" : e));
    var tabla = [
      [/plataforma_nombre_no_coincide/, "El nombre escrito no coincide exactamente con el de la empresa."],
      [/plataforma_codigo_no_valido/, "El código no es válido o ha caducado. Vuelve a preparar el borrado."],
      [/plataforma_bloqueada:\s*plazo_de_gracia/, "Todavía no ha pasado el plazo de gracia."],
      [/plataforma_bloqueada:\s*sin_copia/, "Hace falta una copia descargada o un motivo escrito de al menos 10 caracteres."],
      [/plataforma_bloqueada:\s*empresa_activa/, "La empresa sigue activa: desactívala primero."],
      [/plataforma_bloqueada:\s*sin_registro_de_baja/, "No consta la baja: regístrala primero."],
      [/plataforma_restos_tras_borrado/, "El borrado se ha deshecho porque quedaban restos. No se ha borrado nada."],
      [/Administrador de plataforma requerido/, "Esta cuenta no es administradora de la plataforma."],
      [/jwt expired|invalid jwt|JWT/i, "La sesión ha caducado. Vuelve a iniciar sesión."],
      [/Failed to fetch|NetworkError|Load failed|fetch failed/i, "No hay conexión con el servidor. Inténtalo de nuevo."]
    ];
    for (var i = 0; i < tabla.length; i++) {
      if (tabla[i][0].test(m)) return tabla[i][1];
    }
    return m || "Ha ocurrido un error inesperado.";
  }

  function esFuncionInexistente(e) {
    var m = String(e && e.message ? e.message : e || "");
    return /could not find the function|PGRST202|HTTP 404/i.test(m);
  }

  // ---------------------------------------------------------------------------
  // Pequeña ayuda para construir la pantalla (el texto nunca se interpreta como HTML)
  // ---------------------------------------------------------------------------
  function anadir(el, hijo) {
    if (hijo == null || hijo === false) return;
    if (Array.isArray(hijo)) {
      for (var i = 0; i < hijo.length; i++) anadir(el, hijo[i]);
      return;
    }
    el.appendChild(typeof hijo === "object" ? hijo : document.createTextNode(String(hijo)));
  }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) anadir(el, arguments[i]);
    return el;
  }

  var ESTILOS =
    ".lap-root{position:fixed;inset:0;z-index:10040;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#F7F3E9;color:#102018;font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:14px;line-height:1.45}" +
    ".lap-root *{box-sizing:border-box}" +
    ".lap-barra{background:#0C2714;color:#E7D1A5;padding:14px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}" +
    ".lap-barra h1{margin:0;font-size:18px;color:#fff}.lap-barra small{display:block;color:#B8AC91;font-size:12px;word-break:break-all}" +
    ".lap-cuerpo{max-width:880px;margin:0 auto;padding:16px}" +
    ".lap-fila{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
    ".lap-btn{appearance:none;border:1px solid #0C2714;background:#0C2714;color:#fff;border-radius:10px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer}" +
    ".lap-btn:disabled{opacity:.55;cursor:default}" +
    ".lap-btn.sec{background:transparent;color:#0C2714}.lap-barra .lap-btn.sec{color:#E7D1A5;border-color:#7F6A3C}" +
    ".lap-btn.peligro{background:#8d2e1f;border-color:#8d2e1f}.lap-btn.aviso{background:transparent;color:#8d2e1f;border-color:#8d2e1f}" +
    ".lap-btn.peq{padding:6px 10px;font-size:13px}" +
    ".lap-tarjeta{background:#fff;border:1px solid #d9d2c0;border-radius:14px;padding:14px;margin-top:12px}" +
    ".lap-tarjeta h2{margin:0;font-size:16px}" +
    ".lap-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}" +
    ".lap-pill.ok{background:#e3f1e6;color:#1d5a2c}.lap-pill.off{background:#fff0d6;color:#7a4b00}" +
    ".lap-muted{color:#4B5A54;font-size:13px}" +
    ".lap-banner{border-radius:10px;padding:10px 12px;margin-top:12px;font-size:13px}" +
    ".lap-banner.ok{background:#e3f1e6;color:#1d5a2c}.lap-banner.mal{background:#fff0ed;color:#8d2e1f}.lap-banner.info{background:#fff7e7;color:#6a4b18;border:1px solid #d9b56d}" +
    ".lap-velo{position:fixed;inset:0;z-index:10045;background:rgba(6,23,14,.62);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto}" +
    ".lap-dialogo{width:min(100%,520px);background:#F7F3E9;border:1px solid rgba(198,154,82,.55);border-radius:18px;padding:18px;margin:auto 0;box-shadow:0 24px 70px rgba(0,0,0,.38)}" +
    ".lap-dialogo h2{margin:0 0 8px;font-size:18px;color:#0C2714}" +
    ".lap-campo{display:block;margin-top:12px}.lap-campo>span{display:block;font-size:13px;font-weight:700;color:#263b30;margin-bottom:4px}" +
    ".lap-campo input,.lap-campo textarea{width:100%;padding:11px;border-radius:10px;border:1px solid #b7b0a0;background:#fff;font:inherit;color:#102018}" +
    ".lap-campo .lap-ayuda{font-size:12px;color:#4B5A54;margin-top:3px;font-weight:400}.lap-campo .lap-err{font-size:12px;color:#8d2e1f;margin-top:3px;font-weight:600}" +
    ".lap-pie{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:16px}" +
    ".lap-caja{background:#fff;border:1px dashed #b7b0a0;border-radius:10px;padding:10px 12px;margin-top:10px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;word-break:break-all}" +
    ".lap-codigo{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:26px;letter-spacing:.12em;font-weight:700;text-align:center;background:#fff;border:1px solid #b7b0a0;border-radius:10px;padding:10px;margin-top:10px}" +
    ".lap-atajo{position:fixed;left:10px;bottom:76px;z-index:45;opacity:.9}" +
    ".lap-cambio{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 50% 20%,#153D27 0%,#0C2714 48%,#06170E 100%);overflow-y:auto;font-family:'IBM Plex Sans',system-ui,sans-serif}" +
    ".lap-cambio .lap-dialogo{margin:auto}";

  function asegurarEstilos() {
    if (document.getElementById(ESTILO_ID)) return;
    var st = document.createElement("style");
    st.id = ESTILO_ID;
    st.textContent = ESTILOS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------------------------------------------------------------------------
  // Estado del panel abierto
  // ---------------------------------------------------------------------------
  var ctx = null; // { supabase, userId, email, estado, opciones, empresas, cargando, errorLista, aviso, dialogo, nodo }
  var cambioAbierto = null; // userId con la pantalla de contraseña inicial abierta
  var modoApp = {}; // userId -> true cuando el administrador eligió abrir su propia aplicación
  // La elección sobrevive a la recarga de la página con una sola marca en sessionStorage (solo el id de usuario,
  // nunca contraseñas ni datos de empresas); se borra al volver al panel y al cerrar sesión.
  var CLAVE_MODO_APP = "la_plataforma_modo_app";
  function leerMarcaModoApp() {
    try { return window.sessionStorage.getItem(CLAVE_MODO_APP) || ""; } catch (e) { return ""; }
  }
  function guardarModoApp(userId) {
    modoApp[userId] = true;
    try { window.sessionStorage.setItem(CLAVE_MODO_APP, String(userId)); } catch (e) {}
  }
  function borrarModoApp(userId) {
    delete modoApp[userId];
    try { window.sessionStorage.removeItem(CLAVE_MODO_APP); } catch (e) {}
  }

  function quitarNodo(id) {
    var n = document.getElementById(id);
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  function cerrarTodo() {
    if (ctx && ctx.dialogo) { try { ctx.dialogo.cerrar(true); } catch (e) {} }
    ctx = null;
    cambioAbierto = null;
    quitarNodo(ROOT_PANEL_ID);
    quitarNodo(ROOT_CAMBIO_ID);
    quitarNodo(ATAJO_ID);
    document.documentElement.classList.remove("la-plataforma-abierta");
  }

  function panelAbierto(userId) {
    return !!(ctx && ctx.userId === userId && document.getElementById(ROOT_PANEL_ID));
  }

  function cambioAbiertoPara(userId) {
    return cambioAbierto === userId && !!document.getElementById(ROOT_CAMBIO_ID);
  }

  function quitarCargando() {
    var c = document.getElementById("cargando");
    if (c && c.parentNode) c.parentNode.removeChild(c);
  }

  // ---------------------------------------------------------------------------
  // Llamadas al servidor
  // ---------------------------------------------------------------------------
  async function consultarEstado(sesion) {
    var token = sesion && sesion.access_token ? sesion.access_token : "";
    try {
      var r = await window.__laOwnerBootstrapRpc("plataforma_estado", token, {});
      return {
        es_admin: !!(r && r.es_admin === true),
        plataforma_activa: !!(r && r.plataforma_activa === true),
        mis_empresas: r && typeof r.mis_empresas === "number" ? r.mis_empresas : 0,
        empresas_activas: r && typeof r.empresas_activas === "number" ? r.empresas_activas : 0,
        empresas_desactivadas: r && typeof r.empresas_desactivadas === "number" ? r.empresas_desactivadas : 0
      };
    } catch (e) {
      // Servidor sin las funciones de plataforma (producción hasta que se apliquen): se comporta como antes.
      if (esFuncionInexistente(e)) return { es_admin: false, plataforma_activa: false, mis_empresas: 0, empresas_activas: 0, empresas_desactivadas: 0 };
      throw e;
    }
  }

  async function sesionActual() {
    var r = await ctx.supabase.auth.getSession();
    var s = r && r.data ? r.data.session : null;
    if (!s || !s.access_token || !s.user || s.user.id !== ctx.userId) {
      throw new Error("La sesión ha caducado. Vuelve a iniciar sesión.");
    }
    return s;
  }

  async function rpc(nombre, cuerpo) {
    var s = await sesionActual();
    return window.__laOwnerBootstrapRpc(nombre, s.access_token, cuerpo || {});
  }

  async function funcion(nombre, cuerpo) {
    var s = await sesionActual();
    return window.__laOwnerBootstrapFunction(nombre, s.access_token, cuerpo || {});
  }

  // Comprueba la contraseña del administrador SIN tocar la sesión abierta (llamada aparte a Auth, que se descarta).
  async function verificarContrasena(contrasena) {
    if (!contrasena) return { ok: false, error: "Escribe tu contraseña." };
    var base = String(window.NUBE_URL || "").replace(/\/+$/, "");
    var apikey = String(window.NUBE_CLAVE || "");
    if (!base || !apikey || !ctx || !ctx.email) return { ok: false, error: "No se puede comprobar la contraseña ahora mismo." };
    try {
      var r = await window.fetch(base + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { "apikey": apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.email, password: contrasena })
      });
      if (r.ok) return { ok: true };
      if (r.status === 400 || r.status === 401) return { ok: false, error: "La contraseña no es correcta." };
      if (r.status === 429) return { ok: false, error: "Demasiados intentos. Espera un minuto y vuelve a probar." };
      return { ok: false, error: "No se pudo comprobar la contraseña (error " + r.status + ")." };
    } catch (e) {
      return { ok: false, error: "No se pudo comprobar la contraseña. Revisa la conexión." };
    }
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {
      try {
        var ta = h("textarea", { style: "position:fixed;left:-9999px;top:0" });
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        return !!ok;
      } catch (e2) {
        return false;
      }
    }
  }

  function descargarJson(nombre, objeto) {
    var blob = new Blob([JSON.stringify(objeto)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: nombre, style: "display:none" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 15000);
  }

  // ---------------------------------------------------------------------------
  // Diálogos
  // ---------------------------------------------------------------------------
  function abrirDialogo(titulo, raiz) {
    if (ctx && ctx.dialogo) ctx.dialogo.cerrar(true);
    var ocupado = false;
    var cuerpo = h("div", { class: "lap-dialogo-cuerpo" });
    var error = h("div", { class: "lap-banner mal", role: "alert", style: "display:none" });
    var pie = h("div", { class: "lap-pie" });
    var caja = h("div", { class: "lap-dialogo", role: "dialog", "aria-modal": "true", "aria-label": titulo },
      h("h2", null, titulo), cuerpo, error, pie);
    var velo = h("div", { class: "lap-velo" }, caja);
    (raiz || (ctx && ctx.nodo) || document.body).appendChild(velo);

    var api = {
      cuerpo: cuerpo,
      pie: pie,
      cerrar: function (forzar) {
        if (ocupado && !forzar) return;
        if (velo.parentNode) velo.parentNode.removeChild(velo);
        document.removeEventListener("keydown", alTeclear, true);
        if (ctx && ctx.dialogo === api) ctx.dialogo = null;
      },
      error: function (msg) {
        error.textContent = msg || "";
        error.style.display = msg ? "block" : "none";
      },
      ocupado: function (valor) {
        ocupado = !!valor;
        var controles = caja.querySelectorAll("button,input,textarea,select");
        for (var i = 0; i < controles.length; i++) {
          if (valor) {
            controles[i].setAttribute("data-lap-bloqueado", controles[i].disabled ? "0" : "1");
            controles[i].disabled = true;
          } else if (controles[i].getAttribute("data-lap-bloqueado") === "1") {
            controles[i].disabled = false;
            controles[i].removeAttribute("data-lap-bloqueado");
          }
        }
      },
      enfocar: function () {
        var c = caja.querySelector("input:not([readonly]):not([disabled]),textarea");
        if (c && c.focus) c.focus();
      }
    };
    function alTeclear(ev) {
      if (ev.key === "Escape") api.cerrar();
    }
    document.addEventListener("keydown", alTeclear, true);
    if (ctx) ctx.dialogo = api;
    return api;
  }

  function campo(etiqueta, input, ayuda, clave) {
    var err = h("div", { class: "lap-err", style: "display:none", "data-error-de": clave || "" });
    return {
      nodo: h("label", { class: "lap-campo" }, h("span", null, etiqueta), input, ayuda ? h("div", { class: "lap-ayuda" }, ayuda) : null, err),
      error: function (msg) { err.textContent = msg || ""; err.style.display = msg ? "block" : "none"; }
    };
  }

  function boton(texto, clase, alPulsar) {
    return h("button", { type: "button", class: "lap-btn" + (clase ? " " + clase : ""), onclick: alPulsar }, texto);
  }

  // Intro en un campo de una sola línea envía el formulario (el botón de envío está en el pie del diálogo, fuera del <form>).
  function enviarConIntro(form, enviar) {
    form.addEventListener("submit", function (ev) { ev.preventDefault(); });
    form.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target && ev.target.tagName !== "TEXTAREA" && ev.target.tagName !== "BUTTON") {
        ev.preventDefault();
        enviar();
      }
    });
  }

  function avisar(tipo, texto) {
    if (!ctx) return;
    ctx.aviso = texto ? { tipo: tipo, texto: texto } : null;
    pintar();
  }

  // --- Mostrar credenciales -----------------------------------------------------
  function dlgCredenciales(empresaNombre, email, password) {
    var d = abrirDialogo("Cuenta del dueño creada");
    var direccion = (window.location && window.location.origin) || "";
    var texto = "Empresa: " + empresaNombre + "\nDirección: " + direccion + "\nCorreo: " + email + "\nContraseña inicial: " + password;
    d.cuerpo.appendChild(h("p", { class: "lap-muted" }, "Entrega estos datos al dueño por un canal seguro. Esta contraseña no se volverá a mostrar."));
    d.cuerpo.appendChild(h("div", { class: "lap-caja", "data-credenciales": "1" }, texto));
    d.cuerpo.appendChild(h("p", { class: "lap-muted" }, "Al entrar por primera vez, la aplicación le obligará a elegir su propia contraseña."));
    var btnCopiar = boton("Copiar datos", "sec", async function () {
      var ok = await copiarTexto(texto);
      btnCopiar.textContent = ok ? "Copiado ✓" : "No se pudo copiar: selecciónalo a mano";
    });
    d.pie.appendChild(btnCopiar);
    d.pie.appendChild(boton("Hecho", "", function () { d.cerrar(); }));
  }

  // --- Alta de empresa + dueño --------------------------------------------------
  function dlgAlta() {
    var d = abrirDialogo("Dar de alta una empresa");
    var st = { empresaId: null, opAlta: idOperacion("alta") };
    var iNombre = h("input", { name: "nombre", maxlength: "160", autocomplete: "off", placeholder: "Ej. Bar La Esquina S.L." });
    var iCif = h("input", { name: "cif", maxlength: "40", autocomplete: "off" });
    var iLocal = h("input", { name: "local", maxlength: "160", autocomplete: "off", placeholder: "Ej. Local principal" });
    var iDueno = h("input", { name: "dueno", maxlength: "160", autocomplete: "off", placeholder: "Nombre de la persona dueña" });
    var iEmail = h("input", { name: "email", type: "email", maxlength: "320", autocomplete: "off", placeholder: "correo@empresa.com" });
    var iPass = h("input", { name: "password", type: "text", maxlength: "200", autocomplete: "off", spellcheck: "false" });
    iPass.value = generarContrasena("");

    var cNombre = campo("Nombre de la empresa", iNombre, null, "nombre");
    var cCif = campo("CIF / NIF (opcional)", iCif, null, "cif");
    var cLocal = campo("Nombre del primer local", iLocal, null, "local");
    var cDueno = campo("Dueño: nombre", iDueno, null, "dueno");
    var cEmail = campo("Dueño: correo", iEmail, "Será su usuario para entrar.", "email");
    var cPass = campo("Contraseña inicial", iPass, "La eliges tú y se la das al dueño; tendrá que cambiarla al entrar.", "password");
    var btnOtra = boton("Generar otra contraseña", "sec peq", function () { iPass.value = generarContrasena(iEmail.value); });

    var form = h("form", { novalidate: "novalidate" }, cNombre.nodo, cCif.nodo, cLocal.nodo, cDueno.nodo, cEmail.nodo, cPass.nodo, h("div", { class: "lap-fila", style: "margin-top:6px" }, btnOtra));
    d.cuerpo.appendChild(form);
    var btnEnviar = boton("Crear empresa y cuenta", "", function () { enviar(); });
    d.pie.appendChild(boton("Cancelar", "sec", function () { d.cerrar(); }));
    d.pie.appendChild(btnEnviar);
    enviarConIntro(form, enviar);

    async function enviar() {
      d.error("");
      var v = validarAlta({ nombre: iNombre.value, cif: iCif.value, local: iLocal.value, dueno: iDueno.value, email: iEmail.value, password: iPass.value });
      cNombre.error(v.errores.nombre); cCif.error(v.errores.cif); cLocal.error(v.errores.local);
      cDueno.error(v.errores.dueno); cEmail.error(v.errores.email); cPass.error(v.errores.password);
      if (!v.ok) return;
      d.ocupado(true);
      btnEnviar.textContent = "Creando…";
      try {
        if (!st.empresaId) {
          var r = await rpc("plataforma_crear_empresa", {
            p_operation_id: st.opAlta,
            p_nombre: v.datos.nombre,
            p_local_nombre: v.datos.local,
            p_cif: v.datos.cif || null
          });
          if (!r || r.ok !== true || !r.empresa_id) throw new Error("El servidor no confirmó la creación de la empresa.");
          st.empresaId = r.empresa_id;
        }
        var f = await funcion(FUNCION_PROPIETARIO, {
          empresaId: st.empresaId, nombre: v.datos.dueno, email: v.datos.email, password: v.datos.password
        });
        if (!f || f.ok !== true) throw new Error(f && f.error ? f.error : "No se pudo crear la cuenta del dueño.");
        d.ocupado(false);
        d.cerrar();
        await cargarEmpresas();
        avisar("ok", "Empresa «" + v.datos.nombre + "» creada con su dueño.");
        dlgCredenciales(v.datos.nombre, v.datos.email, v.datos.password);
      } catch (e) {
        d.ocupado(false);
        btnEnviar.textContent = "Crear empresa y cuenta";
        if (st.empresaId) {
          // La empresa ya existe: no se repite; solo falta la cuenta del dueño.
          iNombre.readOnly = true; iCif.readOnly = true; iLocal.readOnly = true;
          btnEnviar.textContent = "Crear solo la cuenta del dueño";
          d.error("La empresa «" + v.datos.nombre + "» ya está creada, pero falta la cuenta del dueño: " + traducirError(e) + " Corrige los datos del dueño y vuelve a pulsar el botón (la empresa no se repetirá). También puedes cerrar esto y usar «Añadir dueño» más tarde.");
          cargarEmpresas();
        } else {
          d.error(traducirError(e));
        }
      }
    }
    d.enfocar();
  }

  // --- Añadir dueño a una empresa existente -----------------------------------
  function dlgAnadirDueno(emp) {
    var d = abrirDialogo("Añadir dueño a «" + emp.nombre + "»");
    var iDueno = h("input", { name: "dueno", maxlength: "160", autocomplete: "off" });
    var iEmail = h("input", { name: "email", type: "email", maxlength: "320", autocomplete: "off" });
    var iPass = h("input", { name: "password", type: "text", maxlength: "200", autocomplete: "off", spellcheck: "false" });
    iPass.value = generarContrasena("");
    var cDueno = campo("Nombre", iDueno, null, "dueno");
    var cEmail = campo("Correo", iEmail, "Será su usuario para entrar.", "email");
    var cPass = campo("Contraseña inicial", iPass, "Tendrá que cambiarla al entrar.", "password");
    var form = h("form", { novalidate: "novalidate" }, cDueno.nodo, cEmail.nodo, cPass.nodo,
      h("div", { class: "lap-fila", style: "margin-top:6px" }, boton("Generar otra contraseña", "sec peq", function () { iPass.value = generarContrasena(iEmail.value); })));
    d.cuerpo.appendChild(form);
    var btn = boton("Crear cuenta", "", function () { enviar(); });
    d.pie.appendChild(boton("Cancelar", "sec", function () { d.cerrar(); }));
    d.pie.appendChild(btn);
    enviarConIntro(form, enviar);

    async function enviar() {
      d.error("");
      var datos = { dueno: iDueno.value, email: iEmail.value, password: iPass.value };
      var errores = validarDueno(datos);
      cDueno.error(errores.dueno); cEmail.error(errores.email); cPass.error(errores.password);
      if (Object.keys(errores).length) return;
      var email = limpiar(datos.email, 320).toLowerCase();
      d.ocupado(true);
      btn.textContent = "Creando…";
      try {
        var f = await funcion(FUNCION_PROPIETARIO, { empresaId: emp.id, nombre: limpiar(datos.dueno, 160), email: email, password: datos.password });
        if (!f || f.ok !== true) throw new Error(f && f.error ? f.error : "No se pudo crear la cuenta del dueño.");
        d.ocupado(false);
        d.cerrar();
        await cargarEmpresas();
        dlgCredenciales(emp.nombre, email, datos.password);
      } catch (e) {
        d.ocupado(false);
        btn.textContent = "Crear cuenta";
        d.error(traducirError(e));
      }
    }
    d.enfocar();
  }

  // --- Desactivar (o registrar la baja de una empresa ya desactivada) ---------
  function dlgDesactivar(emp, soloRegistrar) {
    var titulo = soloRegistrar ? "Registrar la baja de «" + emp.nombre + "»" : "Desactivar «" + emp.nombre + "»";
    var d = abrirDialogo(titulo);
    d.cuerpo.appendChild(h("p", { class: "lap-muted" }, soloRegistrar
      ? "La empresa ya está desactivada, pero no consta la fecha de baja. Al registrarla empieza a contar el plazo de gracia antes de poder borrarla."
      : "Sus usuarios dejarán de poder entrar y sus locales se desactivarán. No se borra ningún dato: podrás reactivarla cuando quieras."));
    var iMotivo = h("textarea", { name: "motivo", rows: "2", maxlength: "500", placeholder: "Ej. Ha dejado de usar el programa" });
    var iPass = h("input", { name: "contrasena", type: "password", autocomplete: "current-password" });
    var cMotivo = campo("Motivo (opcional)", iMotivo, null, "motivo");
    var cPass = campo("Tu contraseña de administrador", iPass, "Se pide para confirmar que eres tú.", "contrasena");
    var form = h("form", { novalidate: "novalidate" }, cMotivo.nodo, cPass.nodo);
    d.cuerpo.appendChild(form);
    var btn = boton(soloRegistrar ? "Registrar la baja" : "Desactivar empresa", "peligro", function () { enviar(); });
    d.pie.appendChild(boton("Cancelar", "sec", function () { d.cerrar(); }));
    d.pie.appendChild(btn);
    var opId = idOperacion("baja");
    enviarConIntro(form, enviar);

    async function enviar() {
      d.error("");
      cPass.error("");
      d.ocupado(true);
      try {
        var ok = await verificarContrasena(iPass.value);
        if (!ok.ok) { d.ocupado(false); cPass.error(ok.error); return; }
        var r = await rpc("plataforma_desactivar_empresa", { p_operation_id: opId, p_empresa_id: emp.id, p_motivo: limpiar(iMotivo.value, 500) || null });
        if (!r || r.ok !== true) throw new Error("El servidor no confirmó la desactivación.");
        d.ocupado(false);
        d.cerrar();
        await cargarEmpresas();
        avisar("ok", soloRegistrar ? "Baja registrada." : "«" + emp.nombre + "» desactivada. Sus datos se conservan.");
      } catch (e) {
        d.ocupado(false);
        d.error(traducirError(e));
      }
    }
    d.enfocar();
  }

  // --- Reactivar -------------------------------------------------------------------
  function dlgReactivar(emp) {
    var d = abrirDialogo("Reactivar «" + emp.nombre + "»");
    d.cuerpo.appendChild(h("p", { class: "lap-muted" }, "La empresa, sus locales y sus usuarios volverán a estar activos tal como estaban antes de la baja."));
    var opId = idOperacion("reactivar");
    var btn = boton("Reactivar empresa", "", async function () {
      d.error("");
      d.ocupado(true);
      try {
        var r = await rpc("plataforma_reactivar_empresa", { p_operation_id: opId, p_empresa_id: emp.id });
        if (!r || r.ok !== true) throw new Error("El servidor no confirmó la reactivación.");
        d.ocupado(false);
        d.cerrar();
        await cargarEmpresas();
        avisar("ok", "«" + emp.nombre + "» reactivada.");
      } catch (e) {
        d.ocupado(false);
        d.error(traducirError(e));
      }
    });
    d.pie.appendChild(boton("Cancelar", "sec", function () { d.cerrar(); }));
    d.pie.appendChild(btn);
  }

  // --- Copia descargable -----------------------------------------------------------
  async function accionCopia(emp, d) {
    var r = await rpc("plataforma_exportar_empresa", { p_operation_id: idOperacion("copia"), p_empresa_id: emp.id });
    if (!r || r.ok !== true || !r.copia) throw new Error("El servidor no devolvió la copia.");
    descargarJson(nombreFicheroCopia(emp.nombre), r.copia);
    return r;
  }

  async function copiaDesdeTarjeta(emp) {
    avisar("info", "Preparando la copia de «" + emp.nombre + "»… puede tardar un poco.");
    try {
      var r = await accionCopia(emp);
      avisar("ok", "Copia de «" + emp.nombre + "» descargada (" + numero(r.filas_total) + " filas). Guárdala en un sitio seguro. Huella: " + String(r.huella || "").slice(0, 16) + "…");
    } catch (e) {
      avisar("mal", "No se pudo preparar la copia: " + traducirError(e));
    }
  }

  // --- Eliminar definitivamente ---------------------------------------------------
  async function dlgEliminar(emp) {
    avisar(null, "");
    var resumen;
    try {
      resumen = await rpc("plataforma_resumen_eliminacion", { p_empresa_id: emp.id });
    } catch (e) {
      avisar("mal", "No se pudo preparar el borrado: " + traducirError(e));
      return;
    }
    var d = abrirDialogo("Eliminar «" + emp.nombre + "» para siempre");
    var bloqueos = Array.isArray(resumen && resumen.bloqueos) ? resumen.bloqueos : [];
    var duros = bloqueos.filter(function (b) { return b !== "sin_copia"; });
    var sinCopia = bloqueos.indexOf("sin_copia") !== -1;

    d.cuerpo.appendChild(h("div", { class: "lap-banner mal" },
      "Esto borra de forma definitiva la empresa, sus locales, sus datos y las cuentas de sus usuarios. No se puede deshacer."));
    d.cuerpo.appendChild(h("p", { class: "lap-muted" },
      "Se borrarían " + numero(resumen.filas_total) + " filas y " + numero(resumen.cuentas_a_borrar) + " cuenta(s) de acceso."));
    var porTabla = resumen && resumen.filas_por_tabla && typeof resumen.filas_por_tabla === "object" ? resumen.filas_por_tabla : {};
    var tablas = Object.keys(porTabla).filter(function (k) { return Number(porTabla[k]) > 0; }).sort();
    if (tablas.length) {
      d.cuerpo.appendChild(h("details", { class: "lap-muted" }, h("summary", null, "Ver detalle por tabla"),
        h("div", null, tablas.map(function (k) { return h("div", null, k + ": " + numero(porTabla[k])); }))));
    }

    if (duros.length) {
      d.cuerpo.appendChild(h("p", { class: "lap-muted" }, "Todavía no se puede borrar:"));
      duros.forEach(function (b) { d.cuerpo.appendChild(h("div", { class: "lap-banner info", "data-bloqueo": b }, textoBloqueo(b, resumen))); });
      d.pie.appendChild(boton("Cerrar", "", function () { d.cerrar(); }));
      return;
    }

    var opPreparar = idOperacion("prep");
    var opEliminar = idOperacion("eli");
    var iNombre = h("input", { name: "nombre", autocomplete: "off", spellcheck: "false" });
    var iMotivo = h("textarea", { name: "motivo", rows: "2", maxlength: "500", placeholder: "Ej. El cliente confirmó por escrito que no necesita copia" });
    var iPass = h("input", { name: "contrasena", type: "password", autocomplete: "current-password" });
    var cNombre = campo("Escribe el nombre exacto de la empresa para confirmar: " + emp.nombre, iNombre, null, "nombre");
    var cMotivo = campo("Motivo para borrar sin copia (mínimo 10 caracteres)", iMotivo, null, "motivo");
    var cPass = campo("Tu contraseña de administrador", iPass, null, "contrasena");
    var paso1 = h("form", { novalidate: "novalidate" });
    if (sinCopia) {
      var avisoCopia = h("div", { class: "lap-banner info" }, textoBloqueo("sin_copia", resumen) + " Puedes descargarla ahora o, si el cliente no la necesita, escribir un motivo.");
      var btnCopia = boton("Descargar copia ahora", "sec peq", async function () {
        d.error("");
        d.ocupado(true);
        btnCopia.textContent = "Preparando…";
        try {
          var r = await accionCopia(emp);
          d.ocupado(false);
          avisoCopia.textContent = "Copia descargada (" + numero(r.filas_total) + " filas). Ya puedes continuar sin motivo.";
          cMotivo.nodo.style.display = "none";
          btnCopia.style.display = "none";
          sinCopia = false;
          resumen.copia_hecha = true;
        } catch (e) {
          d.ocupado(false);
          btnCopia.textContent = "Descargar copia ahora";
          d.error("No se pudo preparar la copia: " + traducirError(e));
        }
      });
      paso1.appendChild(avisoCopia);
      paso1.appendChild(h("div", { class: "lap-fila", style: "margin-top:8px" }, btnCopia));
      paso1.appendChild(cMotivo.nodo);
    }
    paso1.appendChild(cNombre.nodo);
    paso1.appendChild(cPass.nodo);
    d.cuerpo.appendChild(paso1);

    var btnPreparar = boton("Preparar borrado", "peligro", function () { preparar(); });
    d.pie.appendChild(boton("Cancelar", "sec", function () { d.cerrar(); }));
    d.pie.appendChild(btnPreparar);
    enviarConIntro(paso1, preparar);

    async function preparar() {
      d.error("");
      cNombre.error(""); cMotivo.error(""); cPass.error("");
      if (limpiar(iNombre.value, 400) !== emp.nombre) { cNombre.error("No coincide con el nombre de la empresa."); return; }
      if (sinCopia && limpiar(iMotivo.value, 500).length < 10) { cMotivo.error("Escribe un motivo de al menos 10 caracteres o descarga la copia."); return; }
      d.ocupado(true);
      try {
        var ok = await verificarContrasena(iPass.value);
        if (!ok.ok) { d.ocupado(false); cPass.error(ok.error); return; }
        var p = await rpc("plataforma_preparar_eliminacion", { p_operation_id: opPreparar, p_empresa_id: emp.id });
        if (!p || p.ok !== true || !p.codigo) {
          d.ocupado(false);
          var nuevos = p && p.resumen && Array.isArray(p.resumen.bloqueos) ? p.resumen.bloqueos : [];
          d.error("El servidor no permite borrar ahora: " + (nuevos.length ? nuevos.map(function (b) { return textoBloqueo(b, p.resumen); }).join(" ") : "sin código de confirmación."));
          return;
        }
        d.ocupado(false);
        confirmar(p, sinCopia ? limpiar(iMotivo.value, 500) : null, limpiar(iNombre.value, 400));
      } catch (e) {
        d.ocupado(false);
        d.error(traducirError(e));
      }
    }

    function confirmar(prep, motivoSinCopia, nombre) {
      d.cuerpo.textContent = "";
      d.pie.textContent = "";
      d.error("");
      d.cuerpo.appendChild(h("div", { class: "lap-banner mal" }, "Último paso. Al pulsar «Eliminar para siempre» no hay vuelta atrás."));
      d.cuerpo.appendChild(h("p", { class: "lap-muted" }, "Código de confirmación (caduca a las " + horaCorta(prep.expira_en) + "):"));
      d.cuerpo.appendChild(h("div", { class: "lap-codigo", "data-codigo": "1" }, prep.codigo));
      var iCodigo = h("input", { name: "codigo", autocomplete: "off", spellcheck: "false", maxlength: "20" });
      var cCodigo = campo("Escribe el código para confirmar", iCodigo, null, "codigo");
      var form2 = h("form", { novalidate: "novalidate" }, cCodigo.nodo);
      d.cuerpo.appendChild(form2);
      var btnFinal = boton("Eliminar para siempre", "peligro", function () { eliminar(); });
      d.pie.appendChild(boton("Cancelar", "sec", function () { d.cerrar(); }));
      d.pie.appendChild(btnFinal);
      enviarConIntro(form2, eliminar);
      d.enfocar();

      async function eliminar() {
        d.error("");
        cCodigo.error("");
        var codigo = limpiar(iCodigo.value, 40).toUpperCase();
        if (codigo !== String(prep.codigo).toUpperCase()) { cCodigo.error("El código no coincide."); return; }
        d.ocupado(true);
        btnFinal.textContent = "Eliminando…";
        try {
          var r = await rpc("plataforma_eliminar_empresa", {
            p_operation_id: opEliminar,
            p_empresa_id: emp.id,
            p_nombre_confirmado: nombre,
            p_codigo: codigo,
            p_sin_copia_motivo: motivoSinCopia || null
          });
          if (!r || r.ok !== true) throw new Error("El servidor no confirmó el borrado.");
          d.ocupado(false);
          resultadoBorrado(r);
        } catch (e) {
          d.ocupado(false);
          btnFinal.textContent = "Eliminar para siempre";
          d.error(traducirError(e));
        }
      }
    }

    function resultadoBorrado(r) {
      d.cuerpo.textContent = "";
      d.pie.textContent = "";
      d.error("");
      d.cuerpo.appendChild(h("div", { class: "lap-banner ok" }, "«" + r.nombre + "» se ha eliminado."));
      d.cuerpo.appendChild(h("p", { class: "lap-muted" },
        numero(r.filas_total) + " filas borradas y " + numero(r.cuentas_eliminadas) + " cuenta(s) de acceso eliminadas. Queda un acta del borrado (sin datos de negocio). Huella: " + String(r.huella || "").slice(0, 16) + "…"));
      d.pie.appendChild(boton("Cerrar", "", function () { d.cerrar(); }));
      cargarEmpresas();
    }
    d.enfocar();
  }

  // ---------------------------------------------------------------------------
  // Panel
  // ---------------------------------------------------------------------------
  async function cargarEmpresas() {
    if (!ctx) return;
    var mio = ctx;
    ctx.cargando = true;
    ctx.errorLista = "";
    pintar();
    try {
      var lista = await rpc("plataforma_listar_empresas", {});
      if (ctx !== mio) return;
      ctx.empresas = Array.isArray(lista) ? lista : [];
    } catch (e) {
      if (ctx !== mio) return;
      ctx.errorLista = traducirError(e);
    }
    ctx.cargando = false;
    pintar();
  }

  function tarjetaEmpresa(emp) {
    var acciones = accionesDe(emp);
    var duenos = Array.isArray(emp.propietarios) ? emp.propietarios : [];
    var lineaDuenos;
    if (!duenos.length) {
      lineaDuenos = h("div", { class: "lap-banner info", style: "margin-top:8px" }, "Sin dueño todavía. Pulsa «Añadir dueño» para crearle la cuenta.");
    } else {
      lineaDuenos = h("div", { class: "lap-muted", style: "margin-top:6px" }, "Dueño: ", duenos.map(function (p, i) {
        return h("span", { "data-dueno": p.email || "" }, (i ? ", " : "") + (p.email || "(sin correo)") + (p.activo === false ? " (desactivado)" : ""));
      }));
    }
    var estado = emp.activa === true
      ? h("span", { class: "lap-pill ok" }, "Activa")
      : h("span", { class: "lap-pill off" }, "Desactivada");
    var detalleBaja = null;
    if (emp.activa !== true) {
      var partes = [];
      partes.push(emp.baja_en ? "Desactivada el " + fechaCorta(emp.baja_en) + "." : "Desactivada, sin fecha de baja registrada.");
      if (emp.baja_motivo) partes.push("Motivo: " + emp.baja_motivo);
      detalleBaja = h("div", { class: "lap-muted", style: "margin-top:6px" }, partes.join(" "));
    }
    var botones = acciones.map(function (a) {
      switch (a) {
        case "desactivar": return boton("Desactivar", "aviso peq", function () { dlgDesactivar(emp, false); });
        case "anadir_dueno": return boton("Añadir dueño", "sec peq", function () { dlgAnadirDueno(emp); });
        case "reactivar": return boton("Reactivar", "sec peq", function () { dlgReactivar(emp); });
        case "registrar_baja": return boton("Registrar la baja", "aviso peq", function () { dlgDesactivar(emp, true); });
        case "copia": return boton("Descargar copia", "sec peq", function () { copiaDesdeTarjeta(emp); });
        case "eliminar": return boton("Eliminar para siempre…", "peligro peq", function () { dlgEliminar(emp); });
        default: return null;
      }
    });
    return h("div", { class: "lap-tarjeta", "data-empresa": emp.id },
      h("div", { class: "lap-fila", style: "justify-content:space-between" }, h("h2", null, emp.nombre || "(sin nombre)"), estado),
      h("div", { class: "lap-muted", style: "margin-top:4px" },
        "Locales: " + numero(emp.locales_activos) + " activos de " + numero(emp.locales_total) +
        " · Usuarios: " + numero(emp.usuarios_activos) + " activos de " + numero(emp.usuarios_total)),
      lineaDuenos,
      detalleBaja,
      h("div", { class: "lap-fila", style: "margin-top:10px" }, botones));
  }

  function pintar() {
    if (!ctx || !ctx.nodo) return;
    var contenido = ctx.nodo.querySelector("[data-lap-contenido]");
    if (!contenido) return;
    contenido.textContent = "";
    var activas = 0, desactivadas = 0;
    (ctx.empresas || []).forEach(function (e) { if (e.activa === true) activas++; else desactivadas++; });

    if (ctx.aviso && ctx.aviso.texto) {
      contenido.appendChild(h("div", { class: "lap-banner " + ctx.aviso.tipo, role: ctx.aviso.tipo === "mal" ? "alert" : "status", "data-aviso": ctx.aviso.tipo }, ctx.aviso.texto));
    }
    contenido.appendChild(h("div", { class: "lap-fila", style: "justify-content:space-between;margin-top:12px" },
      h("div", { class: "lap-muted", "data-resumen": "1" },
        ctx.cargando && !(ctx.empresas || []).length ? "Cargando empresas…" :
          numero(activas) + (activas === 1 ? " empresa activa" : " empresas activas") + " · " + numero(desactivadas) + (desactivadas === 1 ? " desactivada" : " desactivadas")),
      h("div", { class: "lap-fila" },
        boton("Actualizar", "sec peq", function () { avisar(null, ""); cargarEmpresas(); }),
        boton("+ Dar de alta una empresa", "", function () { try { dlgAlta(); } catch (e) { avisar("mal", traducirError(e)); } }))));
    if (ctx.errorLista) {
      contenido.appendChild(h("div", { class: "lap-banner mal", role: "alert" }, "No se pudo cargar la lista: " + ctx.errorLista));
    }
    if (!ctx.cargando && !ctx.errorLista && !(ctx.empresas || []).length) {
      contenido.appendChild(h("div", { class: "lap-tarjeta", "data-vacio": "1" },
        "Todavía no hay ninguna empresa. Pulsa «Dar de alta una empresa» para crear la primera y la cuenta de su dueño."));
    }
    (ctx.empresas || []).forEach(function (e) { contenido.appendChild(tarjetaEmpresa(e)); });
  }

  // Tras cerrar sesión se recarga la página: así no queda en memoria nada de la sesión anterior
  // (por ejemplo avisos de guardado de la aplicación que estaba cargada por detrás).
  async function cerrarSesion(recargar, userId) {
    try { await ctx.supabase.auth.signOut(); } catch (e) {}
    borrarModoApp(userId);
    if (typeof recargar === "function") recargar();
  }

  function mostrarPanel(supabase, sesion, estado, opciones) {
    asegurarEstilos();
    cerrarTodo();
    var o = opciones || {};
    document.documentElement.classList.add("la-installation-needs-setup");
    document.documentElement.classList.add("la-plataforma-abierta");
    document.documentElement.classList.remove("la-installation-checking");
    quitarCargando();

    var email = sesion && sesion.user && sesion.user.email ? sesion.user.email : "";
    var botonesBarra = [];
    if (estado && estado.mis_empresas > 0 && typeof o.recargar === "function") {
      botonesBarra.push(boton("Abrir mi aplicación", "sec peq", function () {
        guardarModoApp(sesion.user.id);
        cerrarTodo();
        // Se recarga la página: el programa que estaba cargado por detrás mientras se veía el panel tenía la barrera
        // cerrada y habría dado avisos falsos de «cambio no guardado». Recargado, arranca limpio y con la barrera ya validada.
        o.recargar();
      }));
    }
    botonesBarra.push(boton("Cerrar sesión", "sec peq", function () { cerrarSesion(o.recargar, sesion.user.id); }));

    var nodo = h("div", { id: ROOT_PANEL_ID, class: "lap-root", role: "main" },
      h("div", { class: "lap-barra" },
        h("div", null, h("h1", null, "Plataforma · L&A Suite"), h("small", null, "Administrador: " + email)),
        h("div", { class: "lap-fila" }, botonesBarra)),
      h("div", { class: "lap-cuerpo" },
        h("div", { class: "lap-muted" }, "Desde aquí das de alta a las empresas que usan el programa, las desactivas si dejan de usarlo y, pasado el plazo de gracia, borras todos sus datos."),
        h("div", { "data-lap-contenido": "1" })));
    ctx = {
      supabase: supabase, userId: sesion.user.id, email: email, estado: estado || {}, opciones: o,
      empresas: [], cargando: true, errorLista: "", aviso: null, dialogo: null, nodo: nodo
    };
    document.body.appendChild(nodo);
    pintar();
    cargarEmpresas();
  }

  // Pequeño botón para volver al panel cuando el administrador está dentro de su propia aplicación.
  function montarAtajo(userId, alVolver) {
    quitarNodo(ATAJO_ID);
    asegurarEstilos();
    var b = h("button", { id: ATAJO_ID, type: "button", class: "lap-btn peq lap-atajo", title: "Volver al panel de la plataforma", onclick: function () {
      borrarModoApp(userId);
      quitarNodo(ATAJO_ID);
      if (typeof alVolver === "function") alVolver();
    } }, "← Plataforma");
    document.body.appendChild(b);
  }

  // Sin sesión (por ejemplo, el administrador cerró sesión desde su propia aplicación) no queda elección guardada.
  function olvidarModoAplicacion() {
    modoApp = {};
    try { window.sessionStorage.removeItem(CLAVE_MODO_APP); } catch (e) {}
  }

  function enModoAplicacion(userId) {
    return modoApp[userId] === true || (!!userId && leerMarcaModoApp() === String(userId));
  }

  // ---------------------------------------------------------------------------
  // Pantalla «Elige tu contraseña»
  // ---------------------------------------------------------------------------
  // Si el navegador tiene la sesión guardada con un aviso antiguo, se confirma con el servidor antes de molestar.
  async function sigueDebiendoCambiar(supabase, sesion) {
    if (!debeCambiarContrasena(sesion)) return false;
    try {
      var r = await supabase.auth.getUser();
      var u = r && r.data ? r.data.user : null;
      if (u && u.user_metadata) return u.user_metadata.debe_cambiar_contrasena === true;
    } catch (e) {}
    return true;
  }

  function mostrarCambioContrasena(supabase, sesion, opciones) {
    asegurarEstilos();
    cerrarTodo();
    var o = opciones || {};
    cambioAbierto = sesion.user.id;
    document.documentElement.classList.add("la-installation-needs-setup");
    document.documentElement.classList.remove("la-installation-checking");
    quitarCargando();

    var email = sesion.user.email || "";
    var i1 = h("input", { name: "nueva", type: "password", autocomplete: "new-password", maxlength: "200" });
    var i2 = h("input", { name: "repite", type: "password", autocomplete: "new-password", maxlength: "200" });
    var c1 = campo("Nueva contraseña", i1, "Mínimo 10 caracteres, con letras y números.", "nueva");
    var c2 = campo("Repite la contraseña", i2, null, "repite");
    var error = h("div", { class: "lap-banner mal", role: "alert", style: "display:none" });
    var btn = boton("Guardar contraseña y entrar", "", function () { guardar(); });
    var form = h("form", { novalidate: "novalidate" },
      h("p", { class: "lap-muted" }, "Tu cuenta se creó con una contraseña inicial que conoce quien te dio de alta. Elige ahora una contraseña que solo sepas tú."),
      c1.nodo, c2.nodo, error,
      h("div", { class: "lap-pie" }, boton("Cerrar sesión", "sec", function () { cerrarSesionCambio(); }), btn));
    var caja = h("div", { class: "lap-dialogo", role: "dialog", "aria-modal": "true", "aria-label": "Elige tu contraseña" },
      h("div", { style: "font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7F5823;font-weight:700" }, "L&A Suite · primer acceso"),
      h("h2", { style: "margin-top:6px" }, "Elige tu contraseña"), form);
    var raiz = h("div", { id: ROOT_CAMBIO_ID, class: "lap-cambio lap-root", style: "background:radial-gradient(circle at 50% 20%,#153D27 0%,#0C2714 48%,#06170E 100%)" }, caja);
    document.body.appendChild(raiz);

    var enCurso = false;
    enviarConIntro(form, guardar);

    async function cerrarSesionCambio() {
      try { await supabase.auth.signOut(); } catch (e) {}
      if (typeof o.recargar === "function") o.recargar();
    }

    async function guardar() {
      if (enCurso) return;
      error.style.display = "none";
      c1.error(""); c2.error("");
      var motivo = validarCambioContrasena(i1.value, i2.value, email);
      if (motivo) {
        (motivo.indexOf("coinciden") !== -1 ? c2 : c1).error(motivo);
        return;
      }
      enCurso = true;
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        var r = await supabase.auth.updateUser({ password: i1.value, data: { debe_cambiar_contrasena: false } });
        if (r && r.error) throw r.error;
        // El cambio queda confirmado: se cierra la pantalla y se recarga la página para entrar de forma normal
        // (el programa cargado por detrás mientras se elegía la contraseña daría avisos falsos de «cambio no guardado»).
        cambioAbierto = null;
        quitarNodo(ROOT_CAMBIO_ID);
        i1.value = ""; i2.value = "";
        if (typeof o.recargar === "function") o.recargar();
      } catch (e) {
        enCurso = false;
        btn.disabled = false;
        btn.textContent = "Guardar contraseña y entrar";
        var m = String(e && e.message ? e.message : e || "");
        var code = e && (e.code || e.error_code) ? String(e.code || e.error_code) : "";
        if (code === "same_password" || /different from the old password/i.test(m)) m = "La nueva contraseña tiene que ser distinta de la inicial.";
        else if (code === "weak_password" || /weak|easy to guess/i.test(m)) m = "Esa contraseña es demasiado fácil de adivinar. Prueba con otra.";
        else if (code === "reauthentication_needed" || /reauthentication/i.test(m)) m = "Por seguridad, cierra sesión, vuelve a entrar con la contraseña inicial y repite el cambio.";
        else m = traducirError(e);
        error.textContent = m;
        error.style.display = "block";
      }
    }
    i1.focus();
  }

  window.__laPlataforma = {
    version: 1,
    consultarEstado: consultarEstado,
    debeCambiarContrasena: debeCambiarContrasena,
    sigueDebiendoCambiar: sigueDebiendoCambiar,
    mostrarCambioContrasena: mostrarCambioContrasena,
    mostrarPanel: mostrarPanel,
    montarAtajo: montarAtajo,
    enModoAplicacion: enModoAplicacion,
    olvidarModoAplicacion: olvidarModoAplicacion,
    panelAbierto: panelAbierto,
    cambioAbierto: cambioAbiertoPara,
    cerrarTodo: cerrarTodo,
    _puro: {
      contrasenaDebil: contrasenaDebil,
      generarContrasena: generarContrasena,
      idOperacion: idOperacion,
      validarAlta: validarAlta,
      validarDueno: validarDueno,
      validarCambioContrasena: validarCambioContrasena,
      fechaCorta: fechaCorta,
      nombreFicheroCopia: nombreFicheroCopia,
      accionesDe: accionesDe,
      textoBloqueo: textoBloqueo,
      traducirError: traducirError,
      esFuncionInexistente: esFuncionInexistente
    }
  };
})();
