(function (root) {
  'use strict';

  var ESTADOS = Object.freeze({
    BORRADOR: 'BORRADOR',
    EN_CURSO: 'EN_CURSO',
    PARCIAL: 'PARCIAL',
    COMPLETADO: 'COMPLETADO',
    CANCELADO: 'CANCELADO'
  });

  function textoVacio(valor) {
    return valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '');
  }

  function precisionDecimal(numero) {
    var texto = String(numero).toLowerCase();
    if (texto.indexOf('e-') >= 0) return Number(texto.split('e-')[1]) || 0;
    var punto = texto.indexOf('.');
    return punto < 0 ? 0 : texto.length - punto - 1;
  }

  function normalizarCantidad(valor, reglas) {
    reglas = reglas || {};
    if (textoVacio(valor)) return { estado: 'VACIO', contado: false, valido: true, valor: null, error: null };

    var normalizado = typeof valor === 'string' ? valor.trim().replace(',', '.') : valor;
    var numero = Number(normalizado);
    if (!Number.isFinite(numero)) {
      return { estado: 'INVALIDO', contado: false, valido: false, valor: null, error: 'cantidad_no_finita' };
    }
    if (numero < 0) {
      return { estado: 'INVALIDO', contado: false, valido: false, valor: null, error: 'cantidad_negativa' };
    }

    var indivisible = reglas.indivisible === true || reglas.fraccionable === false;
    if (indivisible && !Number.isInteger(numero)) {
      return { estado: 'INVALIDO', contado: false, valido: false, valor: null, error: 'unidad_indivisible' };
    }

    var precision = Number.isInteger(reglas.precision) ? reglas.precision :
      (Number.isInteger(reglas.precisionCantidad) ? reglas.precisionCantidad : null);
    if (precision !== null && precision >= 0 && precisionDecimal(normalizado) > precision) {
      return { estado: 'INVALIDO', contado: false, valido: false, valor: null, error: 'precision_excedida' };
    }

    return { estado: 'VALIDO', contado: true, valido: true, valor: numero, error: null };
  }

  function resumenCobertura(items, reglasPorProducto) {
    var lista = Array.isArray(items) ? items : [];
    var contados = 0;
    var pendientes = 0;
    var invalidos = 0;
    var detalle = lista.map(function (item) {
      var productoId = item && item.productoId;
      var reglas = typeof reglasPorProducto === 'function' ? reglasPorProducto(productoId, item) :
        ((reglasPorProducto && reglasPorProducto[productoId]) || {});
      var valor = item && Object.prototype.hasOwnProperty.call(item, 'conteo') ? item.conteo :
        (item ? item.cantidadContada : null);
      var normalizado = normalizarCantidad(valor, reglas);
      if (normalizado.estado === 'VALIDO') contados += 1;
      else if (normalizado.estado === 'VACIO') pendientes += 1;
      else invalidos += 1;
      return { productoId: productoId || null, normalizado: normalizado };
    });
    var total = lista.length;
    var porcentaje = total === 0 ? 0 : Math.round((contados / total) * 10000) / 100;
    return { total: total, contados: contados, pendientes: pendientes, invalidos: invalidos, porcentaje: porcentaje, detalle: detalle };
  }

  function estadoDerivado(conteo, reglasPorProducto) {
    conteo = conteo || {};
    if (Object.values(ESTADOS).includes(conteo.estado)) return conteo.estado;
    if (conteo.cancelado === true) return ESTADOS.CANCELADO;
    if (conteo.completado === true) return ESTADOS.COMPLETADO;
    var cobertura = resumenCobertura(conteo.items, reglasPorProducto);
    return cobertura.contados === 0 ? ESTADOS.BORRADOR : ESTADOS.EN_CURSO;
  }

  function validarCierre(conteo, opciones) {
    conteo = conteo || {};
    opciones = opciones || {};
    var cobertura = resumenCobertura(conteo.items, opciones.reglasPorProducto);
    var responsable = String(opciones.responsable || (conteo.responsables && conteo.responsables.contadoPor) || '').trim();

    if (cobertura.total === 0) return { ok: false, error: 'sin_productos', cobertura: cobertura };
    if (cobertura.invalidos > 0) return { ok: false, error: 'cantidades_invalidas', cobertura: cobertura };
    if (cobertura.contados === 0) return { ok: false, error: 'conteo_vacio', cobertura: cobertura };
    if (!responsable) return { ok: false, error: 'responsable_obligatorio', cobertura: cobertura };

    if (cobertura.pendientes > 0) {
      if (opciones.confirmarParcial !== true) return { ok: false, error: 'cobertura_incompleta', cobertura: cobertura };
      if (!String(opciones.motivoParcial || '').trim()) return { ok: false, error: 'motivo_parcial_obligatorio', cobertura: cobertura };
      return { ok: true, estado: ESTADOS.PARCIAL, cobertura: cobertura, responsable: responsable };
    }

    return { ok: true, estado: ESTADOS.COMPLETADO, cobertura: cobertura, responsable: responsable };
  }

  root.__pm12ConteoEstados = Object.freeze({
    ESTADOS: ESTADOS,
    normalizarCantidad: normalizarCantidad,
    resumenCobertura: resumenCobertura,
    estadoDerivado: estadoDerivado,
    validarCierre: validarCierre
  });
})(typeof window !== 'undefined' ? window : globalThis);


