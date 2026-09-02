from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

def uno(txt,viejo,nuevo,nombre):
    n=txt.count(viejo)
    assert n==1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK',nombre)
    return txt.replace(viejo,nuevo,1)

# 1) Migración histórica de Fichajes y Turnos usando el local del empleado.
viejo='''      const empleadosFinales = (em || []).map((e) => e.localId ? e : { ...e, localId: localActivoFinal || null });'''
nuevo='''      const empleadosFinales = (em || []).map((e) => e.localId ? e : { ...e, localId: localActivoFinal || null });
      const localPorEmpleadoMigracion = new Map(empleadosFinales.map((e) => [e.id, e.localId || localActivoFinal || null]));
      const fichajesFinales = (fj || []).map((f2) => f2.localId ? f2 : { ...f2, localId: localPorEmpleadoMigracion.get(f2.empleadoId) || localActivoFinal || null });
      const turnosFinales = (tu || []).map((t2) => t2.localId ? t2 : { ...t2, localId: localPorEmpleadoMigracion.get(t2.empleadoId) || localActivoFinal || null });'''
s=uno(s,viejo,nuevo,'Migración fichajes y turnos')

s=uno(s,
'''      setEmpleados(empleadosFinales);''',
'''      setEmpleados(empleadosFinales);
      setFichajes(fichajesFinales);
      setTurnos(turnosFinales);''',
'Migración asignar fichajes y turnos')

s=uno(s,
'''      if (JSON.stringify(empleadosFinales) !== JSON.stringify(em || [])) await saveKey("empleados", empleadosFinales);''',
'''      if (JSON.stringify(empleadosFinales) !== JSON.stringify(em || [])) await saveKey("empleados", empleadosFinales);
      if (JSON.stringify(fichajesFinales) !== JSON.stringify(fj || [])) await saveKey("fichajes", fichajesFinales);
      if (JSON.stringify(turnosFinales) !== JSON.stringify(tu || [])) await saveKey("turnos", turnosFinales);''',
'Migración persistir fichajes y turnos')

# 2) Derivados operativos del local activo.
ancla='''  const fichajesAbiertos = (0, import_react4.useMemo)(() => {'''
assert s.count(ancla)==1, f'Derivados RRHH: {s.count(ancla)}'
derivados='''  const empleadosDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? empleados : empleados.filter((e) => e.localId === localActivoId), [empleados, localActivoId]);
  const fichajesDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? fichajes : fichajes.filter((f2) => f2.localId === localActivoId), [fichajes, localActivoId]);
  const turnosDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? turnos : turnos.filter((t2) => t2.localId === localActivoId), [turnos, localActivoId]);
'''
s=s.replace(ancla,derivados+ancla,1)
print('OK derivados RRHH')

# Acotar fichajesAbiertos al local activo.
i=s.index('  const fichajesAbiertos =')
# El siguiente cálculo conocido es documentos de personal o APPCC; usar el primero disponible.
candidatos=[x for x in [s.find('  const documentosPersonal',i+20),s.find('  const appccPendientesHoy',i+20),s.find('  const encargosUrgentes',i+20)] if x>i]
assert candidatos, 'Fichajes abiertos: no se encontró límite'
j=min(candidatos); b=s[i:j]
b=uno(b,'return empleados.filter((e) => e.activo !== false)','return empleadosDelLocalActivo.filter((e) => e.activo !== false)','Fichajes abiertos empleados local')
b=uno(b,'const ult = fichajes.filter((f2) => f2.empleadoId === e.id)','const ult = fichajesDelLocalActivo.filter((f2) => f2.empleadoId === e.id)','Fichajes abiertos fichajes local')
if '[empleados, fichajes]' in b:
    b=b.replace('[empleados, fichajes]','[empleadosDelLocalActivo, fichajesDelLocalActivo]',1)
elif '[empleados, fichajes,' in b:
    b=b.replace('[empleados, fichajes,','[empleadosDelLocalActivo, fichajesDelLocalActivo,',1)
