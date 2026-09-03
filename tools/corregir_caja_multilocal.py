from pathlib import Path

path = Path('fuente.js')
text = path.read_text(encoding='utf-8')

replacements = {
    'addArqueo': '''function addArqueo(data, denomConfig) {
    if (!localActivoId) return null;
    const id = uid();
    const fecha = todayISO();
    const hora = nowTime();
    const denominaciones = { ...(data.denominaciones || {}) };
    const useConfig = denomConfig || DENOMINACIONES_CAJA;
    const efectivoContado = useConfig.reduce((acc, d) => acc + (Number(denominaciones[d.key]) || 0) * d.valor, 0);
    const efectivoReal = Math.round((efectivoContado + Number.EPSILON) * 100) / 100;
    const esperado = Number(data.efectivoEsperado || 0);
    const diferencia = Math.round((efectivoReal - esperado + Number.EPSILON) * 100) / 100;
    const arqueo = {
      id,
      localId: localActivoId,
      fecha,
      hora,
      efectivoEsperado: esperado,
      efectivoReal,
      diferencia,
      denominaciones,
      notas: data.notas || ""
    };
    setArqueos((prev) => [arqueo, ...prev]);
    return arqueo;
  }''',
    'deleteArqueo': '''function deleteArqueo(id) {
    if (!localActivoId) return;
    setArqueos((prev) => prev.filter((a2) => !(a2.id === id && a2.localId === localActivoId)));
  }''',
    'registrarMovimientoCaja': '''function registrarMovimientoCaja(tipo, importe, concepto, origen = "MANUAL", referenciaId = null) {
    if (!localActivoId) return { ok: false, error: "Selecciona un local antes de registrar movimientos de caja." };
    const imp = Number(importe);
    if (!["ENTRADA", "SALIDA"].includes(tipo)) return { ok: false, error: "Tipo de movimiento no válido." };
    if (!Number.isFinite(imp) || imp <= 0) return { ok: false, error: "El importe debe ser mayor que 0." };
    const mov = {
      id: uid(),
      localId: localActivoId,
      fecha: todayISO(),
      hora: nowTime(),
      tipo,
      importe: Math.round((imp + Number.EPSILON) * 100) / 100,
      concepto: concepto?.trim() || (tipo === "ENTRADA" ? "Entrada manual" : "Salida manual"),
      origen,
      referenciaId
    };
    setMovimientosCaja((prev) => [mov, ...prev]);
    registrarAuditoria?.(
      "MOVIMIENTO_CAJA",
      `${tipo} de ${money(mov.importe)} · ${mov.concepto}`,
      { movimientoCajaId: mov.id, origen: mov.origen }
    );
    return { ok: true, movimiento: mov };
  }''',
    'eliminarMovimientoCaja': '''function eliminarMovimientoCaja(id) {
    if (!localActivoId) return;
    setMovimientosCaja((prev) => prev.filter((m2) => !(m2.id === id && m2.localId === localActivoId)));
  }'''
}

def function_span(src: str, name: str):
    marker = f'function {name}('
    starts = []
    pos = 0
    while True:
        p = src.find(marker, pos)
        if p < 0:
            break
        starts.append(p)
        pos = p + len(marker)
    if len(starts) != 1:
        raise SystemExit(f'{name}: se esperaban 1 coincidencia y hay {len(starts)}')
    start = starts[0]
    p = src.find('(', start)
    depth = 0
    quote = None
    esc = False
    i = p
    while i < len(src):
        c = src[i]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in ('"', "'", '`'):
                quote = c
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    break
        i += 1
    brace = src.find('{', i)
    if brace < 0:
        raise SystemExit(f'{name}: no se encontró cuerpo')
    depth = 0
    quote = None
    esc = False
    j = brace
    while j < len(src):
        c = src[j]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in ('"', "'", '`'):
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return start, j + 1
        j += 1
    raise SystemExit(f'{name}: cuerpo sin cerrar')

before = len(text)
for name, replacement in replacements.items():
    a, b = function_span(text, name)
    old = text[a:b]
    print(f'{name}: {len(old)} -> {len(replacement)} bytes')
    text = text[:a] + replacement + text[b:]

for name in replacements:
    if text.count(f'function {name}(') != 1:
        raise SystemExit(f'{name}: cantidad inesperada tras reemplazo')

required = [
    'function addArqueo(data, denomConfig)',
    'localId: localActivoId,',
    '!(a2.id === id && a2.localId === localActivoId)',
    'function registrarMovimientoCaja(tipo, importe, concepto, origen = "MANUAL", referenciaId = null)',
    'Selecciona un local antes de registrar movimientos de caja.',
    'if (!["ENTRADA", "SALIDA"].includes(tipo))',
    'return { ok: true, movimiento: mov };',
    'function eliminarMovimientoCaja(id)',
    '!(m2.id === id && m2.localId === localActivoId)'
]
for token in required:
    if token not in text:
        raise SystemExit(f'Falta guardia esperada: {token}')

path.write_text(text, encoding='utf-8')
print('Caja multi-local endurecida correctamente')
print('Bytes antes:', before, 'después:', len(text))
