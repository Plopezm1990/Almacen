from pathlib import Path
p=Path('fuente.js'); s=p.read_text(encoding='utf-8')

def uno(txt,a,b,n):
    c=txt.count(a); assert c==1, f'{n}: esperado 1, encontrado {c}'; print('OK',n); return txt.replace(a,b,1)

# Personal: proteger todas las mutaciones contra empleados de otro local.
ini=s.index('function crearLogicaPersonal('); fin=s.index('function crearLogicaTurnos(',ini); b=s[ini:fin]
b=uno(b,
'function crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId }) {',
'''function crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId }) {
  const empleadoEsDelLocalActivoPersonal = (e) => !!e && (!localActivoId || e.localId === localActivoId);''','Personal helper local')
b=uno(b,
'    setEmpleados((s2) => [...s2, { id: uid(), activo: true, documentos: [], ...data, localId: data.localId || localActivoId || null }]);',
'    setEmpleados((s2) => [...s2, { id: uid(), activo: true, documentos: [], ...data, localId: localActivoId || data.localId || null }]);','Personal alta fuerza local')
b=uno(b,
'''  async function crearCuentaEmpleado(empleadoId, { nombre, email, password, rol }) {
    try {''',
'''  async function crearCuentaEmpleado(empleadoId, { nombre, email, password, rol }) {
    const empleadoLocal = empleados.find((e) => e.id === empleadoId);
    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal)) return { ok: false, error: "El empleado no pertenece al local activo." };
    try {''','Personal cuenta protegida')
b=uno(b,
'''  function updateEmpleado(id, data) {
    setEmpleados((s2) => s2.map((e) => e.id === id ? { ...e, ...data } : e));
  }''',
'''  function updateEmpleado(id, data) {
    setEmpleados((s2) => s2.map((e) => e.id === id && empleadoEsDelLocalActivoPersonal(e) ? { ...e, ...data, localId: e.localId || localActivoId || null } : e));
  }''','Personal update protegido')
b=uno(b,
'''  function deleteEmpleado(id) {
    const e = empleados.find((x3) => x3.id === id);
    registrarAuditoria("Eliminar empleado", e ? e.nombre : id);
    setEmpleados((s2) => s2.filter((e2) => e2.id !== id));
    if (setNominas) setNominas((s2) => s2.filter((n) => n.empleadoId !== id));
  }''',
'''  function deleteEmpleado(id) {
    const e = empleados.find((x3) => x3.id === id);
    if (!empleadoEsDelLocalActivoPersonal(e)) return false;
    registrarAuditoria("Eliminar empleado", e.nombre);
    setEmpleados((s2) => s2.filter((e2) => e2.id !== id));
    if (setNominas) setNominas((s2) => s2.filter((n) => n.empleadoId !== id));
    return true;
  }''','Personal delete protegido')
b=uno(b,
'''  function anonimizarEmpleado(id) {
    const e = empleados.find((x3) => x3.id === id);
    registrarAuditoria("Anonimizar empleado", e ? e.nombre : id);''',
'''  function anonimizarEmpleado(id) {
    const e = empleados.find((x3) => x3.id === id);
    if (!empleadoEsDelLocalActivoPersonal(e)) return false;
    registrarAuditoria("Anonimizar empleado", e.nombre);''','Personal anonimizar protegido')
for fn in ['registrarAusencia','eliminarAusencia','registrarEpi','eliminarEpi']:
    marker=f'  function {fn}(empleadoId,'
    pos=b.index(marker); brace=b.index('{',pos); nl=b.index('\n',brace)
    guard='    const empleadoLocal = empleados.find((e) => e.id === empleadoId);\n    if (!empleadoEsDelLocalActivoPersonal(empleadoLocal)) return false;\n'
    b=b[:nl+1]+guard+b[nl+1:]
s=s[:ini]+b+s[fin:]