else:
    raise AssertionError('Fichajes abiertos: dependencias no localizadas')
s=s[:i]+b+s[j:]

# 3) Lógica de Fichajes protegida por local.
viejo='''function crearLogicaFichaje({ setFichajes }) {
  function fichar(empleadoId, tipo) {
    const ahora = /* @__PURE__ */ new Date();
    setFichajes((s2) => [
      { id: uid(), empleadoId, tipo, fecha: todayISO(), hora: ahora.toTimeString().slice(0, 5), timestamp: ahora.toISOString() },
      ...s2
    ]);
  }
  function addFichajeManual(data) {
    setFichajes((s2) => [{ id: uid(), ...data }, ...s2]);
  }
  function updateFichaje(id, data) {
    setFichajes((s2) => s2.map((f2) => f2.id === id ? { ...f2, ...data } : f2));
  }
  function eliminarFichaje(id) {
    setFichajes((s2) => s2.filter((f2) => f2.id !== id));
  }
  return { fichar, addFichajeManual, updateFichaje, eliminarFichaje };
}'''
nuevo='''function crearLogicaFichaje({ empleados, fichajes, setFichajes, localActivoId }) {
  const empleadoEsDelLocalActivoFichaje = (e) => !!e && (!localActivoId || e.localId === localActivoId);
  const fichajeEsDelLocalActivo = (f2) => !!f2 && (!localActivoId || f2.localId === localActivoId);
  function fichar(empleadoId, tipo) {
    const empleado = empleados.find((e) => e.id === empleadoId);
    if (!empleadoEsDelLocalActivoFichaje(empleado)) return false;
    const ahora = /* @__PURE__ */ new Date();
    setFichajes((s2) => [
      { id: uid(), empleadoId, tipo, fecha: todayISO(), hora: ahora.toTimeString().slice(0, 5), timestamp: ahora.toISOString(), localId: empleado.localId || localActivoId || null },
      ...s2
    ]);
    return true;
  }
  function addFichajeManual(data) {
    const empleado = empleados.find((e) => e.id === data.empleadoId);
    if (!empleadoEsDelLocalActivoFichaje(empleado)) return false;
    setFichajes((s2) => [{ id: uid(), ...data, localId: empleado.localId || localActivoId || null }, ...s2]);
    return true;
  }
  function updateFichaje(id, data) {
    const actual = fichajes.find((f2) => f2.id === id);
    if (!fichajeEsDelLocalActivo(actual)) return false;
    if (data.empleadoId) {
      const empleado = empleados.find((e) => e.id === data.empleadoId);
      if (!empleadoEsDelLocalActivoFichaje(empleado)) return false;
    }
    setFichajes((s2) => s2.map((f2) => f2.id === id ? { ...f2, ...data, localId: f2.localId || localActivoId || null } : f2));
    return true;
  }
  function eliminarFichaje(id) {
    const actual = fichajes.find((f2) => f2.id === id);
    if (!fichajeEsDelLocalActivo(actual)) return false;
    setFichajes((s2) => s2.filter((f2) => f2.id !== id));
    return true;
  }
  return { fichar, addFichajeManual, updateFichaje, eliminarFichaje };
}'''
s=uno(s,viejo,nuevo,'Lógica Fichajes local')

s=uno(s,
'''const { fichar, addFichajeManual, updateFichaje, eliminarFichaje } = crearLogicaFichaje({ setFichajes });''',
'''const { fichar, addFichajeManual, updateFichaje, eliminarFichaje } = crearLogicaFichaje({ empleados, fichajes, setFichajes, localActivoId });''',
'Invocación Fichajes local')

