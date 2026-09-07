from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

marker = 'const parseFechaCostePersonalPM13 = (valor) => {'
if marker in s:
    print('PM13 P06: fuente ya endurecida')
    raise SystemExit(0)

old = '''  const costePersonalMensual = empleados.filter((e2) => e2.activo !== false).reduce((a22, e2) => {
    const bruto = Number(e2.salarioBrutoMensual) || 0;
    const coste = e2.costeEmpresaMensual !== "" && e2.costeEmpresaMensual != null ? Number(e2.costeEmpresaMensual) : bruto * 1.32;
    return a22 + coste;
  }, 0);
  const personalEsEstimado = empleados.some((e2) => e2.activo !== false && (e2.costeEmpresaMensual === "" || e2.costeEmpresaMensual == null) && Number(e2.salarioBrutoMensual) > 0);
  const gastosTotalMensual = gastosGeneralesMensual + costePersonalMensual;
  const gastosPeriodo = gastosTotalMensual * (dias / 30) + gastosPuntualesPeriodo;'''

new = '''  const parseFechaCostePersonalPM13 = (valor) => {
    const fecha = String(valor || "").trim();
    const m2 = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(fecha);
    if (!m2) return null;
    const anio = Number(m2[1]), mes = Number(m2[2]), dia = Number(m2[3]);
    const ms = Date.UTC(anio, mes - 1, dia);
    const d2 = new Date(ms);
    if (d2.getUTCFullYear() !== anio || d2.getUTCMonth() !== mes - 1 || d2.getUTCDate() !== dia) return null;
    return { fecha, ms };
  };
  const costeMensualEmpleadoPM13 = (e2) => {
    const exactoInformado = e2 && e2.costeEmpresaMensual !== "" && e2.costeEmpresaMensual != null;
    if (exactoInformado) {
      const exacto = Number(e2.costeEmpresaMensual);
      if (Number.isFinite(exacto) && exacto >= 0) return { costeMensual: exacto, estimado: false, incompleto: false, fuente: "EXACTO" };
      return { costeMensual: 0, estimado: false, incompleto: true, fuente: "EXACTO_INVALIDO" };
    }
    const bruto = Number(e2?.salarioBrutoMensual);
    if (!Number.isFinite(bruto) || bruto < 0) return { costeMensual: 0, estimado: false, incompleto: true, fuente: "BRUTO_INVALIDO" };
    if (bruto === 0) return { costeMensual: 0, estimado: false, incompleto: false, fuente: "SIN_COSTE" };
    const pagasRaw = Number(e2?.pagas);
    const pagasValidas = Number.isInteger(pagasRaw) && pagasRaw > 0;
    const pagas = pagasValidas ? pagasRaw : 12;
    return {
      costeMensual: bruto * pagas / 12 * 1.32,
      estimado: true,
      incompleto: !pagasValidas,
      fuente: pagasValidas ? "ESTIMADO_BRUTO_PAGAS" : "ESTIMADO_LEGADO_12_PAGAS"
    };
  };
  const diasCosteEmpleadoEnPeriodoPM13 = (e2, desdeISO, hastaISO) => {
    const desdeInfo = parseFechaCostePersonalPM13(desdeISO);
    const hastaInfo = parseFechaCostePersonalPM13(hastaISO);
    if (!desdeInfo || !hastaInfo || desdeInfo.ms > hastaInfo.ms) return { dias: 0, incompleto: true };
    const altaInfo = parseFechaCostePersonalPM13(e2?.fechaAlta);
    const bajaInfo = parseFechaCostePersonalPM13(e2?.fechaBaja);
    let incompleto = false;
    let inicio = desdeInfo.ms;
    let fin = hastaInfo.ms;
    if (altaInfo) inicio = Math.max(inicio, altaInfo.ms);
    else incompleto = true;
    if (e2?.activo === false) {
      if (!bajaInfo) return { dias: 0, incompleto: true };
      fin = Math.min(fin, bajaInfo.ms);
    } else if (bajaInfo) {
      fin = Math.min(fin, bajaInfo.ms);
      incompleto = true;
    }
    if (fin < inicio) return { dias: 0, incompleto };
    return { dias: Math.floor((fin - inicio) / 864e5) + 1, incompleto };
  };
  const resumenCostePersonalPeriodoPM13 = (lista, desdeISO, hastaISO) => {
    let total = 0;
    let estimado = false;
    let incompleto = false;
    let empleadosConCoste = 0;
    for (const e2 of lista || []) {
      const costeInfo = costeMensualEmpleadoPM13(e2);
      const tramo = diasCosteEmpleadoEnPeriodoPM13(e2, desdeISO, hastaISO);
      if (costeInfo.incompleto || tramo.incompleto) incompleto = true;
      if (tramo.dias <= 0 || costeInfo.costeMensual <= 0) continue;
      total += costeInfo.costeMensual * (tramo.dias / 30);
      estimado = estimado || costeInfo.estimado;
      empleadosConCoste += 1;
    }
    return { total, estimado, incompleto, empleadosConCoste };
  };
  const costePersonalPeriodoInfo = resumenCostePersonalPeriodoPM13(empleados, desde, hasta);
  const costePersonalPeriodo = costePersonalPeriodoInfo.total;
  const costePersonalMensual = dias > 0 ? costePersonalPeriodo * 30 / dias : 0;
  const personalEsEstimado = costePersonalPeriodoInfo.estimado;
  const personalCosteIncompleto = costePersonalPeriodoInfo.incompleto;
  const gastosTotalMensual = gastosGeneralesMensual + costePersonalMensual;
  const gastosPeriodo = gastosGeneralesMensual * (dias / 30) + costePersonalPeriodo + gastosPuntualesPeriodo;'''