# Turnos: motor completamente local.
ini=s.index('function crearLogicaTurnos('); fin=s.index('function crearLogicaAppcc(',ini); old=s[ini:fin]
new='''function crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId }) {
  const empleadoTurnoLocal = (id) => empleados.find((e) => e.id === id && (!localActivoId || e.localId === localActivoId));
  const turnoEsLocal = (t2) => !!t2 && (!localActivoId || t2.localId === localActivoId);
  function addTurno(data) {
    const emp = empleadoTurnoLocal(data.empleadoId);
    if (!emp) return false;
    setTurnos((s2) => [...s2, { id: uid(), ...data, localId: emp.localId || localActivoId || null }]);
    return true;
  }
  function updateTurno(id, data) {
    setTurnos((s2) => s2.map((t2) => t2.id === id && turnoEsLocal(t2) ? { ...t2, ...data, localId: t2.localId || localActivoId || null } : t2));
  }
  function deleteTurno(id) {
    setTurnos((s2) => s2.filter((t2) => t2.id !== id || !turnoEsLocal(t2)));
  }
  function copiarSemana(desdeFechas, haciaFechas) {
    const nuevos = [];
    turnos.filter(turnoEsLocal).forEach((t2) => {
      const idx = desdeFechas.indexOf(t2.fecha);
      if (idx === -1) return;
      nuevos.push({ id: uid(), empleadoId: t2.empleadoId, fecha: haciaFechas[idx], tipo: t2.tipo, horaInicio: t2.horaInicio, horaFin: t2.horaFin, notas: t2.notas, localId: t2.localId || localActivoId || null });
    });
    if (nuevos.length) setTurnos((s2) => [...s2, ...nuevos]);
    return nuevos.length;
  }
  return { addTurno, updateTurno, deleteTurno, copiarSemana };
}
'''
assert old.count('function addTurno')==1 and old.count('copiarSemana')>=1
s=s[:ini]+new+s[fin:]; print('OK Turnos motor local')

# Fichajes: motor completamente local.
ini=s.index('function crearLogicaFichaje('); fin=s.index('function crearLogicaGastos(',ini); old=s[ini:fin]
new='''function crearLogicaFichaje({ fichajes, setFichajes, empleados, localActivoId }) {
  const empleadoFichajeLocal = (id) => empleados.find((e) => e.id === id && (!localActivoId || e.localId === localActivoId));
  const fichajeEsLocal = (f2) => !!f2 && (!localActivoId || f2.localId === localActivoId);
  function fichar(empleadoId, tipo) {
    const emp = empleadoFichajeLocal(empleadoId);
    if (!emp) return false;
    const ahora = /* @__PURE__ */ new Date();
    setFichajes((s2) => [
      { id: uid(), empleadoId, tipo, fecha: todayISO(), hora: ahora.toTimeString().slice(0, 5), timestamp: ahora.toISOString(), localId: emp.localId || localActivoId || null },
      ...s2
    ]);
    return true;
  }
  function addFichajeManual(data) {
    const emp = empleadoFichajeLocal(data.empleadoId);
    if (!emp) return false;
    setFichajes((s2) => [{ id: uid(), ...data, localId: emp.localId || localActivoId || null }, ...s2]);
    return true;
  }
  function updateFichaje(id, data) {
    setFichajes((s2) => s2.map((f2) => f2.id === id && fichajeEsLocal(f2) ? { ...f2, ...data, localId: f2.localId || localActivoId || null } : f2));
  }
  function eliminarFichaje(id) {
    setFichajes((s2) => s2.filter((f2) => f2.id !== id || !fichajeEsLocal(f2)));
  }
  return { fichar, addFichajeManual, updateFichaje, eliminarFichaje };
}
'''
assert old.count('function fichar')==1 and old.count('addFichajeManual')>=1
s=s[:ini]+new+s[fin:]; print('OK Fichajes motor local')

