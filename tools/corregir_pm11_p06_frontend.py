from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'fuente.js')
s = ruta.read_text(encoding='utf-8')

MARCADOR = 'function pm11UsarSqlPersonal()'
if MARCADOR in s:
    print(f'PM11 P06 frontend: ya aplicado en {ruta}')
    raise SystemExit(0)

logic_ini = s.find('function crearLogicaPersonal({')
logic_fin = s.find('function crearLogicaTurnos({', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('No se encontró crearLogicaPersonal/crearLogicaTurnos')

nuevo_bloque = r'''function pm11UsarSqlPersonal() {
  return typeof window !== "undefined" && window.__nubeActiva === true;
}
function pm11ErrorPersonal(error, fallback = "No se pudo completar la operación de Personal.") {
  const mensaje = error?.message || error?.details || error?.hint || fallback;
  return { ok: false, error: String(mensaje || fallback) };
}
async function pm11ClientePersonal() {
  if (!pm11UsarSqlPersonal()) return null;
  if (typeof window.getSupabaseClient !== "function") throw new Error("Cliente Supabase no disponible.");
  return await window.getSupabaseClient();
}
function pm11NormalizarEmpleadoSql(row) {
  if (!row || typeof row !== "object" || !row.id) return null;
  const datos = row.datos && typeof row.datos === "object" && !Array.isArray(row.datos) ? row.datos : {};
  const estado = row.estado || datos.estado || (datos.activo === false ? "inactivo" : "activo");
  return {
    ...datos,
    id: row.id,
    empresaId: row.empresa_id || datos.empresaId || null,
    localId: row.local_id || datos.localId || null,
    nombre: row.nombre ?? datos.nombre ?? (estado === "anonimizado" ? "Empleado anonimizado" : ""),
    estado,
    activo: estado === "activo",
    anonimizado: estado === "anonimizado",
    bajaAt: row.baja_at || datos.bajaAt || null,
    reactivadoAt: row.reactivado_at || datos.reactivadoAt || null,
    anonimizadoAt: row.anonimizado_at || datos.anonimizadoAt || null,
    actualizadoAt: row.updated_at || datos.actualizadoAt || null
  };
}
function pm11FusionarEmpleados(actuales, remotos) {
  const mapa = new Map();
  (Array.isArray(actuales) ? actuales : []).forEach((e2) => {
    if (e2 && e2.id) mapa.set(e2.id, e2);
  });
  (Array.isArray(remotos) ? remotos : []).forEach((row) => {
    const e2 = pm11NormalizarEmpleadoSql(row);
    if (!e2) return;
    mapa.set(e2.id, { ...mapa.get(e2.id) || {}, ...e2 });
  });
  return Array.from(mapa.values());
}
function pm11DatosMutables(datos) {
  const copia = { ...datos || {} };
  for (const k of ["id", "empresaId", "localId", "estado", "activo", "anonimizado", "nombre"]) delete copia[k];
  return copia;
}
async function pm11CargarEmpleadosSql(localActivoId = null) {
  try {
    const supabase = await pm11ClientePersonal();
    if (!supabase) return { ok: true, local: true, empleados: [] };
    let consulta = supabase.from("empleados").select("id,empresa_id,local_id,estado,nombre,datos,baja_at,reactivado_at,anonimizado_at,updated_at");
    if (localActivoId) consulta = consulta.eq("local_id", localActivoId);
    const { data, error } = await consulta.order("nombre", { ascending: true });
    if (error) return pm11ErrorPersonal(error, "No se pudieron cargar los empleados desde SQL.");
    return { ok: true, empleados: Array.isArray(data) ? data : [] };
  } catch (error) {
    return pm11ErrorPersonal(error, "No se pudieron cargar los empleados desde SQL.");
  }
}
async function pm11RpcPersonal(nombre, payload) {
  try {
    const supabase = await pm11ClientePersonal();
    if (!supabase) return { ok: false, local: true, error: "La operación SQL requiere conexión a la nube." };
    const { data, error } = await supabase.rpc(nombre, payload);
    if (error) return pm11ErrorPersonal(error);
    if (!data || data.ok === false) return { ok: false, error: data?.error || "La operación de Personal fue rechazada." };
    const empleado = pm11NormalizarEmpleadoSql(data.empleado);
    if (!empleado) return { ok: false, error: "La operación no devolvió una ficha de empleado válida." };
    return { ok: true, empleado };
  } catch (error) {
    return pm11ErrorPersonal(error);
  }
}
function crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId, locales = [], empresaId = null }) {
  const empleadoEsDelLocalActivoPersonal = (e2) => !!e2 && (!localActivoId || e2.localId === localActivoId);
  const aplicarEmpleado = (empleado) => {
    if (!empleado || !empleado.id) return;
    setEmpleados((s22) => pm11FusionarEmpleados(s22, [{
      ...empleado,
      empresa_id: empleado.empresaId,
      local_id: empleado.localId,
      baja_at: empleado.bajaAt,
      reactivado_at: empleado.reactivadoAt,
      anonimizado_at: empleado.anonimizadoAt,
      updated_at: empleado.actualizadoAt,
      datos: empleado,
      estado: empleado.estado,
      nombre: empleado.nombre,
      id: empleado.id
    }]));
  };
  const aplicarRpc = (promesa) => promesa.then((r2) => {
    if (!r2.ok) return r2;
    aplicarEmpleado(r2.empleado);
    return r2.empleado;
  });
  function addEmpleado(data) {
    const validacion = validarEmpleadoPM10(data, { localActivoId, locales, empresaId });
    if (!validacion.ok) return validacion;
    const empleadoId = uid();
    if (pm11UsarSqlPersonal()) {
      if (!empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "No se pudo resolver la empresa activa.");
      return aplicarRpc(pm11RpcPersonal("pm11_alta_empleado", {
        p_empresa_id: empresaId,
        p_local_id: localActivoId,
        p_empleado_id: empleadoId,
        p_nombre: validacion.datos.nombre,
        p_datos: pm11DatosMutables(validacion.datos)
      }));
    }
    const nuevo = { id: empleadoId, activo: true, estado: "activo", documentos: [], ...validacion.datos, localId: localActivoId };
    setEmpleados((s22) => [...s22, nuevo]);
    return nuevo;
  }
  async function crearCuentaEmpleado(empleadoId, { nombre, email, password, rol }) {
    const empleadoLocal = empleados.find((e2) => e2.id === empleadoId);
    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal) || empleadoLocal?.activo === false) return { ok: false, error: "El empleado no está activo en el local actual." };
    try {
      const supabase = await window.getSupabaseClient();
      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion?.session?.access_token;
      if (!token) return { ok: false, error: "No hay sesión activa — vuelve a iniciar sesión." };
      const resp = await fetch("https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/crear-cuenta-empleado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ empleadoId, nombre, email, password, rol })
      });
      const r2 = await resp.json();
      if (!r2.ok) return r2;
      setEmpleados((s22) => s22.map((e2) => e2.id === empleadoId ? { ...e2, tieneCuenta: true, rolCuenta: rol, emailCuenta: email } : e2));
      registrarAuditoria("Crear cuenta de empleado", `${nombre} · ${rol} · ${email}`);
      return { ok: true };
    } catch (e2) {
      return { ok: false, error: "No se ha podido conectar: " + (e2?.message || "error de red") };
    }
  }
  function updateEmpleado(id, data) {
    const actual = empleados.find((e2) => e2.id === id);
    if (!empleadoEsDelLocalActivoPersonal(actual) || !localActivoId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");
    if (actual.activo === false) return errorValidacionPM10("estado_invalido", "empleadoId", "Reactiva al empleado antes de editar su ficha.");
    const validacion = validarEmpleadoPM10({ ...actual, ...data, localId: actual.localId || localActivoId }, { localActivoId, locales, empresaId });
    if (!validacion.ok) return validacion;
    if (pm11UsarSqlPersonal()) {
      if (!empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "No se pudo resolver la empresa activa.");
      return aplicarRpc(pm11RpcPersonal("pm11_editar_empleado", {
        p_empresa_id: empresaId,
        p_local_id: actual.localId || localActivoId,
        p_empleado_id: id,
        p_cambios: pm11DatosMutables(validacion.datos),
        p_nombre: validacion.datos.nombre
      }));
    }
    setEmpleados((s22) => s22.map((e2) => e2.id === id ? { ...e2, ...validacion.datos, localId: e2.localId || localActivoId } : e2));
    return true;
  }
  function deleteEmpleado(id) {
    const e2 = empleados.find((x3) => x3.id === id);
    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");
    if (e2.activo === false) return errorValidacionPM10("estado_invalido", "empleadoId", "El empleado ya está de baja.");
    if (pm11UsarSqlPersonal()) {
      if (!empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "No se pudo resolver la empresa activa.");
      return aplicarRpc(pm11RpcPersonal("pm11_baja_empleado", {
        p_empresa_id: empresaId,
        p_local_id: e2.localId || localActivoId,
        p_empleado_id: id,
        p_motivo: "Baja desde Personal"
      }));
    }
    registrarAuditoria("Dar de baja empleado", e2.nombre);
    const ahora = (/* @__PURE__ */ new Date()).toISOString();
    setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: false, estado: "inactivo", bajaAt: emp.bajaAt || ahora } : emp));
    return true;
  }
  function reactivarEmpleado(id) {
    const e2 = empleados.find((x3) => x3.id === id);
    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");
    if (e2.activo !== false) return errorValidacionPM10("estado_invalido", "empleadoId", "El empleado ya está activo.");
    if (e2.anonimizado || e2.estado === "anonimizado") return errorValidacionPM10("estado_invalido", "empleadoId", "Un empleado anonimizado no se puede reactivar.");
    if (pm11UsarSqlPersonal()) {
      if (!empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "No se pudo resolver la empresa activa.");
      return aplicarRpc(pm11RpcPersonal("pm11_reactivar_empleado", {
        p_empresa_id: empresaId,
        p_local_id: e2.localId || localActivoId,
        p_empleado_id: id
      }));
    }
    registrarAuditoria("Reactivar empleado", e2.nombre);
    setEmpleados((s22) => s22.map((emp) => emp.id === id ? { ...emp, activo: true, estado: "activo", reactivadoAt: (/* @__PURE__ */ new Date()).toISOString() } : emp));
    return true;
  }
  function anonimizarEmpleado(id) {
    const e2 = empleados.find((x3) => x3.id === id);
    if (!empleadoEsDelLocalActivoPersonal(e2)) return false;
    if (pm11UsarSqlPersonal()) return { ok: false, error: "La anonimización SQL se habilitará en su operación transaccional específica." };
    if (e2.activo !== false) return { ok: false, error: "Da de baja al empleado antes de anonimizarlo." };
    registrarAuditoria("Anonimizar empleado", e2.nombre);
    setEmpleados(
      (s22) => s22.map(
        (emp) => emp.id === id ? {
          ...emp,
          nombre: "Empleado anonimizado",
          dni: "",
          pin: "",
          documentos: [],
          ausencias: [],
          anonimizado: true,
          estado: "anonimizado",
          activo: false
        } : emp
      )
    );
    return true;
  }
  function registrarAusencia(empleadoId, ausencia) {
    const empleadoLocal = empleados.find((e2) => e2.id === empleadoId);
    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal)) return false;
    return updateEmpleado(empleadoId, { ausencias: [...empleadoLocal.ausencias || [], { id: uid(), ...ausencia }] });
  }
  function eliminarAusencia(empleadoId, ausenciaId) {
    const empleadoLocal = empleados.find((e2) => e2.id === empleadoId);
    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal)) return false;
    return updateEmpleado(empleadoId, { ausencias: (empleadoLocal.ausencias || []).filter((a22) => a22.id !== ausenciaId) });
  }
  function registrarEpi(empleadoId, epi) {
    const empleadoLocal = empleados.find((e2) => e2.id === empleadoId);
    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal)) return false;
    return updateEmpleado(empleadoId, { epis: [...empleadoLocal.epis || [], { id: uid(), fecha: todayISO(), ...epi }] });
  }
  function eliminarEpi(empleadoId, epiId) {
    const empleadoLocal = empleados.find((e2) => e2.id === empleadoId);
    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal)) return false;
    return updateEmpleado(empleadoId, { epis: (empleadoLocal.epis || []).filter((x3) => x3.id !== epiId) });
  }
  return { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado };
}
'''

s = s[:logic_ini] + nuevo_bloque + s[logic_fin:]

# Sincronización SQL tras la carga del estado legacy/KV. SQL gana por ID; las fichas
# legacy que aún no han sido migradas se mantienen hasta el punto de migración.
empresa_pos = s.find('  const empresaDelLocalActivo = (0, import_react4.useMemo)(() => {')
if empresa_pos < 0:
    raise SystemExit('No se encontró empresaDelLocalActivo para insertar sync PM11')
efecto = r'''  (0, import_react4.useEffect)(() => {
    if (!ready || typeof window === "undefined" || !window.__nubeActiva) return;
    let activo = true;
    (async () => {
      const resultado = await pm11CargarEmpleadosSql(localActivoId);
      if (!activo) return;
      if (!resultado.ok) {
        console.error("PM11: no se pudo sincronizar Personal SQL", resultado.error);
        return;
      }
      setEmpleados((actuales) => pm11FusionarEmpleados(actuales, resultado.empleados));
    })();
    return () => {
      activo = false;
    };
  }, [ready, localActivoId]);
'''
s = s[:empresa_pos] + efecto + s[empresa_pos:]

old_destruct = 'const { addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId, locales, empresaId: empresaDelLocalActivo?.id || null });'
new_destruct = 'const { addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId, locales, empresaId: empresaDelLocalActivo?.id || null });'
if s.count(old_destruct) != 1:
    raise SystemExit(f'Destructuring Personal inesperado: {s.count(old_destruct)}')
s = s.replace(old_destruct, new_destruct, 1)

p_ini = s.find('function Personal({')
p_fin = s.find('\nfunction inicioSemana(', p_ini)
if p_ini < 0 or p_fin < 0:
    raise SystemExit('No se encontró bloque UI Personal')
p = s[p_ini:p_fin]

old_sig = 'function Personal({ empleados, addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, documentosPersonalCaducan, fichajes = [], nominas = [], entrevistas = [], crearEntrevista, actualizarEntrevista, finalizarEntrevista, eliminarEntrevista, crearPrefiltro, listarPrefiltros, eliminarPrefiltro, crearCuentaEmpleado }) {'
new_sig = 'function Personal({ empleados, addEmpleado, updateEmpleado, deleteEmpleado, reactivarEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, documentosPersonalCaducan, fichajes = [], nominas = [], entrevistas = [], crearEntrevista, actualizarEntrevista, finalizarEntrevista, eliminarEntrevista, crearPrefiltro, listarPrefiltros, eliminarPrefiltro, crearCuentaEmpleado }) {'
if p.count(old_sig) != 1:
    raise SystemExit('Firma Personal inesperada')
p = p.replace(old_sig, new_sig, 1)

old_estado = '  const [error, setError] = (0, import_react4.useState)("");\n  const [editingId, setEditingId] = (0, import_react4.useState)(null);'
new_estado = '  const [error, setError] = (0, import_react4.useState)("");\n  const [errorAccion, setErrorAccion] = (0, import_react4.useState)("");\n  const [editingId, setEditingId] = (0, import_react4.useState)(null);'
if p.count(old_estado) != 1:
    raise SystemExit('Estado de error Personal inesperado')
p = p.replace(old_estado, new_estado, 1)

old_result = '    const resultado = editingId ? updateEmpleado(editingId, datos) : addEmpleado(datos);\n    if (!resultado || resultado.ok === false) {\n      setError(resultado?.error || "No se pudo guardar la ficha del empleado.");'
new_result = '    const resultado = editingId ? updateEmpleado(editingId, datos) : addEmpleado(datos);\n    const resultadoResuelto = await Promise.resolve(resultado);\n    if (!resultadoResuelto || resultadoResuelto.ok === false || resultado.ok === false) {\n      setError(resultadoResuelto?.error || resultado?.error || "No se pudo guardar la ficha del empleado.");'
if p.count(old_result) != 1:
    raise SystemExit('Submit Personal inesperado')
p = p.replace(old_result, new_result, 1)

old_aus = '''  function submitAusencia() {
    registrarAusencia(ausenciaFor, {
      tipo: ausenciaForm.tipo,
      fechaInicio: ausenciaForm.fechaInicio,
      fechaFin: ausenciaForm.fechaFin,
      dias: diasAusencia(ausenciaForm.fechaInicio, ausenciaForm.fechaFin)
    });
    setAusenciaFor(null);
    setAusenciaForm({ tipo: "Vacaciones", fechaInicio: todayISO(), fechaFin: todayISO() });
  }'''
new_aus = '''  async function submitAusencia() {
    setErrorAccion("");
    const resultado = await Promise.resolve(registrarAusencia(ausenciaFor, {
      tipo: ausenciaForm.tipo,
      fechaInicio: ausenciaForm.fechaInicio,
      fechaFin: ausenciaForm.fechaFin,
      dias: diasAusencia(ausenciaForm.fechaInicio, ausenciaForm.fechaFin)
    }));
    if (!resultado || resultado.ok === false) {
      setErrorAccion(resultado?.error || "No se pudo registrar la ausencia.");
      return;
    }
    setAusenciaFor(null);
    setAusenciaForm({ tipo: "Vacaciones", fechaInicio: todayISO(), fechaFin: todayISO() });
  }'''
if p.count(old_aus) != 1:
    raise SystemExit('submitAusencia inesperado')
p = p.replace(old_aus, new_aus, 1)

# Mostrar errores de operaciones sin cerrar formularios ni perder datos.
needle_grid = '  } }, "Cancelar"))), empleados.length === 0 ?'
if p.count(needle_grid) != 1:
    raise SystemExit(f'Punto de errorAccion inesperado: {p.count(needle_grid)}')
p = p.replace(needle_grid, '  } }, "Cancelar"))), errorAccion && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-3", style: { color: C2.red } }, errorAccion), empleados.length === 0 ?', 1)

trash = '/* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => setConfirmDeleteId(e2.id), "aria-label": "Eliminar empleado" }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 15, color: C2.inkSoft }))'
if p.count(trash) != 1:
    raise SystemExit('Botón de baja Personal inesperado')
p = p.replace(trash, 'e2.activo !== false && ' + trash, 1)

edit_btn = '/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => openEdit(e2) }, "Editar")'
if p.count(edit_btn) != 1:
    raise SystemExit('Botón Editar Personal inesperado')
reactivar = '''reactivarEmpleado && e2.activo === false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: async () => {
      setErrorAccion("");
      const resultado = await Promise.resolve(reactivarEmpleado(e2.id));
      if (!resultado || resultado.ok === false) setErrorAccion(resultado?.error || "No se pudo reactivar al empleado.");
    } }, "Reactivar"), e2.activo !== false && ''' + edit_btn
p = p.replace(edit_btn, reactivar, 1)

for original, reemplazo in [
    ('/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAusenciaFor(e2.id) }, "Registrar ausencia")', 'e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setAusenciaFor(e2.id) }, "Registrar ausencia")'),
    ('/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setEpiFor(e2.id) }, "Entregar EPI")', 'e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setEpiFor(e2.id) }, "Entregar EPI")'),
    ('crearCuentaEmpleado && !e2.tieneCuenta &&', 'e2.activo !== false && crearCuentaEmpleado && !e2.tieneCuenta &&')
]:
    if p.count(original) != 1:
        raise SystemExit(f'Acción Personal inesperada: {original[:45]} count={p.count(original)}')
    p = p.replace(original, reemplazo, 1)

old_del_aus = '/* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => eliminarAusencia(e2.id, a22.id), "aria-label": "Eliminar ausencia" }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 14, color: C2.inkSoft }))'
new_del_aus = '''e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement("button", { onClick: async () => {
      setErrorAccion("");
      const resultado = await Promise.resolve(eliminarAusencia(e2.id, a22.id));
      if (!resultado || resultado.ok === false) setErrorAccion(resultado?.error || "No se pudo eliminar la ausencia.");
    }, "aria-label": "Eliminar ausencia" }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 14, color: C2.inkSoft }))'''
if p.count(old_del_aus) != 1:
    raise SystemExit('Eliminar ausencia inesperado')
p = p.replace(old_del_aus, new_del_aus, 1)

old_del_epi = '/* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => eliminarEpi(e2.id, epi.id), "aria-label": "Eliminar EPI" }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 14, color: C2.inkSoft }))'
new_del_epi = '''e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement("button", { onClick: async () => {
      setErrorAccion("");
      const resultado = await Promise.resolve(eliminarEpi(e2.id, epi.id));
      if (!resultado || resultado.ok === false) setErrorAccion(resultado?.error || "No se pudo eliminar el EPI.");
    }, "aria-label": "Eliminar EPI" }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 14, color: C2.inkSoft }))'''
if p.count(old_del_epi) != 1:
    raise SystemExit('Eliminar EPI inesperado')
p = p.replace(old_del_epi, new_del_epi, 1)

old_epi_save = '''/* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => {
    if (epiForm.nombre.trim()) {
      registrarEpi(epiFor, epiForm);
      setEpiFor(null);
      setEpiForm({ nombre: "", firmado: false });
    }
  } }, "Guardar")'''
new_epi_save = '''/* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: async () => {
    if (epiForm.nombre.trim()) {
      setErrorAccion("");
      const resultado = await Promise.resolve(registrarEpi(epiFor, epiForm));
      if (!resultado || resultado.ok === false) {
        setErrorAccion(resultado?.error || "No se pudo registrar el EPI.");
        return;
      }
      setEpiFor(null);
      setEpiForm({ nombre: "", firmado: false });
    }
  } }, "Guardar")'''
if p.count(old_epi_save) != 1:
    raise SystemExit('Guardar EPI inesperado')
p = p.replace(old_epi_save, new_epi_save, 1)

# Sustituir el borrado físico de la UI por baja lógica. La anonimización SQL queda
# fuera de P06 y no se ofrece desde este modal hasta tener su RPC específica.
modal_ini = p.find('confirmDeleteId && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmDeleteId(null), title: "Eliminar empleado" }')
if modal_ini < 0:
    raise SystemExit('Modal Eliminar empleado no encontrado')
modal_nuevo = r'''confirmDeleteId && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmDeleteId(null), title: "Dar de baja empleado" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-3" }, "La ficha no se borra. Se marcará como baja y se conservarán su identidad técnica, documentos, ausencias e historial."), nominas.some((n2) => n2.empleadoId === confirmDeleteId) && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-3", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "Este empleado tiene nóminas registradas. La baja lógica conserva esas referencias y no elimina su historial.")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: async () => {
    setErrorAccion("");
    const resultado = await Promise.resolve(deleteEmpleado(confirmDeleteId));
    if (!resultado || resultado.ok === false) {
      setErrorAccion(resultado?.error || "No se pudo dar de baja al empleado.");
      return;
    }
    setConfirmDeleteId(null);
  } }, "Dar de baja"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmDeleteId(null) }, "Cancelar")))));'''
p = p[:modal_ini] + modal_nuevo

s = s[:p_ini] + p + s[p_fin:]

# Pasar la nueva operación de reactivación al componente.
mount = '      deleteEmpleado,\n      anonimizarEmpleado,'
if s.count(mount) != 1:
    raise SystemExit(f'Montaje Personal inesperado: {s.count(mount)}')
s = s.replace(mount, '      deleteEmpleado,\n      reactivarEmpleado,\n      anonimizarEmpleado,', 1)

ruta.write_text(s, encoding='utf-8')
print(f'PM11 P06 frontend SQL bridge aplicado en {ruta}')
