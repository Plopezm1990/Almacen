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
  var CLASE_ICONO_MENU = "chocoloyos-auth-menu-logout-icon";
  var ID_CONFIRM = "chocoloyos-auth-logout-confirm";
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
      "." + CLASE_OLVIDO + "{display:block;width:100%;margin:12px 0 0;padding:7px 8px;border:0;background:transparent;color:#C69A52;text-decoration:underline;text-underline-offset:3px;font:inherit;font-size:13px;cursor:pointer}",
      "." + CLASE_LOGOUT + "{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;min-height:40px;border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:0 12px;background:rgba(255,255,255,.10);color:#e7eee9;font:inherit;font-size:12px;font-weight:700;line-height:1;white-space:nowrap;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .12s ease}",
      "." + CLASE_LOGOUT + ":hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.16)}",
      "." + CLASE_LOGOUT + ":active{transform:scale(.97)}",
      "." + CLASE_LOGOUT + ":focus-visible{outline:2px solid #e4c77b;outline-offset:2px}",
      "." + CLASE_LOGOUT + ":disabled,." + CLASE_LOGOUT_MENU + ":disabled{opacity:.55;cursor:default;transform:none}",
      "." + CLASE_LOGOUT + " svg{display:block;width:18px;height:18px;flex:0 0 18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
      "." + CLASE_LOGOUT_MENU + " ." + CLASE_ICONO_MENU + "{display:block!important;width:22px!important;height:22px!important;min-width:22px!important;max-width:22px!important;flex:0 0 22px!important;stroke:currentColor!important;fill:none!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important}",
      "@media (max-width:760px){." + CLASE_LOGOUT + "{display:none!important}}",
      "#" + ID_CONFIRM + "{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,18,11,.76);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}",
      "#" + ID_CONFIRM + " .choco-logout-card{box-sizing:border-box;width:min(390px,100%);padding:22px;background:#123621;color:#f8f1df;border:1px solid rgba(229,199,123,.24);border-radius:20px;box-shadow:0 22px 70px rgba(0,0,0,.46)}",
      "#" + ID_CONFIRM + " .choco-logout-mark{display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0 0 14px;border-radius:13px;background:rgba(229,199,123,.12);color:#e5c77b}",
      "#" + ID_CONFIRM + " .choco-logout-mark svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
      "#" + ID_CONFIRM + " h2{margin:0 0 8px;font-size:20px;line-height:1.2;font-weight:800;color:#fff8e8}",
      "#" + ID_CONFIRM + " p{margin:0;color:#bfd0c5;font-size:14px;line-height:1.5}",
      "#" + ID_CONFIRM + " .choco-logout-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}",
      "#" + ID_CONFIRM + " button{box-sizing:border-box;min-height:46px;border-radius:12px;padding:0 14px;font:inherit;font-size:14px;font-weight:800;cursor:pointer}",
      "#" + ID_CONFIRM + " .choco-logout-cancel{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:#edf3ef}",
      "#" + ID_CONFIRM + " .choco-logout-confirm{border:1px solid #b08a37;background:#a77d29;color:#fffaf0}",
      "#" + ID_CONFIRM + " button:focus-visible{outline:2px solid #e5c77b;outline-offset:2px}",
      "#" + ID_CONFIRM + " button:disabled{opacity:.55;cursor:default}",
      "#" + ID_CONFIRM + " .choco-logout-error{min-height:18px;margin-top:10px;color:#ffb1a7;font-size:12px;line-height:1.35}"
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

  function quitarConfirmacion() {
    var modal = document.getElementById(ID_CONFIRM);
    if (modal) modal.remove();
  }

  function quitarLogoutPropietario() {
    quitarLogoutCabecera();
    quitarLogoutMenu();
    quitarConfirmacion();
  }

  function rutasIconoLogout() {
    return [
      '<path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10"></path>',
      '<path d="M14 8l4 4-4 4"></path>',
      '<path d="M9 12h9"></path>'
    ].join("");
  }

  function iconoLogout(clase) {
    return '<svg' + (clase ? ' class="' + clase + '"' : '') + ' viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + rutasIconoLogout() + '</svg>';
  }

  function contenidoBotonLogout() {
    return iconoLogout("") + '<span class="chocoloyos-auth-logout-text">Cerrar sesión</span>';
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

  function mostrarConfirmacionCerrarSesion(supabase, botonOrigen) {
    if (document.getElementById(ID_CONFIRM)) return;
    aplicarEstilos();

    var modal = document.createElement("div");
    modal.id = ID_CONFIRM;
    modal.setAttribute("role", "presentation");
    modal.innerHTML = [
      '<div class="choco-logout-card" role="dialog" aria-modal="true" aria-labelledby="choco-logout-title" aria-describedby="choco-logout-text">',
      '<div class="choco-logout-mark">' + iconoLogout("") + '</div>',
      '<h2 id="choco-logout-title">Cerrar sesión</h2>',
      '<p id="choco-logout-text">Vas a cerrar la sesión de Propietario solo en este dispositivo. Los datos del negocio no se modificarán.</p>',
      '<div class="choco-logout-error" aria-live="polite"></div>',
      '<div class="choco-logout-actions">',
      '<button type="button" class="choco-logout-cancel">Cancelar</button>',
      '<button type="button" class="choco-logout-confirm">Cerrar sesión</button>',
      '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(modal);

    var cancelar = modal.querySelector(".choco-logout-cancel");
    var confirmar = modal.querySelector(".choco-logout-confirm");
    var error = modal.querySelector(".choco-logout-error");

    function cancelarModal() {
      modal.remove();
      if (botonOrigen && document.body.contains(botonOrigen)) {
        try { botonOrigen.focus({ preventScroll: true }); } catch (e) { try { botonOrigen.focus(); } catch (_) {} }
      }
    }

    cancelar.addEventListener("click", cancelarModal);
    modal.addEventListener("click", function (evento) {
      if (evento.target === modal) cancelarModal();
    });

    modal.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cancelarModal();
      }
    });

    confirmar.addEventListener("click", async function () {
      confirmar.disabled = true;
      cancelar.disabled = true;
      error.textContent = "Cerrando sesión…";
      try {
        var resultado = await supabase.auth.signOut({ scope: "local" });
        if (resultado && resultado.error) throw resultado.error;
        window.location.reload();
      } catch (e) {
        confirmar.disabled = false;
        cancelar.disabled = false;
        error.textContent = e && e.message ? e.message : "No se pudo cerrar la sesión. Inténtalo de nuevo.";
      }
    });

    setTimeout(function () { try { cancelar.focus(); } catch (e) {} }, 30);
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
    if (svg) {
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.classList.add(CLASE_ICONO_MENU);
      svg.innerHTML = rutasIconoLogout();
    }
    reemplazarTexto(boton, "Locales", "Cerrar sesión");

    boton.addEventListener("click", function (evento) {
      evento.preventDefault();
      evento.stopPropagation();
      mostrarConfirmacionCerrarSesion(supabase, boton);
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
      mostrarConfirmacionCerrarSesion(supabase, boton);
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
