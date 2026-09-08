from pathlib import Path
import re

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

ui_ini = s.find('function Personal({')
ui_fin = s.find('function Turnos({', ui_ini)
if ui_ini < 0 or ui_fin < 0:
    raise SystemExit('PM13 P05: no se encontró UI Personal')
ui = s[ui_ini:ui_fin]

if 'function resumenVacacionesPM13(' not in ui:
    patron = re.compile(r'  function vacacionesUsadas\(e2\) \{.*?\n  \}\n  return /\* @__PURE__ \*/', re.S)
    bloque = r'''  function fechaVacacionesPM13(valor) {
    const texto = String(valor || "").trim();
    const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!m2) return null;
    const anio = Number(m2[1]), mes = Number(m2[2]), dia = Number(m2[3]);
    const ms = Date.UTC(anio, mes - 1, dia);
    const d2 = new Date(ms);
    if (d2.getUTCFullYear() !== anio || d2.getUTCMonth() !== mes - 1 || d2.getUTCDate() !== dia) return null;
    return { iso: texto, anio, ms };
  }
  const diasEntreVacacionesPM13 = (inicioMs, finMs) => finMs < inicioMs ? 0 : Math.round((finMs - inicioMs) / 864e5) + 1;
  function tramoVacacionesEnAnioPM13(a22, anio, hoyISO) {
    if (!a22 || a22.tipo !== "Vacaciones" || String(a22.estado || "ACTIVA").toUpperCase() === "ANULADA" || a22.anuladaAt) return { reservados: 0, disfrutados: 0, enCurso: 0, programados: 0 };
    const inicio = fechaVacacionesPM13(a22.fechaInicio);
    const fin = fechaVacacionesPM13(a22.fechaFin);
    if (!inicio || !fin || fin.ms < inicio.ms) return { reservados: 0, disfrutados: 0, enCurso: 0, programados: 0 };
    const inicioAnio = Date.UTC(anio, 0, 1);
    const finAnio = Date.UTC(anio, 11, 31);
    const desde = Math.max(inicio.ms, inicioAnio);
    const hasta = Math.min(fin.ms, finAnio);
    if (hasta < desde) return { reservados: 0, disfrutados: 0, enCurso: 0, programados: 0 };
    const reservados = diasEntreVacacionesPM13(desde, hasta);
    const hoy = fechaVacacionesPM13(hoyISO);
    if (!hoy) return { reservados, disfrutados: 0, enCurso: 0, programados: reservados };
    const ayer = hoy.ms - 864e5;
    const manana = hoy.ms + 864e5;
    const disfrutados = diasEntreVacacionesPM13(desde, Math.min(hasta, ayer));
    const enCurso = hoy.ms >= desde && hoy.ms <= hasta ? 1 : 0;
    const programados = diasEntreVacacionesPM13(Math.max(desde, manana), hasta);
    return { reservados, disfrutados, enCurso, programados };
  }
  function resumenVacacionesPM13(e2, anio = anioActual, hoyISO = typeof todayISO === "function" ? todayISO() : new Date().toISOString().slice(0, 10)) {
    const totalRaw = Number(e2?.diasVacacionesAnuales);
    const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : 0;
    const resumen = { total, reservados: 0, disfrutados: 0, enCurso: 0, programados: 0, saldo: total, disponibles: total, exceso: 0 };
    for (const a22 of e2?.ausencias || []) {
      const tramo = tramoVacacionesEnAnioPM13(a22, Number(anio), hoyISO);
      resumen.reservados += tramo.reservados;
      resumen.disfrutados += tramo.disfrutados;
      resumen.enCurso += tramo.enCurso;
      resumen.programados += tramo.programados;
    }
    resumen.saldo = resumen.total - resumen.reservados;
    resumen.disponibles = Math.max(0, resumen.saldo);
    resumen.exceso = Math.max(0, -resumen.saldo);
    return resumen;
  }
  function vacacionesUsadas(e2) {
    return resumenVacacionesPM13(e2, anioActual).reservados;
  }
  return /* @__PURE__ */'''
    ui, n = patron.subn(lambda _m: bloque, ui, count=1)
    if n != 1:
        raise SystemExit('PM13 P05: no se pudo sustituir vacacionesUsadas')

old_vars = '''    const usados = vacacionesUsadas(e2);\n    const total = Number(e2.diasVacacionesAnuales) || 0;'''
new_vars = '''    const resumenVacaciones = resumenVacacionesPM13(e2, anioActual);\n    const usados = resumenVacaciones.reservados;\n    const total = resumenVacaciones.total;'''
if old_vars in ui:
    ui = ui.replace(old_vars, new_vars, 1)
elif 'const resumenVacaciones = resumenVacacionesPM13(e2, anioActual);' not in ui:
    raise SystemExit('PM13 P05: no se pudo integrar resumen por empleado')

patron_texto = re.compile(r'import_react4\.default\.createElement\("div", null, "Vacaciones: ", usados, " / ", total, " d\\xEDas usados este a\\xF1o"\)')
nuevo_texto = '''import_react4.default.createElement("div", null, "Vacaciones ", anioActual, ": ", resumenVacaciones.disfrutados, " disfrutados · ", resumenVacaciones.enCurso, " hoy · ", resumenVacaciones.programados, " programados · saldo ", resumenVacaciones.saldo, " / ", total, resumenVacaciones.exceso > 0 ? ` · exceso ${resumenVacaciones.exceso}` : "")'''
if '" programados · saldo "' not in ui:
    ui, n = patron_texto.subn(lambda _m: nuevo_texto, ui, count=1)
    if n != 1:
        raise SystemExit('PM13 P05: no se pudo actualizar la tarjeta de vacaciones')

s = s[:ui_ini] + ui + s[ui_fin:]
p.write_text(s, encoding='utf-8')
print('PM13 P05: vacaciones por año, estado temporal y saldo honesto')
