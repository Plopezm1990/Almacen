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