# 4) Lógica de Turnos protegida por local.
viejo='''function crearLogicaTurnos({ turnos, setTurnos }) {
  function addTurno(data) {
    setTurnos((s2) => [...s2, { id: uid(), ...data }]);
  }
  function updateTurno(id, data) {
    setTurnos((s2) => s2.map((t2) => t2.id === id ? { ...t2, ...data } : t2));
  }
  function deleteTurno(id) {
    setTurnos((s2) => s2.filter((t2) => t2.id !== id));
  }
  function copiarSemana(desdeFechas, haciaFechas) {
    const nuevos = [];
    turnos.forEach((t2) => {
      const idx = desdeFechas.indexOf(t2.fecha);
      if (idx === -1) return;
      nuevos.push({ id: uid(), empleadoId: t2.empleadoId, fecha: haciaFechas[idx], tipo: t2.tipo, horaInicio: t2.horaInicio, horaFin: t2.horaFin, notas: t2.notas });
    });
    if (nuevos.length) setTurnos((s2) => [...s2, ...nuevos]);
    return nuevos.length;
  }
  return { addTurno, updateTurno, deleteTurno, copiarSemana };
}'''
nuevo='''function crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId }) {
  const empleadoEsDelLocalActivoTurno = (e) => !!e && (!localActivoId || e.localId === localActivoId);
  const turnoEsDelLocalActivo = (t2) => !!t2 && (!localActivoId || t2.localId === localActivoId);
  function addTurno(data) {
    const empleado = empleados.find((e) => e.id === data.empleadoId);
    if (!empleadoEsDelLocalActivoTurno(empleado)) return false;
    setTurnos((s2) => [...s2, { id: uid(), ...data, localId: empleado.localId || localActivoId || null }]);
    return true;
  }
  function updateTurno(id, data) {
    const actual = turnos.find((t2) => t2.id === id);
    if (!turnoEsDelLocalActivo(actual)) return false;
    if (data.empleadoId) {
      const empleado = empleados.find((e) => e.id === data.empleadoId);
      if (!empleadoEsDelLocalActivoTurno(empleado)) return false;
    }
    setTurnos((s2) => s2.map((t2) => t2.id === id ? { ...t2, ...data, localId: t2.localId || localActivoId || null } : t2));
    return true;
  }
  function deleteTurno(id) {
    const actual = turnos.find((t2) => t2.id === id);
    if (!turnoEsDelLocalActivo(actual)) return false;
    setTurnos((s2) => s2.filter((t2) => t2.id !== id));
    return true;
  }
  function copiarSemana(desdeFechas, haciaFechas) {
    const nuevos = [];
    turnos.filter(turnoEsDelLocalActivo).forEach((t2) => {
      const idx = desdeFechas.indexOf(t2.fecha);
      if (idx === -1) return;
      nuevos.push({ id: uid(), empleadoId: t2.empleadoId, fecha: haciaFechas[idx], tipo: t2.tipo, horaInicio: t2.horaInicio, horaFin: t2.horaFin, notas: t2.notas, localId: t2.localId || localActivoId || null });
    });
    if (nuevos.length) setTurnos((s2) => [...s2, ...nuevos]);
    return nuevos.length;
  }
  return { addTurno, updateTurno, deleteTurno, copiarSemana };
}'''
s=uno(s,viejo,nuevo,'Lógica Turnos local')

s=uno(s,
'''const { addTurno, updateTurno, deleteTurno, copiarSemana } = crearLogicaTurnos({ turnos, setTurnos });''',
'''const { addTurno, updateTurno, deleteTurno, copiarSemana } = crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId });''',
'Invocación Turnos local')

