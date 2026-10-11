  // Una vez que el módulo se ha importado y ejecutado, React ya habrá
  // montado algo dentro de #root — se quita el indicador de "Cargando…".
  // (Un observador simple, en vez de encadenar una promesa al import, ya
  // que un <script type="module" src="..."> no da un gancho directo de
  // "terminé" desde fuera de sí mismo.)
  (function comprobar() {
    var root = document.getElementById("root");
    if (root && root.firstChild) {
      var c = document.getElementById("cargando");
      if (c) c.remove();
    } else {
      setTimeout(comprobar, 50);
    }
  })();
