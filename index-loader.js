  // VERSION es solo una marca visible de qué entrega es esta, para cuando
  // se compara una versión con otra — no participa en el arranque.
  var VERSION = "reparto-en-varios-archivos-1";

  var paso = document.getElementById("paso");
  var root = document.getElementById("root");
  var watchdog = null;
  var observer = null;
  var resuelto = false;
  function di(t) { if (paso) paso.textContent = t; }
  function mostrarErrorArranque(mensaje) {
    if (resuelto) return;
    di(mensaje || "No se ha podido cargar la suite.");
    var cargando = document.getElementById("cargando");
    if (!cargando || document.getElementById("error-arranque")) return;
    var aviso = document.createElement("div");
    aviso.id = "error-arranque";
    aviso.setAttribute("role", "alert");
    aviso.setAttribute("aria-live", "assertive");
    aviso.style.cssText = "margin-top:16px;max-width:320px;text-align:center;color:#F6F4EE;font:13px/1.45 system-ui,sans-serif;";
    aviso.textContent = "El arranque ha tardado demasiado. No se ha borrado ningún dato.";
    var boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = "Reintentar";
    boton.style.cssText = "display:block;margin:12px auto 0;min-height:44px;padding:10px 18px;border:1px solid #D2AD68;border-radius:8px;background:#D2AD68;color:#17191C;font:600 13px system-ui,sans-serif;cursor:pointer;";
    boton.addEventListener("click", function () { window.location.reload(); });
    aviso.appendChild(boton);
    cargando.appendChild(aviso);
  }
  function marcarArranqueResuelto() {
    if (!root || !root.children.length) return;
    resuelto = true;
    if (watchdog) window.clearTimeout(watchdog);
    if (observer) observer.disconnect();
  }
  di("Cargando…");

  // El arranque puede necesitar red, pero nunca debe dejar la pantalla
  // bloqueada indefinidamente. El watchdog solo actúa si React no ha montado
  // ningún nodo después de 20 s; no toca datos ni cancela operaciones en curso.
  watchdog = window.setTimeout(function () {
    if (!resuelto && root && !root.children.length) mostrarErrorArranque("La suite no ha podido terminar de arrancar.");
  }, 20000);
  if (root && typeof MutationObserver === "function") {
    observer = new MutationObserver(marcarArranqueResuelto);
    observer.observe(root, { childList: true });
  }

  // Antes, aquí se ensamblaba el código en un blob y se cargaba con
  // import() dinámico — hacía falta porque el código llegaba embebido como
  // texto plano dentro del propio HTML (primero sin compilar, con Babel
  // desde unpkg.com; después ya compilado, pero seguía embebido). Ahora
  // fuente.js es un archivo de verdad, servido tal cual junto al HTML, así
  // que basta con un <script type="module"> normal — es más simple y dejar
  // que el navegador lo cachee con las reglas HTTP normales, en vez de
  // gestionar la caché a mano con localStorage.
  window.addEventListener("error", function (e) {
    if (e && e.filename && e.filename.indexOf("fuente.js") !== -1) {
      console.error("Fallo al arrancar:", e.message);
      mostrarErrorArranque("Error al arrancar la suite.");
    }
  });