# Nóminas: motor local y protegido.
ini=s.index('function crearLogicaNominas('); fin=s.index('function crearLogicaEntrevistas(',ini); old=s[ini:fin]
new='''function crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId }) {
  const empleadoNominaLocal = (id) => empleados.find((e) => e.id === id && (!localActivoId || e.localId === localActivoId));
  const nominaEsLocal = (n) => !!n && (!localActivoId || n.localId === localActivoId);
  function addNomina(data) {
    const emp = empleadoNominaLocal(data.empleadoId);
    if (!emp) return false;
    const bruto = Number(data.brutoTotal) || 0;
    const ss = Number(data.seguridadSocialEmpresa) || 0;
    setNominas((s2) => {
      const sinEsteMes = s2.filter((n) => !(n.empleadoId === data.empleadoId && n.mes === data.mes));
      return [{ id: uid(), ...data, brutoTotal: bruto, seguridadSocialEmpresa: ss, costeTotalEmpresa: bruto + ss, localId: emp.localId || localActivoId || null }, ...sinEsteMes];
    });
    return true;
  }
  function updateNomina(id, data) {
    const actual = nominas.find((n) => n.id === id);
    if (!nominaEsLocal(actual)) return false;
    const bruto = Number(data.brutoTotal) || 0;
    const ss = Number(data.seguridadSocialEmpresa) || 0;
    setNominas((s2) => s2.map((n) => n.id === id ? { ...n, ...data, brutoTotal: bruto, seguridadSocialEmpresa: ss, costeTotalEmpresa: bruto + ss, localId: n.localId || localActivoId || null } : n));
    registrarAuditoria("Editar registro de n\\xF3mina", `${data.mes || ""} \\xB7 \\u20AC${(bruto + ss).toFixed(2)}`);
    return true;
  }
  function deleteNomina(id) {
    const actual = nominas.find((n) => n.id === id);
    if (!nominaEsLocal(actual)) return false;
    setNominas((s2) => {
      const n = s2.find((x3) => x3.id === id);
      registrarAuditoria("Eliminar registro de n\\xF3mina", n ? `${n.mes} \\xB7 \\u20AC${(Number(n.costeTotalEmpresa) || 0).toFixed(2)}` : id);
      return s2.filter((x3) => x3.id !== id);
    });
    return true;
  }
  return { addNomina, updateNomina, deleteNomina };
}
'''
assert old.count('function addNomina')==1 and old.count('deleteNomina')>=1
s=s[:ini]+new+s[fin:]; print('OK Nominas motor local')

# Invocaciones de motores.
s=uno(s,'crearLogicaTurnos({ turnos, setTurnos });','crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId });','Turnos invocacion')
s=uno(s,'crearLogicaFichaje({ setFichajes });','crearLogicaFichaje({ fichajes, setFichajes, empleados, localActivoId });','Fichajes invocacion')
s=uno(s,'crearLogicaNominas({ setNominas, registrarAuditoria });','crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId });','Nominas invocacion')

# Migración histórica por empleado.
marker='      const empleadosFinales = (em || []).map((e) => e.localId ? e : { ...e, localId: localActivoFinal || null });'
insert=marker+'''\n      const localPorEmpleadoMigracion = new Map(empleadosFinales.map((e) => [e.id, e.localId || localActivoFinal || null]));
      const fichajesFinales = (fj || []).map((f2) => f2.localId ? f2 : { ...f2, localId: localPorEmpleadoMigracion.get(f2.empleadoId) || localActivoFinal || null });
      const turnosFinales = (tu || []).map((t2) => t2.localId ? t2 : { ...t2, localId: localPorEmpleadoMigracion.get(t2.empleadoId) || localActivoFinal || null });
      const nominasFinales = (nom || []).map((n) => n.localId ? n : { ...n, localId: localPorEmpleadoMigracion.get(n.empleadoId) || localActivoFinal || null });'''
