/* ==========================================================================
   L&A Suite - Pasada de presentacion sobre la interfaz
   --------------------------------------------------------------------------
   Dos arreglos que se resuelven mejor una vez para toda la aplicacion que
   pantalla por pantalla:

   1. Tablas convertibles a fichas
   --------------------------------------------------------------------------
   La especificacion pide que las tablas se conviertan en fichas con sus
   etiquetas cuando el ancho no da para comparar columnas. En vez de tocar
   pantalla por pantalla dentro del bundle, esta capa lo resuelve para TODAS:
   lee las cabeceras reales de cada tabla y las copia en `data-etiqueta` de la
   celda que les corresponde. La hoja de estilos hace el resto.

   Asi las etiquetas nunca mienten: salen del propio <th>, de modo que si una
   pantalla cambia sus columnas, las fichas cambian con ella.

   No altera el contenido ni el orden de las celdas, no annade ni quita filas,
   y no toca ningun manejador. Solo escribe un atributo de presentacion.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__laTablasFichas) return;
  window.__laTablasFichas = true;

  var MARCA = "la-tabla-fichas";
  var ATRIBUTO = "data-etiqueta";
  var INTERVALO_MS = 500;

  function textoCabecera(th) {
    var t = (th.textContent || "").replace(/\s+/g, " ").trim();
    /* Una cabecera vacia es la columna de acciones: no lleva etiqueta. */
    return t.length > 40 ? t.slice(0, 40) : t;
  }

  function etiquetar(tabla) {
    var cabeceras = tabla.querySelectorAll(":scope > thead > tr > th");
    if (!cabeceras.length) return false;
    var titulos = [];
    for (var i = 0; i < cabeceras.length; i++) titulos.push(textoCabecera(cabeceras[i]));

    var filas = tabla.querySelectorAll(":scope > tbody > tr");
    for (var f = 0; f < filas.length; f++) {
      var celdas = filas[f].children;
      /* Una fila con celdas combinadas no se convierte: se deja como esta. */
      var combinada = false;
      for (var c = 0; c < celdas.length; c++) {
        if (celdas[c].colSpan > 1) { combinada = true; break; }
      }
      if (combinada) { filas[f].setAttribute("data-la-sin-ficha", "1"); continue; }
      for (var k = 0; k < celdas.length; k++) {
        var etiqueta = titulos[k] || "";
        if (celdas[k].getAttribute(ATRIBUTO) !== etiqueta) celdas[k].setAttribute(ATRIBUTO, etiqueta);
      }
    }
    tabla.classList.add(MARCA);
    return true;
  }

  /* ------------------------------------------------------------------------
     2. Nombre accesible de los campos que solo tienen marcador de posicion.
     Un `placeholder` no es un nombre: desaparece en cuanto se escribe y varios
     lectores de pantalla no lo anuncian. Medido en QA, los buscadores del
     programa dependian solo de el. Aqui se copia a `aria-label`, que si es un
     nombre, sin tocar lo que ve el usuario.

     Deliberadamente NO se inventa nombre para un campo que no tiene ni
     marcador: eso exige una etiqueta de verdad y se arregla en su pantalla.
     ---------------------------------------------------------------------- */
  function tieneNombre(campo) {
    if (campo.getAttribute("aria-label") || campo.getAttribute("aria-labelledby") || campo.title) return true;
    return !!(campo.labels && campo.labels.length);
  }

  function nombrarPorMarcador(raiz) {
    var campos = raiz.querySelectorAll("input[placeholder], textarea[placeholder]");
    for (var i = 0; i < campos.length; i++) {
      var campo = campos[i];
      if (tieneNombre(campo)) continue;
      var texto = (campo.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim();
      if (!texto) continue;
      campo.setAttribute("aria-label", texto);
      campo.setAttribute("data-la-nombre-de-marcador", "1");
    }
  }

  function pasada() {
    try {
      var raiz = document.getElementById("root");
      if (!raiz) return;
      var tablas = raiz.querySelectorAll("table");
      for (var i = 0; i < tablas.length; i++) etiquetar(tablas[i]);
      nombrarPorMarcador(raiz);
    } catch (error) {
      /* Nunca romper la pantalla por una mejora de presentacion. */
    }
  }

  var pendiente = false;
  function programar() {
    if (pendiente) return;
    pendiente = true;
    setTimeout(function () { pendiente = false; pasada(); }, 120);
  }

  function arrancar() {
    pasada();
    try {
      var raiz = document.getElementById("root");
      if (raiz && typeof MutationObserver === "function") {
        new MutationObserver(programar).observe(raiz, { childList: true, subtree: true });
      }
    } catch (error) {}
    /* Respaldo por si el observador no llega a algun remontaje. */
    setInterval(pasada, INTERVALO_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();

  window.LATablasFichas = { pasada: pasada, etiquetar: etiquetar, nombrarPorMarcador: nombrarPorMarcador };
})();
