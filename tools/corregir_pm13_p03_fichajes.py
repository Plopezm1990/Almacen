from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

logic_ini = s.find('function crearLogicaFichaje({ fichajes, setFichajes, empleados, localActivoId }) {')
logic_fin = s.find('\nfunction redondearDineroPM06(', logic_ini)
if logic_ini < 0 or logic_fin < 0:
    raise SystemExit('PM13 P03: no se encontró crearLogicaFichaje')

new_logic = r'''function crearLogicaFichaje({ fichajes, setFichajes, empleados, localActivoId }) {
  const operacionesRemotasFichajePM13 = new Map();
  const motorFichajeRemotoDisponiblePM13 = () => typeof window !== "undefined" && typeof window.getSupabaseClient === "function";
  const fichajeEsLocal = (f22) => !!f22 && (!localActivoId || f22.localId === localActivoId);
  const empleadoFichajeLocal = (id) => empleados.find((e2) => e2.id === id && e2.activo !== false && (!localActivoId || e2.localId === localActivoId));
  const fichajeVigentePM13 = (f22) => !!f22 && f22.anulado !== true && String(f22.anulado || "").toLowerCase() !== "true";
  const tipoFichajeValidoPM13 = (tipo) => tipo === "entrada" || tipo === "salida";
  const fechaFichajeValidaPM13 = (valor) => {
    const fecha = String(valor || "").trim();
    const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    if (!m2) return false;
    const anio = Number(m2[1]), mes = Number(m2[2]), dia = Number(m2[3]);
    const d2 = new Date(Date.UTC(anio, mes - 1, dia));
    return d2.getUTCFullYear() === anio && d2.getUTCMonth() === mes - 1 && d2.getUTCDate() === dia;
  };
  const horaFichajeValidaPM13 = (valor) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor || "").trim());
  const claveOrdenFichajePM13 = (f22) => `${f22.fecha || ""}T${f22.hora || ""}|${f22.id || ""}`;
  const secuenciaFichajeValidaPM13 = (candidato, omitirId = null) => {
    if (!candidato || !empleadoFichajeLocal(candidato.empleadoId) || !fichajeEsLocal(candidato)) return false;
    if (!tipoFichajeValidoPM13(candidato.tipo) || !fechaFichajeValidaPM13(candidato.fecha) || !horaFichajeValidaPM13(candidato.hora)) return false;
    const lista = fichajes.filter((f22) => fichajeVigentePM13(f22) && fichajeEsLocal(f22) && f22.empleadoId === candidato.empleadoId && f22.id !== omitirId).map((f22) => ({ ...f22 }));
    lista.push({ ...candidato, id: candidato.id || "__pm13_candidato__" });
    lista.sort((a22, b2) => claveOrdenFichajePM13(a22).localeCompare(claveOrdenFichajePM13(b2)));
    for (let i33 = 0; i33 < lista.length; i33++) {
      const actual = lista[i33];
      if (!tipoFichajeValidoPM13(actual.tipo) || !fechaFichajeValidaPM13(actual.fecha) || !horaFichajeValidaPM13(actual.hora)) return false;
      if (i33 === 0 && actual.tipo !== "entrada") return false;
      if (i33 > 0) {
        const anterior = lista[i33 - 1];
        if (actual.fecha === anterior.fecha && actual.hora === anterior.hora) return false;
        if (actual.tipo === anterior.tipo) return false;
      }
    }
    return true;
  };
  const aplicarConfirmadoFichajePM13 = (fichaje) => {
    if (!fichaje || !fichaje.id) return false;
    const normalizado = { ...fichaje, anulado: fichaje.anulado === true || String(fichaje.anulado || "").toLowerCase() === "true" };
    setFichajes((s22) => [normalizado, ...s22.filter((f22) => f22.id !== normalizado.id)]);
    return true;
  };
  async function ejecutarRpcFichajePM13(nombre, args) {
    if (!motorFichajeRemotoDisponiblePM13()) return { disponible: false, ok: true, data: null };
    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase || typeof supabase.rpc !== "function") return { disponible: true, ok: false, error: "El motor remoto de fichajes no está disponible." };
      const { data, error } = await supabase.rpc(nombre, args);
      if (error) return { disponible: true, ok: false, error: error.message || String(error) };
      return { disponible: true, ok: data?.ok !== false, data, error: data?.codigo || null };
    } catch (error) {
      return { disponible: true, ok: false, error: error?.message || String(error) };
    }
  }
  function ejecutarUnaVezFichajePM13(clave, ejecutar) {
    if (operacionesRemotasFichajePM13.has(clave)) return operacionesRemotasFichajePM13.get(clave);
    const promesa = Promise.resolve().then(ejecutar).finally(() => operacionesRemotasFichajePM13.delete(clave));
    operacionesRemotasFichajePM13.set(clave, promesa);
    return promesa;
  }
  function fichar(empleadoId, tipo) {
    const emp = empleadoFichajeLocal(empleadoId);
    if (!emp || !localActivoId || !tipoFichajeValidoPM13(tipo)) return false;
    const ahora = new Date();
    const fecha = todayISO();
    const hora = ahora.toTimeString().slice(0, 5);
    const operationId = `pm13-fichar:${localActivoId}:${empleadoId}:${tipo}:${fecha}:${hora}`;
    const candidatoLocal = { id: `fichaje-${operationId}`, empleadoId, tipo, fecha, hora, timestamp: ahora.toISOString(), localId: emp.localId || localActivoId, operationId, manual: false, anulado: false };
    if (!motorFichajeRemotoDisponiblePM13()) {
      if (!secuenciaFichajeValidaPM13(candidatoLocal)) return false;
      setFichajes((s22) => [candidatoLocal, ...s22]);
      return true;
    }
    return ejecutarUnaVezFichajePM13(`auto:${empleadoId}:${tipo}`, () => ejecutarRpcFichajePM13("pm13_fichar", {
      p_empleado_id: empleadoId,
      p_local_id: localActivoId,
      p_tipo: tipo,
      p_operation_id: operationId
    })).then((remoto) => remoto.ok && remoto.data?.fichaje ? aplicarConfirmadoFichajePM13(remoto.data.fichaje) : false);
  }
  function addFichajeManual(data) {
    const emp = empleadoFichajeLocal(data?.empleadoId);
    const fecha = String(data?.fecha || "").trim();
    const hora = String(data?.hora || "").trim();
    const tipo = data?.tipo;
    if (!emp || !localActivoId || !tipoFichajeValidoPM13(tipo) || !fechaFichajeValidaPM13(fecha) || !horaFichajeValidaPM13(hora) || fecha > todayISO()) return false;
    const operationId = String(data?.operationId || `pm13-manual:${localActivoId}:${emp.id}:${fecha}:${hora}:${tipo}`);
    const candidatoLocal = { id: `fichaje-${operationId}`, empleadoId: emp.id, tipo, fecha, hora, timestamp: `${fecha}T${hora}:00`, localId: emp.localId || localActivoId, operationId, manual: true, motivoManual: String(data?.motivoManual || data?.motivo || "Corrección manual registrada").trim(), anulado: false };
    if (!motorFichajeRemotoDisponiblePM13()) {
      if (!secuenciaFichajeValidaPM13(candidatoLocal)) return false;
      setFichajes((s22) => [candidatoLocal, ...s22]);
      return true;
    }
    return ejecutarUnaVezFichajePM13(`manual:${operationId}`, () => ejecutarRpcFichajePM13("pm13_fichaje_manual", {
      p_empleado_id: emp.id,
      p_local_id: localActivoId,
      p_fecha: fecha,
      p_hora: hora,
      p_tipo: tipo,
      p_operation_id: operationId,
      p_motivo: candidatoLocal.motivoManual
    })).then((remoto) => remoto.ok && remoto.data?.fichaje ? aplicarConfirmadoFichajePM13(remoto.data.fichaje) : false);
  }
  function updateFichaje(id, data = {}) {
    const actual = fichajes.find((f22) => f22.id === id);
    if (!fichajeEsLocal(actual) || !fichajeVigentePM13(actual)) return false;
    const emp = empleadoFichajeLocal(actual.empleadoId);
    if (!emp || (data.empleadoId && data.empleadoId !== actual.empleadoId)) return false;
    const fecha = String(data.fecha ?? actual.fecha ?? "").trim();
    const hora = String(data.hora ?? actual.hora ?? "").trim();
    const tipo = data.tipo ?? actual.tipo;
    const motivo = String(data.motivoCorreccion || data.motivo || "").trim();
    if (!motivo || !tipoFichajeValidoPM13(tipo) || !fechaFichajeValidaPM13(fecha) || !horaFichajeValidaPM13(hora)) return false;
    const candidato = { ...actual, ...data, empleadoId: actual.empleadoId, localId: actual.localId || localActivoId, fecha, hora, tipo, timestamp: `${fecha}T${hora}:00` };
    if (!secuenciaFichajeValidaPM13(candidato, id)) return false;
    const operationId = String(data.operationId || `pm13-corregir:${id}:${fecha}:${hora}:${tipo}`);
    if (!motorFichajeRemotoDisponiblePM13()) {
      const original = actual.original || { fecha: actual.fecha, hora: actual.hora, tipo: actual.tipo, timestamp: actual.timestamp };
      const historialCorrecciones = [...(actual.historialCorrecciones || []), { fecha: actual.fecha, hora: actual.hora, tipo: actual.tipo, motivo }];
      setFichajes((s22) => s22.map((f22) => f22.id === id ? { ...candidato, corregido: true, motivoCorreccion: motivo, original, historialCorrecciones, ultimaCorreccionOperationId: operationId } : f22));
      return true;
    }
    return ejecutarUnaVezFichajePM13(`corregir:${id}`, () => ejecutarRpcFichajePM13("pm13_corregir_fichaje", {
      p_fichaje_id: id,
      p_fecha: fecha,
      p_hora: hora,
      p_tipo: tipo,
      p_operation_id: operationId,
      p_motivo: motivo
    })).then((remoto) => remoto.ok && remoto.data?.fichaje ? aplicarConfirmadoFichajePM13(remoto.data.fichaje) : false);
  }
  function eliminarFichaje(id, controlPM13 = {}) {
    const actual = fichajes.find((f22) => f22.id === id);
    if (!fichajeEsLocal(actual)) return false;
    if (!fichajeVigentePM13(actual)) return true;
    const motivo = String(controlPM13.motivo || controlPM13.motivoAnulacion || "").trim();
    if (!motivo) return false;
    const restantes = fichajes.filter((f22) => f22.id !== id);
    const vigenteSiguiente = restantes.filter((f22) => fichajeVigentePM13(f22) && fichajeEsLocal(f22) && f22.empleadoId === actual.empleadoId).sort((a22, b2) => claveOrdenFichajePM13(a22).localeCompare(claveOrdenFichajePM13(b2)));
    for (let i33 = 0; i33 < vigenteSiguiente.length; i33++) {
      if (i33 === 0 && vigenteSiguiente[i33].tipo !== "entrada") return false;
      if (i33 > 0 && vigenteSiguiente[i33].tipo === vigenteSiguiente[i33 - 1].tipo) return false;
    }
    const operationId = String(controlPM13.operationId || `pm13-anular:${id}`);
    if (!motorFichajeRemotoDisponiblePM13()) {
      setFichajes((s22) => s22.map((f22) => f22.id === id ? { ...f22, anulado: true, motivoAnulacion: motivo, anulacionOperationId: operationId } : f22));
      return true;
    }
    return ejecutarUnaVezFichajePM13(`anular:${id}`, () => ejecutarRpcFichajePM13("pm13_anular_fichaje", {
      p_fichaje_id: id,
      p_operation_id: operationId,
      p_motivo: motivo
    })).then((remoto) => remoto.ok && remoto.data?.fichaje ? aplicarConfirmadoFichajePM13(remoto.data.fichaje) : false);
  }
  return { fichar, addFichajeManual, updateFichaje, eliminarFichaje };
}'''