s=uno(s,marker,insert,'Migracion RRHH derivados')
s=uno(s,'      setEmpleados(empleadosFinales);','''      setEmpleados(empleadosFinales);
      setFichajes(fichajesFinales);
      setTurnos(turnosFinales);
      setNominas(nominasFinales);''','Migracion RRHH setters')
s=uno(s,'      if (JSON.stringify(empleadosFinales) !== JSON.stringify(em || [])) await saveKey("empleados", empleadosFinales);','''      if (JSON.stringify(empleadosFinales) !== JSON.stringify(em || [])) await saveKey("empleados", empleadosFinales);
      if (JSON.stringify(fichajesFinales) !== JSON.stringify(fj || [])) await saveKey("fichajes", fichajesFinales);
      if (JSON.stringify(turnosFinales) !== JSON.stringify(tu || [])) await saveKey("turnos", turnosFinales);
      if (JSON.stringify(nominasFinales) !== JSON.stringify(nom || [])) await saveKey("nominas", nominasFinales);''','Migracion RRHH persistencia')

# Añadir empleadoId a avisos de documentación y contrato.
s=s.replace('filas.push({ id: `${e.id}-doc-${d2.id}`, empleado: e.nombre, concepto: d2.nombre, fecha: d2.fechaCaducidad, dias });','filas.push({ id: `${e.id}-doc-${d2.id}`, empleadoId: e.id, empleado: e.nombre, concepto: d2.nombre, fecha: d2.fechaCaducidad, dias });')
s=s.replace('filas.push({ id: `${e.id}-contrato`, empleado: e.nombre, concepto: "Fin de contrato", fecha: e.fechaFinContrato, dias });','filas.push({ id: `${e.id}-contrato`, empleadoId: e.id, empleado: e.nombre, concepto: "Fin de contrato", fecha: e.fechaFinContrato, dias });')
assert 'empleadoId: e.id, empleado: e.nombre' in s

# Derivados RRHH por local.
marker='  const documentosPersonalPronto = (0, import_react4.useMemo)(() => documentosPersonalCaducan.filter((d2) => d2.dias <= 30), [documentosPersonalCaducan]);'
extra=marker+'''\n  const empleadosDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? empleados : empleados.filter((e) => e.localId === localActivoId), [empleados, localActivoId]);
  const idsEmpleadosDelLocalActivo = (0, import_react4.useMemo)(() => new Set(empleadosDelLocalActivo.map((e) => e.id)), [empleadosDelLocalActivo]);
  const fichajesDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? fichajes : fichajes.filter((f2) => f2.localId === localActivoId), [fichajes, localActivoId]);
  const turnosDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? turnos : turnos.filter((t2) => t2.localId === localActivoId), [turnos, localActivoId]);
  const nominasDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? nominas : nominas.filter((n) => n.localId === localActivoId), [nominas, localActivoId]);
  const documentosPersonalProntoDelLocalActivo = (0, import_react4.useMemo)(() => documentosPersonalPronto.filter((d2) => idsEmpleadosDelLocalActivo.has(d2.empleadoId)), [documentosPersonalPronto, idsEmpleadosDelLocalActivo]);'''
s=uno(s,marker,extra,'RRHH derivados local')

# Fichajes abiertos local.
marker='  }, [fichajes, empleados]);\n  const facturasPorPagar ='
extra='''  }, [fichajes, empleados]);
  const fichajesAbiertosDelLocalActivo = (0, import_react4.useMemo)(() => fichajesAbiertos.filter((f2) => idsEmpleadosDelLocalActivo.has(f2.empleadoId)), [fichajesAbiertos, idsEmpleadosDelLocalActivo]);
  const facturasPorPagar ='''
s=uno(s,marker,extra,'Fichajes abiertos local')

