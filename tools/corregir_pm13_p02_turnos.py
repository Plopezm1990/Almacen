from pathlib import Path
import re

path = Path('fuente.js')
src = path.read_text(encoding='utf-8')

new_logic = r'''function crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId }) {
  const empleadoTurnoLocal = (id) => empleados.find((e2) => e2.id === id && e2.activo !== false && (!localActivoId || e2.localId === localActivoId));
  const turnoEsLocal = (t22) => !!t22 && (!localActivoId || t22.localId === localActivoId);
  const parseFechaTurnoPM13 = (valor) => {
    const fecha = String(valor || "").trim();
    const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    if (!m2) return null;
    const anio = Number(m2[1]), mes = Number(m2[2]), dia = Number(m2[3]);
    const ms = Date.UTC(anio, mes - 1, dia);
    const d2 = new Date(ms);
    if (d2.getUTCFullYear() !== anio || d2.getUTCMonth() !== mes - 1 || d2.getUTCDate() !== dia) return null;
    return { fecha, minutosBase: ms / 6e4 };
  };
  const parseHoraTurnoPM13 = (valor) => {
    const hora = String(valor || "").trim();
    const m2 = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
    return m2 ? { hora, minutos: Number(m2[1]) * 60 + Number(m2[2]) } : null;
  };
  const normalizarTurnoPM13 = (data = {}, base = null) => {
    const empleadoId = data.empleadoId ?? base?.empleadoId;
    const emp = empleadoTurnoLocal(empleadoId);
    if (!emp) return null;
    if (base?.localId && emp.localId && base.localId !== emp.localId) return null;
    const fechaInfo = parseFechaTurnoPM13(data.fecha ?? base?.fecha);
    if (!fechaInfo) return null;
    const horaInicio = String(data.horaInicio ?? base?.horaInicio ?? "").trim();
    const horaFin = String(data.horaFin ?? base?.horaFin ?? "").trim();
    if (!!horaInicio !== !!horaFin) return null;
    if (horaInicio) {
      const inicio = parseHoraTurnoPM13(horaInicio);
      const fin = parseHoraTurnoPM13(horaFin);
      if (!inicio || !fin || inicio.minutos === fin.minutos) return null;
    }
    return {
      ...(base || {}),
      ...data,
      empleadoId,
      fecha: fechaInfo.fecha,
      horaInicio,
      horaFin,
      localId: base?.localId || emp.localId || localActivoId || null
    };
  };
  const intervaloTurnoPM13 = (turno) => {
    if (!turno?.horaInicio && !turno?.horaFin) return null;
    const fecha = parseFechaTurnoPM13(turno?.fecha);
    const inicio = parseHoraTurnoPM13(turno?.horaInicio);
    const fin = parseHoraTurnoPM13(turno?.horaFin);
    if (!fecha || !inicio || !fin || inicio.minutos === fin.minutos) return null;
    const desde = fecha.minutosBase + inicio.minutos;
    let hasta = fecha.minutosBase + fin.minutos;
    if (hasta <= desde) hasta += 1440;
    return [desde, hasta];
  };
  const equivalenteTurnoPM13 = (a22, b2) => !!a22 && !!b2 &&
    a22.empleadoId === b2.empleadoId && a22.fecha === b2.fecha &&
    String(a22.tipo || "") === String(b2.tipo || "") &&
    String(a22.horaInicio || "") === String(b2.horaInicio || "") &&
    String(a22.horaFin || "") === String(b2.horaFin || "") &&
    String(a22.notas || "") === String(b2.notas || "") &&
    String(a22.localId || "") === String(b2.localId || "");
  const conflictoTurnoPM13 = (candidato, lista, omitirId = null) => {
    const intervalo = intervaloTurnoPM13(candidato);
    return lista.some((t22) => {
      if (!turnoEsLocal(t22) || t22.id === omitirId || t22.empleadoId !== candidato.empleadoId) return false;
      if (equivalenteTurnoPM13(t22, candidato)) return true;
      if (!intervalo) return false;
      const otro = intervaloTurnoPM13(t22);
      return !!otro && intervalo[0] < otro[1] && otro[0] < intervalo[1];
    });
  };
  function addTurno(data) {
    const candidato = normalizarTurnoPM13(data);
    if (!candidato || conflictoTurnoPM13(candidato, turnos)) return false;
    setTurnos((s22) => [...s22, { id: uid(), ...candidato }]);
    return true;
  }
  function updateTurno(id, data) {
    const actual = turnos.find((t22) => t22.id === id);
    if (!turnoEsLocal(actual)) return false;
    const candidato = normalizarTurnoPM13(data, actual);
    if (!candidato || conflictoTurnoPM13(candidato, turnos, id)) return false;
    setTurnos((s22) => s22.map((t22) => t22.id === id && turnoEsLocal(t22) ? candidato : t22));
    return true;
  }
  function deleteTurno(id) {
    const actual = turnos.find((t22) => t22.id === id);
    if (!turnoEsLocal(actual)) return false;
    setTurnos((s22) => s22.filter((t22) => t22.id !== id || !turnoEsLocal(t22)));
    return true;
  }
  function copiarSemana(desdeFechas, haciaFechas) {
    if (!Array.isArray(desdeFechas) || !Array.isArray(haciaFechas) || desdeFechas.length !== haciaFechas.length) return 0;
    const nuevos = [];
    const ocupados = turnos.filter(turnoEsLocal).slice();
    turnos.filter(turnoEsLocal).forEach((t22) => {
      const idx = desdeFechas.indexOf(t22.fecha);
      if (idx === -1 || !haciaFechas[idx]) return;
      const candidato = normalizarTurnoPM13({
        empleadoId: t22.empleadoId,
        fecha: haciaFechas[idx],
        tipo: t22.tipo,
        horaInicio: t22.horaInicio,
        horaFin: t22.horaFin,
        notas: t22.notas
      });
      if (!candidato || conflictoTurnoPM13(candidato, ocupados)) return;
      const nuevo = { id: uid(), ...candidato };
      nuevos.push(nuevo);
      ocupados.push(nuevo);
    });
    if (nuevos.length) setTurnos((s22) => [...s22, ...nuevos]);
    return nuevos.length;
  }
  return { addTurno, updateTurno, deleteTurno, copiarSemana };
}'''