s = s[:logic_ini] + new_logic + s[logic_fin:]

# UI RegistroHorario: los anulados no computan ni se exportan y el manual no cierra en falso.
ui_ini = s.find('function RegistroHorario({ empleados, fichajes, fichar, addFichajeManual, updateFichaje, eliminarFichaje, fichajesAbiertos }) {')
if ui_ini < 0:
    raise SystemExit('PM13 P03: no se encontró RegistroHorario')
m = re.search(r'^function\s+[A-Za-z0-9_$]+', s[ui_ini + 20:], re.M)
ui_fin = ui_ini + 20 + m.start() if m else min(len(s), ui_ini + 160000)
ui = s[ui_ini:ui_fin]

anchor_activos = '  const activos = empleados.filter((e2) => e2.activo !== false);\n'
if 'fichajesVigentesPM13' not in ui:
    if anchor_activos not in ui:
        raise SystemExit('PM13 P03: falta ancla activos en RegistroHorario')
    ui = ui.replace(anchor_activos, anchor_activos + '  const fichajesVigentesPM13 = (0, import_react4.useMemo)(() => fichajes.filter((f22) => f22?.anulado !== true && String(f22?.anulado || "").toLowerCase() !== "true"), [fichajes]);\n', 1)
ui = ui.replace('const deHoy = fichajes.filter((f22) =>', 'const deHoy = fichajesVigentesPM13.filter((f22) =>', 1)
ui = ui.replace('    fichajes.filter((f22) => f22.fecha >= desde && f22.fecha <= hasta).forEach((f22) => {', '    fichajesVigentesPM13.filter((f22) => f22.fecha >= desde && f22.fecha <= hasta).forEach((f22) => {', 1)
ui = ui.replace('  }, [fichajes, desde, hasta, empleados]);', '  }, [fichajesVigentesPM13, desde, hasta, empleados]);', 1)

