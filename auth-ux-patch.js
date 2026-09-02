// Compatibilidad UX de autenticación para Chocoloyos Almacén.
// Mantiene acceso a recuperación de contraseña y cierre de sesión de Propietario.
// En móvil la cabecera desplaza sus controles internamente sin ensanchar la página.
(function () {
  "use strict";
  if (window.__authUxPatchInstalado) return;
  window.__authUxPatchInstalado = true;

  var CLASE_OLVIDO = "chocoloyos-auth-forgot";
  var CLASE_LOGOUT = "chocoloyos-auth-owner-logout";
  var CLASE_BARRA = "chocoloyos-auth-topbar";
  var clienteCache = null;
  var refrescoProgramado = false;

  function esperar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
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
      "html,body,#root{box-sizing:border-box;width:100%;max-width:100%;overflow-x:hidden!important}",
      "." + CLASE_OLVIDO + "{display:block;width:100%;margin:10px 0 0;padding:7px 8px;border:0;background:transparent;color:#6f6654;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}",
      "." + CLASE_BARRA + "{box-sizing:border-box!important;min-width:0!important;max-width:100%!important}",
      "." + CLASE_LOGOUT + "{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;min-height:40px;border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:0 12px;background:rgba(255,255,255,.10);color:#e7eee9;font:inherit;font-size:12px;font-weight:700;line-height:1;white-space:nowrap;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .12s ease}",
      "." + CLASE_LOGOUT + ":active{transform:scale(.97)}",
      "." + CLASE_LOGOUT + ":focus-visible{outline:2px solid #e4c77b;outline-offset:2px}",
      "." + CLASE_LOGOUT + ":disabled{opacity:.55;cursor:default;transform:none}",
      "." + CLASE_LOGOUT + " svg{display:block;width:19px;height:19px;flex:0 0 19px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
      "@media (max-width:640px){",
      "html,body,#root{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}",
      "." + CLASE_BARRA + "{display:flex!important;flex-wrap:nowrap!important;width:100%!important;max-width:100vw!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-right:58px!important}",
      "." + CLASE_BARRA + "::-webkit-scrollbar{display:none}",
      "." + CLASE_BARRA + ">*{flex-shrink:0!important}",
      "." + CLASE_LOGOUT + "{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:30;width:44px;min-width:44px;height:44px;min-height:44px;padding:0;border-radius:13px;background:#21452f;box-shadow:-10px 0 16px #0b321d}",
      "." + CLASE_LOGOUT + ":active{transform:translateY(-50%) scale(.97)}",
      "." + CLASE_LOGOUT + " .chocoloyos-auth-logout-text{display:none}",
      "." + CLASE_BARRA + "{position:relative!important}",
      "}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function normalizarViewport() {
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      window.scrollTo(0, window.scrollY || 0);
    } catch (e) {}
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

  function quitarLogoutPropietario() {
    var botones = document.querySelectorAll("." + CLASE_LOGOUT);
    for (var i = 0; i < botones.length; i++) botones[i].remove();
  }

  function prepararBarra(modoEmpleado) {
    if (!modoEmpleado || !modoEmpleado.parentElement) return;
    modoEmpleado.parentElement.classList.add(CLASE_BARRA);
    normalizarViewport();
  }

  function contenidoBotonLogout() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
      '<path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10"></path>',
      '<path d="M14 8l4 4-4 4"></path>',
      '<path d="M9 12h9"></path>',
      '</svg>',
      '<span class="chocoloyos-auth-logout-text">Cerrar sesión</span>'
    ].join("");
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

    var modoEmpleado = buscarBotonPorTexto("Modo empleado");
    if (!modoEmpleado || !modoEmpleado.parentNode) return;
    prepararBarra(modoEmpleado);

    var existente = document.querySelector("." + CLASE_LOGOUT);
    if (existente && document.body.contains(existente)) {
      normalizarViewport();
      return;
    }

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = CLASE_LOGOUT;
    boton.innerHTML = contenidoBotonLogout();
    boton.setAttribute("aria-label", "Cerrar sesión");
    boton.title = "Cerrar sesión de Propietario en este dispositivo";
    modoEmpleado.insertAdjacentElement("afterend", boton);

    boton.addEventListener("click", async function () {
      if (!window.confirm("¿Cerrar la sesión de Propietario en este dispositivo?")) return;
      boton.disabled = true;
      try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
      window.location.reload();
    });

    prepararBarra(modoEmpleado);
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
    normalizarViewport();

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
