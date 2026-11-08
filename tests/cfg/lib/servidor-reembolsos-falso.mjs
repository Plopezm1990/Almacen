// Servidor falso en memoria para probar la pantalla «Reembolso económico» (D13) sin base de datos.
// Imita las reglas del servidor tras la migración 20261003100000 (los mismos errores y los mismos resultados que comprueba el contrato
// vivo tests/cfg/d13-contract.sql):
//   - abc_solicitar_reembolso: capacidad ABC_REEMBOLSO_SOLICITAR; quien tiene ABC_REEMBOLSO_CONFIRMAR queda aprobado en el acto;
//     quien no, queda PENDIENTE sin aprobar (requiere_aprobacion = true);
//   - abc_aprobar_reembolso: capacidad ABC_REEMBOLSO_CONFIRMAR, PENDIENTE y sin aprobar, nadie aprueba lo que solicitó él mismo;
//   - abc_cancelar_reembolso (rechazar): capacidad ABC_REEMBOLSO_CONFIRMAR, solo PENDIENTE;
//   - abc_confirmar_reembolso_efectivo: capacidad ABC_REEMBOLSO_CONFIRMAR y aprobado (reembolso_pendiente_aprobacion).
// Cada llamada queda en `estado.llamadas` ({ nombre, params }). `estado.fallos[nombre] = 'texto'` hace que esa función falle con ese texto.
// `estado.retardos[nombre] = ms` hace que esa función tarde esos milisegundos en responder (para probar lo que pasa mientras una operación sigue en curso).

const IDS = {
  E: 'D13-EMP', L: 'D13-L1', TERMINAL: '90000000-0000-0000-0000-0000000000d1', CAJA: '91000000-0000-0000-0000-0000000000d1',
  SESION: '92000000-0000-0000-0000-0000000000d1', PAGO_TARJETA: '50000000-0000-0000-0000-0000000000d1', PAGO_EFECTIVO: '50000000-0000-0000-0000-0000000000d2',
  U_CAJERO: 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', U_ENCARGADO: '5003adca-2e30-477e-8afd-ffb3037b034e', U_PROPIETARIO: '16c79749-a206-47d9-8d56-fbc7a4a49eb7'
};
const ROLES = ['Propietario', 'Encargado', 'Cajero/a', 'Camarero/a'];