pat_submit = re.compile(r'''  function submitManual\(\) \{\n    if \(!manual\.empleadoId\) \{\n      setManualError\("Selecciona un empleado\."\);\n      return;\n    \}\n    setManualError\(""\);\n    addFichajeManual\(\{\n      empleadoId: manual\.empleadoId,\n      fecha: manual\.fecha,\n      tipo: manual\.tipo,\n      hora: manual\.hora,\n      timestamp: \(/\* @__PURE__ \*/ new Date\(`\$\{manual\.fecha\}T\$\{manual\.hora\}:00`\)\)\.toISOString\(\),\n      manual: true\n    \}\);\n    setShowManual\(false\);\n  \}''')
new_submit = '''  async function submitManual() {\n    if (!manual.empleadoId) {\n      setManualError("Selecciona un empleado.");\n      return;\n    }\n    setManualError("");\n    const guardado = await Promise.resolve(addFichajeManual({\n      empleadoId: manual.empleadoId,\n      fecha: manual.fecha,\n      tipo: manual.tipo,\n      hora: manual.hora,\n      timestamp: (/* @__PURE__ */ new Date(`${manual.fecha}T${manual.hora}:00`)).toISOString(),\n      manual: true,\n      motivoManual: "Corrección manual registrada desde Registro horario"\n    }));\n    if (!guardado) {\n      setManualError("No se pudo guardar el fichaje. Revisa empleado, fecha, hora y secuencia entrada/salida.");\n      return;\n    }\n    setShowManual(false);\n  }'''
ui, n_submit = pat_submit.subn(lambda _m: new_submit, ui, count=1)
if n_submit != 1 and 'const guardado = await Promise.resolve(addFichajeManual({' not in ui:
    raise SystemExit(f'PM13 P03: no se pudo endurecer submitManual ({n_submit})')

s = s[:ui_ini] + ui + s[ui_fin:]

# Alertas globales: anulado nunca vuelve a figurar como jornada abierta.
old_open = '''    fichajes.forEach((f22) => {\n      const key = `${f22.empleadoId}-${f22.fecha}`;'''
new_open = '''    fichajes.filter((f22) => f22?.anulado !== true && String(f22?.anulado || "").toLowerCase() !== "true").forEach((f22) => {\n      const key = `${f22.empleadoId}-${f22.fecha}`;'''
if old_open in s:
    s = s.replace(old_open, new_open, 1)
elif new_open not in s:
    raise SystemExit('PM13 P03: no se pudo endurecer fichajesAbiertos global')

p.write_text(s, encoding='utf-8')
print('PM13 P03: Fichajes seguros, remotos e históricos')
