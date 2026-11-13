/* ==========================================================================
   L&A Suite - Editor de apariencia de la empresa (org-37)
   --------------------------------------------------------------------------
   Pantalla de Organizacion -> Apariencia de la empresa. Permite elegir uno de
   los nueve disennos registrados, una de las seis paletas de biblioteca o una
   paleta propia de seis colores, probarla sin guardar, aplicarla a la empresa
   y restaurar la configuracion anterior.

   No toca datos de negocio. Lee y escribe solo la clave "apariencia" a traves
   del motor la-apariencia.js, que ya la segrega por empresa.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__laAparienciaEditor) return;
  window.__laAparienciaEditor = true;

  function motor() { return window.LAApariencia; }

  var dialogo = null;
  var ultimoFoco = null;
  var borrador = null;      /* { diseno, paleta, colores } */
  var revisionLeida = null;
  var vistaPrevia = "escritorio";

  /* ------------------------------------------------------------- estilos */

  var CSS = [
    ".la-ed-fondo{position:fixed;inset:0;z-index:10070;background:rgba(8,14,11,.62);display:flex;align-items:center;justify-content:center;padding:16px}",
    ".la-ed{background:var(--c-surface);color:var(--c-ink);border:1px solid var(--c-divider);border-radius:16px;width:min(1100px,100%);max-height:min(92vh,900px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:var(--la-font)}",
    ".la-ed header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--c-divider)}",
    ".la-ed header h2{margin:0;font-size:17px;font-weight:700;flex:1}",
    ".la-ed .la-ed-cuerpo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;overflow:auto;flex:1}",
    ".la-ed .la-ed-col{padding:16px 18px;min-width:0}",
    ".la-ed .la-ed-col+.la-ed-col{border-left:1px solid var(--c-divider)}",
    ".la-ed h3{font-size:13px;font-weight:700;margin:0 0 8px;letter-spacing:.01em}",
    ".la-ed .la-ed-bloque{margin-bottom:18px}",
    ".la-ed-rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}",
    ".la-ed-opcion{min-height:44px;text-align:left;padding:9px 11px;border-radius:10px;border:1px solid var(--c-border-control);background:var(--c-bg);color:var(--c-ink);cursor:pointer;font:600 12.5px/1.25 var(--la-font)}",
    ".la-ed-opcion small{display:block;font-weight:400;font-size:11px;color:var(--c-ink-soft);margin-top:2px}",
    ".la-ed-opcion[aria-pressed='true']{border:2px solid var(--c-accent-fill);background:var(--c-accent-soft)}",
    ".la-ed-campos{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}",
    ".la-ed-campo{display:flex;align-items:center;gap:8px}",
    ".la-ed-campo label{flex:0 0 72px;font-size:12px;color:var(--c-ink-soft)}",
    ".la-ed-campo input[type='color']{width:44px;height:44px;padding:0;border:1px solid var(--c-border-control);border-radius:8px;background:none;cursor:pointer}",
    ".la-ed-campo input[type='text']{flex:1;min-width:0;min-height:44px;border:1px solid var(--c-border-control);border-radius:8px;background:var(--c-bg);color:var(--c-ink);padding:0 10px;font:600 13px/1 ui-monospace,monospace;text-transform:uppercase}",
    ".la-ed textarea{width:100%;min-height:72px;border:1px solid var(--c-border-control);border-radius:8px;background:var(--c-bg);color:var(--c-ink);padding:8px 10px;font:13px/1.4 ui-monospace,monospace}",
    ".la-ed input[type='text'].la-ed-nombre{width:100%;min-height:44px;border:1px solid var(--c-border-control);border-radius:8px;background:var(--c-bg);color:var(--c-ink);padding:0 10px;font:13px/1 var(--la-font);text-transform:none}",
    ".la-ed-btn{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--c-border-control);background:var(--c-bg);color:var(--c-ink);font:600 13px/1 var(--la-font);cursor:pointer}",
    ".la-ed-btn.primario{background:var(--c-accent-fill);color:var(--c-on-accent);border-color:var(--c-accent-fill)}",
    ".la-ed-btn[disabled]{opacity:.55;cursor:not-allowed}",
    ".la-ed footer{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid var(--c-divider);background:var(--c-bg)}",
    ".la-ed footer .la-ed-espacio{flex:1}",
    ".la-ed-mensaje{font-size:12.5px;padding:8px 10px;border-radius:8px;margin-bottom:10px}",
    ".la-ed-mensaje.aviso{background:var(--c-amber-soft);color:var(--c-amber);border:1px solid var(--c-amber)}",
    ".la-ed-mensaje.error{background:var(--c-red-soft);color:var(--c-red);border:1px solid var(--c-red)}",
    ".la-ed-mensaje.ok{background:var(--c-accent-soft);color:var(--c-ink);border:1px solid var(--c-accent-fill)}",
    ".la-ed-previa{border:1px solid var(--c-divider);border-radius:12px;overflow:hidden}",
    ".la-ed-previa .marco{padding:12px;display:flex;flex-direction:column;gap:10px}",
    ".la-ed-previa .marco.movil{max-width:320px;margin:0 auto}",
    ".la-ed-previa .barra{border-radius:8px;padding:10px 12px;font:700 13px/1.2 var(--la-font)}",
    ".la-ed-previa .tarjeta{border-radius:10px;padding:12px;border-width:1px;border-style:solid}",
    ".la-ed-previa .tarjeta b{display:block;font-size:13px;margin-bottom:4px}",
    ".la-ed-previa .tarjeta span{font-size:12px}",
    ".la-ed-previa .enlace{font-size:12.5px;text-decoration:underline}",
    ".la-ed-previa .boton{display:inline-block;border-radius:9px;padding:11px 14px;font:700 13px/1 var(--la-font)}",
    ".la-ed-conmutador{display:inline-flex;border:1px solid var(--c-border-control);border-radius:10px;overflow:hidden}",
    ".la-ed-conmutador button{min-height:44px;padding:0 14px;border:0;background:var(--c-bg);color:var(--c-ink);font:600 12.5px/1 var(--la-font);cursor:pointer}",
    ".la-ed-conmutador button[aria-pressed='true']{background:var(--c-accent-fill);color:var(--c-on-accent)}",
    ".la-ed :focus-visible{outline:3px solid var(--c-focus-ring);outline-offset:2px}",
    ".la-ed-lanzador{position:fixed;right:14px;bottom:max(14px,env(safe-area-inset-bottom));z-index:10040;min-height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--c-accent-fill);background:var(--c-surface);color:var(--c-ink);font:600 12.5px/1 var(--la-font);cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.18)}",
    "@media(max-width:860px){.la-ed .la-ed-cuerpo{grid-template-columns:minmax(0,1fr)}.la-ed .la-ed-col+.la-ed-col{border-left:0;border-top:1px solid var(--c-divider)}}",
    "@media(prefers-reduced-motion:reduce){.la-ed,.la-ed-fondo{transition:none!important;animation:none!important}}"
  ].join("\n");

  function inyectarEstilos() {
    if (document.getElementById("la-ed-estilos")) return;
    var tag = document.createElement("style");
    tag.id = "la-ed-estilos";
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  /* ------------------------------------------------------------ utilidades */

  function el(etiqueta, props, hijos) {
    var nodo = document.createElement(etiqueta);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "texto") nodo.textContent = props[k];
      else if (k === "html") nodo.innerHTML = props[k];
      else if (k.indexOf("on") === 0) nodo.addEventListener(k.slice(2), props[k]);
      else if (props[k] != null) nodo.setAttribute(k, props[k]);
    });
    (hijos || []).forEach(function (h) { if (h) nodo.appendChild(h); });
    return nodo;
  }

  function coloresDelBorrador() {
    var m = motor();
    if (borrador.colores) return borrador.colores;
    if (borrador.paleta) {
      var p = m.coloresDePaleta(borrador.paleta);
      if (p) return p;
    }
    return m.coloresDe({ diseno: borrador.diseno });
  }

  /* ------------------------------------------------------------- secciones */

  function bloqueDisenos() {
    var m = motor();
    var rejilla = el("div", { class: "la-ed-rejilla" }, m.DISENOS.map(function (d) {
      return el("button", {
        type: "button", class: "la-ed-opcion",
        "aria-pressed": String(borrador.diseno === d.id),
        onclick: function () { borrador.diseno = d.id; repintar(); }
      }, [el("span", { texto: d.nombre }), el("small", { texto: d.resumen })]);
    }));
    return el("section", { class: "la-ed-bloque" }, [
      el("h3", { texto: "Disenno base" }), rejilla
    ]);
  }

  function bloquePaletas() {
    var m = motor();
    var opciones = [el("button", {
      type: "button", class: "la-ed-opcion",
      "aria-pressed": String(!borrador.paleta && !borrador.colores),
      onclick: function () { borrador.paleta = null; borrador.colores = null; repintar(); }
    }, [el("span", { texto: "Colores originales" }), el("small", { texto: "Los del disenno elegido" })])];

    m.PALETAS.forEach(function (p) {
      opciones.push(el("button", {
        type: "button", class: "la-ed-opcion",
        "aria-pressed": String(borrador.paleta === p.id && !borrador.colores),
        onclick: function () { borrador.paleta = p.id; borrador.colores = null; repintar(); }
      }, [el("span", { texto: p.nombre })]));
    });

    m.leerBiblioteca().forEach(function (p) {
      opciones.push(el("button", {
        type: "button", class: "la-ed-opcion",
        "aria-pressed": "false",
        onclick: function () {
          borrador.paleta = null;
          borrador.colores = { fondo: p.fondo, tarjetas: p.tarjetas, texto: p.texto, enlaces: p.enlaces, boton: p.boton, detalle: p.detalle };
          repintar();
        }
      }, [el("span", { texto: p.nombre }), el("small", { texto: "Paleta guardada" })]));
    });

    return el("section", { class: "la-ed-bloque" }, [
      el("h3", { texto: "Paleta" }),
      el("div", { class: "la-ed-rejilla" }, opciones)
    ]);
  }

  function bloqueCampos() {
    var m = motor();
    var colores = coloresDelBorrador();
    var campos = m.CAMPOS.map(function (campo) {
      var valor = colores[campo.id];
      var texto = el("input", { type: "text", value: valor, id: "la-ed-" + campo.id, maxlength: "7", spellcheck: "false" });
      var color = el("input", { type: "color", value: valor, "aria-label": campo.etiqueta + " (selector visual)" });
      function cambiar(nuevo) {
        var hex = m.normalizarHex(nuevo);
        if (!hex) return;
        var base = Object.assign({}, coloresDelBorrador());
        base[campo.id] = hex;
        borrador.colores = base;
        borrador.paleta = null;
        repintar();
      }
      color.addEventListener("input", function () { cambiar(color.value); });
      texto.addEventListener("change", function () {
        if (!m.normalizarHex(texto.value)) { texto.setAttribute("aria-invalid", "true"); mostrarMensaje("error", "El codigo " + texto.value + " no es un HEX valido. Usa seis digitos, por ejemplo #14432F."); return; }
        texto.removeAttribute("aria-invalid");
        cambiar(texto.value);
      });
      return el("div", { class: "la-ed-campo" }, [
        el("label", { for: "la-ed-" + campo.id, texto: campo.etiqueta }), color, texto
      ]);
    });
    return el("section", { class: "la-ed-bloque" }, [
      el("h3", { texto: "Colores" }),
      el("div", { class: "la-ed-campos" }, campos)
    ]);
  }

  function bloqueImportar() {
    var m = motor();
    var area = el("textarea", {
      "aria-label": "Codigos HEX para importar",
      placeholder: "Pega cinco o seis codigos HEX separados por espacios o saltos de linea."
    });
    var nombre = el("input", { type: "text", class: "la-ed-nombre", placeholder: "Nombre de la paleta", "aria-label": "Nombre de la paleta" });
    var importar = el("button", {
      type: "button", class: "la-ed-btn", texto: "Importar codigos",
      onclick: function () {
        var r = m.importarHex(area.value, coloresDelBorrador());
        if (!r.ok) {
          mostrarMensaje("error", "Hacen falta cinco o seis codigos HEX validos. Se han encontrado " + r.encontrados + ".");
          return;
        }
        borrador.colores = r.colores;
        borrador.paleta = null;
        repintar();
        mostrarMensaje("ok", r.conservadoSexto
          ? "Importados cinco codigos. Se conserva el valor actual de Detalle."
          : "Importados seis codigos.");
      }
    });
    var guardar = el("button", {
      type: "button", class: "la-ed-btn", texto: "Guardar paleta",
      onclick: function () {
        var r = m.guardarEnBiblioteca(nombre.value.trim(), coloresDelBorrador());
        if (!r.ok) { mostrarMensaje("error", "No se ha podido guardar la paleta. Revisa el nombre y los colores."); return; }
        repintar();
        mostrarMensaje("ok", r.reemplazada
          ? "Se ha actualizado la paleta \"" + nombre.value.trim() + "\" de tu biblioteca."
          : "Paleta \"" + nombre.value.trim() + "\" guardada en tu biblioteca.");
      }
    });
    return el("section", { class: "la-ed-bloque" }, [
      el("h3", { texto: "Importar o guardar paleta" }),
      area,
      el("div", { style: "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap" }, [nombre]),
      el("div", { style: "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap" }, [importar, guardar])
    ]);
  }

  function bloqueVistaPrevia() {
    var m = motor();
    var c = m.resolverColores(coloresDelBorrador());
    var tinta = c.tintaBoton;
    var marco = el("div", { class: "marco" + (vistaPrevia === "movil" ? " movil" : ""), style: "background:" + c.fondo }, [
      el("div", { class: "barra", style: "background:" + c.boton + ";color:" + tinta, texto: "L&A Suite - Panel" }),
      el("div", { class: "tarjeta", style: "background:" + c.tarjetas + ";border-color:" + c.borde + ";color:" + c.texto }, [
        el("b", { texto: "Ventas de hoy" }),
        el("span", { texto: "1.248,40 EUR - 86 tickets" })
      ]),
      el("div", { class: "tarjeta", style: "background:" + c.tarjetas + ";border-color:" + c.borde + ";color:" + c.texto }, [
        el("b", { texto: "Mesas abiertas" }),
        el("span", { texto: "4 de 12" })
      ]),
      el("a", { class: "enlace", href: "#", style: "color:" + c.enlaces, texto: "Ver el detalle del turno", onclick: function (e) { e.preventDefault(); } }),
      el("span", { class: "boton", style: "background:" + c.boton + ";color:" + tinta, texto: "Cobrar" })
    ]);

    var conmutador = el("div", { class: "la-ed-conmutador", role: "group", "aria-label": "Tamanno de la vista previa" }, [
      el("button", { type: "button", "aria-pressed": String(vistaPrevia === "escritorio"), texto: "Escritorio", onclick: function () { vistaPrevia = "escritorio"; repintar(); } }),
      el("button", { type: "button", "aria-pressed": String(vistaPrevia === "movil"), texto: "Movil", onclick: function () { vistaPrevia = "movil"; repintar(); } })
    ]);

    var avisos = m.revisarContraste(c);
    var listaAvisos = avisos.length
      ? el("div", { class: "la-ed-mensaje aviso", role: "status" }, [
          el("b", { texto: "Contraste insuficiente en " + avisos.length + " combinacion(es):" }),
          el("ul", { style: "margin:6px 0 0 18px;padding:0" }, avisos.map(function (a) { return el("li", { texto: a.mensaje }); }))
        ])
      : el("div", { class: "la-ed-mensaje ok", role: "status", texto: "Todas las combinaciones comprobadas alcanzan el contraste minimo." });

    var ajustados = [];
    if (c.ajustes.enlaces) ajustados.push("Enlaces (" + c.enlaces + ")");
    if (c.ajustes.borde) ajustados.push("borde funcional derivado de Detalle (" + c.borde + ")");
    var notaAjustes = ajustados.length
      ? el("div", { class: "la-ed-mensaje aviso", role: "status", texto:
          "Para alcanzar el contraste minimo se ha aclarado u oscurecido: " + ajustados.join(" y ") +
          ". El color que elegiste se conserva como separador y en la configuracion guardada." })
      : null;

    return el("section", { class: "la-ed-bloque" }, [
      el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" }, [
        el("h3", { texto: "Vista previa", style: "margin:0;flex:1" }), conmutador
      ]),
      el("div", { class: "la-ed-previa" }, [marco]),
      el("div", { style: "height:10px" }),
      listaAvisos,
      notaAjustes
    ]);
  }

  /* ------------------------------------------------------------- mensajes */

  var zonaMensaje = null;
  function mostrarMensaje(tipo, texto) {
    if (!zonaMensaje) return;
    zonaMensaje.innerHTML = "";
    zonaMensaje.appendChild(el("div", { class: "la-ed-mensaje " + tipo, role: "status", texto: texto }));
  }

  /* ---------------------------------------------------------------- pintar */

  var contenedorIzq = null, contenedorDer = null;

  function repintar() {
    if (!contenedorIzq) return;
    contenedorIzq.innerHTML = "";
    contenedorIzq.appendChild(bloqueDisenos());
    contenedorIzq.appendChild(bloquePaletas());
    contenedorIzq.appendChild(bloqueCampos());
    contenedorIzq.appendChild(bloqueImportar());
    contenedorDer.innerHTML = "";
    contenedorDer.appendChild(bloqueVistaPrevia());
  }

  /* ---------------------------------------------------------------- abrir */

  async function abrir() {
    var m = motor();
    if (!m) return;
    inyectarEstilos();
    if (dialogo) return;
    ultimoFoco = document.activeElement;

    var actual = await m.leerEmpresa();
    var enPrueba = m.enPrueba() ? m.estado().config : null;
    var base = enPrueba || actual;
    revisionLeida = actual ? actual.revision : null;
    borrador = base
      ? { diseno: base.diseno, paleta: base.paleta, colores: base.colores }
      : { diseno: "oliva", paleta: null, colores: null };

    contenedorIzq = el("div", { class: "la-ed-col" });
    contenedorDer = el("div", { class: "la-ed-col" });
    zonaMensaje = el("div");

    var cerrar = el("button", { type: "button", class: "la-ed-btn", texto: "Cerrar", onclick: cerrarDialogo });

    var probar = el("button", {
      type: "button", class: "la-ed-btn", texto: "Probar en la suite",
      onclick: function () {
        if (!m.iniciarPrueba(borrador)) { mostrarMensaje("error", "La configuracion no es valida: revisa el disenno y los colores."); return; }
        cerrarDialogo();
      }
    });

    var aplicar = el("button", {
      type: "button", class: "la-ed-btn primario", texto: "Aplicar a la empresa",
      onclick: async function () {
        aplicar.disabled = true;
        var r = await m.guardarEmpresa(borrador, revisionLeida);
        aplicar.disabled = false;
        if (r.ok) {
          revisionLeida = r.config.revision;
          mostrarMensaje("ok", "Apariencia aplicada a la empresa. Revision " + r.config.revision + ".");
          return;
        }
        if (r.motivo === "revision-obsoleta") {
          mostrarMensaje("aviso", "Otra persona ha publicado la revision " + r.actual.revision +
            " mientras editabas. Vuelve a cargar y aplica de nuevo tus cambios.");
          revisionLeida = r.actual.revision;
          return;
        }
        if (r.motivo === "configuracion-invalida") {
          mostrarMensaje("error", "La configuracion no es valida: revisa el disenno y los seis colores.");
          return;
        }
        mostrarMensaje("error", "No se ha podido guardar. El servidor no ha confirmado el cambio y la apariencia anterior sigue vigente.");
      }
    });

    var restaurar = el("button", {
      type: "button", class: "la-ed-btn", texto: "Restaurar apariencia anterior",
      onclick: async function () {
        restaurar.disabled = true;
        var r = await m.restaurarAnterior();
        restaurar.disabled = false;
        if (r.ok) {
          revisionLeida = r.config.revision;
          borrador = { diseno: r.config.diseno, paleta: r.config.paleta, colores: r.config.colores };
          repintar();
          mostrarMensaje("ok", "Se ha restaurado la apariencia anterior como revision " + r.config.revision + ".");
          return;
        }
        mostrarMensaje("aviso", r.motivo === "sin-revision-anterior"
          ? "Todavia no hay una configuracion anterior que restaurar."
          : "No se ha podido restaurar la apariencia anterior.");
      }
    });

    var caja = el("div", { class: "la-ed", role: "dialog", "aria-modal": "true", "aria-label": "Apariencia de la empresa" }, [
      el("header", {}, [el("h2", { texto: "Apariencia de la empresa" }), cerrar]),
      el("div", { style: "padding:0 18px" }, [zonaMensaje]),
      el("div", { class: "la-ed-cuerpo" }, [contenedorIzq, contenedorDer]),
      el("footer", {}, [probar, restaurar, el("div", { class: "la-ed-espacio" }), aplicar])
    ]);

    dialogo = el("div", { class: "la-ed-fondo" }, [caja]);
    dialogo.addEventListener("mousedown", function (e) { if (e.target === dialogo) cerrarDialogo(); });
    document.addEventListener("keydown", alTeclado, true);
    document.body.appendChild(dialogo);
    repintar();
    cerrar.focus();
  }

  function alTeclado(e) {
    if (!dialogo) return;
    if (e.key === "Escape") { e.stopPropagation(); cerrarDialogo(); return; }
    if (e.key !== "Tab") return;
    var focalizables = dialogo.querySelectorAll("button, input, textarea, a[href], select");
    if (!focalizables.length) return;
    var primero = focalizables[0], ultimo = focalizables[focalizables.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  function cerrarDialogo() {
    if (!dialogo) return;
    document.removeEventListener("keydown", alTeclado, true);
    if (dialogo.parentNode) dialogo.parentNode.removeChild(dialogo);
    dialogo = null; contenedorIzq = null; contenedorDer = null; zonaMensaje = null;
    if (ultimoFoco && typeof ultimoFoco.focus === "function") ultimoFoco.focus();
  }

  /* ------------------------------------------------------------ lanzador */

  function montarLanzador() {
    if (document.getElementById("la-ed-lanzador")) return;
    inyectarEstilos();
    var boton = el("button", {
      id: "la-ed-lanzador", type: "button", class: "la-ed-lanzador",
      texto: "Apariencia", "aria-haspopup": "dialog",
      onclick: function () { abrir(); }
    });
    document.body.appendChild(boton);
  }

  window.addEventListener("la-apariencia:abrir-editor", function () { abrir(); });
  if (window.LAApariencia) window.LAApariencia.abrirEditor = abrir;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montarLanzador);
  } else {
    montarLanzador();
  }
})();
