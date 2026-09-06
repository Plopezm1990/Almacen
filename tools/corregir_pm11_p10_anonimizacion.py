from pathlib import Path
import sys

ruta = Path(sys.argv[1] if len(sys.argv) > 1 else 'fuente.js')
s = ruta.read_text(encoding='utf-8')

MARCADOR = 'pm11_anonimizar_empleado'
if MARCADOR in s:
    print(f'PM11 P10 anonimización: ya aplicada en {ruta}')
    raise SystemExit(0)

old_anon = r'''  function anonimizarEmpleado(id) {
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
  }'''

new_anon = r'''  function anonimizarEmpleado(id) {
    const e2 = empleados.find((x3) => x3.id === id);
    if (!empleadoEsDelLocalActivoPersonal(e2) || !localActivoId) return errorValidacionPM10("contexto_no_autorizado", "empleadoId", "El empleado no pertenece al local activo.");
    if (e2.anonimizado || e2.estado === "anonimizado") return errorValidacionPM10("estado_invalido", "empleadoId", "El empleado ya está anonimizado.");
    if (e2.activo !== false) return errorValidacionPM10("estado_invalido", "empleadoId", "Da de baja al empleado antes de anonimizarlo.");
    if (pm11UsarSqlPersonal()) {
      if (!empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "No se pudo resolver la empresa activa.");
      return aplicarRpc(pm11RpcPersonal("pm11_anonimizar_empleado", {
        p_empresa_id: empresaId,
        p_local_id: e2.localId || localActivoId,
        p_empleado_id: id
      }));
    }
    registrarAuditoria("Anonimizar empleado", e2.nombre);
    setEmpleados(
      (s22) => s22.map(
        (emp) => emp.id === id ? {
          ...emp,
          nombre: "Empleado anonimizado",
          dni: "",
          nif: "",
          nie: "",
          email: "",
          telefono: "",
          movil: "",
          direccion: "",
          pin: "",
          documentos: [],
          ausencias: [],
          epis: [],
          anonimizado: true,
          estado: "anonimizado",
          activo: false,
          anonimizadoAt: (/* @__PURE__ */ new Date()).toISOString()
        } : emp
      )
    );
    return true;
  }'''

if s.count(old_anon) != 1:
    raise SystemExit(f'Bloque anonimizarEmpleado inesperado: {s.count(old_anon)}')
s = s.replace(old_anon, new_anon, 1)

old_ui = '''reactivarEmpleado && e2.activo === false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: async () => {
      setErrorAccion("");
      const resultado = await Promise.resolve(reactivarEmpleado(e2.id));
      if (!resultado || resultado.ok === false) setErrorAccion(resultado?.error || "No se pudo reactivar al empleado.");
    } }, "Reactivar"), e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => openEdit(e2) }, "Editar")'''

new_ui = '''reactivarEmpleado && e2.activo === false && !e2.anonimizado && e2.estado !== "anonimizado" && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: async () => {
      setErrorAccion("");
      const resultado = await Promise.resolve(reactivarEmpleado(e2.id));
      if (!resultado || resultado.ok === false) setErrorAccion(resultado?.error || "No se pudo reactivar al empleado.");
    } }, "Reactivar"), anonimizarEmpleado && e2.activo === false && !e2.anonimizado && e2.estado !== "anonimizado" && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: async () => {
      setErrorAccion("");
      const confirmar = typeof window === "undefined" ? false : window.confirm("Anonimizar es irreversible. Se eliminarán los datos identificativos y, si existe una cuenta vinculada, se retirará su acceso. ¿Continuar?");
      if (!confirmar) return;
      const resultado = await Promise.resolve(anonimizarEmpleado(e2.id));
      if (!resultado || resultado.ok === false) setErrorAccion(resultado?.error || "No se pudo anonimizar al empleado.");
    } }, "Anonimizar"), e2.activo !== false && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => openEdit(e2) }, "Editar")'''

if s.count(old_ui) != 1:
    raise SystemExit(f'Acciones Reactivar/Editar inesperadas: {s.count(old_ui)}')
s = s.replace(old_ui, new_ui, 1)

ruta.write_text(s, encoding='utf-8')
print(f'PM11 P10 anonimización frontend aplicada en {ruta}')
