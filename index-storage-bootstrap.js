  /* ==========================================================
     ALMACENAMIENTO: PRIMERO LOCAL, NUBE OPCIONAL
     ----------------------------------------------------------
     El programa guarda SIEMPRE en el propio dispositivo. Así
     funciona sin internet y en cualquier país, sin depender de
     que un servicio extranjero esté accesible.

     Si además hay nube configurada y se puede llegar a ella, se
     sincroniza en segundo plano para poder trabajar desde varios
     dispositivos. Si la nube falla, se bloquea o no hay conexión,
     el programa sigue funcionando igual: nada se pierde, y lo
     pendiente se sube solo en cuanto vuelva a haber acceso.
     ========================================================== */

  var NUBE_URL = "https://flqercbgpgmmfaakrwkc.supabase.co";
  var NUBE_CLAVE = "sb_publishable_dDpJoqnVG8Axmk2QqCCX1g_4h5keXWJ";
  var ESPERA_NUBE_MS = 6000; // si tarda más que esto, se trabaja en local
  // Expuestas en window para que fuente.jsx (que ahora lleva el SDK de
  // Supabase empaquetado dentro, sin depender de esm.sh) pueda leerlas y
  // conectar por sí mismo — ver conectarNube más abajo.
  window.NUBE_URL = NUBE_URL;
  window.NUBE_CLAVE = NUBE_CLAVE;
  window.ESPERA_NUBE_MS = ESPERA_NUBE_MS;
  if (window.__modoPruebasQA) {
    // Deploy Preview: usar exclusivamente el proyecto Supabase de QA.
    window.NUBE_URL = window.__qaNubeUrl || "";
    window.NUBE_CLAVE = window.__qaNubeClave || "";
  } else if (window.__modoPruebasLocal) {
    // Modo de pruebas sin backend remoto, conservado como salvaguarda.
    window.NUBE_URL = "";
    window.NUBE_CLAVE = "";
  }

  window.__nubeActiva = false;   // ¿se pudo contactar con la nube?
  window.__nubeCliente = null;

  function conTiempoLimite(promesa, ms) {
    return Promise.race([
      promesa,
      new Promise(function (_, rechazar) {
        setTimeout(function () { rechazar(new Error("La nube tarda demasiado en responder")); }, ms);
      })
    ]);
  }

  // --- Guardado en el propio dispositivo (nunca falla, no necesita red) ---
  var LOCAL = {
    get: function (key) {
      var v = localStorage.getItem("almacen:" + key);
      if (v === null) throw new Error("no existe");
      return v;
    },
    set: function (key, value) { localStorage.setItem("almacen:" + key, value); },
    delete: function (key) { localStorage.removeItem("almacen:" + key); },
    list: function () {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("almacen:") === 0) keys.push(k.slice(8));
      }
      return keys;
    }
  };

  // Una clave que todavía no existe es un estado normal de primer arranque.
  // Solo se normaliza ese sentinel exacto; SecurityError/cuota/etc. se propagan.
  function leerLocalOpcional(key) {
    try { return LOCAL.get(key); }
    catch (e) {
      if (e && e.message === "no existe") return null;
      throw e;
    }
  }

  // --- Cola de lo que falta subir a la nube ---
  function pendientes() {
    try { return JSON.parse(localStorage.getItem("almacen__pendientes") || "[]"); }
    catch (e) { return []; }
  }
  function pendientesContexto() {
    try {
      var lista = JSON.parse(localStorage.getItem("almacen__pendientes_contexto") || "[]");
      return Array.isArray(lista) ? lista : [];
    } catch (e) { return []; }
  }
  function contextoPendienteActual() {
    var contexto = typeof contextoKvActual === "function" ? contextoKvActual() : {};
    return { empresaId: contexto.empresaId || null, localId: contexto.localId || null };
  }
  function pendienteEsDelContexto(key) {
    var entradas = pendientesContexto().filter(function (entrada) { return entrada && entrada.key === key; });
    // Las colas antiguas no tenían contexto; se conservan reintentables para
    // no perder una escritura histórica, pero toda escritura nueva queda
    // etiquetada y no puede cruzar empresa/local.
    if (!entradas.length) return true;
    var actual = contextoPendienteActual();
    return entradas.some(function (guardado) { return guardado.empresaId === actual.empresaId && guardado.localId === actual.localId; });
  }
  function entradaPendienteActual(key) {
    var actual = contextoPendienteActual();
    return pendientesContexto().find(function (entrada) {
      return entrada && entrada.key === key && entrada.empresaId === actual.empresaId && entrada.localId === actual.localId;
    }) || null;
  }
  function marcarPendiente(key, valor, cacheKey) {
    var lista = pendientes();
    if (lista.indexOf(key) === -1) {
      lista.push(key);
      localStorage.setItem("almacen__pendientes", JSON.stringify(lista));
    }
    var contexto = contextoPendienteActual();
    var entradas = pendientesContexto().filter(function (entrada) {
      return !(entrada && entrada.key === key && entrada.empresaId === contexto.empresaId && entrada.localId === contexto.localId);
    });
    entradas.push({ key: key, empresaId: contexto.empresaId, localId: contexto.localId, cacheKey: cacheKey || key, valor: valor });
    try { localStorage.setItem("almacen__pendientes_contexto", JSON.stringify(entradas)); } catch (e) {}
    actualizarIndicador();
  }
  function quitarPendiente(key) {
    var contexto = contextoPendienteActual();
    var entradas = pendientesContexto().filter(function (entrada) {
      return !(entrada && entrada.key === key && entrada.empresaId === contexto.empresaId && entrada.localId === contexto.localId);
    });
    var conservaOtra = entradas.some(function (entrada) { return entrada && entrada.key === key; });
    var lista = pendientes().filter(function (k) { return k !== key || conservaOtra; });
    localStorage.setItem("almacen__pendientes", JSON.stringify(lista));
    try { localStorage.setItem("almacen__pendientes_contexto", JSON.stringify(entradas)); } catch (e) {}
    actualizarIndicador();
  }

  /* ----------------------------------------------------------
     CLAVES QUE EL SERVIDOR RECHAZA POR PERMISOS
     ------------------------------------------------------------
     Un fallo de red o de tiempo se arregla reintentando, así que
     la clave queda en la cola de pendientes. Un rechazo por
     permisos (RLS, código 42501) no se arregla reintentando: el
     servidor seguirá diciendo que no hasta que cambien sus reglas.
     Si esa clave se dejara en la cola, el aviso "Subiendo N…" no
     desaparecería nunca y cada carga repetiría la misma subida
     rechazada.

     Por eso, ante un rechazo por permisos la clave se anota aparte
     (almacen__denegados): sigue guardándose y leyéndose en este
     equipo, deja de reintentarse durante unas horas y el aviso lo
     dice con claridad en lugar de aparentar que está subiendo.
     Pasado el plazo se vuelve a intentar una vez, por si las
     reglas del servidor han cambiado. En cuanto una subida
     funciona, la marca se retira. Mientras la marca exista, la
     clave se lee de este equipo y no de la nube, igual que las
     pendientes: así una copia antigua de la nube no pisa lo que
     aquí no se ha podido subir.

     No depende de qué claves sean: si el servidor las acepta
     (como hace producción hoy), nada de esto se activa.
     ---------------------------------------------------------- */
  var VIGENCIA_DENEGADO_MS = 6 * 60 * 60 * 1000;
  function denegados() {
    try {
      var o = JSON.parse(localStorage.getItem("almacen__denegados") || "{}");
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (e) { return {}; }
  }
  function tieneMarcaDenegado(key) {
    return Object.prototype.hasOwnProperty.call(denegados(), key);
  }
  function denegadoVigente(key) {
    var t = denegados()[key];
    return typeof t === "number" && (Date.now() - t) < VIGENCIA_DENEGADO_MS;
  }
  function clavesDenegadasVigentes() {
    return Object.keys(denegados()).filter(function (k) { return denegadoVigente(k); });
  }
  function quitarDenegado(key) {
    var o = denegados();
    if (!Object.prototype.hasOwnProperty.call(o, key)) return;
    delete o[key];
    try { localStorage.setItem("almacen__denegados", JSON.stringify(o)); } catch (e) {}
    actualizarIndicador();
  }
  function estadoHttpDelError(e) {
    var candidatos = [e, e && e.cause, e && e.originalError, e && e.response];
    for (var i = 0; i < candidatos.length; i++) {
      var candidato = candidatos[i];
      if (!candidato) continue;
      var estado = Number(candidato.status || candidato.statusCode || candidato.httpStatus);
      if (isFinite(estado) && estado > 0) return estado;
    }
    return 0;
  }
  function esRechazoPorPermisos(e) {
    if (!e) return false;
    var estado = estadoHttpDelError(e);
    if (estado === 401 || estado === 403) return true;
    var codigo = String(e.code || e.error_code || e.errorCode || "").toLowerCase();
    if (codigo === "42501" || codigo === "401" || codigo === "403") return true;
    var texto = [e.message, e.details, e.hint, e.error_description]
      .filter(function (parte) { return parte != null; })
      .join(" ");
    return /row-level security|permission denied|unauthorized|not authorized|forbidden/i.test(texto);
  }
  function esRechazoPorCuota(e) {
    if (!e) return false;
    var texto = String((e && (e.message || e.details || e.hint)) || e);
    return /(?:payload|upload|request|value).*(?:exceed|exceeds|too large|quota|limit)|(?:quota|limit|too large).*(?:exceed|payload|upload|value)/i.test(texto);
  }
  function esTiempoAgotadoNube(e) {
    if (!e) return false;
    return /(?:nube|servidor).*(?:tarda demasiado|timeout|timed out)|(?:timeout|timed out)/i.test(
      String((e && (e.message || e.details || e.hint)) || e)
    );
  }
  function esPreviewQa() {
    return typeof location !== "undefined" && /^deploy-preview-\d+--/i.test(String(location.hostname || ""));
  }
  function esRechazoSoloLocal(key, e) {
    // Las copias automáticas no son un dato operativo ni tienen una ruta
    // autoritativa propia. En QA, donde la autoridad puede devolver 401 o
    // rechazar su payload por tamaño, se conservan localmente para no bloquear
    // los datos operativos. Producción conserva el comportamiento normal.
    var respaldoSoloLocalQa = key === "historialRespaldos" && esPreviewQa();
    // Los movimientos operativos sí tienen una ruta autoritativa en QA. Solo
    // se conservan localmente cuando el error aporta una causa verificable
    // (permisos o cuota); un timeout/transporte debe quedar pendiente para
    // poder reintentarse y mostrar el fallo real al usuario.
    return esRechazoPorPermisos(e) || esRechazoPorCuota(e) || respaldoSoloLocalQa;
  }
  function marcarDenegado(key, error) {
    var yaVigente = denegadoVigente(key);
    var o = denegados();
    o[key] = Date.now();
    try { localStorage.setItem("almacen__denegados", JSON.stringify(o)); } catch (e) {}
    quitarPendiente(key);
    if (!yaVigente) {
      var porCuota = esRechazoPorCuota(error);
      var porQa = key === "historialRespaldos" && esPreviewQa();
      var mensaje = porCuota
        ? "Guardado en este equipo; el respaldo supera el límite de carga del servidor. Puedes reintentarlo ahora después de reducirlo."
        : porQa
          ? "Guardado en este equipo; el respaldo automático de QA no se sube a la nube y no bloquea los datos operativos."
        : "Guardado en este equipo; el servidor no permite confirmar este cambio. Puedes reintentarlo ahora.";
      var motivo = porCuota ? "cuota" : porQa ? "respaldo-qa-solo-local" : "permisos";
      try {
        console.warn("[almacén] «" + key + "» se conserva solo en este equipo porque el servidor no pudo aceptarlo.", error && error.message);
      } catch (e) {}
      try {
        if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("clave-solo-local", { detail: { key: key, motivo: motivo, mensaje: error && error.message } }));
          window.dispatchEvent(new CustomEvent("fallo-guardado", { detail: {
            key: key,
            soloLocal: true,
            motivo: motivo,
            mensaje: mensaje
          } }));
        }
      } catch (e) {}
    }
  }
  window.__clavesSoloLocal = clavesDenegadasVigentes;

  /* ----------------------------------------------------------
     REGISTRO DE BORRADOS DE ESTE DISPOSITIVO
     ------------------------------------------------------------
     Antes, para saber qué borrar en la nube se comparaba la lista
     de este equipo contra la de la nube: lo que no estuviera aquí,
     se borraba allí. Eso da por hecho que este equipo tiene el
     histórico completo, y no siempre es verdad — si el móvil ha
     apuntado ventas mientras el ordenador estaba abierto, el
     ordenador no las tiene, y al guardar las borraba de la nube.

     Ahora se anota explícitamente lo que ESTE equipo ha quitado.
     Solo se borra eso. Lo que este equipo nunca llegó a ver, no
     se toca: si el otro dispositivo lo añadió, ahí sigue.
     ---------------------------------------------------------- */
  // La auditoría solo crece: nunca se borra nada desde el programa. Además,
  // en el equipo se conservan únicamente los 500 apuntes más recientes, así
  // que "lo que ya no está en local" NO significa "borrado" — significa
  // "más antiguo de 500". Si se tratara como borrado, cada apunte nuevo
  // iría eliminando el histórico de la nube. Por eso se excluye.
  var NUNCA_BORRAR = { auditoria: true };

  function borradosDe(key) {
    if (NUNCA_BORRAR[key]) return [];
    try { return JSON.parse(localStorage.getItem("almacen__borrados:" + key) || "[]"); }
    catch (e) { return []; }
  }
  function guardarBorrados(key, ids) {
    try { localStorage.setItem("almacen__borrados:" + key, JSON.stringify(ids)); }
    catch (e) { /* si no cabe, se reintenta en el próximo guardado */ }
  }
  // Compara lo que había guardado en este equipo con lo que se va a guardar
  // ahora, y apunta los identificadores que han desaparecido.
  function anotarBorradosLocales(key, textoAnterior, textoNuevo) {
    if (NUNCA_BORRAR[key]) return;
    var antes, ahora;
    try { antes = JSON.parse(textoAnterior || "[]"); } catch (e) { return; }
    try { ahora = JSON.parse(textoNuevo || "[]"); } catch (e) { return; }
    if (!Array.isArray(antes) || !Array.isArray(ahora)) return;
    var vivos = {};
    ahora.forEach(function (x) { if (x && x.id) vivos[x.id] = true; });
    var lista = borradosDe(key);
    var cambia = false;
    antes.forEach(function (x) {
      if (x && x.id && !vivos[x.id] && lista.indexOf(x.id) === -1) { lista.push(x.id); cambia = true; }
    });
    if (cambia) guardarBorrados(key, lista);
  }

  // --- Aviso discreto del estado (sin molestar) ---
  function actualizarIndicador() {
    var el = document.getElementById("estado-guardado");
    if (!el) {
      el = document.createElement("div");
      el.id = "estado-guardado";
      el.style.cssText = "position:fixed;bottom:8px;right:8px;padding:5px 11px;border-radius:14px;font-family:sans-serif;font-size:11px;z-index:9998;pointer-events:none;opacity:0.9;";
      document.body.appendChild(el);
    }
    var sinSubir = pendientes().length;
    var soloLocal = clavesDenegadasVigentes().length;
    if (window.__nubeActiva && sinSubir === 0 && soloLocal === 0) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    if (!window.__nubeActiva) {
      el.style.background = "#4B5A54";
      el.style.color = "#fff";
      el.textContent = sinSubir > 0
        ? "Guardado en este equipo · " + sinSubir + " sin subir"
        : "Guardado en este equipo";
    } else if (sinSubir > 0) {
      el.style.background = "#B08228";
      el.style.color = "#fff";
      el.textContent = "Subiendo " + sinSubir + "…" +
        (soloLocal > 0 ? " · " + soloLocal + " solo en este equipo" : "");
    } else {
      el.style.background = "#4B5A54";
      el.style.color = "#fff";
      el.textContent = soloLocal === 1
        ? "1 colección solo en este equipo (el servidor no permite guardarla)"
        : soloLocal + " colecciones solo en este equipo (el servidor no permite guardarlas)";
    }
  }
  window.actualizarIndicador = actualizarIndicador;

  // conectarNube y getSupabaseClient ahora viven en fuente.jsx (que lleva
  // el SDK de Supabase empaquetado dentro) — antes vivían aquí, importando
  // el SDK dinámicamente desde esm.sh en cada conexión. Esta es la
  // corrección de un fallo real encontrado el 26 de agosto de 2026:
  // "window.getSupabaseClient" se llamaba desde fuente.jsx pero nunca se
  // había definido en ningún sitio — el camino atómico de venta (con
  // bloqueo de fila real en la base de datos) nunca se había ejecutado en
  // producción, aunque el programa seguía funcionando por el camino local.

  // --- Subir a la nube lo que quedó pendiente ---
  window.subirPendientes = async function () {
    // Tras un reset, ninguna cola local puede llegar al servidor hasta que la
    // sesión haya validado la generación autoritativa de la instalación.
    // El valor solo lo habilita __prepararSesionPostReset() después de limpiar
    // una copia anterior o confirmar que pertenece a la generación vigente.
    if (window.__instalacionSyncPermitida !== true) return;
    if (!window.__nubeActiva || !window.__nubeCliente) return;
    var lista = pendientes();
    for (var i = 0; i < lista.length; i++) {
      var key = lista[i];
      if (esClaveSoloDispositivo(key)) {
        quitarPendiente(key);
        quitarDenegado(key);
        continue;
      }
      if (!pendienteEsDelContexto(key)) continue;
      var entrada = entradaPendienteActual(key);
      // El servidor rechazó esta clave por permisos hace poco: reintentar solo
      // repetiría la misma subida rechazada. Se retira de la cola.
      if (denegadoVigente(key)) { quitarPendiente(key); continue; }
      try {
        var cacheKey = entrada && entrada.cacheKey ? entrada.cacheKey : await claveCacheLocal(key);
        var valor = entrada && entrada.valor !== void 0 ? entrada.valor : LOCAL.get(cacheKey);
        var tablaEmpresa = TABLAS_EMPRESA[key];
        var tablaEmpresaLocal = TABLAS_EMPRESA_LOCAL[key];
        var tablaEspecial = TABLAS_POR_FILA[key];
        if (LEDGERS_RPC[key]) {
          quitarPendiente(key);
          continue;
        } else if (tablaEmpresa) {
          await encolarPorClave(key, function () { return sincronizarColeccionEmpresa(tablaEmpresa, JSON.parse(valor)); });
        } else if (tablaEmpresaLocal) {
          await encolarPorClave(key, function () { return sincronizarColeccionEmpresaLocal(tablaEmpresaLocal, JSON.parse(valor), key); });
        } else if (tablaEspecial) {
          await encolarPorClave(key, function () { return sincronizarColeccionPorFila(tablaEspecial, JSON.parse(valor), key); });
        } else {
          // Sin referencia de "lo que había antes" no se puede saber qué quitó
          // este equipo, así que no se borra nada: solo se añade y se corrige.
          await encolarKv(key, function () {
            return conTiempoLimite(encolarPorClave(key, function () { return guardarBloque(key, null, valor); }), ESPERA_NUBE_MS);
          });
        }
        quitarPendiente(key);
        quitarDenegado(key);
      } catch (e) {
        // Rechazo por permisos o por tamaño: no se arregla reintentando
        // automáticamente (ver arriba). Cualquier otro fallo (red, tiempo)
        // se reintenta la próxima vez.
        if (esRechazoSoloLocal(key, e)) marcarDenegado(key, e);
      }
    }
    actualizarIndicador();
  };

  // Permite recuperar un navegador que quedó marcado como solo local sin
  // esperar seis horas: vuelve a encolar el valor local y usa el mismo camino
  // de sincronización que un guardado normal.
  window.reintentarSincronizacion = async function (key) {
    var claves = key ? [key] : clavesDenegadasVigentes();
    for (var i = 0; i < claves.length; i++) {
      var clave = claves[i];
      quitarDenegado(clave);
      try {
        var cacheKey = await claveCacheLocal(clave);
        var valor = LOCAL.get(cacheKey);
        marcarPendiente(clave, valor, cacheKey);
      } catch (e) {
        console.warn("[almacén] No se pudo preparar el reintento de «" + clave + "».", e && e.message);
      }
    }
    await window.subirPendientes();
    // El reintento se ejecuta fuera de saveKey(), por lo que no pasa por el
    // camino que emite `guardado-confirmado`. Si la sincronización terminó y
    // la clave no quedó pendiente ni marcada como solo local, notificarlo es
    // necesario para que la interfaz retire el aviso rojo persistente.
    if (typeof window.dispatchEvent === "function") {
      for (var j = 0; j < claves.length; j++) {
        var claveConfirmada = claves[j];
        if (pendientes().indexOf(claveConfirmada) === -1 && !denegadoVigente(claveConfirmada)) {
          window.dispatchEvent(new CustomEvent("guardado-confirmado", { detail: { key: claveConfirmada, reintento: true } }));
        }
      }
    }
    actualizarIndicador();
  };

  /* ----------------------------------------------------------
     MOVIMIENTOS, FICHAJES Y AUDITORÍA: una fila por registro
     ------------------------------------------------------------
     Estas tres colecciones crecen sin parar (cada venta, cada
     fichaje, cada acción registrada) — guardarlas como un bloque
     único significaba reescribir el historial entero en cada
     guardado. Aquí cada registro es su propia fila: se añade o
     se corrige solo lo que cambió, nunca todo.

     El resto de colecciones (productos, proveedores, clientes...)
     siguen exactamente igual que antes — son pequeñas y cambian
     poco, así que no ganan nada con este cambio y no se tocan.
     ---------------------------------------------------------- */
  var TABLAS_POR_FILA = {
    movimientos: "movimientos_registro",
    fichajes: "fichajes_registro",
    auditoria: "auditoria_registro",
  };
  // PM-05: proveedores y clientes dejan de compartir un bloque global.
  // Cada registro conserva empresa_id en una tabla con RLS real.
  var TABLAS_EMPRESA = {
    proveedores: "proveedores_empresa",
    clientes: "clientes_empresa",
  };
  // PM-06: documentos financieros con empresa/local explícitos y RLS.
  var TABLAS_EMPRESA_LOCAL = {
    albaranes: "albaranes_empresa",
    facturasDirectas: "facturas_directas_empresa",
    gastosGenerales: "gastos_empresa",
  };
  // PM-06/PM-08: estos historiales críticos son ledgers del servidor. React
  // mantiene una caché local para pintar sin saltos, pero cada alta, reverso o
  // anulación se escribe exclusivamente mediante una RPC transaccional. Nunca
  // deben duplicarse como bloques editables en almacen_kv.
  var LEDGERS_RPC = {
    pagosFacturas: true,
    arqueos: true,
    movimientosCaja: true,
    devoluciones: true,
  };
  var CLAVES_CACHE_POR_USUARIO = {
    proveedores: true, clientes: true, auditoria: true,
    albaranes: true, facturasDirectas: true, gastosGenerales: true, pagosFacturas: true,
    arqueos: true, movimientosCaja: true, devoluciones: true
  };
  // Preferencias de interfaz del dispositivo. No contienen datos de negocio
  // ni deben viajar a Supabase: sincronizarlas provoca avisos al cambiar de
  // usuario en una sesión abierta, aunque el cambio local se haya guardado.
  var CLAVES_SOLO_DISPOSITIVO = {
    modoEmpleado: true,
    usuarioActivoId: true
  };
  function esClaveSoloDispositivo(key) {
    return !!CLAVES_SOLO_DISPOSITIVO[key];
  }

  async function claveCacheLocal(key) {
    if (!CLAVES_CACHE_POR_USUARIO[key] || !window.__nubeCliente) return key;
    try {
      var ses = await window.__nubeCliente.auth.getSession();
      var uid = ses && ses.data && ses.data.session && ses.data.session.user && ses.data.session.user.id;
      if (uid) return key + "::usuario:" + uid;
    } catch (e) {}
    return key + "::sin-sesion";
  }

  async function leerColeccionEmpresa(tabla) {
    var r = await window.__nubeCliente.from(tabla).select("id,empresa_id,datos").order("updated_at", { ascending: true });
    if (r.error) throw r.error;
    return (r.data || []).map(function (fila) {
      var d = fila.datos || {};
      if (!d.empresaId) d = Object.assign({}, d, { empresaId: fila.empresa_id });
      return d;
    });
  }

  async function sincronizarColeccionEmpresa(tabla, listaLocal) {
    if (!Array.isArray(listaLocal)) throw new Error("La colección empresarial debe ser una lista");
    var invalidos = listaLocal.filter(function (x) { return !x || !x.id || !x.empresaId; });
    if (invalidos.length) throw new Error("Hay registros sin id/empresaId; se bloquea la sincronización para evitar mezcla entre empresas");
    var rLee = await window.__nubeCliente.from(tabla).select("id,empresa_id,datos");
    if (rLee.error) throw rLee.error;
    var remotos = rLee.data || [];
    var porId = {}; remotos.forEach(function (r) { porId[r.id] = r; });
    var filas = listaLocal.map(function (x) { return { id: x.id, empresa_id: x.empresaId, datos: x, updated_at: new Date().toISOString() }; });
    if (filas.length) {
      var rUp = await window.__nubeCliente.from(tabla).upsert(filas);
      if (rUp.error) throw rUp.error;
    }
    var vivos = {}; listaLocal.forEach(function (x) { vivos[x.id]=true; });
    var borrar = remotos.filter(function (r) { return !vivos[r.id]; }).map(function (r) { return r.id; });
    if (borrar.length) {
      var rDel = await window.__nubeCliente.from(tabla).delete().in("id", borrar);
      if (rDel.error) throw rDel.error;
    }
  }


  async function leerColeccionEmpresaLocal(tabla) {
    var r = await window.__nubeCliente.from(tabla).select("id,empresa_id,local_id,datos").order("updated_at", { ascending: true });
    if (r.error) throw r.error;
    return (r.data || []).map(function (fila) {
      var d = fila.datos || {};
      return Object.assign({}, d, {
        id: d.id || fila.id,
        empresaId: d.empresaId || fila.empresa_id,
        localId: d.localId || fila.local_id
      });
    });
  }

  async function sincronizarColeccionEmpresaLocal(tabla, listaLocal, key) {
    if (!Array.isArray(listaLocal)) throw new Error("La colección financiera debe ser una lista");
    var invalidos = listaLocal.filter(function (x) { return !x || !x.id || !x.empresaId || !x.localId; });
    if (invalidos.length) throw new Error("Hay documentos sin id/empresaId/localId; se bloquea la sincronización financiera");
    var rLee = await window.__nubeCliente.from(tabla).select("id,empresa_id,local_id,datos");
    if (rLee.error) throw rLee.error;
    var remotos = rLee.data || [];
    var filas = listaLocal.map(function (x) {
      var f = { id: x.id, empresa_id: x.empresaId, local_id: x.localId, datos: x, updated_at: new Date().toISOString() };
      if (tabla === "albaranes_empresa" || tabla === "facturas_directas_empresa") f.proveedor_id = x.proveedorId || null;
      if (tabla === "gastos_empresa") f.factura_directa_id = x.facturaDirectaId || null;
      return f;
    });
    if (filas.length) {
      var rUp = await window.__nubeCliente.from(tabla).upsert(filas);
      if (rUp.error) throw rUp.error;
    }
    // Una factura directa confirmada no se borra físicamente: se anula en su propio registro.
    if (key !== "facturasDirectas") {
      var vivos = {}; listaLocal.forEach(function (x) { vivos[x.id] = true; });
      var borrar = remotos.filter(function (r) { return !vivos[r.id]; }).map(function (r) { return r.id; });
      if (borrar.length) {
        var rDel = await window.__nubeCliente.from(tabla).delete().in("id", borrar);
        if (rDel.error) throw rDel.error;
      }
    }
  }

  async function leerPagosFactura() {
    var r = await window.__nubeCliente.from("pagos_factura")
      .select("id,operation_id,factura_id,origen_factura,empresa_id,local_id,importe,fecha,estado,revierte_pago_id,medio_pago,datos,actor_user_id,created_at")
      .order("created_at", { ascending: true });
    if (r.error) throw r.error;
    return (r.data || []).map(function (p) {
      return {
        id: p.id, operationId: p.operation_id, facturaId: p.factura_id, origenFactura: p.origen_factura,
        empresaId: p.empresa_id, localId: p.local_id, importe: Number(p.importe) || 0, fecha: p.fecha,
        estado: p.estado, reviertePagoId: p.revierte_pago_id || null, medioPago: p.medio_pago || "",
        datos: p.datos || {}, actorUserId: p.actor_user_id || null, createdAt: p.created_at || null
      };
    });
  }
  var LIMITE_LECTURA = { auditoria: 500 }; // truncamiento DELIBERADO: la auditoría solo se consulta, no alimenta cálculos
  var PAGINA_LECTURA = 1000; // tamaño de página de PostgREST

  // PostgREST devuelve como máximo 1000 filas por consulta y NO avisa de que
  // ha cortado: simplemente llegan menos datos. Como movimientos y fichajes
  // alimentan cálculos que necesitan el histórico completo (coste, margen,
  // saldos, ABC, rotación), un corte silencioso daría cifras incorrectas sin
  // ninguna señal de error. Por eso se pide por páginas hasta agotar la tabla.
  //
  // LIMITACIÓN CONOCIDA: esto elimina el límite artificial de PostgREST, pero
  // los cálculos siguen ejecutándose en el navegador sobre la lista completa
  // en memoria. Existe por tanto un límite práctico del dispositivo (memoria
  // y tiempo), no de la consulta. Para volúmenes muy grandes haría falta mover
  // las agregaciones al servidor, que es un rediseño de arquitectura, no un
  // ajuste de esta función.
  async function leerColeccionPorFila(tabla, key) {
    if (LIMITE_LECTURA[key]) {
      var rLim = await window.__nubeCliente.from(tabla).select("datos")
        .order("creado_en", { ascending: false }).limit(LIMITE_LECTURA[key]);
      if (rLim.error) throw rLim.error;
      return (rLim.data || []).map(function (fila) { return fila.datos; });
    }
    var todas = [];
    var desde = 0;
    for (;;) {
      var r = await window.__nubeCliente.from(tabla).select("datos")
        .order("creado_en", { ascending: false })
        .range(desde, desde + PAGINA_LECTURA - 1);
      if (r.error) throw r.error;
      var lote = r.data || [];
      todas = todas.concat(lote.map(function (fila) { return fila.datos; }));
      // Última página: ha venido incompleta, así que ya no queda nada más.
      if (lote.length < PAGINA_LECTURA) break;
      desde += PAGINA_LECTURA;
    }
    return todas;
  }

  // Lee la tabla entera POR PÁGINAS. Antes esta consulta no paginaba, y
  // PostgREST devuelve como mucho 1000 filas sin avisar: a partir del
  // movimiento 1001 el programa creía que la nube estaba medio vacía, así
  // que resubía miles de filas en cada guardado (lento, y se pasaba del
  // tiempo límite) y daba por inexistente lo que sí estaba.
  async function leerFilasCompletas(tabla) {
    var todas = [];
    var desde = 0;
    for (;;) {
      var r = await window.__nubeCliente.from(tabla).select("id, datos")
        .order("creado_en", { ascending: false })
        .range(desde, desde + PAGINA_LECTURA - 1);
      if (r.error) throw r.error;
      var lote = r.data || [];
      todas = todas.concat(lote);
      if (lote.length < PAGINA_LECTURA) break;
      desde += PAGINA_LECTURA;
    }
    return todas;
  }

  // Las filas que llegan de los servicios de stock llevan marcas de control
  // locales. No forman parte del contenido del movimiento y no deben hacer
  // que una fila ya confirmada parezca nueva en cada guardado.
  var CAMPOS_SINCRONIZACION_SOLO_LOCAL = {
    _pm07Servidor: true,
    _pm07BajoMinimo: true,
    _pm07LocalOperable: true,
    _pm08Servidor: true,
    _pm12Servidor: true,
  };
  function contenidoSinMarcasLocales(valor) {
    if (Array.isArray(valor)) return valor.map(contenidoSinMarcasLocales);
    if (!valor || typeof valor !== "object") return valor;
    var salida = {};
    Object.keys(valor).sort().forEach(function (clave) {
      if (CAMPOS_SINCRONIZACION_SOLO_LOCAL[clave]) return;
      salida[clave] = contenidoSinMarcasLocales(valor[clave]);
    });
    return salida;
  }
  function contenidoFilaIgual(a, b) {
    return JSON.stringify(contenidoSinMarcasLocales(a)) === JSON.stringify(contenidoSinMarcasLocales(b));
  }
  function datosFilaParaServidor(valor, claveColeccion) {
    if (!valor || typeof valor !== "object") return valor;
    // Las aperturas que instala el fixture de QA no son operaciones del
    // negocio: no tienen empresa/local ni una RPC autoritativa detrás. Si se
    // intentan subir como movimientos heredados, la política de plataforma
    // las rechaza y deja la colección atascada en «Subiendo…». Se conservan
    // en este navegador para las pruebas, pero no se envían a la tabla
    // operativa. El filtro queda limitado al marcador explícito del fixture
    // y a previews QA; nunca afecta a movimientos reales ni a producción.
    if (claveColeccion === "movimientos" && esPreviewQa() && String(valor.tipo || "").toUpperCase() === "APERTURA_FIXTURE") return null;
    // Las mermas sintéticas de las pruebas AUD llevan un motivo QA explícito
    // y no representan una operación pendiente que deba replicarse. Se dejan
    // en el almacenamiento local para conservar la evidencia de QA, pero se
    // excluyen de la tabla heredada cuando el registro no trae empresa propia.
    if (claveColeccion === "movimientos" && esPreviewQa()
      && String(valor.tipo || "").toUpperCase() === "MERMA"
      && !valor.empresaId
      && /^Merma\s*·\s*QA[-_]/i.test(String(valor.motivo || ""))) return null;
    // Estos movimientos ya viven en movimientos_stock y solo se hidratan en
    // la colección local como referencia autoritativa. No se duplican en la
    // tabla histórica heredada movimientos_registro.
    if (claveColeccion === "movimientos" && valor._pm07Servidor) return null;
    return contenidoSinMarcasLocales(valor);
  }

  // Sube a la nube lo que ha cambiado en este equipo, y borra únicamente lo
  // que este equipo ha quitado a propósito (una venta anulada, un albarán
  // anulado). Lo que no conoce, no lo toca: puede venir del otro dispositivo.
  async function sincronizarColeccionPorFila(tabla, listaLocal, claveColeccion) {
    // Filtra antes de leer la tabla remota. En QA puede haber una colección
    // pendiente compuesta únicamente por referencias locales o fixtures; en
    // ese caso no hay nada que subir y una lectura de autoridad 401 no debe
    // mantener artificialmente la cola abierta.
    var filasSubibles = (listaLocal || []).filter(function (x) {
      if (!x || !x.id) return false;
      return datosFilaParaServidor(x, claveColeccion) !== null;
    });
    if (!filasSubibles.length) return;
    var filasRemotas = await leerFilasCompletas(tabla);
    var remotoPorId = {};
    filasRemotas.forEach(function (fila) { remotoPorId[fila.id] = fila.datos; });

    var filasParaGuardar = [];
    filasSubibles.forEach(function (x) {
      var datosServidor = datosFilaParaServidor(x, claveColeccion);
      if (datosServidor === null) return;
      var enNube = remotoPorId[x.id];
      if (!enNube || !contenidoFilaIgual(enNube, datosServidor)) {
        var filaParaGuardar = {
          id: x.id,
          fecha: datosServidor.fecha || new Date().toISOString().slice(0, 10),
          datos: datosServidor,
        };
        // La política de movimientos no lee empresa/local desde el JSON:
        // RLS evalúa las columnas de alcance de la fila. Mantenerlas también
        // en el sobre de Supabase evita que una merma válida, aunque lleve
        // empresaId/localId dentro de `datos`, se rechace como fila sin
        // contexto. El JSON se conserva completo para la comparación
        // canónica y la reconstrucción de la interfaz.
        if (tabla === "movimientos_registro") {
          filaParaGuardar.empresa_id = datosServidor.empresaId || null;
          filaParaGuardar.local_id = datosServidor.localId || null;
        }
        filasParaGuardar.push(filaParaGuardar);
      }
    });

    // Solo se borra lo que este equipo apuntó como borrado, y solo si de
    // verdad sigue estando en la nube.
    var apuntados = claveColeccion ? borradosDe(claveColeccion) : [];
    var idsParaBorrar = apuntados.filter(function (id) {
      return Object.prototype.hasOwnProperty.call(remotoPorId, id);
    });

    var primerError = null;
    if (filasParaGuardar.length > 0) {
      if (tabla === "auditoria_registro") {
        // auditoria_registro no admite escritura directa a propósito — cada
        // fila nueva tiene que pasar por la RPC controlada, una por una,
        // para que ninguna entrada pueda fabricarse sin pasar por ahí.
        for (var i = 0; i < filasParaGuardar.length; i++) {
          try {
            var d = filasParaGuardar[i].datos;
            var rRpc = await window.__nubeCliente.rpc("registrar_auditoria", {
              p_id: d.id, p_usuario: d.usuario, p_accion: d.accion, p_detalle: d.detalle,
              p_fecha: d.fecha, p_hora: d.hora, p_empresa_id: d.empresaId || null, p_local_id: d.localId || null,
            });
            if (rRpc.error) throw rRpc.error;
          } catch (e) {
            if (!primerError) primerError = e;
          }
        }
      } else {
        // Una fila fallida no puede impedir que las demás lleguen. En el
        // siguiente intento, las ya confirmadas desaparecerán de la lista
        // gracias a la comparación canónica anterior.
        for (var j = 0; j < filasParaGuardar.length; j++) {
          try {
            var rUp = await window.__nubeCliente.from(tabla).upsert([filasParaGuardar[j]]);
            if (rUp.error) throw rUp.error;
          } catch (e2) {
            if (!primerError) primerError = e2;
          }
        }
      }
    }
    if (primerError) throw primerError;
    if (idsParaBorrar.length > 0) {
      var rDel = await window.__nubeCliente.from(tabla).delete().in("id", idsParaBorrar);
      if (rDel.error) throw rDel.error;
    }
    // Los borrados ya aplicados (y los que ya no estaban en la nube porque
    // otro dispositivo se adelantó) dejan de estar pendientes.
    if (claveColeccion && apuntados.length > 0) guardarBorrados(claveColeccion, []);
  }

  /* ----------------------------------------------------------
     COLECCIONES GUARDADAS EN BLOQUE (productos, clientes, ...)
     ------------------------------------------------------------
     Estas no van fila a fila: se guardan como un bloque entero.
     Antes, el último equipo en guardar machacaba el bloque: si
     tenías el programa abierto en el ordenador y dabas de alta un
     producto en el móvil, en cuanto el ordenador guardara
     cualquier otra cosa, ese producto desaparecía.

     Ahora no se sube el bloque tal cual. Se mira qué ha cambiado
     en ESTE equipo (comparando con lo que tenía guardado antes) y
     solo ese cambio se aplica sobre lo que hay en la nube. Lo que
     haya hecho el otro dispositivo se queda donde está.
     ---------------------------------------------------------- */

  // Los respaldos NO se fusionan: cada equipo guarda los suyos y son muy
  // grandes (llevan una copia entera del negocio). Juntar los de dos equipos
  // multiplicaría el tamaño sin aportar nada.
  var SIN_FUSION = { historialRespaldos: true };

  function esListaConId(v) {
    return Array.isArray(v) && v.length > 0 && v.every(function (x) {
      return x && typeof x === "object" && !Array.isArray(x) && x.id;
    });
  }
  function esMapa(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }
  function igual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function fusionarListas(enNube, antes, ahora) {
    var mapaAntes = {}, mapaAhora = {}, mapaNube = {};
    antes.forEach(function (x) { if (x && x.id) mapaAntes[x.id] = x; });
    ahora.forEach(function (x) { if (x && x.id) mapaAhora[x.id] = x; });
    enNube.forEach(function (x) { if (x && x.id) mapaNube[x.id] = x; });

    var resultado = [];
    var colocados = {};
    var conflictos = []; // los dos dispositivos cambiaron el MISMO registro, cada uno a su manera

    ahora.forEach(function (x) {
      if (!x || !x.id) { resultado.push(x); return; }
      colocados[x.id] = true;
      var previo = mapaAntes[x.id];
      var enLaNube = mapaNube[x.id];
      var yoLoCambie = !previo || !igual(previo, x);
      var elOtroTambienLoCambio = previo && enLaNube && !igual(previo, enLaNube) && !igual(enLaNube, x);
      if (yoLoCambie && elOtroTambienLoCambio) {
        conflictos.push({ id: x.id, nombre: x.nombre || x.id, mio: x, delOtro: enLaNube });
      }
      if (!previo || !igual(previo, x)) {
        resultado.push(x);                 // lo he creado o modificado yo: mando yo
      } else if (Object.prototype.hasOwnProperty.call(mapaNube, x.id)) {
        resultado.push(mapaNube[x.id]);    // no lo he tocado: manda la nube
      }
      // Si no lo he tocado y ya no está en la nube, lo borró el otro equipo:
      // se respeta ese borrado y no se repone.
    });

    // Lo que hay en la nube y este equipo no ha llegado a ver nunca: lo ha
    // dado de alta el otro dispositivo, así que se conserva.
    enNube.forEach(function (x) {
      if (!x || !x.id) return;
      if (colocados[x.id]) return;
      if (Object.prototype.hasOwnProperty.call(mapaAntes, x.id)) return; // lo borré yo
      resultado.push(x);
    });

    return { resultado: resultado, conflictos: conflictos };
  }

  function fusionarMapas(enNube, antes, ahora) {
    var res = {};
    var conflictos = [];
    Object.keys(enNube).forEach(function (k) { res[k] = enNube[k]; });
    Object.keys(ahora).forEach(function (k) {
      var previo = antes[k];
      var yoLoCambie = !(k in antes) || !igual(previo, ahora[k]);
      var elOtroTambienLoCambio = (k in antes) && (k in enNube) && !igual(previo, enNube[k]) && !igual(enNube[k], ahora[k]);
      if (yoLoCambie && elOtroTambienLoCambio) conflictos.push({ id: k, nombre: k, mio: ahora[k], delOtro: enNube[k] });
      if (yoLoCambie) res[k] = ahora[k];
    });
    Object.keys(antes).forEach(function (k) { if (!(k in ahora)) delete res[k]; });
    return { resultado: res, conflictos: conflictos };
  }

  function fusionarValor(enNube, antes, ahora) {
    if (enNube === null || enNube === undefined) return { resultado: ahora, conflictos: [] };
    if (Array.isArray(ahora) && Array.isArray(enNube) && (esListaConId(ahora) || esListaConId(enNube))) {
      return fusionarListas(enNube, Array.isArray(antes) ? antes : [], ahora);
    }
    if (esMapa(ahora) && esMapa(enNube)) {
      return fusionarMapas(enNube, esMapa(antes) ? antes : {}, ahora);
    }
    return { resultado: ahora, conflictos: [] }; // números, textos y preferencias del propio equipo
  }

  // La referencia de productos se conserva hasta que el servidor confirma el
  // guardado. Si hay varios set seguidos u ocurre un corte de red, el siguiente
  // intento compara contra la última lista confirmada, no contra otro borrador
  // local. Se guarda fuera de LOCAL para que no aparezca como colección de la app.
  var BASE_PRODUCTOS_PENDIENTE = "almacen__productos_base_pendiente_p3c";
  var VENTA_PRODUCTOS_PENDIENTE = "almacen__productos_venta_pendiente_p3c";
  function leerVentaProductos() {
    try {
      var v = JSON.parse(localStorage.getItem(VENTA_PRODUCTOS_PENDIENTE) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }
  function recordarVentaProductos(lista) {
    if (!Array.isArray(lista) || !lista.length) return;
    var mapa = leerVentaProductos();
    lista.forEach(function (p) { if (p && p.id) mapa[String(p.id)] = p; });
    localStorage.setItem(VENTA_PRODUCTOS_PENDIENTE, JSON.stringify(mapa));
  }
  function confirmarVentaProductos(enviados) {
    var mapa = leerVentaProductos();
    enviados.forEach(function (p) {
      if (p && p.id && JSON.stringify(mapa[String(p.id)]) === JSON.stringify(p)) delete mapa[String(p.id)];
    });
    if (Object.keys(mapa).length) localStorage.setItem(VENTA_PRODUCTOS_PENDIENTE, JSON.stringify(mapa));
    else localStorage.removeItem(VENTA_PRODUCTOS_PENDIENTE);
  }
  function recordarBaseProductos(anterior) {
    if (localStorage.getItem(BASE_PRODUCTOS_PENDIENTE) === null) {
      localStorage.setItem(BASE_PRODUCTOS_PENDIENTE, anterior === null ? "[]" : anterior);
    }
  }
  function confirmarBaseProductos(valorConfirmado) {
    var actual = null;
    try { actual = LOCAL.get("productos"); } catch (e) {}
    if (actual === valorConfirmado) localStorage.removeItem(BASE_PRODUCTOS_PENDIENTE);
    else localStorage.setItem(BASE_PRODUCTOS_PENDIENTE, valorConfirmado);
  }
  function nuevaOperacionProductos() {
    var id = "";
    try { if (window.crypto && window.crypto.randomUUID) id = window.crypto.randomUUID(); } catch (e) {}
    if (!id) id = Date.now().toString(36) + "." + Math.random().toString(36).slice(2);
    return "p3c.lista." + id;
  }

  // Las filas de almacen_kv están segregadas por empresa. El contexto lo
  // publica fuente.js cuando ya se ha resuelto el local activo; nunca se
  // inventa una empresa ni se escribe una fila global sin empresa_id.
  function contextoKvActual() {
    var empresaId = typeof window.__empresaActivaIdParaContexto === "string"
      ? window.__empresaActivaIdParaContexto.trim()
      : "";
    var localId = typeof window.__localActivoIdParaContexto === "string"
      ? window.__localActivoIdParaContexto.trim()
      : "";
    return { empresaId: empresaId || null, localId: localId || null };
  }

  function consultaKvPorClave(key, columnas) {
    var consulta = window.__nubeCliente.from("almacen_kv")
      .select(columnas)
      .eq("key", key);
    var contexto = contextoKvActual();
    if (contexto.empresaId) consulta = consulta.eq("empresa_id", contexto.empresaId);
    return consulta;
  }

  async function guardarBloque(key, textoAnterior, textoNuevo) {
    var nuevo = JSON.parse(textoNuevo);
    var aSubir = nuevo;

    if (key === "productos") {
      var textoBase = localStorage.getItem(BASE_PRODUCTOS_PENDIENTE);
      if (textoBase === null) textoBase = textoAnterior;
      var base = textoBase === null ? [] : JSON.parse(textoBase);
      var mapaVenta = leerVentaProductos();
      var ventaPendiente = Object.keys(mapaVenta).sort().map(function (id) { return mapaVenta[id]; });
      var rProductos = await window.__nubeCliente.rpc("abc_productos_guardar_lista", {
        p_operation_id: nuevaOperacionProductos(), p_base: base, p_nuevo: nuevo,
        p_venta: ventaPendiente
      });
      if (!rProductos.error) {
        if (!rProductos.data || rProductos.data.ok !== true) throw new Error("Respuesta inesperada al guardar productos");
        var listaConfirmada = rProductos.data.lista_confirmada;
        if (!Array.isArray(listaConfirmada)) {
          // Compatibilidad con instalaciones que aún tengan la primera RPC:
          // una lectura posterior al COMMIT obtiene la lista final en nube.
          var rConfirmada = await window.__nubeCliente.from("almacen_kv")
            .select("value").eq("key", "productos").maybeSingle();
          if (rConfirmada.error) throw rConfirmada.error;
          listaConfirmada = rConfirmada.data && rConfirmada.data.value;
        }
        if (!Array.isArray(listaConfirmada)) throw new Error("Lista confirmada de productos no disponible");
        var textoConfirmado = JSON.stringify(listaConfirmada);
        var actualProductos = LOCAL.get("productos");
        var productosConfirmados = actualProductos === textoNuevo;
        if (productosConfirmados) {
          LOCAL.set("productos", textoConfirmado);
          confirmarBaseProductos(textoConfirmado);
          try {
            window.dispatchEvent(new CustomEvent("productos-servidor-confirmados", {
              detail: { enviados: nuevo, confirmados: listaConfirmada }
            }));
          } catch (e) {}
        }
        // Si hay un borrador más reciente, conserva su base original. La
        // siguiente subida compara contra ella y detecta conflictos reales.
        confirmarVentaProductos(ventaPendiente);
        return {
          catalogoYaSincronizado: rProductos.data.catalogo_ya_sincronizado === true,
          productosConfirmados: productosConfirmados,
          listaConfirmada: productosConfirmados ? listaConfirmada : null
        };
      }
      // Antes de desplegar P3c, producción sigue por el camino heredado.
      // Un rechazo real de la RPC no debe acabar en un upsert inseguro.
      if (rProductos.error.code !== "PGRST202" && rProductos.error.code !== "42883") throw rProductos.error;
    }

    if (!SIN_FUSION[key]) {
      var rLee = await consultaKvPorClave(key, "value").maybeSingle();
      if (rLee.error) throw rLee.error;
      var enNube = rLee.data ? rLee.data.value : null;
      var antes = null;
      try { antes = textoAnterior === null ? null : JSON.parse(textoAnterior); } catch (e) { antes = null; }
      var fusion = fusionarValor(enNube, antes, nuevo);
      aSubir = fusion.resultado;
      // Conflicto real: los dos dispositivos cambiaron el MISMO registro de
      // forma distinta mientras el otro no lo veía. La fusión ya decidió
      // (gana lo de este equipo, por ser la corrección más reciente que se
      // conoce), pero esto avisa de que el cambio del otro dispositivo se
      // ha perdido — para que se pueda revisar, no para bloquear el guardado.
      if (fusion.conflictos && fusion.conflictos.length > 0 && typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("conflicto-fusion", { detail: { key: key, conflictos: fusion.conflictos } }));
      }
    }

    var contexto = contextoKvActual();
    if (!contexto.empresaId) throw new Error("No hay empresa activa para guardar " + key + " en la nube");
    var rSube = await window.__nubeCliente.from("almacen_kv").upsert({
      empresa_id: contexto.empresaId,
      key: key,
      value: aSubir,
      local_id: null
    });
    if (rSube.error) throw rSube.error;
    if (key === "productos") {
      confirmarBaseProductos(textoNuevo);
      localStorage.removeItem(VENTA_PRODUCTOS_PENDIENTE);
    }
  }

  // --- Cola de subidas por clave ---
  // Dos guardados seguidos de la misma clave (ej. ajustar dos productos
  // sin esperar entre uno y otro) lanzaban dos subidas A LA VEZ. Si la
  // segunda empezaba a leer la nube antes de que la primera terminara de
  // escribir, la segunda no veía el cambio de la primera todavía — y como
  // para ella ese dato "no lo he tocado yo en esta subida", dejaba mandar
  // a la nube... que en ese instante seguía teniendo el valor viejo. El
  // primer ajuste se perdía, incluso en el mismo equipo tras recargar.
  //
  // Esto pone las subidas de una misma clave en fila: la segunda siempre
  // espera a que la primera termine de verdad (leer, combinar y escribir)
  // antes de empezar la suya. El guardado en el equipo sigue siendo
  // instantáneo — esto solo ordena las subidas a la nube.
  var colaSubidaPorClave = {};
  function encolarPorClave(key, tarea) {
    var anterior = colaSubidaPorClave[key] || Promise.resolve();
    var actual = anterior.then(tarea, tarea); // se ejecuta pase lo que pase con la anterior
    colaSubidaPorClave[key] = actual.catch(function () {}); // un fallo no debe atascar la cola futura
    return actual;
  }

  // Las escrituras de almacen_kv comparten una misma tabla y sus políticas
  // RLS/triggers. Durante el arranque había un saveKey por cada estado de
  // React, todos a la vez; esa ráfaga dejaba el upsert de localActivoId
  // esperando hasta que conTiempoLimite lo cancelaba. Se mantiene la cola
  // por clave para fusionar cambios consecutivos, pero las claves KV se
  // sirven además por una cola global: localActivoId tiene prioridad y cada
  // tarea lleva su propio límite para que un fallo no bloquee las siguientes.
  var colaSubidaKv = [];
  var subiendoKv = false;
  var drenajeKvProgramado = false;
  function drenarColaKv() {
    if (subiendoKv) return;
    subiendoKv = true;
    (async function () {
      while (colaSubidaKv.length) {
        var item = colaSubidaKv.shift();
        try {
          item.resolve(await item.tarea());
        } catch (e) {
          item.reject(e);
        }
      }
      subiendoKv = false;
    })();
  }
  function programarDrenajeKv() {
    if (drenajeKvProgramado) return;
    drenajeKvProgramado = true;
    setTimeout(function () {
      drenajeKvProgramado = false;
      drenarColaKv();
    }, 0);
  }
  function encolarKv(key, tarea) {
    return new Promise(function (resolve, reject) {
      var item = { key: key, tarea: tarea, resolve: resolve, reject: reject };
      if (key === "localActivoId") colaSubidaKv.unshift(item);
      else colaSubidaKv.push(item);
      programarDrenajeKv();
    });
  }

  window.storage = {
    // Leer: si hay nube, se prefiere (trae lo que hayan hecho en otro
    // dispositivo) y se deja copia local. Si no, se lee de local.
    async get(key) {
      var tablaEmpresa = TABLAS_EMPRESA[key];
      var tablaEmpresaLocal = TABLAS_EMPRESA_LOCAL[key];
      var tablaEspecial = TABLAS_POR_FILA[key];
      var esPagosFactura = key === "pagosFacturas";
      var esLedgerRpc = !!LEDGERS_RPC[key];
      var cacheKey = await claveCacheLocal(key);
      var falloNube = null;
      // Los ledgers PM-08 se hidratan con consultas RLS desde fuente.js cuando
      // ya existe sesión. Aquí solo se devuelve la última copia segregada del
      // usuario para no leer el antiguo bloque global de almacen_kv.
      if (esLedgerRpc && !esPagosFactura) {
        return { key: key, value: leerLocalOpcional(cacheKey), shared: false };
      }
      if (window.__nubeActiva && window.__nubeCliente && pendientes().indexOf(key) === -1 && !tieneMarcaDenegado(key)) {
        try {
          var lista;
          if (esPagosFactura) {
            lista = await conTiempoLimite(leerPagosFactura(), ESPERA_NUBE_MS);
          } else if (tablaEmpresa) {
            lista = await conTiempoLimite(leerColeccionEmpresa(tablaEmpresa), ESPERA_NUBE_MS);
          } else if (tablaEmpresaLocal) {
            lista = await conTiempoLimite(leerColeccionEmpresaLocal(tablaEmpresaLocal), ESPERA_NUBE_MS);
          } else if (tablaEspecial) {
            lista = await conTiempoLimite(leerColeccionPorFila(tablaEspecial, key), ESPERA_NUBE_MS);
          } else {
            var r = await conTiempoLimite(
              consultaKvPorClave(key, "value").maybeSingle(),
              ESPERA_NUBE_MS
            );
            if (r.error) throw r.error;
            if (!r.data) {
              var sinDatos = new Error("sin datos en la nube para " + key);
              sinDatos.code = "NUBE_SIN_DATOS";
              throw sinDatos;
            }
            lista = r.data.value;
          }
          var texto = JSON.stringify(lista);
          // La lectura remota sigue siendo válida aunque este dispositivo no
          // tenga espacio para actualizar su caché local. No convertir un
          // fallo de persistencia del navegador en un falso fallo de nube:
          // el otro contexto debe poder mostrar los datos recién sincronizados.
          try {
            LOCAL.set(cacheKey, texto);
          } catch (eCache) {
            console.warn("[almacén] No se pudo actualizar la caché local de «" + key + "»; se conserva la lectura remota.", eCache && eCache.message);
          }
          return { key: key, value: texto, shared: false };
        } catch (e) {
          // La ausencia remota es normal en un first-run. Cualquier otro error
          // se conserva: si tampoco existe caché local, loadKey debe avisarlo.
          if (!(e && e.code === "NUBE_SIN_DATOS")) falloNube = e;
        }
      }
      var valorLocal = leerLocalOpcional(cacheKey);
      if (valorLocal === null && falloNube) throw falloNube;
      return { key: key, value: valorLocal, shared: false };
    },

    // Guardar: primero en el dispositivo (instantáneo y sin fallo posible),
    // y después se intenta subir. Si no sube, queda en la cola de pendientes.
    async set(key, value, _shared, opcionesP3c) {
      var tablaEmpresa = TABLAS_EMPRESA[key];
      var tablaEmpresaLocal = TABLAS_EMPRESA_LOCAL[key];
      var tablaEspecial = TABLAS_POR_FILA[key];
      var esLedgerRpc = !!LEDGERS_RPC[key];
      var cacheKey = await claveCacheLocal(key);
      var confirmadoServidor = false;
      var pendienteSincronizacion = false;

      // Qué había guardado antes en este equipo. Sirve para saber qué se ha
      // quitado y para poder dejarlo como estaba si el guardado no cabe.
      var anterior = null;
      try { anterior = LOCAL.get(cacheKey); } catch (e) { anterior = null; }

      if (key === "productos" && anterior !== value) recordarBaseProductos(anterior);
      if (key === "productos" && opcionesP3c && opcionesP3c.venta) recordarVentaProductos(opcionesP3c.venta);

      // El almacenamiento del navegador tiene un tope (unos 5 MB en total).
      // Antes se daba por hecho que guardar en local "no puede fallar"; si
      // se llenaba, saltaba el error aquí mismo y ni se guardaba ni se
      // apuntaba para subir: el cambio se perdía entero.
      var falloLocal = null;
      try {
        LOCAL.set(cacheKey, value);
      } catch (e) {
        falloLocal = e;
        try { if (anterior !== null) LOCAL.set(cacheKey, anterior); } catch (e2) {}
      }

      if (tablaEspecial && !falloLocal) anotarBorradosLocales(key, anterior, value);

      // Estas preferencias solo viven en este navegador. Se limpian también
      // de colas antiguas para que una versión previa no vuelva a intentar
      // subirlas ni muestre un aviso de sincronización pendiente.
      if (esClaveSoloDispositivo(key)) {
        quitarPendiente(key);
        quitarDenegado(key);
        if (falloLocal) throw falloLocal;
        return { key: key, value: value, shared: false, confirmadoServidor: false, pendienteSincronizacion: false };
      }

      // Los ledgers remotos solo se escriben mediante RPC transaccional. El set
      // reactivo conserva la copia local; nunca hace upsert directo ni fallback.
      if (esLedgerRpc) {
        quitarPendiente(key);
        if (falloLocal) throw falloLocal;
        return { key: key, value: value, shared: false, confirmadoServidor: false, pendienteSincronizacion: false };
      }

      if (window.__nubeActiva && window.__nubeCliente) {
        var resultadoProductos = null;
        var catalogoBloqueado = false;
        // Si el servidor rechazó esta clave por permisos hace poco no se insiste:
        // queda guardada en este equipo y se reintenta pasado el plazo.
        if (key === "productos" && denegadoVigente(key)) catalogoBloqueado = true;
        if (!denegadoVigente(key)) {
          try {
            if (tablaEmpresa) {
              await conTiempoLimite(
                encolarPorClave(key, function () { return sincronizarColeccionEmpresa(tablaEmpresa, JSON.parse(value)); }),
                ESPERA_NUBE_MS
              );
            } else if (tablaEmpresaLocal) {
              await conTiempoLimite(
                encolarPorClave(key, function () { return sincronizarColeccionEmpresaLocal(tablaEmpresaLocal, JSON.parse(value), key); }),
                ESPERA_NUBE_MS
              );
            } else if (tablaEspecial) {
              await conTiempoLimite(
                encolarPorClave(key, function () { return sincronizarColeccionPorFila(tablaEspecial, JSON.parse(value), key); }),
                ESPERA_NUBE_MS
              );
            } else {
              resultadoProductos = await encolarKv(key, function () {
                return conTiempoLimite(encolarPorClave(key, function () { return guardarBloque(key, anterior, value); }), ESPERA_NUBE_MS);
              });
            }
            quitarPendiente(key);
            quitarDenegado(key);
            confirmadoServidor = true;
          } catch (e) {
            if (key === "productos") catalogoBloqueado = true;
            if (esRechazoSoloLocal(key, e)) marcarDenegado(key, e);
            else { marcarPendiente(key, value, cacheKey); pendienteSincronizacion = true; }
          }
        }
      } else if (!window.__modoPruebasLocal) {
        marcarPendiente(key, value, cacheKey);
        pendienteSincronizacion = true;
      }

      // Si no cupo en el equipo, se avisa solo si tampoco quedó confirmado en
      // el servidor. Con nube confirmada, el fallo afecta únicamente a la
      // caché local y no debe aparentar que el movimiento sigue pendiente.
      if (falloLocal) {
        if (!confirmadoServidor) {
          throw new Error(
            "No cabe en el almacenamiento de este equipo (" + key + "). " +
            "Suele significar que hay algo muy grande guardado, como una foto."
          );
        }
        console.warn("[almacén] La caché local de «" + key + "» está llena; el servidor confirmó el cambio.");
      }
      return {
        key: key, value: value, shared: false,
        confirmadoServidor: confirmadoServidor,
        pendienteSincronizacion: pendienteSincronizacion || pendientes().indexOf(key) !== -1,
        catalogoYaSincronizado: !!(resultadoProductos && resultadoProductos.catalogoYaSincronizado),
        catalogoBloqueado: !!catalogoBloqueado,
        productosConfirmados: !!(resultadoProductos && resultadoProductos.productosConfirmados),
        listaConfirmada: resultadoProductos && resultadoProductos.listaConfirmada
      };
    },

    async delete(key) {
      var cacheKey = await claveCacheLocal(key);
      LOCAL.delete(cacheKey);
      if (window.__nubeActiva && window.__nubeCliente) {
        try {
          var tablaEmpresa = TABLAS_EMPRESA[key];
          var tablaEmpresaLocal = TABLAS_EMPRESA_LOCAL[key];
          var tablaEspecial = TABLAS_POR_FILA[key];
          if (LEDGERS_RPC[key]) {
            return { key: key, deleted: true, shared: false };
          } else if (tablaEmpresa) {
            var rEmpDel = await conTiempoLimite(window.__nubeCliente.from(tablaEmpresa).delete().neq("id", ""), ESPERA_NUBE_MS);
            if (rEmpDel.error) throw rEmpDel.error;
          } else if (tablaEmpresaLocal) {
            var rFinDel = await conTiempoLimite(window.__nubeCliente.from(tablaEmpresaLocal).delete().neq("id", ""), ESPERA_NUBE_MS);
            if (rFinDel.error) throw rFinDel.error;
          } else if (tablaEspecial) {
            await conTiempoLimite(window.__nubeCliente.from(tablaEspecial).delete().neq("id", ""), ESPERA_NUBE_MS);
          } else {
            var contextoBorrado = contextoKvActual();
            if (contextoBorrado.empresaId) {
              await conTiempoLimite(
                window.__nubeCliente.from("almacen_kv")
                  .delete().eq("empresa_id", contextoBorrado.empresaId).eq("key", key),
                ESPERA_NUBE_MS
              );
            }
          }
        } catch (e) { /* el borrado local ya está hecho */ }
      }
      return { key: key, deleted: true, shared: false };
    },

    async list() {
      return { keys: LOCAL.list(), shared: false };
    }
  };
