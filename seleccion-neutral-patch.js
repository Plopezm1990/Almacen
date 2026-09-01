// Compatibilidad temporal de seguridad para la rama de pruebas.
//
// PROTECCIÓN DE SUSCRIPCIONES PUSH
// - Si el navegador crea una suscripción nueva y el alta en Supabase falla,
//   se deshace esa suscripción local para no dejar un estado "activado" falso.
// - Al desactivar, solo se permite unsubscribe() cuando se ha comprobado que
//   el endpoint ya no existe en suscripciones_push.
//
// Este bloque no crea, borra ni modifica suscripciones por sí solo: únicamente
// protege los flujos que inicia el usuario desde la interfaz.
(function () {
  "use strict";

  if (window.__pushSubscriptionSafetyPatched) return;
  window.__pushSubscriptionSafetyPatched = true;

  if (!window.fetch || !window.PushManager || !window.PushSubscription) return;

  var subscribeOriginal = window.PushManager.prototype.subscribe;
  var unsubscribeOriginal = window.PushSubscription.prototype.unsubscribe;
  if (typeof subscribeOriginal !== "function" || typeof unsubscribeOriginal !== "function") return;

  var fetchOriginal = window.fetch.bind(window);
  var pendiente = null;
  var temporizadorPendiente = null;
  var rollbackEnCurso = false;

  function limpiarPendiente() {
    if (temporizadorPendiente) {
      clearTimeout(temporizadorPendiente);
      temporizadorPendiente = null;
    }
    pendiente = null;
  }

  async function deshacerPendiente() {
    var sub = pendiente;
    limpiarPendiente();
    if (!sub) return;
    rollbackEnCurso = true;
    try {
      await unsubscribeOriginal.call(sub);
    } catch (_) {
      // El alta ya ha fallado; si el navegador también falla al deshacerla,
      // no se oculta el error original de Supabase.
    } finally {
      rollbackEnCurso = false;
    }
  }

  window.PushManager.prototype.subscribe = async function () {
    var sub = await subscribeOriginal.apply(this, arguments);
    pendiente = sub;

    if (temporizadorPendiente) clearTimeout(temporizadorPendiente);
    temporizadorPendiente = setTimeout(function () {
      // Si después de crear la suscripción no llegó a completarse ningún alta
      // en Supabase (por caída de red, sesión, etc.), se limpia el navegador.
      deshacerPendiente().catch(function () {});
    }, 45000);

    return sub;
  };

  function esPeticionSuscripciones(input) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    return url.indexOf("/rest/v1/suscripciones_push") !== -1;
  }

  function metodoPeticion(input, init) {
    return String(
      (init && init.method) ||
      (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET") ||
      "GET"
    ).toUpperCase();
  }

  window.fetch = async function (input, init) {
    var esAlta = pendiente && esPeticionSuscripciones(input) && metodoPeticion(input, init) === "POST";
    if (!esAlta) return fetchOriginal(input, init);

    try {
      var respuesta = await fetchOriginal(input, init);
      if (respuesta && respuesta.ok) {
        limpiarPendiente();
      } else {
        await deshacerPendiente();
      }
      return respuesta;
    } catch (e) {
      await deshacerPendiente();
      throw e;
    }
  };

  window.PushSubscription.prototype.unsubscribe = async function () {
    if (rollbackEnCurso) return unsubscribeOriginal.apply(this, arguments);

    var endpoint = this && this.endpoint ? this.endpoint : "";
    if (!endpoint) throw new Error("No se pudo identificar esta suscripción push.");

    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("No se pudo comprobar la nube. La suscripción no se ha desactivado en este navegador.");
    }

    var supabase = await window.getSupabaseClient();
    var comprobacion = await supabase
      .from("suscripciones_push")
      .select("endpoint")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (comprobacion.error) {
      throw new Error("No se pudo comprobar el borrado en la nube. La suscripción sigue activa en este navegador.");
    }
    if (comprobacion.data) {
      throw new Error("No se pudo eliminar la suscripción de la nube. La suscripción sigue activa en este navegador.");
    }

    return unsubscribeOriginal.apply(this, arguments);
  };
})();