pattern_logic = r'function crearLogicaTurnos\(\{ turnos, setTurnos, empleados, localActivoId \}\) \{.*?\n\}\nfunction crearLogicaAppcc\('
src, n = re.subn(pattern_logic, lambda m: new_logic + '\nfunction crearLogicaAppcc(', src, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'PM13 P02: no se pudo sustituir crearLogicaTurnos de forma única ({n})')

turnos_ini = src.index('function Turnos({ empleados, turnos, addTurno, updateTurno, deleteTurno, copiarSemana }) {')
turnos_fin = src.index('\nfunction MapaAlmacen(', turnos_ini)
ui = src[turnos_ini:turnos_fin]

old_submit = re.compile(r'''  function submit\(\) \{\n    if \(!form\.empleadoId\) \{\n      setError\("Selecciona un empleado\."\);\n      return;\n    \}\n    setError\(""\);\n    const plantilla = PLANTILLAS_TURNO\.find\(\(p22\) => p22\.id === form\.plantilla\);\n    addTurno\(\{\n      empleadoId: form\.empleadoId,\n      fecha: form\.fecha,\n      tipo: plantilla \? plantilla\.label : "Personalizado",\n      horaInicio: form\.horaInicio,\n      horaFin: form\.horaFin,\n      notas: form\.notas\n    \}\);\n    setShowForm\(false\);\n    setForm\(null\);\n  \}''')
new_submit = '''  function submit() {\n    if (!form.empleadoId) {\n      setError("Selecciona un empleado.");\n      return;\n    }\n    setError("");\n    const plantilla = PLANTILLAS_TURNO.find((p22) => p22.id === form.plantilla);\n    const guardado = addTurno({\n      empleadoId: form.empleadoId,\n      fecha: form.fecha,\n      tipo: plantilla ? plantilla.label : "Personalizado",\n      horaInicio: form.horaInicio,\n      horaFin: form.horaFin,\n      notas: form.notas\n    });\n    if (!guardado) {\n      setError("No se pudo guardar el turno. Revisa empleado, fecha, horas y posibles solapamientos.");\n      return;\n    }\n    setShowForm(false);\n    setForm(null);\n  }'''
ui, n_submit = old_submit.subn(new_submit, ui, count=1)
if n_submit != 1 and 'const guardado = addTurno({' not in ui:
    raise SystemExit(f'PM13 P02: no se pudo endurecer submit de Turnos ({n_submit})')

ui = ui.replace('"La semana anterior no ten\\xEDa turnos que copiar."', '"No hay turnos nuevos que copiar."')
ui = ui.replace('"La semana anterior no tenía turnos que copiar."', '"No hay turnos nuevos que copiar."')

src = src[:turnos_ini] + ui + src[turnos_fin:]
path.write_text(src, encoding='utf-8')
print('PM13 P02: Turnos endurecido e idempotente')
