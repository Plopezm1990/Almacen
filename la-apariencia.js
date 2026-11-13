/* ==========================================================================
   L&A Suite - Apariencia por empresa (motor en tiempo de ejecucion)
   --------------------------------------------------------------------------
   Resuelve y aplica el aspecto de la suite sin tocar datos, permisos ni
   operaciones. Solo escribe atributos y variables CSS sobre <html>.

   Precedencia (plan 2.4):
     prueba temporal del usuario -> preferencia personal -> disenno de la
     empresa -> interfaz base.

   Persistencia: clave generica "apariencia" de window.storage, que el
   programa ya segrega por empresa con RLS y sincroniza con la nube. No se
   annade tabla ni migracion.

   Resiliencia (plan 2.6): cualquier fallo de lectura, un disenno no
   registrado o un color invalido dejan la interfaz base en pie y nunca
   interrumpen una operacion en curso.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__laApariencia) return;

  var CLAVE = "apariencia";
  var CLAVE_PRUEBA = "la:apariencia:prueba";
  var CLAVE_BIBLIOTECA = "la:apariencia:biblioteca";
  var VERDE_MARCA = "#123B2D";

  var DISENOS = [
    { id: "oliva",  nombre: "Oliva",  resumen: "Verde y oro de la marca. Referencia general." },
    { id: "claro",  nombre: "Claro",  resumen: "Luminoso y compacto, con areas en la cabecera." },
    { id: "pulso",  nombre: "Pulso",  resumen: "Oscuro, analitico y denso." },
    { id: "patio",  nombre: "Patio",  resumen: "Calido y orientado a tareas." },
    { id: "rumbo",  nombre: "Rumbo",  resumen: "Navegacion por busqueda global." },
    { id: "sello",  nombre: "Sello",  resumen: "Corporativa clasica, verde botella y oro." },
    { id: "orbita", nombre: "Orbita", resumen: "Panel oscuro de carbon, acero y coral." },
    { id: "ascua",  nombre: "Ascua",  resumen: "Panel calido de rojo, naranja y crema." },
    { id: "pase",   nombre: "Pase",   resumen: "Panel de servicio con plano de sala y cola." }
  ];

  /* Los seis campos semanticos del editor, en el orden de la especificacion. */
  var CAMPOS = [
    { id: "fondo",    etiqueta: "Fondo",    token: "--c-bg" },
    { id: "tarjetas", etiqueta: "Tarjetas", token: "--c-surface" },
    { id: "texto",    etiqueta: "Texto",    token: "--c-ink" },
    { id: "enlaces",  etiqueta: "Enlaces",  token: "--c-accent" },
    { id: "boton",    etiqueta: "Boton",    token: "--c-accent-fill" },
    { id: "detalle",  etiqueta: "Detalle",  token: "--c-line" }
  ];

  var PALETAS = [
    { id: "bosque",       nombre: "Bosque",       fondo: "#0F1F17", tarjetas: "#1E3A2E", texto: "#C7CBB8", enlaces: "#6B7F67", boton: "#3E5A3F", detalle: "#3D4337" },
    { id: "cafe-tostado", nombre: "Cafe tostado", fondo: "#1A120E", tarjetas: "#3A2418", texto: "#D5C4AE", enlaces: "#A88462", boton: "#6B4A2E", detalle: "#4A4A46" },
    { id: "azul-ambar",   nombre: "Azul y ambar", fondo: "#0B132B", tarjetas: "#1C2541", texto: "#F4D6B0", enlaces: "#5BC0DE", boton: "#D97706", detalle: "#3A506B" },
    { id: "amatista",     nombre: "Amatista",     fondo: "#0E0B1D", tarjetas: "#2A1E4D", texto: "#C9C2E3", enlaces: "#8B7CC7", boton: "#5A3B8C", detalle: "#3A3A52" },
    { id: "granada",      nombre: "Granada",      fondo: "#1A0F2E", tarjetas: "#3B1B4F", texto: "#F4D7D4", enlaces: "#D6598F", boton: "#FF6B6B", detalle: "#7A2E6F" },
    { id: "ascua",        nombre: "Ascua",        fondo: "#FFF7ED", tarjetas: "#FFE4C7", texto: "#7F1D1D", enlaces: "#F97316", boton: "#DC2626", detalle: "#FDBA74" }
  ];

  /* ---------------------------------------------------------------- color */

  function normalizarHex(valor) {
    if (typeof valor !== "string") return null;
    var v = valor.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(v)) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
    return "#" + v.toUpperCase();
  }

  function aRgb(hex) {
    var h = normalizarHex(hex);
    if (!h) return null;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  function luminancia(hex) {
    var rgb = aRgb(hex);
    if (!rgb) return 0;
    var c = rgb.map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contraste(a, b) {
    var la = luminancia(a), lb = luminancia(b);
    var alto = Math.max(la, lb), bajo = Math.min(la, lb);
    return (alto + 0.05) / (bajo + 0.05);
  }

  function mezclar(hexA, hexB, proporcion) {
    var a = aRgb(hexA), b = aRgb(hexB);
    if (!a || !b) return normalizarHex(hexA) || normalizarHex(hexB);
    var p = Math.min(1, Math.max(0, proporcion));
    var mezcla = a.map(function (v, i) { return Math.round(v + (b[i] - v) * p); });
    return "#" + mezcla.map(function (v) {
      return v.toString(16).padStart(2, "0").toUpperCase();
    }).join("");
  }

  /* Tinta legible sobre un relleno: blanca u oscura, la de mayor contraste. */
  function tintaSobre(fondo) {
    return contraste(fondo, "#FFFFFF") >= contraste(fondo, "#10140F") ? "#FFFFFF" : "#10140F";
  }

  /**
   * Acerca un color al blanco o al negro, conservando su tono, hasta alcanzar
   * el contraste minimo frente a los fondos indicados. La especificacion pide
   * "ajustar el tono de enlaces" en vez de rechazar la paleta del propietario.
   * Si no se alcanza el minimo, devuelve el valor con mejor contraste logrado.
   */
  function ajustarContraste(color, fondos, minimo) {
    var base = normalizarHex(color);
    if (!base) return color;
    var lista = (Array.isArray(fondos) ? fondos : [fondos]).map(normalizarHex).filter(Boolean);
    if (!lista.length) return base;
    function peor(c) {
      return lista.reduce(function (min, f) { return Math.min(min, contraste(c, f)); }, Infinity);
    }
    if (peor(base) >= minimo) return base;
    var fondoClaro = lista.every(function (f) { return luminancia(f) >= 0.35; });
    var destino = fondoClaro ? "#000000" : "#FFFFFF";
    var mejor = base, mejorRatio = peor(base);
    for (var paso = 1; paso <= 20; paso++) {
      var intento = mezclar(base, destino, paso / 20);
      var ratio = peor(intento);
      if (ratio > mejorRatio) { mejor = intento; mejorRatio = ratio; }
      if (ratio >= minimo) return intento;
    }
    return mejor;
  }

  /**
   * Resuelve los seis campos del propietario en los tokens que el programa
   * usa, ajustando los que tienen un minimo de contraste exigible.
   * `detalle` se conserva tal cual como separador decorativo y se deriva de el
   * un borde funcional legible (WCAG 2.2, 1.4.11).
   */
  function resolverColores(colores) {
    var fondos = [colores.fondo, colores.tarjetas];
    var enlaces = ajustarContraste(colores.enlaces, fondos, 4.5);
    var borde = ajustarContraste(colores.detalle, fondos, 3);
    return {
      fondo: colores.fondo,
      tarjetas: colores.tarjetas,
      texto: colores.texto,
      enlaces: enlaces,
      boton: colores.boton,
      detalle: colores.detalle,
      borde: borde,
      tintaBoton: tintaSobre(colores.boton),
      ajustes: {
        enlaces: enlaces !== normalizarHex(colores.enlaces),
        borde: borde !== normalizarHex(colores.detalle)
      }
    };
  }

  /* Informe de contraste de una combinacion ya resuelta, para el editor. */
  function revisarContraste(colores) {
    var r = resolverColores(normalizarColores(colores) || colores);
    var avisos = [];
    function exigir(nombre, texto, fondo, minimo) {
      var ratio = contraste(texto, fondo);
      if (ratio < minimo) {
        avisos.push({
          campo: nombre,
          ratio: Math.round(ratio * 100) / 100,
          minimo: minimo,
          mensaje: "El contraste de " + nombre + " es " + (Math.round(ratio * 100) / 100) +
            ":1 y el minimo exigido es " + minimo + ":1."
        });
      }
    }
    exigir("texto sobre fondo", r.texto, r.fondo, 4.5);
    exigir("texto sobre tarjetas", r.texto, r.tarjetas, 4.5);
    exigir("enlaces sobre fondo", r.enlaces, r.fondo, 4.5);
    exigir("enlaces sobre tarjetas", r.enlaces, r.tarjetas, 4.5);
    exigir("tinta del boton", r.tintaBoton, r.boton, 4.5);
    exigir("borde funcional sobre fondo", r.borde, r.fondo, 3);
    exigir("borde funcional sobre tarjetas", r.borde, r.tarjetas, 3);
    return avisos;
  }

  /* ------------------------------------------------------- normalizacion */

  function esDisenoRegistrado(id) {
    return DISENOS.some(function (d) { return d.id === id; });
  }

  function paletaPorId(id) {
    for (var i = 0; i < PALETAS.length; i++) if (PALETAS[i].id === id) return PALETAS[i];
    return null;
  }

  function normalizarColores(entrada) {
    if (!entrada || typeof entrada !== "object") return null;
    var salida = {};
    for (var i = 0; i < CAMPOS.length; i++) {
      var hex = normalizarHex(entrada[CAMPOS[i].id]);
      if (!hex) return null;
      salida[CAMPOS[i].id] = hex;
    }
    return salida;
  }

  /* Una configuracion invalida no se aplica: se devuelve null y manda la base. */
  function normalizarConfig(entrada) {
    if (!entrada || typeof entrada !== "object") return null;
    var diseno = typeof entrada.diseno === "string" ? entrada.diseno : "";
    if (!esDisenoRegistrado(diseno)) return null;
    var paleta = typeof entrada.paleta === "string" && paletaPorId(entrada.paleta) ? entrada.paleta : null;
    var colores = normalizarColores(entrada.colores);
    return {
      diseno: diseno,
      paleta: paleta,
      colores: colores,
      revision: Number(entrada.revision) > 0 ? Number(entrada.revision) : 1,
      actualizadoPor: typeof entrada.actualizadoPor === "string" ? entrada.actualizadoPor : "",
      actualizadoEn: typeof entrada.actualizadoEn === "string" ? entrada.actualizadoEn : "",
      anterior: entrada.anterior && typeof entrada.anterior === "object" ? entrada.anterior : null
    };
  }

  /* --------------------------------------------------------------- aplicar */

  var raiz = document.documentElement;
  var estado = { config: null, origen: "base" };

  function limpiarVariables() {
    var estilo = raiz.style;
    ["--c-bg", "--c-surface", "--c-ink", "--c-ink-soft", "--c-line", "--c-border-control",
      "--c-divider", "--c-accent", "--c-accent-fill", "--c-on-accent", "--c-accent-soft",
      "--c-focus-ring", "--c-badge-ring", "--c-chrome"].forEach(function (t) {
        estilo.removeProperty(t);
      });
  }

  function aplicarColores(colores) {
    var estilo = raiz.style;
    var r = resolverColores(colores);
    var oscuro = luminancia(r.fondo) < 0.35;
    estilo.setProperty("--c-bg", r.fondo);
    estilo.setProperty("--c-surface", r.tarjetas);
    estilo.setProperty("--c-ink", r.texto);
    estilo.setProperty("--c-ink-soft", mezclar(r.texto, r.fondo, 0.32));
    /* Borde funcional legible; el detalle original queda como separador. */
    estilo.setProperty("--c-line", r.borde);
    estilo.setProperty("--c-border-control", r.borde);
    estilo.setProperty("--c-divider", r.detalle);
    estilo.setProperty("--c-accent", r.enlaces);
    estilo.setProperty("--c-accent-fill", r.boton);
    estilo.setProperty("--c-on-accent", r.tintaBoton);
    estilo.setProperty("--c-accent-soft", mezclar(r.fondo, r.enlaces, 0.14));
    estilo.setProperty("--c-focus-ring", r.enlaces);
    estilo.setProperty("--c-badge-ring", oscuro ? "#FFFFFF" : "transparent");
    estilo.setProperty("--c-chrome", oscuro ? mezclar(r.fondo, "#000000", 0.25) : r.boton);
  }

  /* Los seis colores de una paleta de biblioteca, sin tokens derivados. */
  function coloresDePaleta(id) {
    var p = paletaPorId(id);
    if (!p) return null;
    return { fondo: p.fondo, tarjetas: p.tarjetas, texto: p.texto, enlaces: p.enlaces, boton: p.boton, detalle: p.detalle };
  }

  /** Aplica una configuracion ya normalizada. `null` devuelve la interfaz base. */
  function aplicar(config, origen) {
    try {
      limpiarVariables();
      if (!config) {
        raiz.removeAttribute("data-la-diseno");
        raiz.removeAttribute("data-la-paleta");
        raiz.removeAttribute("data-la-personalizada");
        raiz.removeAttribute("data-la-origen");
        estado = { config: null, origen: "base" };
      } else {
        raiz.setAttribute("data-la-diseno", config.diseno);
        if (config.paleta) raiz.setAttribute("data-la-paleta", config.paleta);
        else raiz.removeAttribute("data-la-paleta");
        if (config.colores) raiz.setAttribute("data-la-personalizada", "");
        else raiz.removeAttribute("data-la-personalizada");
        /* Una paleta de biblioteca se resuelve igual que una propia, para que
           los enlaces y los bordes funcionales alcancen su contraste minimo.
           Los bloques de la hoja de estilos quedan como reserva sin JS. */
        var colores = config.colores || (config.paleta ? coloresDePaleta(config.paleta) : null);
        if (colores) aplicarColores(colores);
        raiz.setAttribute("data-la-origen", origen || "empresa");
        estado = { config: config, origen: origen || "empresa" };
      }
      pintarAviso();
      emitir();
      return true;
    } catch (error) {
      /* Nunca dejar la suite sin interfaz por un fallo de apariencia. */
      try {
        limpiarVariables();
        raiz.removeAttribute("data-la-diseno");
        raiz.removeAttribute("data-la-paleta");
        raiz.removeAttribute("data-la-personalizada");
        raiz.removeAttribute("data-la-origen");
      } catch (e) {}
      estado = { config: null, origen: "base" };
      return false;
    }
  }

  function emitir() {
    try {
      window.dispatchEvent(new CustomEvent("la-apariencia:cambio", {
        detail: { diseno: estado.config ? estado.config.diseno : null, origen: estado.origen }
      }));
    } catch (e) {}
  }

  /* -------------------------------------------------------------- contexto */

  function empresaActiva() {
    return window.__empresaActivaIdParaContexto || "";
  }

  function usuarioActivo() {
    return window.__usuarioActivoNombre || "";
  }

  function claveSesion() {
    return CLAVE_PRUEBA + ":" + (empresaActiva() || "sin-empresa") + ":" + (usuarioActivo() || "sin-usuario");
  }

  /* ------------------------------------------------------------ almacenaje */

  /* Estado del contrato de servidor, para que el editor pueda decirlo claro. */
  var servidor = { disponible: null, puedeAplicar: null, motivo: "" };

  function clienteNube() {
    return window.__nubeActiva ? (window.__nubeCliente || null) : null;
  }

  /**
   * El contrato de servidor todavia no esta desplegado en este entorno.
   * Postgres responde 42883 y PostgREST responde PGRST202 cuando la funcion
   * no esta en su cache de esquema; ambos significan lo mismo aqui.
   */
  function contratoAusente(error) {
    if (!error) return false;
    var codigo = String(error.code || "");
    var texto = String(error.message || "");
    return codigo === "42883" || codigo === "PGRST202" ||
      /does not exist|could not find the function/i.test(texto);
  }

  function desdeRpc(datos) {
    if (!datos || datos.ok !== true || datos.existe !== true) return null;
    return normalizarConfig({
      diseno: datos.diseno,
      paleta: datos.paleta,
      colores: datos.colores,
      revision: datos.revision,
      actualizadoPor: datos.actualizado_por || "",
      actualizadoEn: datos.actualizado_en || "",
      anterior: datos.anterior || null
    });
  }

  /**
   * Lee la apariencia de la empresa. Prefiere el contrato de servidor
   * (abc_apariencia_leer). Si todavia no esta desplegado, cae a la copia de
   * este navegador y lo deja anotado: una configuracion local NO llega a los
   * demas locales ni a las demas sesiones.
   */
  async function leerEmpresa() {
    var sb = clienteNube();
    if (sb && empresaActiva()) {
      try {
        var r = await sb.rpc("abc_apariencia_leer", { p_empresa_id: empresaActiva() });
        if (!r.error) {
          servidor = { disponible: true, puedeAplicar: !!(r.data && r.data.puede_aplicar), motivo: "" };
          return desdeRpc(r.data);
        }
        /* 42883: la funcion no existe todavia en este entorno. */
        servidor = {
          disponible: false,
          puedeAplicar: null,
          motivo: contratoAusente(r.error)
            ? "contrato-no-desplegado"
            : (r.error.code || "error") + ": " + (r.error.message || "")
        };
      } catch (error) {
        servidor = { disponible: false, puedeAplicar: null, motivo: "sin-respuesta" };
      }
    }
    try {
      if (!window.storage || typeof window.storage.get !== "function") return null;
      var fila = await window.storage.get(CLAVE);
      var bruto = fila && fila.value;
      if (typeof bruto === "string") bruto = JSON.parse(bruto);
      return normalizarConfig(bruto);
    } catch (error) {
      return null;
    }
  }

  /**
   * Guarda la apariencia de la empresa contra la revision leida.
   * Devuelve {ok:true, config} o {ok:false, motivo, actual} si otra sesion
   * publico antes. No inventa fecha ni actor: usa los del contexto y deja
   * que el servidor fije la suya cuando el contrato lo permita.
   */
  function traducirErrorRpc(error) {
    var texto = (error && (error.message || "")) + " " + (error && error.details || "");
    if (/apariencia_no_autorizada/.test(texto)) return { ok: false, motivo: "sin-permiso", servidor: true };
    if (/apariencia_revision_obsoleta/.test(texto)) {
      var m = texto.match(/revision_vigente=(\d+)/);
      return { ok: false, motivo: "revision-obsoleta", servidor: true, revisionVigente: m ? Number(m[1]) : null };
    }
    if (/apariencia_diseno_no_registrado|apariencia_colores_invalidos/.test(texto)) {
      return { ok: false, motivo: "configuracion-invalida", servidor: true };
    }
    if (/apariencia_sin_revision_anterior/.test(texto)) return { ok: false, motivo: "sin-revision-anterior", servidor: true };
    return { ok: false, motivo: "no-guardado", servidor: true, detalle: texto.trim() };
  }

  async function guardarEmpresa(entrada, revisionLeida) {
    var config = normalizarConfig(entrada);
    if (!config) return { ok: false, motivo: "configuracion-invalida" };

    var sb = clienteNube();
    if (sb && empresaActiva() && servidor.motivo !== "contrato-no-desplegado") {
      var r = await sb.rpc("abc_apariencia_guardar", {
        p_empresa_id: empresaActiva(),
        p_revision_leida: revisionLeida == null ? null : Number(revisionLeida),
        p_diseno: config.diseno,
        p_paleta: config.paleta,
        p_colores: config.colores
      });
      if (!r.error) {
        servidor.disponible = true;
        var guardadoServidor = desdeRpc(r.data);
        aplicar(guardadoServidor, "empresa");
        return { ok: true, config: guardadoServidor, servidor: true };
      }
      if (!contratoAusente(r.error)) {
        var fallo = traducirErrorRpc(r.error);
        if (fallo.motivo === "revision-obsoleta") fallo.actual = await leerEmpresa();
        return fallo;
      }
      servidor = { disponible: false, puedeAplicar: null, motivo: "contrato-no-desplegado" };
    }

    var actual = await leerEmpresa();
    if (actual && actual.revision !== revisionLeida) {
      return { ok: false, motivo: "revision-obsoleta", actual: actual };
    }
    var siguiente = {
      diseno: config.diseno,
      paleta: config.paleta,
      colores: config.colores,
      revision: (actual ? actual.revision : 0) + 1,
      actualizadoPor: usuarioActivo(),
      actualizadoEn: new Date().toISOString(),
      anterior: actual ? {
        diseno: actual.diseno, paleta: actual.paleta, colores: actual.colores,
        revision: actual.revision, actualizadoPor: actual.actualizadoPor,
        actualizadoEn: actual.actualizadoEn
      } : null
    };
    try {
      await window.storage.set(CLAVE, JSON.stringify(siguiente));
    } catch (error) {
      return { ok: false, motivo: "no-guardado" };
    }
    var guardado = normalizarConfig(siguiente);
    aplicar(guardado, "empresa");
    /* `soloLocal` avisa de que el cambio NO ha salido de este navegador. */
    return { ok: true, config: guardado, servidor: false, soloLocal: true };
  }

  /** Restaurar crea una revision nueva a partir de la anterior y conserva el historial. */
  async function restaurarAnterior(revisionLeida) {
    var actual = null;
    if (revisionLeida === undefined) {
      actual = await leerEmpresa();
      revisionLeida = actual ? actual.revision : null;
    }
    var sb = clienteNube();
    if (sb && empresaActiva() && servidor.motivo !== "contrato-no-desplegado") {
      var r = await sb.rpc("abc_apariencia_restaurar", {
        p_empresa_id: empresaActiva(),
        p_revision_leida: revisionLeida
      });
      if (!r.error) {
        var restaurado = desdeRpc(r.data);
        aplicar(restaurado, "empresa");
        return { ok: true, config: restaurado, servidor: true };
      }
      return traducirErrorRpc(r.error);
    }
    if (!actual) actual = await leerEmpresa();
    if (actual && actual.revision !== revisionLeida) {
      return { ok: false, motivo: "revision-obsoleta", actual: actual };
    }
    if (!actual || !actual.anterior) return { ok: false, motivo: "sin-revision-anterior" };
    return guardarEmpresa(actual.anterior, actual.revision);
  }

  /* ---------------------------------------------------- prueba del usuario */

  function leerPrueba() {
    try {
      var bruto = sessionStorage.getItem(claveSesion());
      return bruto ? normalizarConfig(JSON.parse(bruto)) : null;
    } catch (error) { return null; }
  }

  function iniciarPrueba(entrada) {
    var config = normalizarConfig(entrada);
    if (!config) return false;
    try { sessionStorage.setItem(claveSesion(), JSON.stringify(config)); } catch (e) {}
    return aplicar(config, "prueba");
  }

  async function salirPrueba() {
    try { sessionStorage.removeItem(claveSesion()); } catch (e) {}
    var empresa = await leerEmpresa();
    return aplicar(empresa, empresa ? "empresa" : "base");
  }

  /* La previsualizacion desaparece al salir o al cambiar de empresa. */
  function limpiarPruebasDelNavegador() {
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(CLAVE_PRUEBA) === 0) sessionStorage.removeItem(k);
      }
    } catch (e) {}
  }

  /* --------------------------------------------------- biblioteca personal */

  function leerBiblioteca() {
    try {
      var bruto = localStorage.getItem(CLAVE_BIBLIOTECA + ":" + (empresaActiva() || "sin-empresa"));
      var lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista.filter(function (p) { return p && normalizarColores(p); }) : [];
    } catch (error) { return []; }
  }

  function guardarEnBiblioteca(nombre, colores) {
    var limpio = normalizarColores(colores);
    if (!limpio || !nombre) return { ok: false, motivo: "paleta-invalida" };
    var lista = leerBiblioteca();
    var existente = lista.findIndex(function (p) { return p.nombre === nombre; });
    var entrada = Object.assign({ nombre: String(nombre).slice(0, 60) }, limpio);
    if (existente >= 0) lista[existente] = entrada; else lista.push(entrada);
    try {
      localStorage.setItem(CLAVE_BIBLIOTECA + ":" + (empresaActiva() || "sin-empresa"), JSON.stringify(lista));
    } catch (error) { return { ok: false, motivo: "no-guardado" }; }
    return { ok: true, reemplazada: existente >= 0, lista: lista };
  }

  /**
   * Importa cinco o seis codigos HEX. Con cinco se conserva el valor actual
   * del sexto campo, como exige la especificacion.
   */
  function importarHex(texto, actuales) {
    var encontrados = String(texto || "").match(/#?[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
    var hex = encontrados.map(normalizarHex).filter(Boolean);
    if (hex.length < 5 || hex.length > 6) {
      return { ok: false, motivo: "cantidad-invalida", encontrados: hex.length };
    }
    var base = normalizarColores(actuales) || coloresDe(estado.config) || coloresDe({ diseno: "oliva" });
    var salida = {};
    CAMPOS.forEach(function (campo, i) {
      salida[campo.id] = hex[i] || base[campo.id];
    });
    return { ok: true, colores: salida, conservadoSexto: hex.length === 5 };
  }

  /* Colores efectivos de una configuracion, leidos del CSS ya aplicado. */
  function coloresDe(config) {
    if (config && config.colores) return config.colores;
    if (config && config.paleta) {
      var p = paletaPorId(config.paleta);
      if (p) return { fondo: p.fondo, tarjetas: p.tarjetas, texto: p.texto, enlaces: p.enlaces, boton: p.boton, detalle: p.detalle };
    }
    var previo = raiz.getAttribute("data-la-diseno");
    try {
      if (config && config.diseno) raiz.setAttribute("data-la-diseno", config.diseno);
      var calculado = getComputedStyle(raiz);
      var salida = {
        fondo: normalizarHex(aHex(calculado.getPropertyValue("--c-bg"))) || "#F7F2E8",
        tarjetas: normalizarHex(aHex(calculado.getPropertyValue("--c-surface"))) || "#FFFDF8",
        texto: normalizarHex(aHex(calculado.getPropertyValue("--c-ink"))) || "#1B2420",
        enlaces: normalizarHex(aHex(calculado.getPropertyValue("--c-accent"))) || "#7A5718",
        boton: normalizarHex(aHex(calculado.getPropertyValue("--c-accent-fill"))) || VERDE_MARCA,
        detalle: normalizarHex(aHex(calculado.getPropertyValue("--c-line"))) || "#8F8470"
      };
      return salida;
    } finally {
      if (previo) raiz.setAttribute("data-la-diseno", previo);
      else if (config && config.diseno) raiz.removeAttribute("data-la-diseno");
    }
  }

  function aHex(valor) {
    var v = String(valor || "").trim();
    if (!v) return null;
    if (v[0] === "#") return v;
    var m = v.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return null;
    return "#" + [m[1], m[2], m[3]].map(function (n) {
      return Number(n).toString(16).padStart(2, "0");
    }).join("");
  }

  /* ------------------------------------------------------------- aviso UI */

  var aviso = null;

  function pintarAviso() {
    try {
      if (estado.origen !== "prueba") {
        if (aviso && aviso.parentNode) aviso.parentNode.removeChild(aviso);
        aviso = null;
        return;
      }
      if (aviso) return;
      aviso = document.createElement("div");
      aviso.className = "la-apariencia-aviso";
      aviso.setAttribute("role", "status");
      var texto = document.createElement("span");
      texto.textContent = "Prueba de apariencia activa. Los cambios no estan guardados.";
      var editar = document.createElement("button");
      editar.type = "button";
      editar.textContent = "Editar apariencia";
      editar.addEventListener("click", function () {
        window.dispatchEvent(new CustomEvent("la-apariencia:abrir-editor"));
      });
      var salir = document.createElement("button");
      salir.type = "button";
      salir.className = "secundario";
      salir.textContent = "Salir de la prueba";
      salir.addEventListener("click", function () { salirPrueba(); });
      aviso.appendChild(texto);
      aviso.appendChild(editar);
      aviso.appendChild(salir);
      document.body.prepend(aviso);
    } catch (e) {}
  }

  /* ------------------------------------------------------------- arranque */

  var empresaVigilada = empresaActiva();

  async function resolver() {
    var prueba = leerPrueba();
    if (prueba) return aplicar(prueba, "prueba");
    var empresa = await leerEmpresa();
    return aplicar(empresa, empresa ? "empresa" : "base");
  }

  function vigilarContexto() {
    setInterval(function () {
      var actual = empresaActiva();
      if (actual === empresaVigilada) return;
      empresaVigilada = actual;
      limpiarPruebasDelNavegador();
      resolver();
    }, 1500);
    window.addEventListener("pagehide", limpiarPruebasDelNavegador);
  }

  window.__laApariencia = true;
  window.LAApariencia = {
    DISENOS: DISENOS,
    PALETAS: PALETAS,
    CAMPOS: CAMPOS,
    estado: function () { return { diseno: estado.config ? estado.config.diseno : null, origen: estado.origen, config: estado.config }; },
    aplicar: function (config, origen) { return aplicar(normalizarConfig(config), origen || "empresa"); },
    resolver: resolver,
    leerEmpresa: leerEmpresa,
    estadoServidor: function () { return { disponible: servidor.disponible, puedeAplicar: servidor.puedeAplicar, motivo: servidor.motivo }; },
    guardarEmpresa: guardarEmpresa,
    restaurarAnterior: restaurarAnterior,
    iniciarPrueba: iniciarPrueba,
    salirPrueba: salirPrueba,
    enPrueba: function () { return estado.origen === "prueba"; },
    leerBiblioteca: leerBiblioteca,
    guardarEnBiblioteca: guardarEnBiblioteca,
    importarHex: importarHex,
    coloresDe: coloresDe,
    coloresDePaleta: coloresDePaleta,
    resolverColores: resolverColores,
    ajustarContraste: ajustarContraste,
    revisarContraste: revisarContraste,
    contraste: contraste,
    tintaSobre: tintaSobre,
    normalizarHex: normalizarHex
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { resolver(); vigilarContexto(); });
  } else {
    resolver();
    vigilarContexto();
  }
})();
