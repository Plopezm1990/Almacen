// Compatibilidad UX de autenticación para Chocoloyos Almacén.
// Mantiene recuperación de contraseña y cierre de sesión de Propietario.
// En móvil, "Cerrar sesión" vive dentro de Más > Ajustes para no saturar la cabecera.
(function () {
  "use strict";
  if (window.__authUxPatchInstalado) return;
  window.__authUxPatchInstalado = true;

  var CLASE_OLVIDO = "chocoloyos-auth-forgot";
  var CLASE_LOGOUT = "chocoloyos-auth-owner-logout";
  var CLASE_LOGOUT_MENU = "chocoloyos-auth-owner-logout-menu";
  var clienteCache = null;
  var refrescoProgramado = false;

  function esperar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function esMovil() {
    try { return window.matchMedia("(max-width: 760px)").matches; }
    catch (e) { return (window.innerWidth || 0) <= 760; }
  }

  async function clienteSupabase() {
    if (clienteCache) return clienteCache;
    for (var i = 0; i < 120; i++) {
      if (typeof window.getSupabaseClient === "function") {
        clienteCache = await window.getSupabaseClient();
        return clienteCache;
      }
      await esperar(25);
    }
    throw new Error("Cliente Supabase no disponible");
  }

  function aplicarEstilos() {
    if (document.getElementById("chocoloyos-auth-ux-style")) return;
    var style = document.createElement("style");
    style.id = "chocoloyos-auth-ux-style";
    style.textContent = [
      "." + CLASE_OLVIDO + "{display:block;width:100%;margin:10px 0 0;padding:7px 8px;border:0;background:transparent;color:#6f6654;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}",
      "." + CLASE_LOGOUT + "{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;min-height:40px;border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:0 12px;background:rgba(255,255,255,.10);color:#e7eee9;font:inherit;font-size:12px;font-weight:700;line-height:1;white-space:nowrap;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .12s ease}",
      "." + CLASE_LOGOUT + ":hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.16)}",
      "." + CLASE_LOGOUT + ":active{transform:scale(.97)}",
      "." + CLASE_LOGOUT + ":focus-visible{outline:2px solid #e4c77b;outline-offset:2px}",
      "." + CLASE_LOGOUT + ":disabled,." + CLASE_LOGOUT_MENU + ":disabled{opacity:.55;cursor:default;transform:none}",
      "." + CLASE_LOGOUT + " svg{display:block;width:18px;height:18px;flex:0 0 18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
      "." + CLASE_LOGOUT_MENU + " svg{stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
      "@media (max-width:760px){." + CLASE_LOGOUT + "{display:none!important}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function buscarBotonPorTexto(textoBuscado) {
    var botones = document.querySelectorAll("button");
    for (var i = 0; i < botones.length; i++) {
      var texto = (botones[i].textContent || "").replace(/\s+/g, " ").trim();
      if (texto.indexOf(textoBuscado) !== -1) return botones[i];
    }
    return null;
  }

  function asegurarOlvidePassword() {
    if (document.querySelector("." + CLASE_OLVIDO)) return;
    var email = document.querySelector('input[placeholder="Correo"]');
    var password = document.querySelector('input[placeholder="Contraseña"]');
    var entrar = buscarBotonPorTexto("Entrar");
    if (!email || !password || !entrar || !entrar.parentNode) return;

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = CLASE_OLVIDO;
    boton.textContent = "¿Olvidaste tu contraseña?";
    boton.addEventListener("click", function () {
      window.location.href = "./restablecer-contrasena.html";
    });
    entrar.insertAdjacentElement("afterend", boton);
  }

  function quitarLogoutCabecera() {
    var botones = document.querySelectorAll("." + CLASE_LOGOUT);
    for (var i = 0; i < botones.length; i++) botones[i].remove();
  }

  function quitarLogoutMenu() {
    var botones = document.querySelectorAll("." + CLASE_LOGOUT_MENU);
    for (var i = 0; i < botones.length; i++) botones[i].remove();
  }

  function quitarLogoutPropietario() {
    quitarLogoutCabecera();
    quitarLogoutMenu();
  }

  function iconoLogout() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10"></path>',
      '<path d="M14 8l4 4-4 4"></path>',
      '<path d="M9 12h9"></path>',
      '</svg>'
    ].join("");
  }

  function contenidoBotonLogout() {
    return iconoLogout() + '<span class="chocoloyos-auth-logout-text">Cerrar sesión</span>';
  }

  function reemplazarTexto(root, anterior, nuevo) {
    if (!root || typeof document.createTreeWalker !== "function") return false;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodo;
    while ((nodo = walker.nextNode())) {
      if ((nodo.nodeValue || "").indexOf(anterior) !== -1) {
        nodo.nodeValue = nodo.nodeValue.replace(anterior, nuevo);
        return true;
      }
    }
    return false;
  }

  async function cerrarSesion(supabase, boton) {
    if (!window.confirm("¿Cerrar la sesión de Propietario en este dispositivo?")) return;
    if (boton) boton.disabled = true;
    try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
    window.location.reload();
  }

  function asegurarLogoutEnMenu(supabase) {
    quitarLogoutCabecera();
    if (document.querySelector("." + CLASE_LOGOUT_MENU)) return;

    var referencia = buscarBotonPorTexto("Locales");
    if (!referencia || !referencia.parentNode) return;

    var boton = referencia.cloneNode(true);
    boton.classList.add(CLASE_LOGOUT_MENU);
    boton.type = "button";
    boton.removeAttribute("id");
    boton.setAttribute("aria-label", "Cerrar sesión");
    boton.setAttribute("title", "Cerrar sesión de Propietario en este dispositivo");

    var ids = boton.querySelectorAll("[id]");
    for (var i = 0; i < ids.length; i++) ids[i].removeAttribute("id");

    var svg = boton.querySelector("svg");
    if (svg) svg.outerHTML = iconoLogout();
    reemplazarTexto(boton, "Locales", "Cerrar sesión");

    boton.addEventListener("click", function (evento) {
      evento.preventDefault();
      evento.stopPropagation();
      cerrarSesion(supabase, boton);
    });

    referencia.insertAdjacentElement("afterend", boton);
  }

  function asegurarLogoutEnCabecera(supabase) {
    quitarLogoutMenu();
    var existente = document.querySelector("." + CLASE_LOGOUT);
    if (existente && document.body.contains(existente)) return;

    var modoEmpleado = buscarBotonPorTexto("Modo empleado");
    if (!modoEmpleado || !modoEmpleado.parentNode) return;

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = CLASE_LOGOUT;
    boton.innerHTML = contenidoBotonLogout();
    boton.setAttribute("aria-label", "Cerrar sesión");
    boton.title = "Cerrar sesión de Propietario en este dispositivo";
    modoEmpleado.insertAdjacentElement("afterend", boton);

    boton.addEventListener("click", function () {
      cerrarSesion(supabase, boton);
    });
  }

  async function asegurarLogoutPropietario() {
    var supabase;
    try { supabase = await clienteSupabase(); } catch (e) { return; }

    var sesion;
    try { sesion = await supabase.auth.getSession(); } catch (e) { return; }
    var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user
      ? sesion.data.session.user.id : null;
    if (!userId) {
      quitarLogoutPropietario();
      return;
    }

    var perfil;
    try {
      perfil = await supabase.from("perfiles").select("rol, activo").eq("user_id", userId).maybeSingle();
    } catch (e) { return; }
    if (perfil.error || !perfil.data || perfil.data.activo !== true || perfil.data.rol !== "Propietario") {
      quitarLogoutPropietario();
      return;
    }

    if (esMovil()) asegurarLogoutEnMenu(supabase);
    else asegurarLogoutEnCabecera(supabase);
  }

  function programarRefresco() {
    if (refrescoProgramado) return;
    refrescoProgramado = true;
    setTimeout(function () {
      refrescoProgramado = false;
      asegurarOlvidePassword();
      asegurarLogoutPropietario();
    }, 100);
  }

  async function iniciar() {
    aplicarEstilos();

    try {
      var supabase = await clienteSupabase();
      supabase.auth.onAuthStateChange(function (evento) {
        if (evento === "SIGNED_OUT") quitarLogoutPropietario();
        programarRefresco();
      });
    } catch (e) {}

    programarRefresco();

    if (typeof MutationObserver !== "undefined") {
      var observador = new MutationObserver(programarRefresco);
      observador.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener("resize", programarRefresco);
    window.addEventListener("orientationchange", function () {
      setTimeout(programarRefresco, 150);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
