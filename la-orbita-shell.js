/*
 * L&A Suite · marco común Órbita
 *
 * Esta capa no duplica la lógica de navegación ni de permisos. Observa el
 * contenedor React que ya existe y le da una única composición visual:
 * cabecera, barra lateral, contenido y navegación móvil. Los controles
 * existentes siguen siendo los que reciben el clic; aquí solo se les ofrece
 * un punto de entrada común.
 */
(function () {
  "use strict";
  if (window.__laOrbitaShell) return;
  window.__laOrbitaShell = true;

  var root = null;
  var marco = null;
  var cabecera = null;
  var dialogo = null;
  var contextoBoton = null;
  var perfilMenu = null;
  var observador = null;
  var prepararPendiente = false;
  var ultimoContexto = "";

  function h(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (key === "texto") node.textContent = value;
      else if (key.indexOf("on") === 0 && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (value != null) node.setAttribute(key, value);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function textoVisible(node) { return String(node && node.textContent || "").replace(/\s+/g, " ").trim(); }

  function textoSiCambia(node, value) {
    if (!node || node.textContent === value) return;
    node.textContent = value;
  }

  function activarBotonOriginal(clon, original) {
    clon.addEventListener("click", function () { original.click(); });
    clon.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); original.click(); }
    });
  }

  function botonesNavegacion() {
    if (!marco) return [];
    return Array.prototype.slice.call(marco.querySelectorAll("[data-la-orbita-nav-item]"));
  }

  function marcarBarraInferior(bottom) {
    if (!bottom) return;
    Array.prototype.forEach.call(bottom.querySelectorAll(":scope > button, :scope > a"), function (button) {
      button.setAttribute("data-la-orbita-nav-item", "");
      button.classList.add("la-orbita-bottom-item");
      /* Los handlers pertenecen al componente React; solo conservamos una
         marca semántica para que el shell pueda buscar y pintar el activo. */
      if (!button.dataset.laOrbitaBound) {
        button.dataset.laOrbitaBound = "1";
        button.addEventListener("click", function () {
          Array.prototype.forEach.call(bottom.querySelectorAll("[data-la-orbita-nav-item]"), function (item) {
            item.removeAttribute("aria-current");
          });
          button.setAttribute("aria-current", "page");
        });
      }
    });
  }

  function sincronizarBarraInferior(bottom, ruta) {
    if (!bottom) return;
    var patrones = {
      inicio: /inicio|panel general|dashboard/i,
      tpv: /tpv|venta|sala/i,
      cocina: /cocina/i,
      caja: /caja|arqueo/i,
      personal: /fichaje|personal|empleado/i
    };
    var patron = patrones[ruta];
    if (!patron) return;
    var encontrado = Array.prototype.slice.call(bottom.querySelectorAll("[data-la-orbita-nav-item]"))
      .find(function (item) { return patron.test(textoVisible(item)); });
    if (!encontrado) return;
    Array.prototype.forEach.call(bottom.querySelectorAll("[data-la-orbita-nav-item]"), function (item) {
      if (item === encontrado) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function contextoActual() {
    var sidebar = marco && marco.querySelector(".la-orbita-sidebar");
    if (!sidebar) return ultimoContexto || "Selecciona empresa y local";
    var candidato = Array.prototype.slice.call(sidebar.querySelectorAll("div,span"))
      .map(textoVisible)
      .find(function (texto) { return /^Local\s+/i.test(texto) && texto.length < 180; });
    return candidato || ultimoContexto || "Selecciona empresa y local";
  }

  function selectorsContexto() {
    return Array.prototype.slice.call((root || document).querySelectorAll("select")).filter(function (select) {
      var options = Array.prototype.slice.call(select.options || []).map(function (option) { return textoVisible(option); });
      var texto = options.join(" ").toLowerCase();
      /* El resto de formularios también usa <select>. Solo el selector de
         contexto tiene una opción «Todos los locales» y opciones de locales. */
      return options.some(function (label) { return /todos los locales/i.test(label); }) &&
        options.some(function (label) { return /^(?:local|sala|terraza|interior|zona)\b/i.test(label); }) &&
        texto.length > 0;
    });
  }

  function cerrarContexto() {
    var menu = document.getElementById("la-orbita-context-menu");
    if (menu) menu.remove();
    if (contextoBoton) contextoBoton.setAttribute("aria-expanded", "false");
  }

  function abrirPanelParaContexto() {
    var destino = botonesNavegacion().find(function (button) {
      return /panel general|inicio|dashboard/i.test(textoVisible(button));
    });
    if (!destino) return false;
    destino.click();
    window.setTimeout(function () {
      if (contextoBoton && !document.getElementById("la-orbita-context-menu")) abrirContexto();
    }, 350);
    return true;
  }

  function abrirContexto() {
    var selects = selectorsContexto();
    var menu = document.getElementById("la-orbita-context-menu");
    if (menu) { cerrarContexto(); return; }
    menu = h("div", { id: "la-orbita-context-menu", class: "la-orbita-context-menu", role: "menu" });
    if (!selects.length) {
      menu.appendChild(h("p", { class: "la-orbita-context-empty", texto: "Esta pantalla no expone el selector operativo. Ábrelo desde el Panel general sin perder tu sesión." }));
      var irAlPanel = h("button", { type: "button", role: "menuitem", texto: "Abrir Panel general" });
      irAlPanel.addEventListener("click", function () { cerrarContexto(); abrirPanelParaContexto(); });
      menu.appendChild(irAlPanel);
    } else {
      var select = selects[0];
      Array.prototype.slice.call(select.options).forEach(function (option) {
        var button = h("button", { type: "button", role: "menuitemradio", "aria-checked": String(option.value === select.value), texto: option.textContent });
        button.addEventListener("click", function () {
          var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
          setter.call(select, option.value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
          cerrarContexto();
          actualizarCabecera();
        });
        menu.appendChild(button);
      });
    }
    cabecera.appendChild(menu);
    if (contextoBoton) contextoBoton.setAttribute("aria-expanded", "true");
  }

  function abrirBusqueda() {
    if (dialogo && dialogo.isConnected) { dialogo.querySelector("input")?.focus(); return; }
    dialogo = h("dialog", { class: "la-orbita-search-dialog", "aria-labelledby": "la-orbita-search-title" });
    var cerrar = h("button", { type: "button", class: "la-orbita-dialog-close", "aria-label": "Cerrar buscador", texto: "×" });
    cerrar.addEventListener("click", function () { dialogo.close(); });
    var input = h("input", { type: "search", class: "la-orbita-search-input", placeholder: "Busca una pantalla, módulo o tarea", autocomplete: "off", "aria-label": "Buscar en la suite" });
    var lista = h("div", { class: "la-orbita-search-list", role: "listbox" });
    var vistos = new Set();
    var items = botonesNavegacion().map(function (button) {
      return { label: textoVisible(button), button: button };
    }).filter(function (item) {
      if (!item.label || vistos.has(item.label)) return false;
      vistos.add(item.label);
      return true;
    });
    function render() {
      var consulta = input.value.trim().toLocaleLowerCase("es");
      lista.replaceChildren();
      var encontrados = items.filter(function (item) { return !consulta || item.label.toLocaleLowerCase("es").includes(consulta); });
      encontrados.slice(0, 24).forEach(function (item) {
        var option = h("button", { type: "button", role: "option", class: "la-orbita-search-option", texto: item.label });
        option.addEventListener("click", function () { item.button.click(); dialogo.close(); });
        lista.appendChild(option);
      });
      if (!encontrados.length) lista.appendChild(h("p", { class: "la-orbita-context-empty", texto: "No hay pantallas que coincidan." }));
    }
    input.addEventListener("input", render);
    var cab = h("div", { class: "la-orbita-dialog-head" }, [h("h2", { id: "la-orbita-search-title", texto: "Buscar en L&A Suite" }), cerrar]);
    dialogo.append(cab, input, lista);
    dialogo.addEventListener("close", function () { dialogo.remove(); dialogo = null; });
    document.body.appendChild(dialogo);
    render();
    dialogo.showModal();
    input.focus();
  }

  function marcarNavegacion(sidebar) {
    if (!sidebar) return;
    var grupos = sidebar.querySelectorAll(":scope > div:not(:first-child) button");
    Array.prototype.forEach.call(grupos, function (button) {
      if (button.closest(".la-orbita-shell-tools")) return;
      button.setAttribute("data-la-orbita-nav-item", "");
      Array.prototype.forEach.call(button.querySelectorAll("span"), function (span) { span.classList.add("la-shell-label"); });
      if (!button.dataset.laOrbitaRouteBound) {
        button.dataset.laOrbitaRouteBound = "1";
        button.addEventListener("click", function () {
          Array.prototype.forEach.call(sidebar.querySelectorAll("[data-la-orbita-nav-item]"), function (item) {
            item.removeAttribute("aria-current");
          });
          button.setAttribute("aria-current", "page");
          marcarSuperficie(marco && marco.querySelector(":scope > main"), sidebar);
          sincronizarBarraInferior(marco && marco.querySelector(":scope > [data-la-barra-inferior]"), marco && marco.getAttribute("data-la-orbita-route"));
        });
      }
    });
  }

  function crearSidebarParaClaro(legacy) {
    if (!legacy || marco.querySelector(".la-orbita-sidebar")) return marco.querySelector(".la-orbita-sidebar");
    var sidebar = h("aside", { class: "la-orbita-sidebar", "aria-label": "Navegación principal" });
    var marca = legacy.querySelector(".la-claro-marca");
    if (marca) sidebar.appendChild(marca.cloneNode(true));
    var areas = legacy.querySelectorAll(".la-claro-area");
    Array.prototype.forEach.call(areas, function (area) {
      var titulo = area.querySelector(":scope > button");
      var section = h("section", { class: "la-orbita-sidebar-group" });
      if (titulo) section.appendChild(h("div", { class: "la-orbita-sidebar-title la-shell-label", texto: textoVisible(titulo) }));
      Array.prototype.forEach.call(area.querySelectorAll(".la-claro-destinos > button"), function (original) {
        var clone = original.cloneNode(true);
        clone.removeAttribute("aria-current");
        clone.removeAttribute("style");
        clone.setAttribute("data-la-orbita-nav-item", "");
        clone.className = "la-orbita-sidebar-item";
        Array.prototype.forEach.call(clone.querySelectorAll("span"), function (span) { span.classList.add("la-shell-label"); });
        activarBotonOriginal(clone, original);
        section.appendChild(clone);
      });
      if (section.querySelector("[data-la-orbita-nav-item]")) sidebar.appendChild(section);
    });
    marco.appendChild(sidebar);
    return sidebar;
  }

  function sincronizarSidebarClaro(legacy, sidebar) {
    if (!legacy || !sidebar) return;
    var originales = Array.prototype.slice.call(legacy.querySelectorAll(".la-claro-destinos > button"));
    var porTexto = new Map(originales.map(function (button) { return [textoVisible(button), button]; }));
    Array.prototype.forEach.call(sidebar.querySelectorAll("[data-la-orbita-nav-item]"), function (clone) {
      var original = porTexto.get(textoVisible(clone));
      if (original) {
        if (original.getAttribute("aria-current") === "page") clone.setAttribute("aria-current", "page");
        else clone.removeAttribute("aria-current");
      }
    });
  }

  function prepararSidebar() {
    var legacy = marco.querySelector(":scope > .la-claro-cabecera");
    if (legacy) {
      legacy.classList.add("la-orbita-legacy-header");
      var sidebarClaro = crearSidebarParaClaro(legacy);
      sincronizarSidebarClaro(legacy, sidebarClaro);
      return sidebarClaro;
    }
    var sidebar = marco.querySelector(":scope > aside");
    if (sidebar) {
      sidebar.classList.add("la-orbita-sidebar");
      marcarNavegacion(sidebar);
    }
    return sidebar;
  }

  function marcarHerramientasLegadas(sidebar) {
    if (!sidebar) return;
    var primerBloque = sidebar.firstElementChild;
    if (!primerBloque) return;
    Array.prototype.forEach.call(primerBloque.querySelectorAll("button"), function (button) {
      var texto = textoVisible(button);
      if (/seguridad|perfil|modo empleado|cerrar sesión|cerrar sesion|claro|oscuro|tema/i.test(texto)) {
        button.classList.add("la-orbita-legacy-tool");
      }
    });
  }

  function slugRuta(texto) {
    return textoVisible({ textContent: texto })
      .toLocaleLowerCase("es")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pantalla";
  }

  /*
   * Los módulos históricos no comparten nombres de clase: unos usan Tailwind,
   * otros clases propias y otros solo roles ARIA. Esta marca es deliberadamente
   * semántica y aditiva. No reemplaza nodos ni escucha sus eventos; únicamente
   * permite que la hoja Órbita aplique la misma escala a todos los módulos,
   * también cuando React vuelve a pintar una pantalla.
   */
  function marcarComponentesOrbita(main) {
    if (!main) return;
    Array.prototype.forEach.call(main.querySelectorAll(
      'button, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="option"]'
    ), function (control) {
      control.classList.add("la-orbita-control");
      if (control.getAttribute("aria-disabled") === "true" || control.disabled) control.classList.add("la-orbita-control-disabled");
    });
    Array.prototype.forEach.call(main.querySelectorAll('input, select, textarea'), function (field) {
      field.classList.add("la-orbita-field");
    });
    Array.prototype.forEach.call(main.querySelectorAll('[role="tab"]'), function (tab) {
      tab.classList.add("la-orbita-tab");
    });
    Array.prototype.forEach.call(main.querySelectorAll('table'), function (table) {
      table.classList.add("la-orbita-table");
    });
    Array.prototype.forEach.call(main.querySelectorAll('[role="alert"], [role="status"]'), function (state) {
      state.classList.add("la-orbita-state");
    });
    Array.prototype.forEach.call(main.querySelectorAll('[role="dialog"], dialog'), function (dialog) {
      dialog.classList.add("la-orbita-dialog");
    });
    Array.prototype.forEach.call(main.querySelectorAll('.la-ui-card, [data-la-card]'), function (card) {
      card.classList.add("la-orbita-card");
    });
  }

  function rutaActiva(sidebar, main) {
    var activa = sidebar && sidebar.querySelector('[aria-current="page"]');
    var labelNavegacion = textoVisible(activa);
    /* El destino elegido por la navegación manda sobre cualquier subpanel
       incrustado (por ejemplo, Pase dentro de Inicio). */
    if (/panel general|resumen general|inicio|dashboard/i.test(labelNavegacion)) return "inicio";
    if (main && main.querySelector(".tpv-layout")) return "tpv";
    var encabezadoInicial = textoVisible(main && main.querySelector("h1, h2"));
    var textoRutaInicial = (labelNavegacion + " | " + encabezadoInicial)
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    /* Traspasos conserva una raíz operativa histórica de Caja, pero pertenece
       al bloque de Inventario. Resolverlo antes de mirar esa clase evita que
       la capa visual de Caja gane por accidente. */
    if (/traspasos|reconciliacion|inventario ciego|saldo de almacen|mapa de almacen|etiquetas y catalogo/.test(textoRutaInicial)) return "inventario";
    /* Inicio puede incrustar el panel Pase para dar contexto operativo. La
       raíz del dashboard tiene prioridad: la cola embebida no debe cambiar la
       identidad del módulo ni la navegación activa. */
    if (main && main.querySelector(".la-panel-diseno")) return "inicio";
    if (main && main.querySelector("#la-pase, .la-pase")) return "pase";
    if (main && main.querySelector(".la-operacion-cocina")) return "cocina";
    if (main && main.querySelector(".la-operacion-caja")) return "caja";
    /* Algunas pantallas históricas navegan mediante un handler propio y no
       actualizan aria-current. Su h1/h2 es la fuente visible y estable para
       conservar el anclaje Órbita sin sustituir el componente ni su ruta. */
    var labelEncabezado = textoVisible(main && main.querySelector("h1, h2"));
    var label = [labelNavegacion, labelEncabezado].filter(Boolean).join(" | ");
    var conocidas = [
      ["resumen general|panel general|inicio|dashboard", "inicio"],
      ["panel de direccion|direccion", "direccion"],
      ["tpv|venta rapida|venta rápida", "tpv"],
      ["pase", "pase"],
      ["cocina", "cocina"],
      ["caja|arqueo", "caja"],
      ["clientes", "clientes"],
      ["compras|proveedores|pedidos|recepcion|albaranes|facturas", "compras"],
      ["inventario|productos|historial de producto|mermas|caducidad|ajustes|reconciliaci[oó]n|inventario ciego|saldo de almac[eé]n|mapa de almac[eé]n|traspasos|etiquetas y cat[aá]logo", "inventario"],
      ["encargos|devoluciones|descuentos|cortesias|cupones", "tpv"],
      ["\\bpersonal\\b|\\bempleados\\b|\\bcargos\\b|\\bpermisos\\b|\\bturnos\\b|\\bfichajes\\b|registro horario|cuadrante de turnos|coste de personal", "personal"],
      ["configuracion|empresa|locales|terminales|equipos|fiscal", "configuracion"],
      ["plataforma|administracion", "plataforma"],
      ["acceso|login", "acceso"],
      ["auditoria", "auditoria"],
      ["informes|resultados", "informes"]
    ];
    // Las etiquetas visibles pueden llevar tildes (Configuración, Dirección,
    // Administración). Clasificar sobre una copia sin diacríticos evita que
    // una pantalla acabe con un slug duplicado como
    // «configuracion-configuracion» y quede fuera del CSS scoped de Órbita.
    var labelParaCoincidencia = label
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    var coincidencia = conocidas.find(function (entrada) { return new RegExp(entrada[0], "i").test(labelParaCoincidencia); });
    return coincidencia ? coincidencia[1] : (label ? slugRuta(label) : "pantalla");
  }

  function marcarSuperficie(main, sidebar) {
    if (!marco) return;
    var ruta = rutaActiva(sidebar, main);
    marco.setAttribute("data-la-orbita-route", ruta);
    if (main) {
      main.setAttribute("data-la-orbita-route", ruta);
      var superficie = ruta === "inicio" ? "inicio" :
        ruta === "inventario" ? "inventario" :
        ruta === "personal" ? "personal" :
        main.querySelector(".tpv-layout") ? "tpv" :
        main.querySelector(".la-panel-diseno") ? "inicio" :
        main.querySelector("#la-pase, .la-pase") ? "pase" :
        main.querySelector(".la-operacion-cocina") ? "cocina" :
        main.querySelector(".la-operacion-caja") ? "caja" : ruta;
      main.setAttribute("data-la-orbita-surface", superficie);
      marco.setAttribute("data-la-orbita-module", superficie);
      main.setAttribute("data-la-orbita-module", superficie);
      marcarComponentesOrbita(main);
      /* Los módulos históricos comparten SectionTitle, pero su composición
         queda anidada en raíces distintas. Marcar el primer h2 visible da a
         Órbita un ancla estable para la misma jerarquía en Clientes,
         Inventario, Compras y Organización, sin reemplazar el componente ni
         sus acciones. */
      Array.prototype.forEach.call(main.querySelectorAll(".la-orbita-page-title"), function (tituloViejo) {
        tituloViejo.classList.remove("la-orbita-page-title");
      });
      var titulo = main.querySelector("h2");
      if (titulo && !titulo.closest(".la-operacion-cocina, .la-operacion-caja, #la-pase, .la-pase, .tpv-layout")) {
        titulo.classList.add("la-orbita-page-title");
        if (titulo.parentElement) titulo.parentElement.classList.add("la-orbita-page-title-wrap");
      }
    }
  }

  function alternarSidebar(sidebar, toggle) {
    var cerrado = !sidebar.classList.contains("la-orbita-colapsada");
    sidebar.classList.toggle("la-orbita-colapsada", cerrado);
    marco.classList.toggle("la-orbita-sidebar-cerrada", cerrado);
    toggle.setAttribute("aria-expanded", String(!cerrado));
    toggle.textContent = cerrado ? "»" : "«";
    try { localStorage.setItem("la-orbita:sidebar", cerrado ? "cerrado" : "abierto"); } catch (_) {}
  }

  function prepararToggle(sidebar) {
    if (!sidebar || sidebar.querySelector("[data-la-orbita-sidebar-toggle]")) return;
    var toggle = h("button", { type: "button", class: "la-orbita-sidebar-toggle", "data-la-orbita-sidebar-toggle": "", "aria-label": "Contraer navegación", "aria-expanded": "true", texto: "«" });
    toggle.addEventListener("click", function () { alternarSidebar(sidebar, toggle); });
    var marca = sidebar.firstElementChild;
    if (marca) marca.appendChild(toggle); else sidebar.prepend(toggle);
    try {
      if (localStorage.getItem("la-orbita:sidebar") === "cerrado") alternarSidebar(sidebar, toggle);
    } catch (_) {}
  }

  function actualizarCabecera() {
    if (!cabecera) return;
    var contexto = contextoActual();
    ultimoContexto = contexto;
    var texto = cabecera.querySelector("[data-la-orbita-context-label]");
    textoSiCambia(texto, contexto);
    var qa = cabecera.querySelector("[data-la-orbita-qa]");
    if (qa) {
      var esQa = window.__modoPruebasQA === true || /deploy-preview-/i.test(location.hostname);
      textoSiCambia(qa, esQa ? "QA" : "Producción");
      qa.dataset.qa = esQa ? "qa" : "produccion";
    }
    var avisos = cabecera.querySelector("[data-la-orbita-alertas]");
    if (avisos) {
      var cantidad = marco.querySelectorAll(".la-orbita-alert").length;
      textoSiCambia(avisos, cantidad ? "Avisos " + cantidad : "Avisos");
    }
  }

  function crearCabecera(sidebar) {
    if (marco.querySelector("[data-la-orbita-header]")) return marco.querySelector("[data-la-orbita-header]");
    cabecera = h("header", { class: "la-orbita-header", "data-la-orbita-header": "", role: "banner" });
    var contexto = h("button", { type: "button", class: "la-orbita-context", "aria-haspopup": "menu", texto: "Selecciona empresa y local" });
    contexto.setAttribute("data-la-orbita-context-label", "");
    contexto.setAttribute("aria-expanded", "false");
    contextoBoton = contexto;
    contexto.addEventListener("click", abrirContexto);
    var izquierda = h("div", { class: "la-orbita-header-context" }, [h("span", { class: "la-orbita-brand", texto: "L&A Suite" }), contexto]);
    var qa = h("span", { class: "la-orbita-qa", "data-la-orbita-qa": "", texto: "QA" });
    izquierda.appendChild(qa);
    var derecha = h("div", { class: "la-orbita-header-actions" });
    var buscar = h("button", { type: "button", class: "la-orbita-header-button", "aria-label": "Buscar (Ctrl K)", texto: "⌕ Buscar" });
    buscar.addEventListener("click", abrirBusqueda);
    var alertas = h("button", { type: "button", class: "la-orbita-header-button", "data-la-orbita-alertas": "", texto: "Avisos" });
    alertas.addEventListener("click", function () {
      var aviso = marco.querySelector(".la-orbita-alert");
      if (aviso) aviso.scrollIntoView({ block: "nearest" });
    });
    var perfil = h("button", { type: "button", class: "la-orbita-header-button", "aria-haspopup": "menu", "aria-expanded": "false", texto: "Perfil" });
    perfil.addEventListener("click", function () {
      if (perfilMenu && perfilMenu.isConnected) {
        perfilMenu.remove();
        perfilMenu = null;
        perfil.setAttribute("aria-expanded", "false");
        return;
      }
      perfilMenu = h("div", { class: "la-orbita-profile-menu", role: "menu" });
      [
        { label: "Cuenta y seguridad", pattern: /seguridad|perfil/i },
        { label: "Cambiar tema", pattern: /claro|oscuro|tema/i },
        { label: "Modo empleado", pattern: /modo empleado/i },
        { label: "Cerrar sesión", pattern: /cerrar sesión|cerrar sesion|salir/i }
      ].forEach(function (item) {
        var original = Array.prototype.slice.call((sidebar || marco).querySelectorAll("button")).find(function (button) {
          return item.pattern.test(textoVisible(button)) && !button.closest(".la-orbita-header");
        });
        if (!original) return;
        var action = h("button", { type: "button", role: "menuitem", texto: item.label });
        action.addEventListener("click", function () {
          perfilMenu.remove();
          perfilMenu = null;
          perfil.setAttribute("aria-expanded", "false");
          /* El botón heredado de salida vive dentro del encabezado que el shell
             oculta. Su click abría un modal también oculto y dejaba al usuario
             atrapado en la sesión. La salida del perfil Órbita se ejecuta aquí
             directamente; el botón antiguo queda como respaldo si el cliente
             no está disponible (por ejemplo, durante una hidratación parcial). */
          if (item.label === "Cerrar sesión" && typeof window.getSupabaseClient === "function") {
            Promise.resolve(window.getSupabaseClient()).then(function (cliente) {
              if (!cliente || !cliente.auth || typeof cliente.auth.signOut !== "function") throw new Error("cliente de sesión no disponible");
              return cliente.auth.signOut({ scope: "local" });
            }).then(function () {
              window.location.reload();
            }).catch(function () {
              if (original && typeof original.click === "function") original.click();
            });
          } else if (original && typeof original.click === "function") {
            original.click();
          }
        });
        perfilMenu.appendChild(action);
      });
      if (!perfilMenu.children.length) perfilMenu.appendChild(h("p", { class: "la-orbita-context-empty", texto: "No hay acciones de perfil disponibles para este rol." }));
      cabecera.appendChild(perfilMenu);
      perfil.setAttribute("aria-expanded", "true");
    });
    var apariencia = h("button", { type: "button", class: "la-orbita-header-button la-orbita-appearance", texto: "Apariencia" });
    apariencia.addEventListener("click", function () { if (typeof window.LAApariencia?.abrirEditor === "function") window.LAApariencia.abrirEditor(); });
    derecha.append(buscar, alertas, perfil, apariencia);
    cabecera.append(izquierda, derecha);
    marco.appendChild(cabecera);
    actualizarCabecera();
    return cabecera;
  }

  function prepararMarco() {
    /* En modo local el producto no persiste `disenoNavegacion` y el wrapper
       React llega sin data-la-contenedor. Sigue siendo la misma superficie de
       suite (su clase estable es w-full/min-h-[700px]); asumir que el atributo
       existe dejaba el shell antiguo visible en el banco sin sincronización. */
    var encontrado = document.querySelector("#root > [data-la-contenedor]") ||
      document.querySelector('#root > div.w-full.min-h-\\[700px\\]');
    if (!encontrado) return;
    /* Sin cuenta ni sincronización no hay resolución de empresa que escriba
       data-la-diseno. Órbita es el valor inicial del producto; solo se fija
       cuando no existe otro diseño para no pisar una elección posterior. */
    if (!document.documentElement.getAttribute("data-la-diseno")) {
      document.documentElement.setAttribute("data-la-diseno", "orbita");
    }
    if (marco !== encontrado) { marco = encontrado; }
    if (!marco.getAttribute("data-la-contenedor")) marco.setAttribute("data-la-contenedor", "orbita");
    marco.classList.add("la-orbita-shell");
    Array.prototype.forEach.call(marco.children, function (child) {
      if (child.tagName === "STYLE") child.classList.add("la-orbita-runtime-style");
      if (child.tagName === "DIV" && /sticky/.test(String(child.getAttribute("style") || ""))) child.classList.add("la-orbita-alert");
      if (child.classList.contains("md:hidden") && child.querySelector("img")) child.classList.add("la-orbita-legacy-mobile");
    });
    var sidebar = prepararSidebar();
    if (!sidebar) return;
    marcarHerramientasLegadas(sidebar);
    prepararToggle(sidebar);
    crearCabecera(sidebar);
    var main = marco.querySelector(":scope > main");
    if (main) main.classList.add("la-orbita-main");
    var bottom = marco.querySelector(":scope > [data-la-barra-inferior]");
    if (bottom) {
      bottom.classList.add("la-orbita-bottom-nav");
      marcarBarraInferior(bottom);
    }
    var rumbo = marco.querySelector(":scope > main .la-rumbo-acceso");
    if (rumbo) rumbo.classList.add("la-orbita-legacy-search");
    marcarSuperficie(main, sidebar);
    if (bottom) sincronizarBarraInferior(bottom, marco.getAttribute("data-la-orbita-route"));
    actualizarCabecera();
  }

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
    if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
    event.preventDefault();
    abrirBusqueda();
  });

  function iniciar() {
    prepararMarco();
    observador = new MutationObserver(function () {
      if (prepararPendiente) return;
      prepararPendiente = true;
      var ejecutar = function () {
        prepararPendiente = false;
        prepararMarco();
      };
      if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(ejecutar);
      else window.setTimeout(ejecutar, 0);
    });
    observador.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
    window.addEventListener("la-apariencia:contexto-cambiado", actualizarCabecera);
    window.addEventListener("resize", actualizarCabecera);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