if old not in s:
    raise SystemExit('No se encontró el bloque base de costes P06')
s = s.replace(old, new, 1)

# Clarificar semántica de los campos sin cambiar nombres de datos legados.
s = s.replace('label: "Salario bruto mensual (\\u20AC)"', 'label: "Salario bruto por paga (\\u20AC)"', 1)
s = s.replace('label: "Coste total mensual para la empresa (\\u20AC, opcional)"', 'label: "Coste medio mensual para la empresa (\\u20AC, opcional)"', 1)
s = s.replace('"Si dejas el coste para la empresa en blanco, se usar\\xE1 una estimaci\\xF3n aproximada (bruto \\xD7 1,32) para calcular resultados \\u2014 p\\xEDdele la cifra exacta a tu gestor\\xEDa cuando la tengas."', '"Si dejas el coste para la empresa en blanco, Resultados estimar\\xE1 el coste medio mensual con bruto por paga \\xD7 n\\xFAmero de pagas \\xF7 12 \\xD7 1,32. Si tu gestor\\xEDa te da el coste anual real, introduce aqu\\xED su media mensual (coste anual \\xF7 12)."', 1)

old_ui = '''costePersonalMensual > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-1" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12px]", style: { color: C2.inkSoft } }, "Coste de personal del periodo", personalEsEstimado ? " (parte estimado)" : ""), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "\\u20AC", fmt(costePersonalMensual * (dias / 30))))'''
new_ui = '''costePersonalPeriodo > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-1" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12px]", style: { color: C2.inkSoft } }, "Coste de personal del periodo", personalEsEstimado ? " (parte estimada)" : ""), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono" }, "\\u20AC", fmt(costePersonalPeriodo)))'''
if old_ui not in s:
    raise SystemExit('No se encontró la fila UI de coste personal P06')
s = s.replace(old_ui, new_ui, 1)

old_note = '''/* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "Aproximado: los gastos fijos y el personal se reparten a prorrata de los d\\xEDas del periodo, no d\\xEDa a d\\xEDa real", personalEsEstimado ? ", y el coste de personal sin cifra exacta usa bruto \\xD7 1,32 como aproximaci\\xF3n." : ".")'''
new_note = '''/* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "Los gastos fijos se prorratean por d\\xEDas. El personal se calcula solo por los d\\xEDas comprendidos entre su alta y su baja dentro del periodo", personalEsEstimado ? "; cuando falta el coste exacto se estima con bruto por paga \\xD7 pagas \\xF7 12 \\xD7 1,32." : "."), personalCosteIncompleto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.amber } }, "Coste de personal incompleto: hay fichas legadas o datos de coste/fechas insuficientes. No se han inventado importes para esas partes.")'''
if old_note not in s:
    raise SystemExit('No se encontró la nota UI de costes P06')
s = s.replace(old_note, new_note, 1)

p.write_text(s, encoding='utf-8')
print('PM13 P06: costes por pagas, altas/bajas y estados honestos')
