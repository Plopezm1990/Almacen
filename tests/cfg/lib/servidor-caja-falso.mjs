// Servidor FALSO (un modelo en memoria) del cierre de caja, para probar la pantalla y las funciones del cliente sin conexión.
// Reproduce, con las reglas de las migraciones, lo que el cliente ve del servidor:
//   - tablas legibles por el cliente: terminales_tpv, caja_sesion_terminales, caja_sesiones, caja_cierres, cajas_fisicas
//   - funciones: C04 (iniciar, confirmar provisional, finalizar, reabrir), pieza 2 (diferencia de caja) y pieza 5 (permisos)
//   - pieza 6d: abc_obtener_dia_operativo_local
// NO es el servidor real: el servidor real se prueba con los contratos SQL (tests/cfg/cfg2-contract.sql y cfg6d-contract.sql).
import { randomUUID } from 'node:crypto';

export function crearServidorFalso(opciones = {}) {
  const ids = { E: 'QA-EMP-A', L: 'QA-A1', T: randomUUID(), S: randomUUID(), C: randomUUID(), U: randomUUID() };
  const s = {
    ids,
    rol: opciones.rol || 'Propietario',
    diaServidor: opciones.diaServidor || '2026-10-02',
    umbral: opciones.umbral ?? 0,
    esperado: opciones.esperado ?? 0,
    rolesReabrir: opciones.rolesReabrir || ['Propietario'],
    sesionEstado: opciones.sesionEstado || 'ABIERTA',
    llamadas: [],
    lecturas: [],
    fallos: {},
    terminales: [{ id: ids.T, empresa_id: ids.E, local_id: ids.L, nombre: 'Terminal A1', device_key: 'dk-a1', activo: true }],
    vinculos: [{ empresa_id: ids.E, local_id: ids.L, session_id: ids.S, terminal_id: ids.T, desde: '2026-10-02T19:47:43Z', hasta: null }],
    sesiones: [{ id: ids.S, empresa_id: ids.E, local_id: ids.L, estado: opciones.sesionEstado || 'ABIERTA', version: 1, caja_id: ids.C }],
    cierres: [],
    registros: [],
    cajas: [{ id: ids.C, empresa_id: ids.E, local_id: ids.L, nombre: 'Caja principal', activo: true }]
  };
  const sesion = () => s.sesiones.find((x) => x.id === s.ids.S) || s.sesiones[s.sesiones.length - 1];
  const cierreActivo = () => s.cierres.find((c) => ['INICIADO', 'PROVISIONAL'].includes(c.estado));
  const err = (m) => ({ data: null, error: { message: m } });
  const ok = (d) => ({ data: d, error: null });
  const puedeOperarCaja = () => ['Propietario', 'Encargado', 'Cajero/a'].includes(s.rol);
  const esPropietario = () => s.rol === 'Propietario';

  function estadoDiferencia() {
    const se = sesion();
    const c = s.cierres.find((x) => ['PROVISIONAL', 'FINAL'].includes(x.estado) && x.session_id === se.id);
    if (!c || c.counted == null) return { cierre_id: c ? c.id : null, difference: null, bloqueos: [] };
    const difference = Math.round((c.counted - s.esperado) * 100) / 100;
    const req = Math.abs(difference) > s.umbral;
    const reg = s.registros.find((r) => r.cierre_id === c.id) || null;
    let bloqueos = [];
    if (difference !== 0) {
      if (!reg) bloqueos = ['DIFERENCIA_SIN_MOTIVO'];
      else if (reg.difference !== difference) bloqueos = ['DIFERENCIA_CAMBIADA'];
      else if (reg.estado === 'RECHAZADA') bloqueos = ['DIFERENCIA_RECHAZADA'];
      else if (reg.estado === 'REGISTRADA' && req) bloqueos = ['DIFERENCIA_PENDIENTE_APROBACION'];
    }
    return {
      cierre_id: c.id, cierre_estado: c.estado, currency_code: 'EUR', expected_amount: s.esperado, counted_amount: c.counted,
      difference, umbral: s.umbral, requiere_aprobacion: difference !== 0 && req,
      registro: reg ? { estado: reg.estado, motivo: reg.motivo, difference: reg.difference, requiere_aprobacion: reg.requiere_aprobacion, decision_motivo: reg.decision_motivo || null } : null,
      bloqueos
    };
  }

  const rpcs = {
    abc_consultar_operacion: () => err('operacion_no_encontrada_o_no_autorizada'),
    abc_obtener_dia_operativo_local: () => (puedeOperarCaja() ? ok({ ok: true, operating_day: s.diaServidor }) : err('abc_caja_no_autorizado')),
    abc_obtener_capacidades_rol: () => ok({ ok: true, capacidades: [
      { capacidad: 'ABC_CAJA_OPERAR', roles: [] },
      { capacidad: 'ABC_CIERRE_REABRIR', roles: ['Propietario', 'Encargado', 'Cajero/a', 'Camarero/a'].map((rol) => ({ rol, efectivo: s.rolesReabrir.includes(rol) })) }
    ] }),
    abc_abrir_sesion_caja: (p) => {
      if (!puedeOperarCaja()) return err('abc_caja_no_autorizado');
      s.sesiones.push({ id: p.p_session_id, empresa_id: p.p_empresa_id, local_id: p.p_local_id, estado: 'ABIERTA', version: 1, caja_id: p.p_caja_id });
      s.ids.S = p.p_session_id;
      s.vinculos.push({ empresa_id: p.p_empresa_id, local_id: p.p_local_id, session_id: p.p_session_id, terminal_id: p.p_terminal_id, desde: new Date().toISOString(), hasta: null });
      return ok({ ok: true, session_id: p.p_session_id });
    },
    abc_iniciar_cierre_sesion_caja: (p) => {
      if (!puedeOperarCaja()) return err('abc_caja_no_autorizado');
      if (!p.p_session_id || !p.p_terminal_id || !p.p_operating_day) return err('inicio_cierre_parametros_requeridos');
      const se = s.sesiones.find((x) => x.id === p.p_session_id);
      if (!se || se.estado !== 'ABIERTA') return err('sesion_caja_no_abierta');
      s.cierres.push({ id: randomUUID(), empresa_id: s.ids.E, local_id: s.ids.L, session_id: se.id, estado: 'INICIADO', counted: null, expected_snapshot: { operating_day: p.p_operating_day } });
      se.estado = 'EN_CIERRE'; se.version += 1;
      return ok({ ok: true, session_id: se.id, estado: 'EN_CIERRE' });
    },
    abc_confirmar_cierre_provisional: (p) => {
      if (!puedeOperarCaja()) return err('abc_caja_no_autorizado');
      if (!p.p_session_id || !p.p_terminal_id || !p.p_operating_day) return err('cierre_provisional_parametros_requeridos');
      const se = s.sesiones.find((x) => x.id === p.p_session_id);
      const c = cierreActivo();
      if (!se || se.estado !== 'EN_CIERRE' || !c) return err('cierre_no_iniciado');
      c.estado = 'PROVISIONAL'; c.counted = Number(p.p_counted_amount);
      c.expected_snapshot = { ...c.expected_snapshot, operating_day: p.p_operating_day };
      se.estado = 'CIERRE_PROVISIONAL'; se.version += 1;
      const difference = Math.round((c.counted - s.esperado) * 100) / 100;
      return ok({ ok: true, session_id: se.id, estado: 'CIERRE_PROVISIONAL', blockers: [], expected_amount: s.esperado, counted_amount: c.counted, difference });
    },
    abc_obtener_diferencia_caja: () => {
      if (!puedeOperarCaja()) return err('abc_caja_no_autorizado');
      return ok({ ...estadoDiferencia(), session_estado: sesion().estado });
    },
    abc_registrar_diferencia_caja: (p) => {
      if (!puedeOperarCaja()) return err('abc_caja_no_autorizado');
      const motivo = String(p.p_motivo || '').trim();
      if (!motivo) return err('diferencia_caja_motivo_requerido');
      if (sesion().estado !== 'CIERRE_PROVISIONAL') return err('sesion_no_provisional');
      const e = estadoDiferencia();
      if (e.difference == null || e.difference === 0) return err('diferencia_caja_inexistente');
      let reg = s.registros.find((r) => r.cierre_id === e.cierre_id);
      if (reg && ['APROBADA', 'RECHAZADA'].includes(reg.estado)) return err('diferencia_caja_ya_decidida');
      if (!reg) { reg = { cierre_id: e.cierre_id, estado: 'REGISTRADA' }; s.registros.push(reg); }
      Object.assign(reg, { difference: e.difference, motivo, requiere_aprobacion: e.requiere_aprobacion });
      return ok({ ok: true, estado: 'REGISTRADA', difference: e.difference, umbral: s.umbral, requiere_aprobacion: e.requiere_aprobacion, bloqueos: estadoDiferencia().bloqueos });
    },
    abc_decidir_diferencia_caja: (p) => {
      if (!esPropietario()) return err('abc_diferencia_caja_no_autorizada');
      const decision = String(p.p_decision || '').toUpperCase();
      if (!['APROBAR', 'RECHAZAR'].includes(decision)) return err('diferencia_caja_decision_invalida');
      const motivo = String(p.p_motivo || '').trim();
      if (!motivo) return err('diferencia_caja_motivo_requerido');
      if (sesion().estado !== 'CIERRE_PROVISIONAL') return err('sesion_no_provisional');
      const e = estadoDiferencia();
      const reg = s.registros.find((r) => r.cierre_id === e.cierre_id);
      if (!reg) return err('diferencia_caja_sin_registro');
      if (reg.estado !== 'REGISTRADA') return err('diferencia_caja_ya_decidida');
      if (!(Math.abs(e.difference) > s.umbral)) return err('diferencia_caja_no_requiere_aprobacion');
      reg.estado = decision === 'APROBAR' ? 'APROBADA' : 'RECHAZADA'; reg.decision_motivo = motivo;
      return ok({ ok: true, estado: reg.estado, difference: e.difference, umbral: s.umbral, bloqueos: estadoDiferencia().bloqueos });
    },
    abc_finalizar_cierre_sesion_caja: (p) => {
      if (!puedeOperarCaja()) return err('abc_caja_no_autorizado');
      if (!p.p_session_id || !p.p_terminal_id || !p.p_operating_day) return err('cierre_final_parametros_invalidos');
      const se = s.sesiones.find((x) => x.id === p.p_session_id);
      if (!se || se.estado !== 'CIERRE_PROVISIONAL') return err('sesion_no_provisional');
      const b = estadoDiferencia().bloqueos;
      if (b.length > 0) return err('cierre_definitivo_diferencia_pendiente:' + JSON.stringify(b));
      se.estado = 'CERRADA_FINAL'; se.version += 1;
      const c = s.cierres.find((x) => x.estado === 'PROVISIONAL'); if (c) c.estado = 'FINAL';
      s.vinculos.filter((v) => v.session_id === se.id && v.hasta === null).forEach((v) => { v.hasta = new Date().toISOString(); });
      return ok({ ok: true, session_id: se.id, estado: 'CERRADA_FINAL' });
    },
    abc_reabrir_cierre_provisional: (p) => {
      if (!puedeOperarCaja() || !s.rolesReabrir.includes(s.rol)) return err('abc_caja_no_autorizado');
      const motivo = String(p.p_motivo || '').trim();
      if (!motivo || !p.p_session_id || !p.p_terminal_id || !p.p_operating_day) return err('reapertura_motivo_requerido');
      const se = s.sesiones.find((x) => x.id === p.p_session_id);
      if (!se || se.estado !== 'CIERRE_PROVISIONAL') return err('sesion_no_provisional');
      const c = s.cierres.find((x) => x.estado === 'PROVISIONAL'); if (c) c.estado = 'CANCELADO';
      se.estado = 'ABIERTA'; se.version += 1;
      return ok({ ok: true, session_id: se.id, estado: 'ABIERTA' });
    }
  };

  function tabla(nombre) {
    const filas = {
      terminales_tpv: () => s.terminales, caja_sesion_terminales: () => s.vinculos, caja_sesiones: () => s.sesiones,
      caja_cierres: () => s.cierres, cajas_fisicas: () => s.cajas, tpv_estaciones_preparacion: () => [], tpv_producto_estaciones: () => []
    }[nombre];
    if (!filas) throw new Error('tabla no simulada: ' + nombre);
    const q = {
      _f: [], _lim: null, _o: null,
      select(cols) { q._cols = cols; return q; },
      eq(c, v) { q._f.push([c, v, 'eq']); return q; },
      is(c, v) { q._f.push([c, v, 'is']); return q; },
      order(c, o) { q._o = [c, o]; return q; },
      limit(n) { q._lim = n; return q; },
      _filas() {
        s.lecturas.push({ tabla: nombre, filtros: q._f.map((f) => f.slice(0, 2)), columnas: q._cols });
        let r = filas().filter((x) => q._f.every(([c, v, t]) => (t === 'is' ? (x[c] ?? null) === v : x[c] === v)));
        if (q._o) r = r.slice().sort((a, b) => (a[q._o[0]] < b[q._o[0]] ? 1 : -1) * (q._o[1]?.ascending === false ? 1 : -1));
        if (q._lim != null) r = r.slice(0, q._lim);
        return r;
      },
      maybeSingle() { const r = q._filas(); return Promise.resolve({ data: r[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: q._filas(), error: null }).then(res, rej); }
    };
    return q;
  }

  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: s.ids.U } } }, error: null }) },
    from: (nombre) => tabla(nombre),
    async rpc(nombre, params) {
      s.llamadas.push({ nombre, params });
      if (s.fallos[nombre]) return err(s.fallos[nombre]);
      const f = rpcs[nombre];
      if (!f) return err('funcion_no_simulada:' + nombre);
      return f(params || {});
    }
  };
  return { cliente, estado: s, sesion, cierreActivo, estadoDiferencia };
}
