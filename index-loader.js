  // VERSION es solo una marca visible de qué entrega es esta, para cuando
  // se compara una versión con otra — no participa en el arranque.
  var VERSION = "reparto-en-varios-archivos-1";

  var paso = document.getElementById("paso");
  function di(t) { if (paso) paso.textContent = t; }
  di("Cargando…");

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
      di("Error al arrancar. Recarga la página.");
    }
  });