export function crearServidorReembolsosFalso(opciones = {}) {
  const s = {
    ids: IDS,
    usuario: opciones.usuario || { id: IDS.U_ENCARGADO, rol: 'Encargado' },
    // capacidades efectivas por rol (lo que devuelve abc_obtener_capacidades_rol)
    capacidades: opciones.capacidades || {
      ABC_REEMBOLSO_SOLICITAR: { Propietario: true, Encargado: true, 'Cajero/a': false, 'Camarero/a': false },
      ABC_REEMBOLSO_CONFIRMAR: { Propietario: true, Encargado: true, 'Cajero/a': false, 'Camarero/a': false }
    },
    tablas: {
      checkouts: [
        { id: 'c-tarjeta', empresa_id: IDS.E, local_id: IDS.L, currency_code: 'EUR', estado: 'COMPLETADO', operating_day: '2026-10-03', created_at: '2026-10-03T07:00:00Z' },
        { id: 'c-efectivo', empresa_id: IDS.E, local_id: IDS.L, currency_code: 'EUR', estado: 'COMPLETADO', operating_day: '2026-10-03', created_at: '2026-10-03T07:01:00Z' }
      ],
      pagos: [
        { id: IDS.PAGO_TARJETA, empresa_id: IDS.E, local_id: IDS.L, checkout_id: 'c-tarjeta', medio: 'TARJETA', estado: 'CONFIRMADO', importe_objetivo: 20, payment_currency_code: 'EUR', created_at: '2026-10-03T07:00:10Z', resolved_at: null },
        { id: IDS.PAGO_EFECTIVO, empresa_id: IDS.E, local_id: IDS.L, checkout_id: 'c-efectivo', medio: 'EFECTIVO', estado: 'CONFIRMADO', importe_objetivo: 10, payment_currency_code: 'EUR', created_at: '2026-10-03T07:01:10Z', resolved_at: null }
      ],
      reembolsos: [],
      terminales_tpv: [{ id: IDS.TERMINAL, empresa_id: IDS.E, local_id: IDS.L, activo: true }],
      caja_sesion_terminales: [{ session_id: IDS.SESION, terminal_id: IDS.TERMINAL, empresa_id: IDS.E, local_id: IDS.L, desde: '2026-10-03T06:00:00Z', hasta: null }],
      caja_sesiones: [{ id: IDS.SESION, caja_id: IDS.CAJA, estado: 'ABIERTA', empresa_id: IDS.E, local_id: IDS.L }]
    },
    llamadas: [],
    consultas: [],
    fallos: {},
    retardos: {},
    lecturasCapacidades: 0,
    contador: 0
  };
  if (opciones.reembolsos) s.tablas.reembolsos.push(...opciones.reembolsos);

  const err = (m) => ({ data: null, error: { message: m } });
  const puede = (cap) => s.capacidades[cap]?.[s.usuario.rol] === true;
  const reservado = (pagoId) => s.tablas.reembolsos.filter((r) => r.pago_id === pagoId && ['PENDIENTE', 'DESCONOCIDO', 'CONFIRMADO'].includes(r.estado)).reduce((a, r) => a + Number(r.importe_solicitado), 0);

  const rpcs = {
    abc_obtener_capacidades_rol() {
      s.lecturasCapacidades += 1;
      return { data: { capacidades: Object.entries(s.capacidades).map(([capacidad, porRol]) => ({ capacidad, roles: ROLES.map((rol) => ({ rol, efectivo: porRol[rol] === true })) })) }, error: null };
    },
    abc_solicitar_reembolso(p) {
      if (!puede('ABC_REEMBOLSO_SOLICITAR')) return err('abc_reembolso_no_autorizado');
      if (!String(p.p_motivo || '').trim()) return err('motivo_reembolso_requerido');
      const pago = s.tablas.pagos.find((x) => x.id === p.p_pago_id);
      if (!pago) return err('pago_no_encontrado');
      if (Number(p.p_importe_solicitado) > Number(pago.importe_objetivo) - reservado(pago.id) + 1e-9) return err('saldo_reembolsable_insuficiente');
      const auto = puede('ABC_REEMBOLSO_CONFIRMAR');
      s.contador += 1;
      s.tablas.reembolsos.push({
        id: p.p_reembolso_id, empresa_id: p.p_empresa_id, local_id: p.p_local_id, pago_id: p.p_pago_id, estado: 'PENDIENTE', payment_currency_code: 'EUR',
        importe_solicitado: Number(p.p_importe_solicitado), provider_code: null, provider_reference: null, motivo: p.p_motivo,
        created_at: `2026-10-03T08:0${s.contador}:00Z`, resolved_at: null, created_by: s.usuario.id,
        aprobado_por: auto ? s.usuario.id : null, aprobado_at: auto ? `2026-10-03T08:0${s.contador}:00Z` : null
      });
      return { data: { ok: true, reembolso_id: p.p_reembolso_id, pago_id: p.p_pago_id, estado: 'PENDIENTE', importe_comprometido: Number(p.p_importe_solicitado), currency_code: 'EUR', requiere_aprobacion: !auto, aprobado: auto }, error: null };
    },
    abc_aprobar_reembolso(p) {
      if (!puede('ABC_REEMBOLSO_CONFIRMAR')) return err('abc_aprobar_reembolso_no_autorizado');
      const r = s.tablas.reembolsos.find((x) => x.id === p.p_reembolso_id);
      if (!r) return err('reembolso_no_encontrado');
      if (r.estado !== 'PENDIENTE') return err('reembolso_no_aprobable');
      if (r.aprobado_at) return err('reembolso_ya_aprobado');
      if (r.created_by === s.usuario.id) return err('reembolso_aprobador_distinto_solicitante');
      r.aprobado_por = s.usuario.id;
      r.aprobado_at = '2026-10-03T09:00:00Z';
      return { data: { ok: true, reembolso_id: r.id, estado: 'PENDIENTE', aprobado: true, aprobado_por: s.usuario.id }, error: null };
    },
    abc_cancelar_reembolso(p) {
      if (!puede('ABC_REEMBOLSO_CONFIRMAR')) return err('abc_cancelar_reembolso_no_autorizado');
      if (!String(p.p_motivo_cancelacion || '').trim()) return err('motivo_cancelacion_requerido');
      const r = s.tablas.reembolsos.find((x) => x.id === p.p_reembolso_id);
      if (!r) return err('reembolso_no_encontrado');
      if (r.estado !== 'PENDIENTE') return err('reembolso_no_cancelable');
      r.estado = 'CANCELADO';
      r.resolved_at = '2026-10-03T09:30:00Z';
      return { data: { ok: true, reembolso_id: r.id, estado: 'CANCELADO' }, error: null };
    },
    abc_confirmar_reembolso_efectivo(p) {
      if (!puede('ABC_REEMBOLSO_CONFIRMAR')) return err('abc_confirmar_reembolso_no_autorizado');
      const r = s.tablas.reembolsos.find((x) => x.id === p.p_reembolso_id);
      if (!r) return err('reembolso_no_encontrado');
      if (r.estado !== 'PENDIENTE') return err('reembolso_efectivo_no_confirmable');
      if (!r.aprobado_at) return err('reembolso_pendiente_aprobacion');
      r.estado = 'CONFIRMADO';
      r.resolved_at = '2026-10-03T09:45:00Z';
      return { data: { ok: true, reembolso_id: r.id, estado: 'CONFIRMADO' }, error: null };
    }
  };

  function consulta(nombre) {
    const filtros = [];
    let columnas = '';
    let orden = null;
    let limite = null;
    const q = {
      select(c) { columnas = c; return q; },
      eq(col, v) { filtros.push((f) => f[col] === v); return q; },
      in(col, vs) { filtros.push((f) => vs.includes(f[col])); return q; },
      is(col, v) { filtros.push((f) => (f[col] ?? null) === v); return q; },
      order(col, o) { orden = { col, asc: o?.ascending !== false }; return q; },
      limit(n) { limite = n; return q; },
      maybeSingle() { return Promise.resolve(q._ejecutar(true)); },
      then(ok, ko) { return Promise.resolve(q._ejecutar(false)).then(ok, ko); },
      _ejecutar(unica) {
        const tabla = s.tablas[nombre];
        s.consultas.push({ tabla: nombre, columnas });
        if (!tabla) return err('tabla no simulada: ' + nombre);
        let filas = tabla.filter((f) => filtros.every((fn) => fn(f)));
        if (orden) filas = [...filas].sort((a, b) => (String(a[orden.col]) < String(b[orden.col]) ? -1 : 1) * (orden.asc ? 1 : -1));
        if (limite != null) filas = filas.slice(0, limite);
        const cols = columnas ? columnas.split(',').map((c) => c.trim()) : null;
        const proyecta = (f) => (cols ? Object.fromEntries(cols.map((c) => [c, f[c]])) : f);
        const datos = filas.map(proyecta);
        return { data: unica ? (datos[0] ?? null) : datos, error: null };
      }
    };
    return q;
  }

  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: s.usuario.id } } }, error: null }) },
    from: (nombre) => consulta(nombre),
    async rpc(nombre, params) {
      s.llamadas.push({ nombre, params });
      if (s.retardos[nombre]) await new Promise((r) => setTimeout(r, s.retardos[nombre]));
      if (s.fallos[nombre]) return err(s.fallos[nombre]);
      const f = rpcs[nombre];
      if (!f) return err('funcion_no_simulada:' + nombre);
      return f(params || {});
    }
  };
  return { cliente, estado: s };
}
