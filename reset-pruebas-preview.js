(function () {
  "use strict";

  // Este reinicio existe SOLO para los Deploy Preview de L&A Suite.
  // Producción y cualquier otro dominio quedan fuera por diseño.
  var HOST_PREVIEW = /^deploy-preview-\d+--chic-entremet-9107cf\.netlify\.app$/i;
  if (typeof window === "undefined" || !HOST_PREVIEW.test(window.location.hostname)) return;

  // Mientras se prueba desde el Preview, la aplicación debe permanecer
  // completamente aislada de Supabase: ni lee datos reales ni sube datos de prueba.
  window.__modoPruebasLocal = true;

  // Marcador de una sola ejecución por navegador/origen. Para repetir el reset
  // en otra campaña de pruebas bastará con versionar este nombre.
  var MARCADOR = "la_suite_reset_pruebas_multilocal_v1";
  if (localStorage.getItem(MARCADOR) === "1") return;

  // Conservamos únicamente estructura, contexto y preferencias de interfaz.
  // Todo lo operativo se reconstruirá desde cero durante las pruebas.
  var CONSERVAR = {
    empresas: true,
    locales: true,
    localActivoId: true,
    configEmpresa: true,
    disenoMenu: true,
    temaOscuro: true,
    pinPropietario: true
  };

  // Copiamos primero las claves para poder borrarlas sin alterar el recorrido.
  var claves = [];
  for (var i = 0; i < localStorage.length; i++) claves.push(localStorage.key(i));

  claves.forEach(function (clave) {
    if (!clave) return;

    if (clave.indexOf("almacen:") === 0) {
      var simple = clave.slice(8);
      if (!CONSERVAR[simple]) localStorage.removeItem(clave);
      return;
    }

    // Nunca arrastrar a una futura sincronización los IDs que pertenecían
    // a datos antiguos del dispositivo.
    if (clave.indexOf("almacen__borrados:") === 0) {
      localStorage.removeItem(clave);
    }
  });

  // La cola anterior podría subir registros antiguos cuando vuelva la nube.
  localStorage.removeItem("almacen__pendientes");
  localStorage.removeItem("almacen__caducidades_avisadas");

  localStorage.setItem(MARCADOR, "1");
  window.__resetPruebasEjecutado = true;
})();
