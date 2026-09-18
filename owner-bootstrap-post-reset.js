(function () {
  "use strict";
  if (window.__laOwnerBootstrapFlowV1) return;
  window.__laOwnerBootstrapFlowV1 = true;

  var secuencia = 0;
  var supabaseActual = null;
  var usuarioActual = null;
  var ROOT_SETUP_ID = "la-installation-setup-root";

  function htmlSeguro(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function quitarSetup() {
    var anterior = document.getElementById(ROOT_SETUP_ID);
    if (anterior) anterior.remove();
    document.documentElement.classList.remove("la-installation-needs-setup");
  }

  function iniciarComprobacion() {
    document.documentElement.classList.add("la-installation-checking");
    document.documentElement.classList.remove("la-installation-needs-setup");
    if (typeof window.__laOwnerBootstrapReset === "function") window.__laOwnerBootstrapReset();
    window.__instalacionSyncPermitida = false;
  }

  function liberarVistaSinSesion() {
    quitarSetup();
    document.documentElement.classList.remove("la-installation-checking");
  }

  function liberarVistaLista() {
    quitarSetup();
    document.documentElement.classList.remove("la-installation-checking");
  }

  function tokenDe(sesion) {
    return sesion && sesion.access_token ? sesion.access_token : "";
  }

  function generacionLocal() {
    try { return localStorage.getItem("la_suite_installation_generation_v1") || ""; }
    catch (e) { return ""; }
  }

  async function rpcP4(nombre, sesion, cuerpo) {
    if (typeof window.__laOwnerBootstrapRpc !== "function") {
      throw new Error("Canal seguro de bootstrap no disponible");
    }
    return window.__laOwnerBootstrapRpc(nombre, tokenDe(sesion), cuerpo || {});
  }

  async function sembrarContextoUi(sesion) {
    var contexto = await rpcP4("obtener_contexto_instalacion_ui", sesion, {});
    if (!contexto || contexto.state !== "ready") {
      throw new Error("El servidor no confirmó el contexto de empresa/local");
    }
    if (!contexto.generation || contexto.generation !== generacionLocal()) {
      throw new Error("La generación del contexto empresa/local no coincide");
    }
    if (typeof window.__laOwnerBootstrapSeedUiContext !== "function") {
      throw new Error("Semilla segura del contexto empresa/local no disponible");
    }
    window.__laOwnerBootstrapSeedUiContext(contexto, sesion.user.id);
    return contexto;
  }

  function crearMarco(titulo, descripcion) {
    quitarSetup();
    document.documentElement.classList.remove("la-installation-checking");
    document.documentElement.classList.add("la-installation-needs-setup");

    var root = document.createElement("div");
    root.id = ROOT_SETUP_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.style.cssText = "position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 50% 20%,#153D27 0%,#0C2714 48%,#06170E 100%);font-family:'IBM Plex Sans',system-ui,sans-serif;color:#102018";

    var tarjeta = document.createElement("div");
    tarjeta.style.cssText = "width:min(100%,520px);background:#F7F3E9;border:1px solid rgba(198,154,82,.55);border-radius:22px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.38)";
    tarjeta.innerHTML =
      '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7F5823;font-weight:700">L&amp;A Suite · instalación inicial</div>' +
      '<h1 style="margin:8px 0 8px;font-size:25px;line-height:1.15;color:#0C2714">' + htmlSeguro(titulo) + '</h1>' +
      '<p style="margin:0 0 18px;color:#4B5A54;font-size:14px;line-height:1.5">' + htmlSeguro(descripcion) + '</p>';
    root.appendChild(tarjeta);
    document.body.appendChild(root);
    var cargando = document.getElementById("cargando");
    if (cargando) cargando.remove();
    return tarjeta;
  }

  function mostrarBloqueo(mensaje, permitirReintento, opciones) {
    var op = opciones || {};
    var tarjeta = crearMarco(
      op.titulo || "Instalación bloqueada de forma segura",
      op.descripcion || "No se abrirá el panel ni se sincronizarán datos hasta resolver el estado del servidor."
    );
    var aviso = document.createElement("div");
    aviso.style.cssText = "padding:12px 14px;border-radius:12px;background:#fff7e7;border:1px solid #d9b56d;color:#6a4b18;font-size:13px;line-height:1.45";
    aviso.textContent = mensaje || "El estado de instalación no es válido.";
    tarjeta.appendChild(aviso);

    if (permitirReintento) {
      var boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = op.textoBoton || "Reintentar comprobación";
      boton.style.cssText = "margin-top:16px;width:100%;padding:12px 16px;border:0;border-radius:12px;background:#0C2714;color:#fff;font-weight:700;cursor:pointer";
      boton.addEventListener("click", function () {
        // Volver a comprobar aqui solo es posible si llegamos a tener cliente
        // y usuario. Cuando no los hay -- el caso mas habitual, que el
        // programa no se haya descargado entero -- este boton no hacia nada
        // en absoluto: reintentar la comprobacion no vuelve a bajar el
        // archivo que falta. Recargar si.
        if (supabaseActual && usuarioActual) validarSesion(supabaseActual, usuarioActual);
        else window.location.reload();
      });
      tarjeta.appendChild(boton);
    }
  }

  function mostrarNecesitaSetup(supabase, sesion, estado) {
    var tarjeta = crearMarco(
      "Crea la primera empresa y el primer local",
      "El servidor está vacío y la identidad del Propietario ya está validada. Esta operación crea los tres registros iniciales en una sola transacción."
    );

    var formulario = document.createElement("form");
    formulario.innerHTML =
      '<label style="display:block;margin:12px 0 6px;font-size:13px;font-weight:700;color:#263b30">Nombre de la empresa</label>' +
      '<input name="empresa" autocomplete="organization" maxlength="120" required style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #b7b0a0;background:#fff;font:inherit" placeholder="Ej. L&A Hostelería" />' +
      '<label style="display:block;margin:14px 0 6px;font-size:13px;font-weight:700;color:#263b30">Nombre del primer local</label>' +
      '<input name="local" maxlength="120" required style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #b7b0a0;background:#fff;font:inherit" placeholder="Ej. Local principal" />' +
      '<div data-error style="display:none;margin-top:12px;padding:10px 12px;border-radius:10px;background:#fff0ed;color:#8d2e1f;font-size:13px"></div>' +
      '<button type="submit" style="margin-top:16px;width:100%;padding:13px 16px;border:0;border-radius:12px;background:#0C2714;color:#fff;font-weight:700;cursor:pointer">Crear instalación inicial</button>';
    tarjeta.appendChild(formulario);

    formulario.addEventListener("submit", async function (evento) {
      evento.preventDefault();
      var boton = formulario.querySelector("button[type=submit]");
      var error = formulario.querySelector("[data-error]");
      var empresa = String(formulario.elements.empresa.value || "").trim();
      var local = String(formulario.elements.local.value || "").trim();
      error.style.display = "none";

      if (empresa.length < 2 || local.length < 2) {
        error.textContent = "Indica un nombre válido para la empresa y el local.";
        error.style.display = "block";
        return;
      }

      boton.disabled = true;
      boton.textContent = "Creando…";
      try {
        var actual = await supabase.auth.getSession();
        var sesionActual = actual && actual.data ? actual.data.session : null;
        if (!sesionActual || !sesionActual.user || sesionActual.user.id !== sesion.user.id) {
          throw new Error("La sesión cambió. Vuelve a iniciar sesión.");
        }

        if (typeof window.__prepararSesionPostReset !== "function") {
          throw new Error("No se pudo validar la generación de instalación");
        }
        var preparacion = await window.__prepararSesionPostReset(supabase, sesionActual);
        if (preparacion && preparacion.generacionCambiada) {
          window.location.reload();
          return;
        }

        var resultado = await rpcP4("bootstrap_owner_instalacion", sesionActual, {
          p_empresa_nombre: empresa,
          p_local_nombre: local
        });
        if (!resultado || resultado.state !== "ready") throw new Error("El bootstrap no confirmó estado ready");

        var comprobacion = await rpcP4("obtener_estado_instalacion", sesionActual, {});
        if (!comprobacion || comprobacion.state !== "ready") throw new Error("El servidor no confirmó la instalación creada");
        if (!comprobacion.generation || comprobacion.generation !== generacionLocal()) {
          throw new Error("La generación del servidor cambió durante el bootstrap");
        }

        await sembrarContextoUi(sesionActual);
        if (typeof window.__laOwnerBootstrapSetReady === "function") window.__laOwnerBootstrapSetReady(true);
        window.__instalacionSyncPermitida = true;
        if (window.__instalacionSyncPermitida !== true) throw new Error("La barrera de sincronización no quedó validada");

        window.location.reload();
      } catch (e) {
        if (typeof window.__laOwnerBootstrapSetReady === "function") window.__laOwnerBootstrapSetReady(false);
        error.textContent = e && e.message ? e.message : "No se pudo crear la instalación inicial.";
        error.style.display = "block";
        boton.disabled = false;
        boton.textContent = "Crear instalación inicial";
      }
    });
  }

  async function validarSesion(supabase, sesion) {
    var miSecuencia = ++secuencia;
    supabaseActual = supabase;
    usuarioActual = sesion;
    iniciarComprobacion();

    if (!sesion || !sesion.user || !sesion.user.id) {
      usuarioActual = null;
      liberarVistaSinSesion();
      return;
    }

    try {
      if (typeof window.__prepararSesionPostReset !== "function") {
        throw new Error("Barrera de generación no disponible");
      }

      var preparacion = await window.__prepararSesionPostReset(supabase, sesion);
      if (miSecuencia !== secuencia) return;
      if (preparacion && preparacion.generacionCambiada) {
        window.location.reload();
        return;
      }

      var estado = await rpcP4("obtener_estado_instalacion", sesion, {});
      if (miSecuencia !== secuencia) return;
      if (!estado || !estado.state || !estado.generation) throw new Error("Respuesta de instalación incompleta");
      if (estado.generation !== generacionLocal()) throw new Error("Generación de instalación no coincide");

      if (estado.state === "ready") {
        await sembrarContextoUi(sesion);
        if (miSecuencia !== secuencia) return;
        if (typeof window.__laOwnerBootstrapSetReady === "function") window.__laOwnerBootstrapSetReady(true);
        if (window.__instalacionSyncPermitida !== true) throw new Error("Sincronización no validada");
        liberarVistaLista();
        if (typeof window.subirPendientes === "function") await window.subirPendientes();
        return;
      }

      if (estado.state === "needs_setup") {
        if (typeof window.__laOwnerBootstrapSetReady === "function") window.__laOwnerBootstrapSetReady(false);
        mostrarNecesitaSetup(supabase, sesion, estado);
        return;
      }

      if (typeof window.__laOwnerBootstrapSetReady === "function") window.__laOwnerBootstrapSetReady(false);
      mostrarBloqueo("El servidor devolvió un estado empresarial inconsistente. No se ha modificado ningún dato.", true);
    } catch (e) {
      if (miSecuencia !== secuencia) return;
      if (typeof window.__laOwnerBootstrapSetReady === "function") window.__laOwnerBootstrapSetReady(false);
      mostrarBloqueo(e && e.message ? e.message : "No se pudo validar la instalación.", true);
    }
  }

  async function iniciar() {
    var supabase = null;
    for (var i = 0; i < 160; i++) {
      if (typeof window.getSupabaseClient === "function") {
        try { supabase = await window.getSupabaseClient(); } catch (e) {}
        if (supabase) break;
      }
      await new Promise(function (resolver) { setTimeout(resolver, 25); });
    }

    if (!supabase || !supabase.auth) {
      // `window.getSupabaseClient` la define el propio programa al cargarse, y
      // en ningun otro sitio. Si no esta, no llego a cargarse: no sabemos nada
      // del servidor, asi que no se le echa la culpa.
      if (typeof window.getSupabaseClient !== "function") {
        mostrarBloqueo(
          "No se ha podido descargar el programa entero. Suele ser cosa de la conexión: vuelve a cargar la página.",
          true,
          {
            titulo: "No se ha podido cargar el programa",
            descripcion: "Falta parte del programa, así que el panel no se abre. No se ha perdido ningún dato.",
            textoBoton: "Volver a cargar"
          }
        );
      } else {
        mostrarBloqueo("Cliente Supabase no disponible. La aplicación permanece cerrada para proteger el estado post-reset.", true);
      }
      return;
    }

    supabaseActual = supabase;
    try {
      var actual = await supabase.auth.getSession();
      var sesion = actual && actual.data ? actual.data.session : null;
      await validarSesion(supabase, sesion);

      supabase.auth.onAuthStateChange(function (_evento, nuevaSesion) {
        setTimeout(function () { validarSesion(supabase, nuevaSesion); }, 0);
      });
    } catch (e) {
      mostrarBloqueo(e && e.message ? e.message : "No se pudo comprobar la sesión.", true);
    }
  }

  iniciar();
})();
