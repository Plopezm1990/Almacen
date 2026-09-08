(function (root) {
  'use strict';

  if (root.__pm12HistorialInformesMovil) return;

  var ESTADOS = ['BORRADOR', 'EN_CURSO', 'PARCIAL', 'COMPLETADO', 'CANCELADO'];
  var ETIQUETAS = {
    BORRADOR: 'Borrador',
    EN_CURSO: 'En curso',
    PARCIAL: 'Parcial',
    COMPLETADO: 'Completado',
    CANCELADO: 'Cancelado'
  };
  var AMBITOS = {
    total: 'Todo el local',
    almacen: 'Almacén',
    piso_venta: 'Piso de venta'
  };

  function texto(valor) {
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function numero(valor) {
    var n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  function fechaValida(valor) {
    if (!valor) return null;
    var d = new Date(valor);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function fechaHumana(valor) {
    var d = fechaValida(valor);
    if (!d) return null;
    try {
      return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return d.toISOString();
    }
  }

  function estadoCanonico(conteo) {
    conteo = conteo || {};
    if (conteo.cancelado === true || conteo.estado === 'CANCELADO') return 'CANCELADO';
    if (ESTADOS.indexOf(conteo.estado) >= 0) return conteo.estado;
    if (conteo.completado === true) return 'COMPLETADO';

    var api = root.__pm12ConteoEstados;
    if (api && typeof api.estadoDerivado === 'function') {
      try { return api.estadoDerivado(conteo); } catch (_) { /* fallback below */ }
    }

    var items = Array.isArray(conteo.items) ? conteo.items : [];
    var alguno = items.some(function (item) {
      var valor = item && Object.prototype.hasOwnProperty.call(item, 'conteo') ? item.conteo : item && item.cantidadContada;
      return valor !== null && valor !== undefined && !(typeof valor === 'string' && valor.trim() === '');
    });
    return alguno ? 'EN_CURSO' : 'BORRADOR';
  }

  function normalizarCobertura(valor) {
    if (!valor || typeof valor !== 'object') return null;
    var total = numero(valor.total);
    var contados = numero(valor.contados);
    var pendientes = numero(valor.pendientes);
    var invalidos = numero(valor.invalidos);
    var porcentaje = numero(valor.porcentaje);
    if (total === null || contados === null || pendientes === null) return null;
    return {
      total: total,
      contados: contados,
      pendientes: pendientes,
      invalidos: invalidos === null ? 0 : invalidos,
      porcentaje: porcentaje === null ? (total > 0 ? Math.round(contados / total * 10000) / 100 : 0) : porcentaje
    };
  }

  function coberturaHonesta(conteo) {
    conteo = conteo || {};
    var estado = estadoCanonico(conteo);
    var congelada = normalizarCobertura(conteo.coberturaCierre) ||
      normalizarCobertura(conteo.cierre && conteo.cierre.cobertura) ||
      normalizarCobertura(conteo.corte && {
        total: conteo.corte.totalProductos,
        contados: conteo.corte.productosContados,
        pendientes: conteo.corte.productosPendientes,
        porcentaje: conteo.corte.porcentajeCobertura,
        invalidos: 0
      });
    if (congelada) return { conocida: true, congelada: true, valor: congelada };

    // Para documentos cerrados antiguos no reconstruimos retrospectivamente la cobertura.
    // El estado legado puede ser compatible, pero la cobertura histórica debe quedar explícitamente desconocida.
    if (estado === 'PARCIAL' || estado === 'COMPLETADO' || estado === 'CANCELADO' || conteo.completado === true) {
      return { conocida: false, congelada: false, valor: null };
    }

    var api = root.__pm12ConteoEstados;
    if (api && typeof api.resumenCobertura === 'function') {
      try {
        return { conocida: true, congelada: false, valor: normalizarCobertura(api.resumenCobertura(conteo.items || [])) };
      } catch (_) { /* no-op */ }
    }
    return { conocida: false, congelada: false, valor: null };
  }

  function responsableDe(conteo) {
    conteo = conteo || {};
    return texto(conteo.cierre && conteo.cierre.actorNombre) ||
      texto(conteo.corte && conteo.corte.responsable) ||
      texto(conteo.responsables && conteo.responsables.contadoPor) ||
      texto(conteo.responsable) || null;
  }

  function actorAjuste(conteo) {
    var a = conteo && conteo.ajustesActor;
    if (!a) return null;
    return texto(a.nombre) || texto(a.id) || texto(a.rol) || null;
  }

  function resumenConteo(conteo) {
    conteo = conteo || {};
    var estado = estadoCanonico(conteo);
    var cobertura = coberturaHonesta(conteo);
    var reversos = (conteo.cancelacion && Array.isArray(conteo.cancelacion.reversos)) ? conteo.cancelacion.reversos :
      (Array.isArray(conteo.reversosCancelacion) ? conteo.reversosCancelacion : []);
    return {
      id: texto(conteo.id) || null,
      estado: estado,
      estadoEtiqueta: ETIQUETAS[estado] || estado,
      ambito: texto(conteo.ambito || 'total'),
      ambitoEtiqueta: AMBITOS[conteo.ambito] || 'Todo el local',
      fecha: texto(conteo.fecha) || null,
      iniciadoEn: fechaHumana(conteo.iniciadoEn),
      cerradoEn: fechaHumana(conteo.cerradoEn || (conteo.cierre && conteo.cierre.cerradoEn)),
      responsable: responsableDe(conteo),
      revisor: texto(conteo.responsables && conteo.responsables.revisor) || null,
      motivoParcial: estado === 'PARCIAL' ? texto(conteo.motivoParcial || (conteo.cierre && conteo.cierre.motivoParcial)) || null : null,
      cobertura: cobertura,
      ajustes: {
        aplicados: conteo.ajustesAplicados === true,
        cantidad: numero(conteo.ajustesCantidad),
        fecha: fechaHumana(conteo.ajustesAplicadosEn),
        actor: actorAjuste(conteo),
        operationId: texto(conteo.ajustesOperationId) || null
      },
      cancelacion: estado === 'CANCELADO' ? {
        fecha: fechaHumana(conteo.canceladoEn || (conteo.cancelacion && conteo.cancelacion.canceladoEn)),
        motivo: texto(conteo.motivoCancelacion || (conteo.cancelacion && conteo.cancelacion.motivo)) || null,
        responsable: texto(conteo.responsableCancelacion || (conteo.cancelacion && conteo.cancelacion.responsable)) || null,
        reversos: reversos.length
      } : null
    };
  }

  function filtrarScope(conteos, scope) {
    var lista = Array.isArray(conteos) ? conteos : [];
    scope = scope || {};
    var empresaId = texto(scope.empresaId);
    var localId = texto(scope.localId);
    if (!empresaId && !localId) return lista.slice();
    return lista.filter(function (c) {
      if (empresaId && texto(c && c.empresaId) !== empresaId) return false;
      if (localId && texto(c && c.localId) !== localId) return false;
      return true;
    });
  }

  function resumenColeccion(conteos, scope) {
    var lista = filtrarScope(conteos, scope);
    var porEstado = { BORRADOR: 0, EN_CURSO: 0, PARCIAL: 0, COMPLETADO: 0, CANCELADO: 0 };
    var ajustadosHistoricos = 0;
    var cierresConCobertura = 0;
    var cierresSinCobertura = 0;
    var reversosCancelacion = 0;

    lista.forEach(function (c) {
      var r = resumenConteo(c);
      porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
      if (r.ajustes.aplicados) ajustadosHistoricos += 1;
      if (r.estado === 'PARCIAL' || r.estado === 'COMPLETADO' || r.estado === 'CANCELADO') {
        if (r.cobertura.conocida) cierresConCobertura += 1;
        else cierresSinCobertura += 1;
      }
      if (r.cancelacion) reversosCancelacion += r.cancelacion.reversos;
    });

    return {
      total: lista.length,
      porEstado: porEstado,
      abiertos: porEstado.BORRADOR + porEstado.EN_CURSO,
      cerrados: porEstado.PARCIAL + porEstado.COMPLETADO + porEstado.CANCELADO,
      ajustadosHistoricos: ajustadosHistoricos,
      cierresConCobertura: cierresConCobertura,
      cierresSinCobertura: cierresSinCobertura,
      reversosCancelacion: reversosCancelacion
    };
  }

  var apiPublica = Object.freeze({
    ESTADOS: Object.freeze(ESTADOS.slice()),
    ETIQUETAS: Object.freeze(Object.assign({}, ETIQUETAS)),
    estadoCanonico: estadoCanonico,
    coberturaHonesta: coberturaHonesta,
    resumenConteo: resumenConteo,
    filtrarScope: filtrarScope,
    resumenColeccion: resumenColeccion
  });
  root.__pm12HistorialInformesMovil = apiPublica;

  if (typeof document === 'undefined') return;

  var STYLE_ID = 'pm12-p09-historial-informes-movil-style';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.pm12-p09-meta{margin-top:10px;padding-top:9px;border-top:1px solid rgba(107,122,110,.22);font-size:11.5px;line-height:1.45;color:#6B7A6E}',
      '.pm12-p09-meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px}',
      '.pm12-p09-meta strong{color:inherit;font-weight:600}',
      '.pm12-p09-report{margin:0 0 16px;padding:14px;border:1px solid rgba(107,122,110,.22);border-radius:12px;background:rgba(231,220,189,.22)}',
      '.pm12-p09-report-title{font-size:13px;font-weight:700;margin-bottom:8px}',
      '.pm12-p09-report-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '.pm12-p09-stat{padding:8px;border-radius:9px;background:rgba(255,255,255,.52);min-width:0}',
      '.pm12-p09-stat b{display:block;font-size:16px;line-height:1.2}',
      '.pm12-p09-stat span{font-size:10.5px;color:#6B7A6E}',
      '.pm12-p09-note{margin-top:8px;font-size:10.5px;color:#6B7A6E}',
      '@media(max-width:640px){',
      '  [data-pm12-p09-card="1"]>[data-pm12-p09-row="1"]{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:8px!important}',
      '  [data-pm12-p09-actions="1"]{width:100%!important;display:flex!important;flex-wrap:wrap!important;justify-content:flex-start!important;gap:6px!important}',
      '  .pm12-p09-meta-grid{grid-template-columns:minmax(0,1fr)!important}',
      '  .pm12-p09-report-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}',
      '  .pm12-p09-capture-grid{grid-template-columns:minmax(0,1fr)!important}',
      '  .pm12-p09-capture-grid input,.pm12-p09-capture-grid select{width:100%!important;max-width:100%!important}',
      '  [data-pm12-p09-history-list="1"]{width:100%!important;max-width:100%!important}',
      '  [data-pm12-p09-history-list="1"]>*{min-width:0!important;max-width:100%!important}',
      '}',
      '@media(max-width:380px){.pm12-p09-report-grid{grid-template-columns:minmax(0,1fr)!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function normalizarTexto(v) {
    return texto(v).replace(/\s+/g, ' ').toLowerCase();
  }

  function leerJsonLocal(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem('almacen:' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function leerScopeLocal() {
    if (!root.localStorage) return {};
    var localId = '';
    var empresaId = '';
    var posiblesLocal = ['localActivoId', 'localActivo', 'local_activo_id'];
    var posiblesEmpresa = ['empresaActivaId', 'empresaActiva', 'empresa_activa_id'];
    posiblesLocal.some(function (k) {
      try {
        var v = root.localStorage.getItem('almacen:' + k);
        if (!v) return false;
        try { v = JSON.parse(v); } catch (_) { /* texto simple */ }
        localId = texto(v && typeof v === 'object' ? (v.id || v.localId) : v);
        return !!localId;
      } catch (_) { return false; }
    });
    posiblesEmpresa.some(function (k) {
      try {
        var v = root.localStorage.getItem('almacen:' + k);
        if (!v) return false;
        try { v = JSON.parse(v); } catch (_) { /* texto simple */ }
        empresaId = texto(v && typeof v === 'object' ? (v.id || v.empresaId) : v);
        return !!empresaId;
      } catch (_) { return false; }
    });
    return { empresaId: empresaId, localId: localId };
  }

  function conteosVisiblesSeguros() {
    var todos = leerJsonLocal('conteos', []);
    if (!Array.isArray(todos)) return [];
    var scope = leerScopeLocal();
    if (scope.localId || scope.empresaId) return filtrarScope(todos, scope);

    // Si no podemos resolver el scope, solo agregamos cuando todos los documentos
    // pertenecen inequívocamente al mismo local. Nunca mezclamos locales en informes.
    var locales = Array.from(new Set(todos.map(function (c) { return texto(c && c.localId); }).filter(Boolean)));
    var empresas = Array.from(new Set(todos.map(function (c) { return texto(c && c.empresaId); }).filter(Boolean)));
    if (locales.length <= 1 && empresas.length <= 1) return todos;
    return [];
  }

  function linea(label, value) {
    if (!value) return null;
    var div = document.createElement('div');
    var strong = document.createElement('strong');
    strong.textContent = label + ': ';
    div.appendChild(strong);
    div.appendChild(document.createTextNode(value));
    return div;
  }

  function coberturaTexto(cobertura) {
    if (!cobertura || !cobertura.conocida || !cobertura.valor) return 'No disponible (histórico sin cobertura congelada)';
    var c = cobertura.valor;
    return c.contados + '/' + c.total + ' · ' + c.porcentaje + '%' + (c.pendientes ? ' · ' + c.pendientes + ' pendiente(s)' : '');
  }

  function datosCoinciden(card, resumen) {
    var t = normalizarTexto(card.textContent);
    if (resumen.fecha && t.indexOf(normalizarTexto(resumen.fecha)) < 0) return false;
    if (resumen.ambito === 'piso_venta' && t.indexOf('piso de venta') < 0) return false;
    if (resumen.ambito === 'almacen' && t.indexOf('almac') < 0) return false;
    return t.indexOf(normalizarTexto(resumen.estadoEtiqueta)) >= 0;
  }

  function enriquecerHistorial() {
    var headings = Array.from(document.querySelectorAll('div,span,h2,h3,h4'));
    var heading = headings.find(function (el) {
      return el.children.length === 0 && normalizarTexto(el.textContent) === 'historial de conteos';
    });
    if (!heading || !heading.nextElementSibling) return;

    var list = heading.nextElementSibling;
    list.setAttribute('data-pm12-p09-history-list', '1');
    var tarjetas = Array.from(list.children || []);
    if (!tarjetas.length) return;
    var disponibles = conteosVisiblesSeguros().map(resumenConteo);
    var usados = {};

    tarjetas.forEach(function (card) {
      card.setAttribute('data-pm12-p09-card', '1');
      var row = card.firstElementChild;
      if (row) {
        row.setAttribute('data-pm12-p09-row', '1');
        if (row.lastElementChild) row.lastElementChild.setAttribute('data-pm12-p09-actions', '1');
      }
      if (card.querySelector('.pm12-p09-meta')) return;

      var indice = disponibles.findIndex(function (r, i) { return !usados[i] && datosCoinciden(card, r); });
      if (indice < 0) return;
      usados[indice] = true;
      var r = disponibles[indice];
      var meta = document.createElement('div');
      meta.className = 'pm12-p09-meta';
      meta.setAttribute('data-pm12-p09-conteo-id', r.id || 'sin-id');
      var grid = document.createElement('div');
      grid.className = 'pm12-p09-meta-grid';
      [
        linea('Cobertura', coberturaTexto(r.cobertura)),
        linea('Responsable', r.responsable || 'No registrado'),
        linea('Cierre', r.cerradoEn),
        linea('Revisor', r.revisor),
        linea('Motivo parcial', r.motivoParcial),
        r.ajustes.aplicados ? linea('Ajustes', (r.ajustes.cantidad === null ? 'Aplicados' : r.ajustes.cantidad + ' producto(s)') + (r.ajustes.fecha ? ' · ' + r.ajustes.fecha : '') + (r.ajustes.actor ? ' · ' + r.ajustes.actor : '')) : null,
        r.cancelacion ? linea('Cancelación', (r.cancelacion.fecha || 'Fecha no registrada') + (r.cancelacion.responsable ? ' · ' + r.cancelacion.responsable : '') + ' · ' + r.cancelacion.reversos + ' reverso(s)') : null,
        r.cancelacion && r.cancelacion.motivo ? linea('Motivo cancelación', r.cancelacion.motivo) : null
      ].filter(Boolean).forEach(function (el) { grid.appendChild(el); });
      meta.appendChild(grid);
      card.appendChild(meta);
    });
  }

  function mejorarCapturaMovil() {
    var labels = Array.from(document.querySelectorAll('label,div,span'));
    var contado = labels.find(function (el) {
      return el.children.length <= 2 && normalizarTexto(el.textContent).indexOf('contado por') === 0 && el.querySelector && el.querySelector('input');
    });
    if (!contado) return;
    var grid = contado.parentElement;
    for (var i = 0; i < 3 && grid; i += 1, grid = grid.parentElement) {
      if (grid.classList && grid.classList.contains('grid') && grid.classList.contains('grid-cols-2')) {
        grid.classList.add('pm12-p09-capture-grid');
        break;
      }
    }
  }

  function crearStat(valor, label) {
    var div = document.createElement('div');
    div.className = 'pm12-p09-stat';
    var b = document.createElement('b');
    b.textContent = String(valor);
    var span = document.createElement('span');
    span.textContent = label;
    div.appendChild(b);
    div.appendChild(span);
    return div;
  }

  function enriquecerReportes() {
    var headings = Array.from(document.querySelectorAll('div,h1,h2,h3,h4'));
    var heading = headings.find(function (el) {
      return el.children.length === 0 && normalizarTexto(el.textContent) === 'reportes y rotación';
    });
    if (!heading) return;

    var container = heading.parentElement && heading.parentElement.parentElement;
    if (!container) return;
    var existente = container.querySelector('.pm12-p09-report');
    var lista = conteosVisiblesSeguros();
    if (!lista.length) {
      if (existente) existente.remove();
      return;
    }
    var r = resumenColeccion(lista);
    var signature = JSON.stringify(r);
    if (existente && existente.getAttribute('data-signature') === signature) return;
    if (existente) existente.remove();

    var box = document.createElement('div');
    box.className = 'pm12-p09-report';
    box.setAttribute('data-signature', signature);
    var title = document.createElement('div');
    title.className = 'pm12-p09-report-title';
    title.textContent = 'Estado de los conteos de inventario';
    box.appendChild(title);
    var grid = document.createElement('div');
    grid.className = 'pm12-p09-report-grid';
    grid.appendChild(crearStat(r.porEstado.BORRADOR, 'Borrador'));
    grid.appendChild(crearStat(r.porEstado.EN_CURSO, 'En curso'));
    grid.appendChild(crearStat(r.porEstado.PARCIAL, 'Parcial'));
    grid.appendChild(crearStat(r.porEstado.COMPLETADO, 'Completado'));
    grid.appendChild(crearStat(r.porEstado.CANCELADO, 'Cancelado'));
    grid.appendChild(crearStat(r.ajustadosHistoricos, 'Con ajustes históricos'));
    box.appendChild(grid);
    var note = document.createElement('div');
    note.className = 'pm12-p09-note';
    note.textContent = 'Cobertura congelada disponible en ' + r.cierresConCobertura + ' cierre(s)' +
      (r.cierresSinCobertura ? '; ' + r.cierresSinCobertura + ' histórico(s) se muestran como cobertura no disponible, sin reconstruirla.' : '.') +
      (r.reversosCancelacion ? ' Reversos de cancelación trazados: ' + r.reversosCancelacion + '.' : '');
    box.appendChild(note);

    var zona = container.querySelector('.zona-impresion');
    if (zona) container.insertBefore(box, zona);
    else container.appendChild(box);
  }

  var aplicando = false;
  function aplicar() {
    if (aplicando) return;
    aplicando = true;
    try {
      enriquecerHistorial();
      enriquecerReportes();
      mejorarCapturaMovil();
    } finally {
      aplicando = false;
    }
  }

  var programado = false;
  function programar() {
    if (programado) return;
    programado = true;
    var raf = root.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); };
    raf(function () {
      programado = false;
      aplicar();
    });
  }

  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(programar).observe(document.documentElement, { childList: true, subtree: true });
  }
  root.addEventListener && root.addEventListener('resize', programar, { passive: true });
  root.addEventListener && root.addEventListener('pageshow', programar);
  programar();
})(typeof window !== 'undefined' ? window : globalThis);
