from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

if 'APROBADA_HUMANO' in s and 'PM13 P07: propuesta IA' in s:
    print('PM13 P07: fuente ya endurecida')
    raise SystemExit(0)

start = s.index('function crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId }) {')
end = s.index('function crearLogicaEntrevistas', start)

nuevo_motor = r'''function crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId }) {
  const empleadoNominaLocal = (id) => empleados.find((e2) => e2.id === id && (!localActivoId || e2.localId === localActivoId));
  const nominaEsLocal = (n2) => !!n2 && (!localActivoId || n2.localId === localActivoId);
  const hoyNominaPM13 = () => typeof todayISO === "function" ? todayISO() : "";
  const altasSesionNominaPM13 = /* @__PURE__ */ new Map();
  const anuladasSesionNominaPM13 = /* @__PURE__ */ new Set();
  const errorNominaPM13 = (error) => ({ ok: false, error });
  const claveNominaPM13 = (empleadoId, mes) => `${empleadoId || ""}|${mes || ""}`;
  const mesNominaValidoPM13 = (mes) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ""));
  function prepararNominaPM13(data, emp, actual = null) {
    if (!data || typeof data !== "object") return errorNominaPM13("Los datos de la nómina no son válidos.");
    const mes = String(data.mes || "").trim();
    if (!mesNominaValidoPM13(mes)) return errorNominaPM13("El mes de la nómina no es válido.");
    const bruto = Number(data.brutoTotal);
    const ss = data.seguridadSocialEmpresa === "" || data.seguridadSocialEmpresa == null ? 0 : Number(data.seguridadSocialEmpresa);
    if (!Number.isFinite(bruto) || bruto <= 0) return errorNominaPM13("El bruto total debe ser mayor que cero.");
    if (!Number.isFinite(ss) || ss < 0) return errorNominaPM13("La Seguridad Social de empresa no puede ser negativa.");
    const origen = actual && actual.origen === "IA" ? "IA" : data.origen === "IA" ? "IA" : "MANUAL";
    if (origen === "IA" && data.revisionHumanaConfirmada !== true) {
      return errorNominaPM13("La propuesta de IA requiere revisión humana explícita antes de guardarse.");
    }
    return {
      ok: true,
      datos: {
        ...data,
        empleadoId: emp.id,
        mes,
        brutoTotal: bruto,
        seguridadSocialEmpresa: ss,
        costeTotalEmpresa: bruto + ss,
        localId: emp.localId || localActivoId || null,
        origen,
        estado: origen === "IA" ? "APROBADA_HUMANO" : "REGISTRADA_MANUAL",
        requiereRevisionHumana: false,
        revisionHumanaConfirmada: origen === "IA" ? true : null,
        fechaRevisionHumana: origen === "IA" ? hoyNominaPM13() : "",
        fechaRegistro: actual?.fechaRegistro || hoyNominaPM13(),
        fechaAnulacion: ""
      }
    };
  }
  function addNomina(data) {
    const emp = empleadoNominaLocal(data?.empleadoId);
    if (!emp) return errorNominaPM13("La nómina no pertenece a un empleado del local activo.");
    const preparada = prepararNominaPM13(data, emp);
    if (!preparada.ok) return preparada;
    const clave = claveNominaPM13(preparada.datos.empleadoId, preparada.datos.mes);
    const existente = nominas.find((n2) => nominaEsLocal(n2) && n2.estado !== "ANULADA" && claveNominaPM13(n2.empleadoId, n2.mes) === clave);
    if (existente) return errorNominaPM13("Ya existe una nómina activa para este empleado y mes. Edítala o anúlala antes de registrar otra.");
    if (altasSesionNominaPM13.has(clave)) return { ok: true, replayed: true, id: altasSesionNominaPM13.get(clave) };
    const nueva = { ...preparada.datos, id: uid() };
    altasSesionNominaPM13.set(clave, nueva.id);
    setNominas((s22) => [nueva, ...s22]);
    registrarAuditoria(
      nueva.origen === "IA" ? "Aprobar registro de nómina asistido por IA" : "Registrar nómina manual",
      `${nueva.mes} · €${nueva.costeTotalEmpresa.toFixed(2)} · ${nueva.origen === "IA" ? "revisión humana confirmada" : "entrada manual"}`
    );
    return { ok: true, replayed: false, nomina: nueva };
  }
  function updateNomina(id, data) {
    const actual = nominas.find((n2) => n2.id === id);
    if (!nominaEsLocal(actual)) return errorNominaPM13("La nómina está fuera del contexto autorizado.");
    if (actual.estado === "ANULADA") return errorNominaPM13("Una nómina anulada no se puede editar.");
    if (actual.origen === "IA" || actual.estado === "APROBADA_HUMANO") {
      return errorNominaPM13("Una nómina asistida por IA ya revisada es inmutable. Anúlala y registra una corrección nueva.");
    }
    const emp = empleadoNominaLocal(data?.empleadoId || actual.empleadoId);
    if (!emp) return errorNominaPM13("La nómina no pertenece a un empleado del local activo.");
    const preparada = prepararNominaPM13({ ...data, origen: "MANUAL" }, emp, actual);
    if (!preparada.ok) return preparada;
    const duplicada = nominas.find((n2) => n2.id !== id && nominaEsLocal(n2) && n2.estado !== "ANULADA" && n2.empleadoId === preparada.datos.empleadoId && n2.mes === preparada.datos.mes);
    if (duplicada) return errorNominaPM13("Ya existe otra nómina activa para este empleado y mes.");
    const sinCambios = actual.empleadoId === preparada.datos.empleadoId && actual.mes === preparada.datos.mes && Number(actual.brutoTotal) === preparada.datos.brutoTotal && Number(actual.seguridadSocialEmpresa || 0) === preparada.datos.seguridadSocialEmpresa && String(actual.notas || "") === String(preparada.datos.notas || "");
    if (sinCambios) return { ok: true, yaSinCambios: true };
    const actualizada = { ...actual, ...preparada.datos, id: actual.id, origen: actual.origen || "MANUAL", estado: "REGISTRADA_MANUAL" };
    setNominas((s22) => s22.map((n2) => n2.id === id ? actualizada : n2));
    registrarAuditoria("Editar registro manual de nómina", `${actualizada.mes} · €${actualizada.costeTotalEmpresa.toFixed(2)}`);
    return { ok: true, nomina: actualizada };
  }
  function deleteNomina(id) {
    const actual = nominas.find((n2) => n2.id === id);
    if (!nominaEsLocal(actual)) return errorNominaPM13("La nómina está fuera del contexto autorizado.");
    if (actual.estado === "ANULADA" || anuladasSesionNominaPM13.has(id)) return { ok: true, replayed: true };
    anuladasSesionNominaPM13.add(id);
    setNominas((s22) => s22.map((n2) => n2.id === id ? { ...n2, estado: "ANULADA", fechaAnulacion: hoyNominaPM13() } : n2));
    registrarAuditoria("Anular registro de nómina", `${actual.mes || ""} · €${(Number(actual.costeTotalEmpresa) || 0).toFixed(2)} · sin borrado físico`);
    return { ok: true, replayed: false };
  }
  return { addNomina, updateNomina, deleteNomina };
}
'''

