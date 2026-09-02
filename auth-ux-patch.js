// Compatibilidad UX de autenticación para Chocoloyos Almacén.
// Añade dos piezas que el bundle actual todavía no incluye:
// 1) recuperación/cambio de contraseña con Supabase Auth;
// 2) cierre de sesión visible para el perfil Propietario.
//
// La autorización de datos sigue estando en Supabase/RLS y edge-auth-patch.js.
(function () {
  "use strict";
  if (window.__authUxPatchInstalado) return;
  window.__authUxPatchInstalado = true;

  var RECOVERY_KEY = "chocoloyos_recuperacion_pendiente_v1";
  var ID_MODAL = "chocoloyos-auth-recovery-modal";
  var CLASE_OLVIDO = "chocoloyos-auth-forgot";
  var CLASE_LOGOUT = "chocoloyos-auth-owner-logout";
  var clienteCache = null;
  var observador = null;
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
      "." + CLASE_OLVIDO + "{display:block;width:100%;margin:10px 0 0;padding:7px 8px;border:0;background:transparent;color:#6f6654;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}",
      "." + CLASE_LOGOUT + "{border:0;border-radius:10px;padding:8px 11px;background:rgba(255,255,255,.10);color:#d9e3dd;font:inherit;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}",
      "#" + ID_MODAL + "{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,17,.72);display:flex;align-items:center;justify-content:center;padding:18px}",
      "#" + ID_MODAL + " .choco-auth-card{width:min(440px,100%);background:#f8f5ec;color:#15271f;border-radius:18px;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.35)}",
      "#" + ID_MODAL + " h2{margin:0 0 8px;font-size:22px}",
      "#" + ID_MODAL + " p{margin:0 0 16px;color:#68736d;font-size:14px;line-height:1.45}",
      "#" + ID_MODAL + " label{display:block;margin:10px 0 5px;font-size:13px;font-weight:700}",
      "#" + ID_MODAL + " input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cfc8b8;border-radius:10px;background:#fff;color:#15271f;font:inherit}",
      "#" + ID_MODAL + " .choco-auth-error{min-height:18px;margin-top:9px;color:#a63d32;font-size:12px}",
      "#" + ID_MODAL + " .choco-auth-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}",
      "#" + ID_MODAL + " button{border:0;border-radius:10px;padding:11px 14px;font:inherit;font-weight:700;cursor:pointer}",
      "#" + ID_MODAL + " .choco-auth-primary{background:#9a7729;color:#fff;flex:1}",
      "#" + ID_MODAL + " .choco-auth-secondary{background:#e8e3d8;color:#26352e}",
      "#" + ID_MODAL + " button:disabled{opacity:.55;cursor:default}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function mensajeCerca(elemento, texto, esError) {
    if (!elemento || !elemento.parentNode) return;
    var id = "chocoloyos-auth-mensaje";
    var anterior = document.getElementById(id);
    if (anterior) anterior.remove();
    var div = document.createElement("div");
    div.id = id;
    div.textContent = texto;
    div.style.marginTop = "8px";
    div.style.fontSize = "12px";
    div.style.lineHeight = "1.35";
    div.style.color = esError ? "#a63d32" : "#52675c";
    elemento.insertAdjacentElement("afterend", div);
  }

  function marcarRecuperacion(valor) {
    try {
      if (valor) localStorage.setItem(RECOVERY_KEY, String(valor));
      else localStorage.removeItem(RECOVERY_KEY);
    } catch (e) {}
  }

  function hayRecuperacionPendiente() {
    try { return !!localStorage.getItem(RECOVERY_KEY); } catch (e) { return false; }
  }

  async function mostrarModalNuevaPassword() {
    if (document.getElementById(ID_MODAL)) return;
    aplicarEstilos();

    var supabase;
    try { supabase = await clienteSupabase(); } catch (e) { return; }
    var sesion;
    try { sesion = await supabase.auth.getSession(); } catch (e) { return; }
    if (!sesion || !sesion.data || !sesion.data.session) return;

    var overlay = document.createElement("div");
    overlay.id = ID_MODAL;
    overlay.innerHTML = [
      '<div class="choco-auth-card" role="dialog" aria-modal="true" aria-label="Restablecer contraseña">',
      '<h2>Crear nueva contraseña</h2>',
      '<p>Escribe una contraseña nueva para esta cuenta. No se modificará ningún dato del negocio.</p>',
      '<label for="choco-auth-pass1">Nueva contraseña</label>',
      '<input id="choco-auth-pass1" type="password" autocomplete="new-password" minlength="8">',
      '<label for="choco-auth-pass2">Repetir contraseña</label>',
      '<input id="choco-auth-pass2" type="password" autocomplete="new-password" minlength="8">',
      '<div class="choco-auth-error" aria-live="polite"></div>',
      '<div class="choco-auth-actions">',
      '<button type="button" class="choco-auth-secondary">Cancelar</button>',
      '<button type="button" class="choco-auth-primary">Guardar contraseña</button>',
      '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(overlay);

    var pass1 = overlay.querySelector("#choco-auth-pass1");
    var pass2 = overlay.querySelector("#choco-auth-pass2");
    var error = overlay.querySelector(".choco-auth-error");
    var cancelar = overlay.querySelector(".choco-auth-secondary");
    var guardar = overlay.querySelector(".choco-auth-primary");

    cancelar.addEventListener("click", function () {
      overlay.remove();
    });

    guardar.addEventListener("click", async function () {
      var p1 = pass1.value || "";
      var p2 = pass2.value || "";
      if (p1.length < 8) {
        error.textContent = "Usa al menos 8 caracteres.";
        pass1.focus();
        return;
      }
      if (p1 !== p2) {
        error.textContent = "Las dos contraseñas no coinciden.";
        pass2.focus();
        return;
      }

      guardar.disabled = true;
      cancelar.disabled = true;
      error.textContent = "Guardando…";
      try {
        var resultado = await supabase.auth.updateUser({ password: p1 });
        if (resultado.error) throw resultado.error;
        marcarRecuperacion(null);
        error.style.color = "#2f6b4f";
        error.textContent = "Contraseña actualizada. Volviendo al inicio de sesión…";
        pass1.value = "";
        pass2.value = "";
        try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
        setTimeout(function () { window.location.reload(); }, 900);
      } catch (e) {
        guardar.disabled = false;
        cancelar.disabled = false;
        error.style.color = "#a63d32";
        error.textContent = e && e.message ? e.message : "No se pudo actualizar la contraseña.";
      }
    });

    setTimeout(function () { pass1.focus(); }, 50);
  }

  function buscarBotonEntrar() {
    var botones = document.querySelectorAll("button");
    for (var i = 0; i < botones.length; i++) {
      if ((botones[i].textContent || "").trim() === "Entrar") return botones[i];
    }
    return null;
  }

  function asegurarOlvidePassword() {
    if (document.querySelector("." + CLASE_OLVIDO)) return;
    var email = document.querySelector('input[placeholder="Correo"]');
    var password = document.querySelector('input[placeholder="Contraseña"]');
    var entrar = buscarBotonEntrar();
    if (!email || !password || !entrar || !entrar.parentNode) return;

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = CLASE_OLVIDO;
    boton.textContent = "¿Olvidaste tu contraseña?";
    entrar.insertAdjacentElement("afterend", boton);

    boton.addEventListener("click", async function () {
      var correo = (email.value || "").trim();
      if (!correo) {
        mensajeCerca(boton, "Escribe primero el correo de la cuenta.", true);
        email.focus();
        return;
      }

      boton.disabled = true;
      mensajeCerca(boton, "Enviando correo de recuperación…", false);
      try {
        var supabase = await clienteSupabase();
        marcarRecuperacion(correo);
        var resultado = await supabase.auth.resetPasswordForEmail(correo, {
          redirectTo: window.location.origin
        });
        if (resultado.error) throw resultado.error;
        mensajeCerca(
          boton,
          "Si la cuenta existe, recibirás un correo. Ábrelo en este mismo navegador para crear la nueva contraseña.",
          false
        );
      } catch (e) {
        marcarRecuperacion(null);
        mensajeCerca(boton, e && e.message ? e.message : "No se pudo enviar el correo de recuperación.", true);
      } finally {
        boton.disabled = false;
      }
    });
  }

  function quitarLogoutPropietario() {
    var botones = document.querySelectorAll("." + CLASE_LOGOUT);
    for (var i = 0; i < botones.length; i++) botones[i].remove();
  }

  function buscarBotonModoEmpleado() {
    var botones = document.querySelectorAll("button");
    for (var i = 0; i < botones.length; i++) {
      var texto = (botones[i].textContent || "").replace(/\s+/g, " ").trim();
      if (texto.indexOf("Modo empleado") !== -1) return botones[i];
    }
    return null;
  }

  async function asegurarLogoutPropietario() {
    var existente = document.querySelector("." + CLASE_LOGOUT);
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
      perfil = await supabase.from("perfiles").select("rol, nombre, activo").eq("user_id", userId).maybeSingle();
    } catch (e) { return; }
    if (perfil.error || !perfil.data || perfil.data.activo !== true || perfil.data.rol !== "Propietario") {
      quitarLogoutPropietario();
      return;
    }
    if (existente && document.body.contains(existente)) return;

    var modoEmpleado = buscarBotonModoEmpleado();
    if (!modoEmpleado || !modoEmpleado.parentNode) return;
    aplicarEstilos();

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = CLASE_LOGOUT;
    boton.textContent = "Cerrar sesión";
    boton.title = "Cerrar sesión de Propietario en este dispositivo";
    modoEmpleado.insertAdjacentElement("afterend", boton);

    boton.addEventListener("click", async function () {
      if (!window.confirm("¿Cerrar la sesión de Propietario en este dispositivo?")) return;
      boton.disabled = true;
      try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
      window.location.reload();
    });
  }

  function programarRefresco() {
    if (refrescoProgramado) return;
    refrescoProgramado = true;
    setTimeout(function () {
      refrescoProgramado = false;
      asegurarOlvidePassword();
      asegurarLogoutPropietario();
    }, 80);
  }

  async function iniciar() {
    aplicarEstilos();
    var supabase;
    try { supabase = await clienteSupabase(); } catch (e) { return; }

    try {
      supabase.auth.onAuthStateChange(function (evento) {
        if (evento === "PASSWORD_RECOVERY") {
          marcarRecuperacion("recovery");
          setTimeout(mostrarModalNuevaPassword, 0);
        }
        if (evento === "SIGNED_OUT") quitarLogoutPropietario();
        programarRefresco();
      });
    } catch (e) {}

    try {
      var sesion = await supabase.auth.getSession();
      if (sesion && sesion.data && sesion.data.session && hayRecuperacionPendiente()) {
        setTimeout(mostrarModalNuevaPassword, 0);
      }
    } catch (e) {}

    asegurarOlvidePassword();
    asegurarLogoutPropietario();

    if (typeof MutationObserver !== "undefined") {
      observador = new MutationObserver(programarRefresco);
      observador.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