// Compatibilidad temporal de interfaz para la rama de seguridad.
//
// Objetivo: mientras el bundle principal todavía usa el formato antiguo de
// selección, ocultar puntuaciones/recomendaciones automáticas y preparar la
// pantalla para los nuevos resúmenes neutrales. No guarda ni modifica datos.
(function () {
  "use strict";

  var prefiltrosCache = [];
  var fetchAnterior = window.fetch.bind(window);

  function guardarPrefiltros(datos) {
    var filas = Array.isArray(datos) ? datos : (datos && typeof datos === "object" ? [datos] : []);
    filas.forEach(function (fila) {
      if (!fila || !fila.candidato_nombre) return;
      var clave = fila.token || fila.id || (fila.candidato_nombre + "|" + (fila.creado_en || ""));
      var i = prefiltrosCache.findIndex(function (x) {
        var k = x.token || x.id || (x.candidato_nombre + "|" + (x.creado_en || ""));
        return k === clave;
      });
      if (i >= 0) prefiltrosCache[i] = fila;
      else prefiltrosCache.push(fila);
    });
  }

  // Solo observa las lecturas de prefiltros para poder mostrar los campos
  // neutrales nuevos. La respuesta original se devuelve intacta a React.
  window.fetch = async function (input, init) {
    var respuesta = await fetchAnterior(input, init);
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (url.indexOf("/rest/v1/prefiltros_candidatos") !== -1 && respuesta && respuesta.ok) {
        respuesta.clone().json().then(guardarPrefiltros).catch(function () {});
      }
    } catch (_) {}
    return respuesta;
  };

  function hojas(root) {
    return Array.prototype.slice.call((root || document).querySelectorAll("div,span,b,summary"))
      .filter(function (el) { return el.children.length === 0; });
  }

  function exactos(root, texto) {
    return hojas(root).filter(function (el) { return (el.textContent || "").trim() === texto; });
  }

  function empiezan(root, texto) {
    return hojas(root).filter(function (el) { return (el.textContent || "").trim().indexOf(texto) === 0; });
  }

  function ocultar(el) {
    if (el) el.style.setProperty("display", "none", "important");
  }

  function cardDesdeTitulo(el) {
    return el ? el.parentElement : null;
  }

  function cardSimple(titulo, contenido, esLista) {
    var card = document.createElement("div");
    card.setAttribute("data-neutral-patch", "1");
    card.className = "mb-4 rounded-xl p-3";
    card.style.border = "1px solid #DED7C5";
    card.style.background = "rgba(255,255,255,0.55)";

    var h = document.createElement("div");
    h.className = "text-[12px] font-semibold mb-2";
    h.textContent = titulo;
    card.appendChild(h);

    if (esLista) {
      var lista = Array.isArray(contenido) ? contenido.filter(Boolean) : [];
      if (lista.length === 0) {
        var vacio = document.createElement("div");
        vacio.className = "text-[12px]";
        vacio.textContent = "Nada señalado.";
        card.appendChild(vacio);
      } else {
        var ul = document.createElement("ul");
        ul.className = "text-[12px] space-y-1 list-disc pl-4";
        lista.forEach(function (item) {
          var li = document.createElement("li");
          li.textContent = String(item);
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }
    } else {
      var body = document.createElement("div");
      body.className = "text-[12px]";
      body.textContent = contenido || "—";
      card.appendChild(body);
    }
    return card;
  }

  function leerEntrevistasLocales() {
    try {
      var raw = localStorage.getItem("almacen:entrevistas");
      var datos = JSON.parse(raw || "[]");
      return Array.isArray(datos) ? datos : [];
    } catch (_) {
      return [];
    }
  }

  function parchearInformeEntrevista(root) {
    var resumenTrans = exactos(root, "Ver transcripción completa de la entrevista")[0];
    if (!resumenTrans) return;

    var details = resumenTrans.parentElement;
    var contenedor = details && details.parentElement;
    if (!contenedor) return;

    Array.prototype.slice.call(contenedor.querySelectorAll('[data-neutral-interview="1"]')).forEach(function (x) { x.remove(); });

    [
      "Recomendación final",
      "Fortalezas",
      "Aspectos a mejorar",
      "Señales de riesgo",
      "Perfil profesional",
      "Competencias generales",
      "Por qué esta confianza"
    ].forEach(function (t) {
      exactos(contenedor, t).forEach(function (el) { ocultar(cardDesdeTitulo(el)); });
    });

    exactos(contenedor, "Puesto principal:").forEach(function (el) {
      ocultar(el.parentElement && el.parentElement.parentElement);
    });
    empiezan(contenedor, "Se recomienda prueba práctica para:").forEach(function (el) {
      ocultar(cardDesdeTitulo(el));
    });

    var confianza = empiezan(contenedor, "Confianza ")[0];
    if (confianza) {
      var card = confianza.parentElement;
      var grid = card && card.parentElement;
      if (grid && (grid.className || "").toString().indexOf("grid-cols-3") !== -1) ocultar(grid);
    }

    var header = hojas(contenedor).find(function (el) {
      var cls = (el.className || "").toString();
      return cls.indexOf("text-[15px]") !== -1 && cls.indexOf("font-semibold") !== -1 && (el.textContent || "").indexOf(" · ") !== -1;
    });
    var cabecera = header ? (header.textContent || "").trim() : "";
    var partes = cabecera.split(" · ");
    var nombre = partes[0] || "";
    var fecha = partes.slice(1).join(" · ");
    var entrevistas = leerEntrevistasLocales();
    var entrevista = entrevistas.find(function (e) {
      return e && e.candidatoNombre === nombre && (!fecha || e.fecha === fecha);
    }) || entrevistas.find(function (e) { return e && e.candidatoNombre === nombre && e.estado === "completada"; });
    var inf = entrevista && entrevista.informe ? entrevista.informe : {};

    var nodos = [];
    var tieneNeutral = !!(inf.resumen || inf.experiencia || inf.disponibilidad ||
      (Array.isArray(inf.evidencias_aportadas) && inf.evidencias_aportadas.length) ||
      (Array.isArray(inf.situaciones_tratadas) && inf.situaciones_tratadas.length) ||
      (Array.isArray(inf.cuestiones_a_aclarar) && inf.cuestiones_a_aclarar.length));

    if (tieneNeutral) {
      if (inf.resumen) nodos.push(cardSimple("Resumen de la entrevista", inf.resumen, false));
      if (inf.experiencia) nodos.push(cardSimple("Experiencia aportada", inf.experiencia, false));
      if (inf.disponibilidad) nodos.push(cardSimple("Disponibilidad y condiciones prácticas", inf.disponibilidad, false));
      if (Array.isArray(inf.evidencias_aportadas)) nodos.push(cardSimple("Ejemplos y evidencias aportadas", inf.evidencias_aportadas, true));
      if (Array.isArray(inf.situaciones_tratadas)) nodos.push(cardSimple("Situaciones tratadas", inf.situaciones_tratadas, true));
      if (Array.isArray(inf.cuestiones_a_aclarar)) nodos.push(cardSimple("Cuestiones a aclarar o comprobar", inf.cuestiones_a_aclarar, true));
    } else {
      nodos.push(cardSimple(
        "Informe anterior",
        "Este registro se generó con el formato antiguo. Por seguridad, las puntuaciones y recomendaciones automáticas están ocultas. Revisa la transcripción completa para tomar cualquier decisión de forma humana.",
        false
      ));
    }

    nodos.forEach(function (nodo) {
      nodo.setAttribute("data-neutral-interview", "1");
      contenedor.insertBefore(nodo, details);
    });
  }

  function buscarPrefiltro(nombre) {
    for (var i = prefiltrosCache.length - 1; i >= 0; i--) {
      var p = prefiltrosCache[i];
      if (p && p.candidato_nombre === nombre && p.estado === "completado") return p;
    }
    for (var j = prefiltrosCache.length - 1; j >= 0; j--) {
      var q = prefiltrosCache[j];
      if (q && q.candidato_nombre === nombre) return q;
    }
    return null;
  }

  function parchearModalPrefiltro(root) {
    var respuestasTitulo = exactos(root, "Respuestas completas")[0];
    if (!respuestasTitulo) return;
    var respuestasCard = respuestasTitulo.parentElement;
    if (!respuestasCard) return;

    var cursor = respuestasCard.parentElement;
    var modal = null;
    var tituloModal = null;
    while (cursor && cursor !== document.body) {
      tituloModal = hojas(cursor).find(function (el) {
        return (el.textContent || "").trim().indexOf("Prefiltro · ") === 0;
      });
      if (tituloModal) { modal = cursor; break; }
      cursor = cursor.parentElement;
    }
    if (!modal || !tituloModal) return;

    exactos(modal, "Puntuación orientativa (sin verificar en persona)").forEach(function (el) { ocultar(cardDesdeTitulo(el)); });
    exactos(modal, "Avisos").forEach(function (el) { ocultar(cardDesdeTitulo(el)); });
    exactos(modal, "Recomendación").forEach(function (el) { ocultar(cardDesdeTitulo(el)); });

    Array.prototype.slice.call(modal.querySelectorAll('[data-neutral-prefiltro="1"]')).forEach(function (x) { x.remove(); });

    var nombre = (tituloModal.textContent || "").trim().slice("Prefiltro · ".length);
    var fila = buscarPrefiltro(nombre);
    var resumen = fila && fila.resumen ? fila.resumen : null;
    if (!resumen) return;

    var esFormatoAntiguo = Object.prototype.hasOwnProperty.call(resumen, "puntuacion_orientativa") ||
      Object.prototype.hasOwnProperty.call(resumen, "recomendacion") ||
      Object.prototype.hasOwnProperty.call(resumen, "avisos");

    var nuevos = [];

    if (esFormatoAntiguo) {
      ["Resumen", "Experiencia", "Disponibilidad", "Motivación"].forEach(function (titulo) {
        exactos(modal, titulo).forEach(function (el) { ocultar(cardDesdeTitulo(el)); });
      });
      nuevos.push(cardSimple(
        "Análisis anterior",
        "Este análisis se generó con el formato anterior. Por seguridad, el resumen, las puntuaciones y las recomendaciones automáticas están ocultos. Revisa las respuestas completas para realizar la valoración de forma humana.",
        false
      ));
    } else {
      if (Array.isArray(resumen.evidencias_aportadas)) {
        nuevos.push(cardSimple("Evidencias aportadas", resumen.evidencias_aportadas, true));
      }
      if (Array.isArray(resumen.cuestiones_a_aclarar)) {
        nuevos.push(cardSimple("Cuestiones a aclarar", resumen.cuestiones_a_aclarar, true));
      }
    }

    nuevos.forEach(function (nodo) {
      nodo.setAttribute("data-neutral-prefiltro", "1");
      respuestasCard.parentElement.insertBefore(nodo, respuestasCard);
    });
  }

  function parchearTextos(root) {
    hojas(root).forEach(function (el) {
      var t = (el.textContent || "").trim();

      if (t.indexOf(" · Recomendado:") !== -1) {
        el.textContent = t.replace(/ · Recomendado:.*$/, " · Entrevista completada");
        return;
      }
      if (/^·\s*\d+(?:[.,]\d+)?\/100$/.test(t) || t === "· con avisos") {
        ocultar(el);
        return;
      }
      if (t.indexOf("entrevista termina con avisos o puntuación baja") !== -1) {
        el.textContent = "Recibe avisos importantes del sistema, como stock bajo, caducidades, descuadres de caja y otros eventos que requieren tu atención.";
        return;
      }
      if (t === "Manda un enlace corto antes de citar al candidato — responde unas preguntas cortas por su cuenta, desde su móvil, sin necesitar la app. No sustituye a la entrevista de verdad: es solo para descartar rápido a quien claramente no encaja, antes de invertir tiempo en persona.") {
        el.textContent = "Manda un enlace corto antes de la entrevista. El candidato responde unas preguntas por su cuenta y la IA organiza la información para que una persona la revise después. No puntúa, no recomienda y no sustituye la entrevista.";
        return;
      }
      if (t === "Entrevista al candidato en persona o por teléfono, y ve escribiendo aquí sus respuestas — la IA decide la siguiente pregunta y, al final, genera un informe puntuado para Camarero/a, Cajero/a y Churrero/a. La evaluación nunca tiene en cuenta nacionalidad, sexo, edad ni ninguna característica ajena al desempeño.") {
        el.textContent = "Entrevista al candidato en persona o por teléfono y registra sus respuestas. La IA puede proponer la siguiente pregunta y, al final, organizar la información aportada para revisión humana. No debe puntuar, clasificar ni decidir una contratación.";
      }
    });
  }

  var pendiente = false;
  function aplicar() {
    pendiente = false;
    var root = document.getElementById("root");
    if (!root) return;
    parchearTextos(root);
    parchearInformeEntrevista(root);
    parchearModalPrefiltro(root);
  }

  function programar() {
    if (pendiente) return;
    pendiente = true;
    setTimeout(aplicar, 30);
  }

  function iniciar() {
    var root = document.getElementById("root");
    if (!root) return;
    new MutationObserver(programar).observe(root, { childList: true, subtree: true, characterData: true });
    programar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();