s = s[:start] + nuevo_motor + s[end:]

def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: esperado 1, encontrado {count}')
    s = s.replace(old, new, 1)

replace_once(
'''  const nominasDelMes = nominas.filter((n2) => n2.mes === mes);
  const costeTotalMes = nominasDelMes.reduce((a22, n2) => a22 + (Number(n2.costeTotalEmpresa) || 0), 0);''',
'''  const nominasDelMes = nominas.filter((n2) => n2.mes === mes);
  const nominasValidasDelMesPM13 = nominasDelMes.filter((n2) => n2.estado !== "ANULADA");
  const costeTotalMes = nominasValidasDelMesPM13.reduce((a22, n2) => a22 + (Number(n2.costeTotalEmpresa) || 0), 0);''',
'coste excluye anuladas'
)

replace_once(
'''      const mesSaneado = mesLimpio(d2.mes);
      const avisos = [];''',
'''      const mesSaneado = mesLimpio(d2.mes);
      const avisos = ["PM13 P07: propuesta IA. Revisa empleado, mes, bruto y Seguridad Social. La IA no emite ni valida una nómina oficial y el guardado exige confirmación humana explícita."];''',
'aviso revision IA'
)

replace_once(
'''        seguridadSocialEmpresa: numeroLimpio(d2.seguridadSocialEmpresa),
        notas: d2.notas || ""
      });''',
'''        seguridadSocialEmpresa: numeroLimpio(d2.seguridadSocialEmpresa),
        notas: d2.notas || "",
        origen: "IA",
        revisionHumanaConfirmada: false
      });''',
'origen IA en formulario'
)