# Selector de informes del propietario: RRHH del local elegido.
marker='  const empleadosInforme = localInformeId ? empleados.filter((e) => e.localId === localInformeId) : empleados;'
if marker in s:
    extra=marker+'''\n  const idsEmpleadosInforme = new Set(empleadosInforme.map((e) => e.id));
  const fichajesAbiertosInforme = localInformeId ? fichajesAbiertos.filter((f2) => idsEmpleadosInforme.has(f2.empleadoId)) : fichajesAbiertos;
  const documentosPersonalProntoInforme = localInformeId ? documentosPersonalPronto.filter((d2) => idsEmpleadosInforme.has(d2.empleadoId)) : documentosPersonalPronto;'''
    s=uno(s,marker,extra,'RRHH informe propietario')
    s=uno(s,'      documentosPersonalPronto,\n      fichajesAbiertos,','      documentosPersonalPronto: documentosPersonalProntoInforme,\n      fichajesAbiertos: fichajesAbiertosInforme,','Dashboard RRHH informe')
else:
    raise AssertionError('empleadosInforme no localizado')

# Pantallas RRHH locales.
ini=s.index('tab === "personal"'); fin=s.index('tab === "venta"',ini); b=s[ini:fin]
for a,b2,n in [
('      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Personal empleados'),
('      fichajes,\n','      fichajes: fichajesDelLocalActivo,\n','Personal fichajes'),
('      nominas,\n','      nominas: nominasDelLocalActivo,\n','Personal nominas')]: b=uno(b,a,b2,n)
# RegistroHorario y CostePersonal have additional occurrences, replace in scoped block sequentially.
b=uno(b,'      empleados,\n      fichajes,\n      fichar,','      empleados: empleadosDelLocalActivo,\n      fichajes: fichajesDelLocalActivo,\n      fichar,','Fichaje props local') if '      empleados,\n      fichajes,\n      fichar,' in b else b
b=b.replace('      fichajesAbiertos\n','      fichajesAbiertos: fichajesAbiertosDelLocalActivo\n',1)
# Coste personal scoped exact after nominas tab.
pos=b.index('tab === "nominas"'); tail=b[pos:]
tail=tail.replace('      empleados,\n','      empleados: empleadosDelLocalActivo,\n',1).replace('      nominas,\n','      nominas: nominasDelLocalActivo,\n',1).replace('      fichajes,\n','      fichajes: fichajesDelLocalActivo,\n',1).replace('      movimientos\n','      movimientos: movimientosDelLocalActivo\n',1)
b=b[:pos]+tail
s=s[:ini]+b+s[fin:]

# Turnos pantalla.
ini=s.index('tab === "turnos"'); fin=s.index('tab === "mapa"',ini); b=s[ini:fin]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Turnos empleados local')
b=uno(b,'      turnos,\n','      turnos: turnosDelLocalActivo,\n','Turnos colección local')
s=s[:ini]+b+s[fin:]

# Badges RRHH locales.
s=uno(s,'{ id: "personal", label: "Personal", icon: Users, badge: documentosPersonalPronto.length, badgeColor: C2.amber }','{ id: "personal", label: "Personal", icon: Users, badge: documentosPersonalProntoDelLocalActivo.length, badgeColor: C2.amber }','Personal badge local')
s=uno(s,'{ id: "fichaje", label: "Registro horario", icon: Clock, badge: fichajesAbiertos.length, badgeColor: C2.amber }','{ id: "fichaje", label: "Registro horario", icon: Clock, badge: fichajesAbiertosDelLocalActivo.length, badgeColor: C2.amber }','Fichaje badge local')

for req in ['empleadosDelLocalActivo','fichajesDelLocalActivo','turnosDelLocalActivo','nominasDelLocalActivo','documentosPersonalProntoDelLocalActivo','fichajesAbiertosDelLocalActivo','const fichajesFinales =','const turnosFinales =','const nominasFinales =','El empleado no pertenece al local activo.']:
    assert req in s, req
p.write_text(s,encoding='utf-8'); print('BLOQUE7B_GUARDAS_OK')