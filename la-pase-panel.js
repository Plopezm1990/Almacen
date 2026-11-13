/* ==========================================================================
   L&A Suite - Pase: panel de servicio del turno
   --------------------------------------------------------------------------
   Monta "El turno en directo" encima del panel del programa cuando la empresa
   usa el disenno Pase. Dibuja el plano de sala, la cola del turno y los
   accesos con los DATOS REALES del servidor.

   Lo que este archivo NO hace, a proposito:
   - no abre mesas, no envia comandas, no cobra y no escribe nada;
   - no reimplementa permisos: el plano llega del RPC `abc_listar_mapa_sala`,
     que exige la capacidad ABC_SALA_VER en el servidor, y la navegacion pasa
     por `cambiarTabPM15`, que conserva la guarda de borrador y de permiso;
   - no inventa datos: lo que el servidor no devuelve se muestra como
     desconocido en lugar de rellenarse.

   Depende de `window.__laPuenteRediseno`, publicado por la aplicacion.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__laPasePanel) return;
  window.__laPasePanel = true;

  var ID = "la-pase-panel";
  var REFRESCO_MS = 20000;

  var estado = {
    zonaFiltro: "todas",
    colaFiltro: "todas",
    mesaSeleccionada: null,
    mapa: null,
    mapaError: null,
    comandas: null,
    comandasError: null,
    pedidos: null,
    totalPedidos: null,
    caja: null,
    cargando: false,
    ultimaCarga: 0
  };

  function puente() { return window.__laPuenteRediseno || null; }

  function disenoActivo() {
    return document.documentElement.getAttribute("data-la-diseno") || null;
  }

  function esPanelServicio(diseno) {
    return diseno === "pase" || diseno === "ascua";
  }

  /* ------------------------------------------------------------ utilidades */

  function el(etiqueta, props, hijos) {
    var nodo = document.createElement(etiqueta);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "texto") nodo.textContent = props[k];
      else if (k.indexOf("on") === 0) nodo.addEventListener(k.slice(2), props[k]);
      else if (props[k] != null) nodo.setAttribute(k, props[k]);
    });
    (hijos || []).forEach(function (h) { if (h) nodo.appendChild(h); });
    return nodo;
  }

  var ETIQUETA_ESTADO = {
    LIBRE: "Libre",
    OCUPADA: "Cuenta abierta",
    RESERVADA: "Reservada",
    BLOQUEADA: "Bloqueada",
    FUERA_SERVICIO: "Fuera de servicio"
  };

  function etiquetaEstado(mesa) {
    var e = mesa && mesa.estado_efectivo;
    return ETIQUETA_ESTADO[e] || (e ? String(e) : "Estado desconocido");
  }

  function mesasDe(mapa) {
    var salida = [];
    (mapa && mapa.zonas ? mapa.zonas : []).forEach(function (z) {
      (z.mesas || []).forEach(function (m) {
        salida.push(Object.assign({ __zona: z.nombre || z.codigo || "" }, m));
      });
    });
    return salida;
  }

  /* --------------------------------------------------------------- carga */

  async function cargar(forzar) {
    var p = puente();
    if (!p || p.tabActual !== "dashboard" || !esPanelServicio(disenoActivo())) return;
    var contexto = claveContexto(p);
    actualizarContexto(contexto);
    if (!p.empresaId || !p.localId || estado.cargando) return;
    if (!forzar && Date.now() - estado.ultimaCarga < 4000) return;
    var generacion = generacionContexto;
    estado.cargando = true;
    try {
      if (typeof p.cargarMapaSala === "function") {
        var r = await p.cargarMapaSala();
        if (!esCargaVigente(contexto, generacion)) return;
        if (r && r.ok) { estado.mapa = r; estado.mapaError = null; }
        else { estado.mapa = null; estado.mapaError = r || { error: "No se ha podido cargar la sala." }; }
      }
      if (typeof p.listarPedidosTurno === "function" && p.puedeConsultar?.("cocina")) {
        var resultado = await p.listarPedidosTurno();
        if (!esCargaVigente(contexto, generacion)) return;
        estado.pedidos = resultado && resultado.ok ? resultado.pedidos : null;
        estado.totalPedidos = resultado && resultado.ok ? resultado.total : null;
        estado.comandasError = resultado && resultado.ok ? null : resultado;
      } else if (typeof p.listarComandas === "function") {
        var c = await p.listarComandas(null, 50);
        if (!esCargaVigente(contexto, generacion)) return;
        if (c && c.ok) { estado.comandas = c.comandas || []; estado.comandasError = null; }
        else { estado.comandas = null; estado.comandasError = c || { error: "No se ha podido cargar la cola." }; }
      }
      if (typeof p.consultarCaja === "function" && p.puedeConsultar?.("caja")) {
        var caja = await p.consultarCaja();
        if (!esCargaVigente(contexto, generacion)) return;
        estado.caja = caja && caja.ok ? caja.sessionEstado : null;
      } else {
        estado.caja = null;
      }
    } catch (error) {
      if (esCargaVigente(contexto, generacion)) {
        var fallo = { error: "No se ha podido contactar con el servidor." };
        if (!estado.mapa) estado.mapaError = estado.mapaError || fallo;
        if (!estado.comandas && !estado.pedidos) estado.comandasError = estado.comandasError || fallo;
        estado.caja = null;
      }
    } finally {
      if (generacion === generacionContexto) {
        estado.cargando = false;
        estado.ultimaCarga = Date.now();
        pintar();
      }
    }
  }

  /* -------------------------------------------------------------- bloques */

  function bloqueTurno() {
    var p = puente() || {};
    var mesas = mesasDe(estado.mapa);
    var ocupadas = mesas.filter(function (m) { return m.estado_efectivo === "OCUPADA"; });
    var comandas = Array.isArray(estado.comandas) ? estado.comandas : null;

    var izquierda = el("div", {}, [
      el("span", { class: "la-pase-local", texto: (p.empresaId || "Empresa") + " · " + (p.localId || "Sin local") }),
      (function () {
        var h = el("h2", { class: "la-pase-titulo" });
        h.appendChild(document.createTextNode("El turno"));
        h.appendChild(el("em", { texto: "en directo." }));
        return h;
      })(),
      el("p", { class: "la-pase-entradilla", texto: "Mesas, comandas y acciones del servicio." }),
      bloquePrioridad(ocupadas),
      el("div", { class: "la-pase-cifras" }, [
        el("div", { class: "la-pase-cifra" }, [
          el("div", { class: "n", texto: estado.mapa ? ocupadas.length + " de " + mesas.length : "—" }),
          el("div", { class: "e", texto: "Mesas con cuenta abierta" })
        ]),
        !p.listarPedidosTurno || p.puedeConsultar?.("cocina") ? el("div", { class: "la-pase-cifra" }, [
          el("div", { class: "n", texto: estado.totalPedidos != null ? String(estado.totalPedidos) : comandas ? String(comandas.length) : "—" }),
          el("div", { class: "e", texto: p.listarPedidosTurno ? "Pedidos en servicio" : "Comandas consultadas" })
        ]) : null,
        p.puedeConsultar?.("caja") ? el("div", { class: "la-pase-cifra" }, [
          el("div", { class: "n", texto: etiquetaCaja() }),
          el("div", { class: "e", texto: "Caja del terminal" })
        ]) : null
      ])
    ]);

    return el("section", { class: "la-pase-turno", "aria-label": "El turno en directo" }, [izquierda, bloquePlano()]);
  }

  function etiquetaCaja() {
    return { ABIERTA: "Abierta", EN_CIERRE: "En cierre", CIERRE_PROVISIONAL: "Cierre provisional" }[estado.caja] || "Sin estado confirmado";
  }

  function bloqueAscua() {
    var p = puente();
    var mesas = mesasDe(estado.mapa);
    var abiertas = mesas.filter(function (mesa) { return mesa.estado_efectivo === "OCUPADA"; }).length;
    var puedeCaja = p.puedeConsultar?.("caja");
    var porcentaje = mesas.length ? 100 * abiertas / mesas.length : 0;
    var esfera = el("div", { class: "la-ascua-esfera", "aria-hidden": "true" }, [
      el("div", { class: "la-ascua-anillo", style: "--la-ascua-progreso:" + porcentaje + "%" }),
      el("span", { class: "la-ascua-dato", texto: estado.mapa ? abiertas + " / " + mesas.length : "—" })
    ]);
    return el("section", { class: "la-ascua-turno", "aria-label": "El servicio, al punto" }, [
      el("div", { class: "la-ascua-cab" }, [
        el("p", { class: "la-pase-local", texto: (p.empresaId || "Empresa") + " · " + (p.localId || "Sin local") }),
        el("h2", { texto: "El servicio, al punto." }),
        el("dl", {}, [
          el("div", {}, [el("dt", { texto: "Mesas con cuenta abierta" }), el("dd", { texto: estado.mapa ? abiertas + " de " + mesas.length : "Sin datos confirmados" })]),
          p.puedeConsultar?.("cocina") ? el("div", {}, [el("dt", { texto: p.listarPedidosTurno ? "Pedidos en servicio" : "Comandas mostradas" }),
            el("dd", { texto: estado.totalPedidos != null ? String(estado.totalPedidos) : Array.isArray(estado.comandas) ? String(estado.comandas.length) : "Sin datos confirmados" })]) : null,
          puedeCaja ? el("div", {}, [el("dt", { texto: "Caja del terminal" }), el("dd", { texto: etiquetaCaja() })]) : null
        ]),
        el("div", { class: "la-ascua-acciones" }, [
          botonIrA("venta", "Sala y TPV"),
          botonIrA("cocina", "Cocina"),
          puedeCaja ? botonIrA("caja", "Caja") : null
        ])
      ]),
      esfera
    ]);
  }

  function bloquePrioridad(ocupadas) {
    if (!estado.mapa) return null;
    if (!ocupadas.length) {
      return el("div", { class: "la-pase-prioridad" }, [
        el("div", {}, [
          el("span", { class: "etq", texto: "Sin cuentas abiertas" }),
          el("span", { class: "val", texto: "El turno está despejado" })
        ])
      ]);
    }
    /* La mas antigua por asignacion es la que lleva mas tiempo esperando. */
    var orden = ocupadas.slice().sort(function (a, b) {
      var fa = (a.cuentas && a.cuentas[0] && a.cuentas[0].asignada_desde) || "";
      var fb = (b.cuentas && b.cuentas[0] && b.cuentas[0].asignada_desde) || "";
      return String(fa).localeCompare(String(fb));
    });
    var m = orden[0];
    return el("div", { class: "la-pase-prioridad" }, [
      el("div", {}, [
        el("span", { class: "etq", texto: "Lleva más tiempo abierta" }),
        el("span", { class: "val", texto: (m.nombre || m.codigo || "Mesa") + " · " + (m.__zona || "") })
      ]),
      el("div", { class: "hueco" }),
      botonIrA("venta", "Ver cuenta", "la-pase-accion")
    ]);
  }

  function bloquePlano() {
    var cab = el("div", { class: "la-pase-plano-cab" }, [el("h3", { texto: "Plano de sala" })]);

    if (estado.mapa && estado.mapa.zonas && estado.mapa.zonas.length) {
      var filtros = el("div", { class: "la-pase-filtros", role: "group", "aria-label": "Filtrar el plano por zona" }, [
        el("button", {
          type: "button", "aria-pressed": String(estado.zonaFiltro === "todas"),
          texto: "Todas", onclick: function () { estado.zonaFiltro = "todas"; pintar(); }
        })
      ].concat(estado.mapa.zonas.map(function (z) {
        var id = String(z.zona_id);
        return el("button", {
          type: "button", "aria-pressed": String(estado.zonaFiltro === id),
          texto: z.nombre || z.codigo || "Zona",
          onclick: function () { estado.zonaFiltro = id; pintar(); }
        });
      })));
      cab.appendChild(filtros);
    }

    var cuerpo;
    if (!puente()?.localId) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status", texto: "Selecciona un local para ver sus mesas." });
    } else if (estado.mapaError) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status" }, [
        el("div", { texto: estado.mapaError.error || "No se ha podido cargar la sala." }),
        estado.mapaError.requiereCuenta
          ? el("div", { style: "margin-top:8px" }, [botonIrA("venta", "Abrir TPV", "la-pase-accion")])
          : null
      ]);
    } else if (!estado.mapa) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status", texto: "Cargando la sala…" });
    } else if (!estado.mapa.zonas.length) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status", texto:
        "Este local todavía no tiene zonas ni mesas configuradas. Configúralas desde el TPV si tu cargo lo permite." });
    } else {
      var zonas = estado.mapa.zonas.filter(function (z) {
        return estado.zonaFiltro === "todas" || String(z.zona_id) === estado.zonaFiltro;
      });
      cuerpo = el("div", { class: "la-pase-zonas" }, zonas.map(function (z) {
        var mesas = (z.mesas || []).map(function (m) { return botonMesa(m, z); });
        return el("div", { class: "la-pase-zona" }, [
          el("h4", { texto: z.nombre || z.codigo || "Zona" }),
          mesas.length
            ? el("div", { class: "la-pase-mesas" }, mesas)
            : el("div", { class: "la-pase-aviso", texto: "Esta zona no tiene mesas activas." })
        ]);
      }));
    }

    return el("section", { class: "la-pase-plano" }, [cab, cuerpo, bloqueDetalleMesa()]);
  }

  function botonMesa(m, z) {
    var estadoMesa = m.estado_efectivo || "";
    var inoperable = estadoMesa === "BLOQUEADA" || estadoMesa === "FUERA_SERVICIO";
    var seleccionada = estado.mesaSeleccionada === String(m.mesa_id);
    var etiqueta = (m.nombre || m.codigo || "Mesa") + ", " + (z.nombre || z.codigo || "zona") +
      ", " + etiquetaEstado(m) + ", " + (m.capacidad || 0) + " plazas";
    return el("button", {
      type: "button",
      class: "la-pase-mesa",
      "data-estado": estadoMesa,
      "aria-pressed": String(seleccionada),
      "aria-label": etiqueta,
      "aria-disabled": inoperable ? "true" : null,
      onclick: function () {
        estado.mesaSeleccionada = seleccionada ? null : String(m.mesa_id);
        pintar();
      }
    }, [
      el("span", { texto: m.codigo || m.nombre || "" }),
      el("span", { class: "est", texto: etiquetaEstado(m) })
    ]);
  }

  function bloqueDetalleMesa() {
    if (!estado.mesaSeleccionada || !estado.mapa) return null;
    var mesa = mesasDe(estado.mapa).filter(function (m) {
      return String(m.mesa_id) === estado.mesaSeleccionada;
    })[0];
    if (!mesa) return null;

    var abierta = mesa.estado_efectivo === "OCUPADA";
    var inoperable = mesa.estado_efectivo === "BLOQUEADA" || mesa.estado_efectivo === "FUERA_SERVICIO";
    var detalle = [
      mesa.__zona,
      etiquetaEstado(mesa),
      (mesa.capacidad || 0) + " plazas",
      abierta ? (mesa.ocupacion_comensales || 0) + " comensales" : null,
      mesa.sobre_capacidad ? "por encima de su capacidad" : null,
      mesa.notas || null
    ].filter(Boolean).join(" · ");

    return el("div", { class: "la-pase-detalle", role: "status" }, [
      el("div", { class: "txt" }, [
        el("b", { texto: mesa.nombre || mesa.codigo || "Mesa" }),
        el("span", { texto: detalle })
      ]),
      inoperable
        ? el("span", { class: "txt", texto: "Esta mesa no admite servicio ahora mismo." })
        : botonIrA("venta", abierta ? "Ver cuenta en el TPV" : "Abrir mesa en el TPV", "la-pase-accion")
    ]);
  }

  function bloqueCola() {
    if (typeof puente()?.listarPedidosTurno === "function") return bloquePedidosTurno();
    var cab = el("div", { class: "la-pase-plano-cab" }, [el("h3", { texto: "Cola del turno" })]);
    var cuerpo;

    if (!puente()?.localId) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status", texto: "Selecciona un local para ver sus comandas." });
    } else if (estado.comandasError) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status",
        texto: estado.comandasError.error || "No se ha podido cargar la cola del turno." });
    } else if (!Array.isArray(estado.comandas)) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status", texto: "Cargando la cola…" });
    } else if (!estado.comandas.length) {
      cuerpo = el("div", { class: "la-pase-aviso", role: "status", texto: "No hay comandas en la cola." });
    } else {
      var lista = estado.comandas.filter(function (c) {
        if (estado.colaFiltro === "todas") return true;
        if (estado.colaFiltro === "pendientes") return String(c.estado || "").toUpperCase() === "PENDIENTE";
        return String(c.estado || "").toUpperCase() !== "PENDIENTE";
      });
      var filtros = el("div", { class: "la-pase-filtros", role: "group", "aria-label": "Filtrar la cola" },
        [["todas", "Todas"], ["pendientes", "Pendientes"], ["resto", "Recibidas"]].map(function (f) {
          return el("button", {
            type: "button", "aria-pressed": String(estado.colaFiltro === f[0]), texto: f[1],
            onclick: function () { estado.colaFiltro = f[0]; pintar(); }
          });
        }));
      cab.appendChild(filtros);
      /* La cola del panel es un vistazo, no el listado de cocina: se muestran
         las primeras y se ofrece el paso a Cocina para el resto. */
      var TOPE = 8;
      var sobran = Math.max(0, lista.length - TOPE);
      var visibles = lista.slice(0, TOPE);
      cuerpo = visibles.length
        ? el("ul", { class: "la-pase-cola" }, visibles.map(function (c) {
            var ref = c.pedido_ref || c.pedido_id || c.operation_id || "";
            return el("li", {}, [
              el("div", { class: "q" }, [
                document.createTextNode(c.mesa_nombre || c.mesa_codigo || c.estacion_nombre || "Comanda"),
                el("span", { texto: [c.tipo, String(ref).slice(0, 12)].filter(Boolean).join(" · ") })
              ]),
              el("span", { class: "la-pase-etiqueta", texto: c.estado || "Sin estado" })
            ]);
          }))
        : el("div", { class: "la-pase-aviso", role: "status", texto: "Ninguna comanda con ese filtro." });
      if (sobran > 0) {
        cuerpo = el("div", {}, [
          cuerpo,
          el("div", { class: "la-pase-detalle" }, [
            el("div", { class: "txt" }, [el("span", { texto: "Y " + sobran + " comanda(s) mas en la cola." })]),
            botonIrA("cocina", "Ver toda la cocina", "la-pase-accion suave")
          ])
        ]);
      }
    }
    return el("section", { class: "la-pase-caja" }, [cab, cuerpo]);
  }

  var ESTADO_PEDIDO = {
    PREPARADO: [0, "Listo para servir"],
    PARCIALMENTE_PREPARADO: [1, "Parcialmente listo"],
    EN_PREPARACION: [2, "En preparación"],
    ENVIADO: [3, "Enviado a cocina"],
    SERVIDO: [4, "Cuenta abierta"]
  };

  function bloquePedidosTurno() {
    var p = puente();
    var cab = el("h3", { texto: "Pedidos en servicio" });
    var aviso = !p.localId ? "Selecciona un local para ver sus pedidos."
      : !p.puedeConsultar?.("cocina") ? "Tu cargo no tiene acceso a la cola de Cocina."
      : estado.comandasError ? estado.comandasError.error || "No se han podido cargar los pedidos."
      : !Array.isArray(estado.pedidos) ? "Cargando los pedidos…"
      : estado.pedidos.length === 0 ? "No hay pedidos en servicio." : null;
    if (aviso) return el("section", { class: "la-pase-caja" }, [cab, el("p", { class: "la-pase-aviso", role: "status", texto: aviso })]);
    var filtro = el("div", { class: "la-pase-filtros", role: "group", "aria-label": "Filtrar pedidos en servicio" },
      [["todas", "Todos"], ["cocina", "Cocina"], ["cuentas", "Cuentas"]].map(function (opcion) {
        return el("button", { type: "button", texto: opcion[1], "aria-pressed": String(estado.colaFiltro === opcion[0]),
          onclick: function () { estado.colaFiltro = opcion[0]; pintar(); } });
      }));
    var pedidos = estado.pedidos.filter(function (pedido) {
      return estado.colaFiltro === "todas" || (estado.colaFiltro === "cuentas") === (pedido.estado === "SERVIDO");
    }).sort(function (a, b) {
      return (ESTADO_PEDIDO[a.estado]?.[0] ?? 9) - (ESTADO_PEDIDO[b.estado]?.[0] ?? 9)
        || String(a.created_at).localeCompare(String(b.created_at));
    });
    var nombresMesa = new Map();
    mesasDe(estado.mapa).forEach(function (mesa) {
      (mesa.cuentas || []).forEach(function (cuenta) { nombresMesa.set(cuenta.cuenta_id, mesa.nombre || mesa.codigo); });
    });
    var lista = el("ul", { class: "la-pase-cola" }, pedidos.slice(0, 8).map(function (pedido) {
      return el("li", {}, [
        el("div", { class: "q" }, [
          document.createTextNode(nombresMesa.get(pedido.cuenta_id) || "Pedido"),
          el("span", { texto: String(pedido.id || "").slice(0, 8) })
        ]),
        el("span", { class: "la-pase-etiqueta", texto: ESTADO_PEDIDO[pedido.estado]?.[1] || pedido.estado })
      ]);
    }));
    var parcial = estado.totalPedidos != null && estado.totalPedidos > estado.pedidos.length;
    return el("section", { class: "la-pase-caja" }, [
      cab, filtro, pedidos.length ? lista : el("p", { class: "la-pase-aviso", texto: "Ningún pedido con ese filtro." }),
      parcial ? el("p", { class: "la-pase-aviso", texto: "La muestra del panel contiene " + estado.pedidos.length + " de " + estado.totalPedidos + " pedidos." }) : null,
      botonIrA("cocina", "Ver Cocina", "la-pase-accion suave")
    ]);
  }

  function botonIrA(tab, texto, clase) {
    var p = puente();
    var permitido = !!(p && typeof p.irA === "function" &&
      (typeof p.puedeConsultar !== "function" || p.puedeConsultar(tab)));
    return el("button", {
      type: "button",
      class: clase || "",
      texto: texto,
      disabled: permitido ? null : "disabled",
      title: permitido ? null : "Tu cargo no tiene acceso a esta pantalla.",
      onclick: function () { if (permitido) p.irA(tab); }
    });
  }

  function bloqueAccesos() {
    return el("section", { class: "la-pase-caja" }, [
      el("h3", { texto: "Accesos del turno" }),
      el("div", { class: "la-pase-accesos" }, [
        botonIrA("venta", "Abrir TPV"),
        botonIrA("cocina", "Ver cocina"),
        botonIrA("caja", "Revisar caja"),
        botonIrA("fichaje", "Fichar"),
        botonIrA("albaranes", "Recepciones")
      ])
    ]);
  }

  /* --------------------------------------------------------------- pintar */

  function contenedorDestino() {
    var raiz = document.getElementById("root");
    if (!raiz) return null;
    var main = raiz.querySelector("main") || raiz.firstElementChild;
    return main || raiz;
  }

  function pintar() {
    var p = puente();
    var diseno = disenoActivo();
    var activo = p && p.tabActual === "dashboard" && esPanelServicio(diseno);
    var previo = document.getElementById(ID);

    if (!activo) {
      if (previo && previo.parentNode) previo.parentNode.removeChild(previo);
      return;
    }
    var destino = contenedorDestino();
    if (!destino) return;
    actualizarContexto(claveContexto(p));

    var nodo = el("div", { id: ID, class: diseno === "ascua" ? "la-pase la-ascua" : "la-pase" }, [
      diseno === "ascua" ? bloqueAscua() : bloqueTurno(),
      el("div", { class: "la-pase-abajo" }, [bloqueCola(), bloqueAccesos()])
    ]);

    var focoPrevio = previo && previo.contains(document.activeElement) ? document.activeElement : null;
    var firmaFoco = focoPrevio && focoPrevio.tagName === "BUTTON"
      ? [focoPrevio.parentElement?.className, focoPrevio.getAttribute("aria-label") || focoPrevio.textContent] : null;
    if (previo && previo.parentNode) previo.parentNode.replaceChild(nodo, previo);
    else destino.insertBefore(nodo, destino.firstChild);
    if (firmaFoco) {
      Array.from(nodo.querySelectorAll("button:not([disabled])")).find(function (boton) {
        return boton.parentElement?.className === firmaFoco[0] &&
          (boton.getAttribute("aria-label") || boton.textContent) === firmaFoco[1];
      })?.focus({ preventScroll: true });
    }
  }

  /* ------------------------------------------------------------- arranque */

  var ultimoTab = null;
  var ultimoDiseno = null;
  var ultimoContexto = null;
  var generacionContexto = 0;

  function claveContexto(p) {
    return JSON.stringify(p ? [p.empresaId, p.localId, p.rol, p.modoEmpleado] : []);
  }

  function actualizarContexto(contexto) {
    if (contexto === ultimoContexto) return false;
    ultimoContexto = contexto;
    generacionContexto++;
    estado.zonaFiltro = "todas";
    estado.colaFiltro = "todas";
    estado.mesaSeleccionada = null;
    estado.mapa = null;
    estado.mapaError = null;
    estado.comandas = null;
    estado.comandasError = null;
    estado.pedidos = null;
    estado.totalPedidos = null;
    estado.caja = null;
    estado.cargando = false;
    estado.ultimaCarga = 0;
    return true;
  }

  function esCargaVigente(contexto, generacion) {
    return generacion === generacionContexto && contexto === claveContexto(puente());
  }

  function revisar() {
    var p = puente();
    var cambioContexto = actualizarContexto(claveContexto(p));
    var tab = p ? p.tabActual : null;
    var diseno = disenoActivo();
    if (!cambioContexto && tab === ultimoTab && diseno === ultimoDiseno) {
      if (tab === "dashboard" && esPanelServicio(diseno) && !document.getElementById(ID)) pintar();
      return;
    }
    ultimoTab = tab;
    ultimoDiseno = diseno;
    if (tab === "dashboard" && esPanelServicio(diseno)) { pintar(); cargar(true); }
    else pintar();
  }

  window.addEventListener("la-puente:actualizado", revisar);
  window.addEventListener("la-apariencia:cambio", revisar);
  window.addEventListener("pagehide", function () { actualizarContexto(claveContexto(null)); });
  setInterval(revisar, 1200);
  setInterval(function () {
    var p = puente();
    if (p && p.tabActual === "dashboard" && esPanelServicio(disenoActivo())) cargar(false);
  }, REFRESCO_MS);

  /* Expuesto para las comprobaciones del banco de pruebas. */
  window.LAPasePanel = {
    estado: function () { return estado; },
    cargar: cargar,
    pintar: pintar,
    mesasDe: mesasDe,
    etiquetaEstado: etiquetaEstado
  };
})();
