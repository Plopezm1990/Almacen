from pathlib import Path

path = Path('fuente.js')
text = path.read_text(encoding='utf-8')

replacements = {
    'addArqueo': '''function addArqueo(arqueo) {
    if (!localActivoId) return null;
    const arqueoConLocal = { ...arqueo, localId: localActivoId };
    setArqueos((prev) => [arqueoConLocal, ...prev]);
    return arqueoConLocal;
  }''',
    'deleteArqueo': '''function deleteArqueo(id) {
    if (!localActivoId) return false;
    let eliminado = false;
    setArqueos((prev) => prev.filter((a2) => {
      if (a2.id === id && a2.localId === localActivoId) {
        eliminado = true;
        return false;
      }
      return true;
    }));
    return eliminado;
  }''',
    'registrarMovimientoCaja': '''function registrarMovimientoCaja({ tipo, importe, concepto, origen, referenciaId }) {
    if (!localActivoId) return null;
    const mov = {
      id: uid(),
      localId: localActivoId,
      fecha: todayISO(),
      hora: nowTime(),
      tipo,
      importe: nnum(importe),
      concepto: concepto || "",
      origen: origen || "MANUAL",
      referenciaId: referenciaId || ""
    };
    setMovimientosCaja((prev) => [mov, ...prev]);
    try {
      registrarAuditoria && registrarAuditoria("MOVIMIENTO_CAJA", `${tipo} ${fmt(nnum(importe))}€ · ${concepto || "Sin concepto"}`);
    } catch {
    }
    return mov;
  }''',
    'deleteMovimientoCaja': '''function deleteMovimientoCaja(id) {
    if (!localActivoId) return false;
    let eliminado = false;
    setMovimientosCaja((prev) => prev.filter((m2) => {
      if (m2.id === id && m2.localId === localActivoId) {
        eliminado = true;
        return false;
      }
      return true;
    }));
    return eliminado;
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

# Comprobaciones semánticas mínimas del endurecimiento.
required = [
    'const arqueoConLocal = { ...arqueo, localId: localActivoId };',
    'a2.id === id && a2.localId === localActivoId',
    'localId: localActivoId,',
    'm2.id === id && m2.localId === localActivoId'
]
for token in required:
    if token not in text:
        raise SystemExit(f'Falta guardia esperada: {token}')

path.write_text(text, encoding='utf-8')
print('Caja multi-local endurecida correctamente')
print('Bytes antes:', before, 'después:', len(text))
