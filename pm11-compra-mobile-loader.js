(function () {
  "use strict";

  // PM11 P10: el parche visual de compras es parte de la app y debe
  // cargarse en todos los entornos, incluida producción. Separado de
  // reset-pruebas-preview.js (exclusivo de Deploy Preview) en PM26 P04b
  // -- antes vivía dentro de ese archivo, que producción descargaba
  // entero solo para ejecutar este bloque y salir por el guard de QA.
  if (typeof window === "undefined" || window.__pm11CompraMobileLoaderV1) return;
  window.__pm11CompraMobileLoaderV1 = true;
  var mobileScript = document.createElement("script");
  mobileScript.src = "./pm11-compra-mobile-layout-v1.js?v=pm11-p10-mobile-v1";
  mobileScript.async = false;
  mobileScript.setAttribute("data-pm11-compra-mobile", "v1");
  (document.head || document.documentElement).appendChild(mobileScript);
})();
