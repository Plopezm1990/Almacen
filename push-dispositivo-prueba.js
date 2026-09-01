// Prueba temporal y aislada de push real para UN solo dispositivo.
// Solo se activa en la rama mediante el cargador con ?push-test=1.
// No lee ni escribe suscripciones_push.
(function () {
  "use strict";

  var ENDPOINT = "https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/enviar-notificacion-dispositivo-prueba";
  var MARCA = "chocoloyos:push-prueba-real-enviada-v2";

  function base64UrlAUint8Array(base64) {
    var padding = "=".repeat((4 - base64.length % 4) % 4);
    var s = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(s);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function crearPanel() {
    if (document.getElementById("push-prueba-dispositivo")) return;

    var panel = document.createElement("div");
    panel.id = "push-prueba-dispositivo";
    panel.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:10050;background:#F7F3E9;color:#17241C;border:2px solid #8C6D2A;border-radius:16px;padding:12px 14px;font-family:system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.22);max-width:620px;margin:auto";

    var titulo = document.createElement("div");
    titulo.style.cssText = "font-weight:800;font-size:15px;margin-bottom:5px";
    titulo.textContent = "Prueba push · solo este dispositivo";

    var texto = document.createElement("div");
    texto.style.cssText = "font-size:12px;line-height:1.35;margin-bottom:10px";
    texto.textContent = "El botón usa únicamente la suscripción push de este navegador. No consulta ni contacta los otros dispositivos registrados.";

    var estado = document.createElement("div");
    estado.style.cssText = "font-size:12px;margin:6px 0;min-height:18px";

    var fila = document.createElement("div");
    fila.style.cssText = "display:flex;gap:8px;align-items:center";

    var boton = document.createElement("button");
    boton.type = "button";
    boton.style.cssText = "flex:1;border:0;border-radius:11px;padding:11px 12px;background:#0C3B23;color:white;font-size:13px;font-weight:800";
    boton.textContent = "Enviar 1 prueba a este móvil";

    var cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.style.cssText = "border:1px solid #8C6D2A;border-radius:11px;padding:10px 12px;background:transparent;color:#17241C;font-size:13px";
    cerrar.textContent = "Cerrar";
    cerrar.onclick = function () { panel.remove(); };

    if (localStorage.getItem(MARCA) === "1") {
      boton.disabled = true;
      boton.style.opacity = "0.5";
      boton.textContent = "Prueba ya enviada";
      estado.textContent = "Este navegador ya completó esta prueba temporal.";
    }

    boton.onclick = async function () {
      boton.disabled = true;
      boton.style.opacity = "0.6";
      estado.style.color = "#5c665f";
      estado.textContent = "Preparando este dispositivo…";

      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
          throw new Error("Este navegador no admite notificaciones push.");
        }

        if (Notification.permission === "denied") {
          throw new Error("Las notificaciones están bloqueadas para este sitio.");
        }
        if (Notification.permission !== "granted") {
          var permiso = await Notification.requestPermission();
          if (permiso !== "granted") throw new Error("No se concedió permiso para notificaciones.");
        }

        if (typeof window.getSupabaseClient !== "function") {
          throw new Error("No se pudo comprobar la sesión. Recarga la aplicación.");
        }
        var supabase = await window.getSupabaseClient();
        var rSesion = await supabase.auth.getSession();
        var token = rSesion && rSesion.data && rSesion.data.session ? rSesion.data.session.access_token : null;
        if (!token) throw new Error("No hay sesión activa.");

        var registro = await navigator.serviceWorker.getRegistration();
        if (!registro) registro = await navigator.serviceWorker.register("./sw.js");
        registro = await navigator.serviceWorker.ready;

        estado.textContent = "Comprobando la suscripción de este navegador…";
        var sub = await registro.pushManager.getSubscription();
        var temporal = false;

        if (!sub) {
          var rConfig = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ accion: "config" })
          });
          var config = await rConfig.json().catch(function () { return {}; });
          if (!rConfig.ok || !config.vapidPublicKey) throw new Error(config.error || "No se pudo preparar VAPID.");

          estado.textContent = "Creando una suscripción temporal solo para esta prueba…";
          sub = await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlAUint8Array(config.vapidPublicKey)
          });
          temporal = true;
        }

        estado.textContent = "Enviando una única prueba…";
        var r = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            accion: "enviar",
            confirmacion: "UNA_PRUEBA_REAL",
            suscripcion: sub.toJSON()
          })
        });
        var datos = await r.json().catch(function () { return {}; });
        if (!r.ok || datos.ok !== true || datos.enviado !== true) {
          throw new Error(datos.error || "La prueba no pudo enviarse.");
        }

        localStorage.setItem(MARCA, "1");
        boton.textContent = "Prueba enviada";
        estado.style.color = "#176b3a";
        estado.textContent = temporal
          ? "✅ Envío aceptado. Se creó una suscripción temporal en esta rama; no se guardó en la base de datos. Espera unos segundos a recibir el aviso."
          : "✅ Envío aceptado únicamente para este dispositivo. Espera unos segundos a recibir el aviso.";
      } catch (e) {
        estado.style.color = "#9b1c1c";
        estado.textContent = "❌ " + (e && e.message ? e.message : String(e));
        boton.disabled = false;
        boton.style.opacity = "1";
      }
    };

    fila.appendChild(boton);
    fila.appendChild(cerrar);
    panel.appendChild(titulo);
    panel.appendChild(texto);
    panel.appendChild(estado);
    panel.appendChild(fila);
    document.body.appendChild(panel);
  }

  function iniciar() {
    var intentos = 0;
    var timer = setInterval(function () {
      intentos++;
      if (document.body && typeof window.getSupabaseClient === "function") {
        clearInterval(timer);
        crearPanel();
      } else if (intentos > 60) {
        clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