# 5) Gastos: borrar únicamente desde el local autorizado. Resultados puede tener selector distinto al local activo.
viejo='''function crearLogicaGastos({ setGastosGenerales, localActivoId }) {
  function addGasto(data) {
    setGastosGenerales((s2) => [...s2, { id: uid(), ...data, localId: data.localId || localActivoId || null }]);
  }
  function deleteGasto(id) {
    setGastosGenerales((s2) => s2.filter((g2) => g2.id !== id));
  }
  return { addGasto, deleteGasto };
}'''
nuevo='''function crearLogicaGastos({ gastosGenerales, setGastosGenerales, localActivoId }) {
  function addGasto(data) {
    setGastosGenerales((s2) => [...s2, { id: uid(), ...data, localId: data.localId || localActivoId || null }]);
  }
  function deleteGasto(id, localIdPermitido = localActivoId) {
    const actual = gastosGenerales.find((g2) => g2.id === id);
    if (!actual || localIdPermitido && actual.localId !== localIdPermitido) return false;
    setGastosGenerales((s2) => s2.filter((g2) => g2.id !== id));
    return true;
  }
  return { addGasto, deleteGasto };
}'''
s=uno(s,viejo,nuevo,'Lógica Gastos borrado local')
s=uno(s,
'''const { addGasto, deleteGasto } = crearLogicaGastos({ setGastosGenerales, localActivoId });''',
'''const { addGasto, deleteGasto } = crearLogicaGastos({ gastosGenerales, setGastosGenerales, localActivoId });''',
'Invocación Gastos local')
s=uno(s,
'''  const addGastoInforme = (data) => addGasto({ ...data, localId: localInformeId || localActivoId || null });''',
'''  const addGastoInforme = (data) => addGasto({ ...data, localId: localInformeId || localActivoId || null });
  const deleteGastoInforme = (id) => deleteGasto(id, localInformeId || localActivoId || null);''',
'Wrapper borrar gasto informe')
# Solo dentro de Resultados.
i=s.index('tab === "resultados"'); j=s.index('tab === "',i+20); b=s[i:j]
b=uno(b,'      deleteGasto,\n','      deleteGasto: deleteGastoInforme,\n','Resultados borrar gasto local seleccionado')
s=s[:i]+b+s[j:]

# 6) Renders operativos RRHH.
i=s.index('tab === "fichaje"'); j=s.index('tab === "nominas"',i); b=s[i:j]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Render Fichaje empleados local')
b=uno(b,'      fichajes,\n','      fichajes: fichajesDelLocalActivo,\n','Render Fichaje registros local')
s=s[:i]+b+s[j:]

i=s.index('tab === "turnos"'); j=s.index('tab === "mapa"',i); b=s[i:j]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Render Turnos empleados local')
b=uno(b,'      turnos,\n','      turnos: turnosDelLocalActivo,\n','Render Turnos colección local')
s=s[:i]+b+s[j:]

# 7) Mapa, badge de Traspasos y ficha en Productos.
s=uno(s,
'tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos, proveedorPorId })',
'tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId })',
'Mapa productos local')
s=uno(s,
'{ id: "traspasos", label: "Traspasos", icon: ArrowLeftRight, badge: pisoVentaBajo.length, badgeColor: C2.amber }',
'{ id: "traspasos", label: "Traspasos", icon: ArrowLeftRight, badge: pisoVentaBajoDelLocalActivo.length, badgeColor: C2.amber }',
'Badge Traspasos local')
# Productos: acotar entre pestañas.
i=s.index('tab === "productos"'); j=s.index('tab === "historial_producto"',i); b=s[i:j]
b=uno(b,'      fichasCosto,\n','      fichasCosto: fichasCostoDelLocalActivo,\n','Productos fichas local')
s=s[:i]+b+s[j:]

# Guardas.
requeridos=[
'const empleadosDelLocalActivo =', 'const fichajesDelLocalActivo =', 'const turnosDelLocalActivo =',
'localId: empleado.localId || localActivoId || null', 'turnos.filter(turnoEsDelLocalActivo)',
'deleteGastoInforme = (id) => deleteGasto(id, localInformeId || localActivoId || null)',
'productos: productosDelLocalActivo, proveedorPorId',
'badge: pisoVentaBajoDelLocalActivo.length', 'fichasCosto: fichasCostoDelLocalActivo',
'const fichajesFinales =', 'const turnosFinales ='
]
for x in requeridos: assert x in s, x

p.write_text(s,encoding='utf-8')
print('GUARDAS_BLOQUE7A_OK')