(function (root) {
  'use strict';

  var estadosApi = root.__pm12ConteoEstados;
  if (!estadosApi) throw new Error('PM12 estados no disponible');

  var AMBITOS = Object.freeze(['total', 'almacen', 'piso_venta']);

  function texto(valor) {
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function ahora(reloj) {
    var valor = typeof reloj === 'function' ? reloj() : new Date().toISOString();
    var fecha = new Date(valor);
    if (!Number.isFinite(fecha.getTime())) throw new Error('fecha_corte_invalida');
    return fecha.toISOString();
  }

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function validarContexto(documento, contexto) {
    contexto = contexto || {};
    if (!documento || !texto(documento.empresaId) || !texto(documento.localId)) return { ok: false, error: 'identidad_incompleta' };
    if (contexto.todosLosLocales === true || contexto.localId === 'todos') return { ok: false, error: 'todos_no_es_destino' };
    if (texto(contexto.empresaId) && texto(contexto.empresaId) !== texto(documento.empresaId)) return { ok: false, error: 'empresa_no_coincide' };
    if (texto(contexto.localId) && texto(contexto.localId) !== texto(documento.localId)) return { ok: false, error: 'local_no_coincide' };
    return { ok: true };
  }

  function crearDocumento(datos) {
    datos = datos || {};
    var id = texto(datos.id);
    var empresaId = texto(datos.empresaId);
    var localId = texto(datos.localId);
    var ambito = texto(datos.ambito || 'total');
    var actorId = texto(datos.actorId);
    var productos = Array.isArray(datos.productos) ? datos.productos : [];

    if (!id) return { ok: false, error: 'id_obligatorio' };
    if (!empresaId) return { ok: false, error: 'empresa_obligatoria' };
    if (!localId || localId === 'todos') return { ok: false, error: 'local_obligatorio' };
    if (!AMBITOS.includes(ambito)) return { ok: false, error: 'ambito_invalido' };
    if (!actorId) return { ok: false, error: 'actor_obligatorio' };

    var ids = productos.map(function (p) { return texto(p && (p.productoId || p.id)); });
    if (ids.some(function (x) { return !x; })) return { ok: false, error: 'producto_sin_id' };
    if (new Set(ids).size !== ids.length) return { ok: false, error: 'producto_duplicado' };

    var iniciadoEn = ahora(datos.reloj);
    var documento = {
      id: id,
      versionDocumento: 1,
      empresaId: empresaId,
      localId: localId,
      estado: estadosApi.ESTADOS.BORRADOR,
      ambito: ambito,
      responsables: { contadoPor: '', revisor: '' },
      actorInicio: { id: actorId, nombre: texto(datos.actorNombre) },
      iniciadoEn: iniciadoEn,
      actualizadoEn: iniciadoEn,
      cerradoEn: null,
      motivoParcial: null,
      coberturaCierre: null,
      corte: null,
      ajustesAplicados: false,
      items: productos.map(function (p, indice) {
        return {
          productoId: texto(p.productoId || p.id),
          conteo: '',
          orden: indice + 1,
          incluidoEnCorte: true
        };
      })
    };
    return { ok: true, documento: documento };
  }

  function actualizarCaptura(documento, cambio, opciones) {
    opciones = opciones || {};
    var contexto = validarContexto(documento, opciones.contexto);
    if (!contexto.ok) return contexto;
    if ([estadosApi.ESTADOS.PARCIAL, estadosApi.ESTADOS.COMPLETADO, estadosApi.ESTADOS.CANCELADO].includes(documento.estado)) {
      return { ok: false, error: 'documento_cerrado' };
    }

    var productoId = texto(cambio && cambio.productoId);
    var indice = documento.items.findIndex(function (item) { return item.productoId === productoId; });
    if (indice < 0) return { ok: false, error: 'producto_fuera_del_corte' };

    var copia = clonar(documento);
    copia.items[indice].conteo = cambio.valor;
    var cobertura = estadosApi.resumenCobertura(copia.items, opciones.reglasPorProducto);
    copia.estado = cobertura.contados === 0 ? estadosApi.ESTADOS.BORRADOR : estadosApi.ESTADOS.EN_CURSO;
    copia.actualizadoEn = ahora(opciones.reloj);
    return { ok: true, documento: copia, cobertura: cobertura };
  }

  function actualizarResponsables(documento, responsables, opciones) {
    opciones = opciones || {};
    var contexto = validarContexto(documento, opciones.contexto);
    if (!contexto.ok) return contexto;
    if ([estadosApi.ESTADOS.PARCIAL, estadosApi.ESTADOS.COMPLETADO, estadosApi.ESTADOS.CANCELADO].includes(documento.estado)) {
      return { ok: false, error: 'documento_cerrado' };
    }
    var copia = clonar(documento);
    copia.responsables = {
      contadoPor: texto(responsables && responsables.contadoPor),
      revisor: texto(responsables && responsables.revisor)
    };
    copia.actualizadoEn = ahora(opciones.reloj);
    return { ok: true, documento: copia };
  }

  function cerrarDocumento(documento, opciones) {
    opciones = opciones || {};
    var contexto = validarContexto(documento, opciones.contexto);
    if (!contexto.ok) return contexto;
    if ([estadosApi.ESTADOS.PARCIAL, estadosApi.ESTADOS.COMPLETADO, estadosApi.ESTADOS.CANCELADO].includes(documento.estado)) {
      return { ok: false, error: 'documento_ya_cerrado' };
    }

    var cierre = estadosApi.validarCierre(documento, {
      reglasPorProducto: opciones.reglasPorProducto,
      responsable: documento.responsables && documento.responsables.contadoPor,
      confirmarParcial: opciones.confirmarParcial === true,
      motivoParcial: opciones.motivoParcial
    });
    if (!cierre.ok) return cierre;

    var cerradoEn = ahora(opciones.reloj);
    var copia = clonar(documento);
    copia.estado = cierre.estado;
    copia.cerradoEn = cerradoEn;
    copia.actualizadoEn = cerradoEn;
    copia.motivoParcial = cierre.estado === estadosApi.ESTADOS.PARCIAL ? texto(opciones.motivoParcial) : null;
    copia.coberturaCierre = clonar(cierre.cobertura);
    copia.corte = {
      empresaId: copia.empresaId,
      localId: copia.localId,
      ambito: copia.ambito,
      iniciadoEn: copia.iniciadoEn,
      cerradoEn: cerradoEn,
      actorCierre: { id: texto(opciones.actorId), nombre: texto(opciones.actorNombre) },
      responsable: texto(copia.responsables.contadoPor),
      revisor: texto(copia.responsables.revisor),
      productosIncluidos: copia.items.map(function (item) { return item.productoId; }),
      totalProductos: cierre.cobertura.total,
      productosContados: cierre.cobertura.contados,
      productosPendientes: cierre.cobertura.pendientes,
      porcentajeCobertura: cierre.cobertura.porcentaje
    };
    if (!copia.corte.actorCierre.id) return { ok: false, error: 'actor_cierre_obligatorio' };
    return { ok: true, documento: copia };
  }

  root.__pm12DocumentoConteo = Object.freeze({
    AMBITOS: AMBITOS,
    validarContexto: validarContexto,
    crearDocumento: crearDocumento,
    actualizarCaptura: actualizarCaptura,
    actualizarResponsables: actualizarResponsables,
    cerrarDocumento: cerrarDocumento
  });
})(typeof window !== 'undefined' ? window : globalThis);
