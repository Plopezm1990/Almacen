// Bootstrap mínimo del shell offline. Debe ser un archivo externo porque la
// CSP de la aplicación no permite scripts inline.
(function () {
  "use strict";

  function registrarShellOffline() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).then(function (registro) {
      if (registro.waiting) registro.waiting.postMessage({ type: "SKIP_WAITING" });
    }).catch(function () {
      // La aplicación sigue funcionando online si el navegador no admite SW.
    });
  }

  function actualizarEstadoRed() {
    var paso = document.getElementById("paso");
    if (paso && navigator.onLine === false) paso.textContent = "Sin conexión · abriendo copia local…";
  }

  registrarShellOffline();
  window.addEventListener("offline", actualizarEstadoRed);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", actualizarEstadoRed);
  else actualizarEstadoRed();
})();
