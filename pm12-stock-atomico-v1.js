(function (root) {
  'use strict';
  function crear(obtenerCliente) {
    async function ejecutar(nombre, args) {
      try {
        var cliente = await obtenerCliente();
        if (!cliente || typeof cliente.rpc !== 'function') throw new Error('motor_atomico_no_disponible');
        var r = await cliente.rpc(nombre, args);
        if (r.error) throw r.error;
        if (!r.data || r.data.ok !== true || !r.data.conteo) throw new Error('respuesta_atomica_invalida');
        return r.data;
      } catch (e) {
        return { ok: false, codigo: e && e.message || 'confirmacion_atomica_pendiente', error: 'No se confirmó la operación completa. Conserva el conteo y reintenta; se recuperará la misma intención.', ajustados: 0, traspasados: [] };
      }
    }
    function intencion(conteo) {
      var copia = {};
      Object.keys(conteo).sort().forEach(function (key) {
        if (!/^(ajustes|cancel|reversos|_pm12)/.test(key)) copia[key] = conteo[key];
      });
      return copia;
    }
    return {
      aplicar: function (conteo, plan, bases, permiso, operationId) {
        var documento = intencion(conteo);
        documento.items = (conteo.items || []).map(function (item) {
          var base = bases.find(function (b) { return b.productoId === item.productoId; });
          return base ? Object.assign({}, item, { conteo: base.conteo }) : item;
        });
        return ejecutar('pm12_confirmar_ajuste_stock', { p_operation_id: operationId, p_empresa_id: permiso.empresaId, p_local_id: permiso.localId,
          p_intencion: Object.assign(documento, { ajustesPendientesRevision: conteo.ajustesPendientesRevision === true }), p_plan: plan, p_bases: bases });
      },
      cancelar: function (conteo, cancelacion, permiso) {
        return ejecutar('pm12_cancelar_conteo_stock', { p_empresa_id: permiso.empresaId, p_local_id: permiso.localId, p_conteo: conteo, p_cancelacion: cancelacion });
      }
    };
  }
  root.__pm12StockAtomico = crear(function () {
    if (typeof root.getSupabaseClient !== 'function') throw new Error('motor_atomico_no_disponible');
    return root.getSupabaseClient();
  });
  root.__pm12CrearStockAtomico = crear;
})(typeof window !== 'undefined' ? window : globalThis);