replace_once(
'''    setError("");
    if (editingId) updateNomina(editingId, form);
    else addNomina(form);
    if (form.mes && form.mes !== mes) setMes(form.mes);
    setForm({ empleadoId: "", mes: form.mes || mes, brutoTotal: "", seguridadSocialEmpresa: "", notas: "" });
    setEditingId(null);
    setAvisosIA([]);
    setShowForm(false);''',
'''    setError("");
    let datosGuardarPM13 = form;
    if (!editingId && form.origen === "IA") {
      const revisionConfirmadaPM13 = typeof window !== "undefined" && typeof window.confirm === "function" && window.confirm("Revisión humana obligatoria: confirma que has comprobado empleado, mes, bruto, Seguridad Social y notas contra la nómina original. La IA solo propone datos y no sustituye tu revisión.");
      if (!revisionConfirmadaPM13) {
        setError("La propuesta de IA no se ha guardado porque falta confirmar la revisión humana.");
        return;
      }
      datosGuardarPM13 = { ...form, revisionHumanaConfirmada: true };
    }
    const resultadoNominaPM13 = editingId ? updateNomina(editingId, datosGuardarPM13) : addNomina(datosGuardarPM13);
    if (!resultadoNominaPM13 || resultadoNominaPM13.ok === false) {
      setError(resultadoNominaPM13?.error || "No se pudo guardar la nómina.");
      return;
    }
    if (form.mes && form.mes !== mes) setMes(form.mes);
    setForm({ empleadoId: "", mes: form.mes || mes, brutoTotal: "", seguridadSocialEmpresa: "", notas: "" });
    setEditingId(null);
    setAvisosIA([]);
    setShowForm(false);''',
'submit fail closed y revision humana'
)

replace_once(
'''      seguridadSocialEmpresa: n2.seguridadSocialEmpresa ?? "",
      notas: n2.notas || ""
    });''',
'''      seguridadSocialEmpresa: n2.seguridadSocialEmpresa ?? "",
      notas: n2.notas || "",
      origen: n2.origen || "MANUAL",
      revisionHumanaConfirmada: false
    });''',
'edicion conserva origen'
)

replace_once(
'''/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => abrirEdicion(n2) }, /* @__PURE__ */ import_react4.default.createElement(Pencil, { size: 13 }), " Editar")''',
'''/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", disabled: n2.origen === "IA" || n2.estado === "ANULADA", onClick: () => abrirEdicion(n2) }, /* @__PURE__ */ import_react4.default.createElement(Pencil, { size: 13 }), n2.origen === "IA" ? " Revisada por humano" : n2.estado === "ANULADA" ? " Anulada" : " Editar")''',
'bloqueo edicion IA'
)

replace_once(
'''/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => deleteNomina(n2.id) }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 13 }), " Eliminar")''',
'''/* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", disabled: n2.estado === "ANULADA", onClick: () => deleteNomina(n2.id) }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 13 }), n2.estado === "ANULADA" ? " Anulada" : " Anular")''',
'anulacion UI'
)

p.write_text(s, encoding='utf-8')
print('PM13 P07: propuesta IA -> revision humana -> registro trazable aplicada')
