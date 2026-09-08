from pathlib import Path

PATH = Path('fuente.js')
s = PATH.read_text(encoding='utf-8')
original = s


def reemplazar(antes: str, despues: str, etiqueta: str) -> None:
    global s
    if despues in s:
        return
    if antes not in s:
        raise SystemExit(f'PM14 P01: no se encontró el bloque esperado: {etiqueta}')
    s = s.replace(antes, despues, 1)


reemplazar(
'''  if (!data || typeof data !== "object" || Array.isArray(data)) return errorValidacionPM10("formato_invalido", "encargo", "El encargo no tiene un formato válido.");
  if (data.localId && data.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", "localId", "El encargo pertenece a otro local.");''',
'''  if (!data || typeof data !== "object" || Array.isArray(data)) return errorValidacionPM10("formato_invalido", "encargo", "El encargo no tiene un formato válido.");
  if (!empresaId) return errorValidacionPM10("contexto_no_autorizado", "empresaId", "No se pudo determinar la empresa del encargo.");
  if (data.empresaId && data.empresaId !== empresaId) return errorValidacionPM10("referencia_otro_contexto", "empresaId", "El encargo pertenece a otra empresa.");
  if (data.localId && data.localId !== localActivoId) return errorValidacionPM10("referencia_otro_contexto", "localId", "El encargo pertenece a otro local.");''',
'empresa explícita en validarEncargoPM10'
)

reemplazar(
'''    const nuevo = { ...datos, id: uid(), estado: "Pendiente", fechaCreacion: fecha, cobros, localId: localActivoId };''',
'''    const nuevo = { ...datos, id: uid(), empresaId, localId: localActivoId, estado: "Pendiente", fechaCreacion: fecha, total: validacion.total, cobros };''',
'identidad explícita y total estable en alta'
)

reemplazar(
'''  function updateEncargo(id, data) {
    const actual = encargos.find((e2) => e2.id === id);
    if (!actual || !encargoEsDelLocalActivo(actual)) return errorValidacionPM10("contexto_no_autorizado", "encargoId", "El encargo no pertenece al local activo.");
    const candidato = { ...actual, ...data, id: actual.id, localId: actual.localId || localActivoId };
    const validacion = validarEncargoPM10(candidato, { productos, clientes, localActivoId, locales, empresaId, fechaCreacion: actual.fechaCreacion || todayISO() });''',
'''  function updateEncargo(id, data) {
    const actual = encargos.find((e2) => e2.id === id);
    if (!actual || !encargoEsDelLocalActivo(actual)) return errorValidacionPM10("contexto_no_autorizado", "encargoId", "El encargo no pertenece al local activo.");
    if (data && data.id && data.id !== actual.id) return errorValidacionPM10("campo_inmutable", "encargoId", "La identidad interna del encargo no se puede cambiar.");
    if (data && data.localId && actual.localId && data.localId !== actual.localId) return errorValidacionPM10("campo_inmutable", "localId", "El local del encargo no se puede cambiar.");
    if (data && data.empresaId && actual.empresaId && data.empresaId !== actual.empresaId) return errorValidacionPM10("campo_inmutable", "empresaId", "La empresa del encargo no se puede cambiar.");
    if (data && data.fechaCreacion && actual.fechaCreacion && data.fechaCreacion !== actual.fechaCreacion) return errorValidacionPM10("campo_inmutable", "fechaCreacion", "La fecha de creación del encargo no se puede cambiar.");
    const candidato = {
      ...actual,
      ...data,
      id: actual.id,
      empresaId: actual.empresaId || data?.empresaId || null,
      localId: actual.localId || localActivoId,
      fechaCreacion: actual.fechaCreacion || todayISO()
    };
    const validacion = validarEncargoPM10(candidato, { productos, clientes, localActivoId, locales, empresaId, fechaCreacion: actual.fechaCreacion || todayISO() });''',
'identidad inmutable en edición'
)

reemplazar(
'''        const actualizado = { ...e2, ...validacion.datos, id: e2.id, localId: e2.localId || localActivoId };''',
'''        const actualizado = {
          ...e2,
          ...validacion.datos,
          id: e2.id,
          empresaId: e2.empresaId || validacion.datos.empresaId || null,
          localId: e2.localId || localActivoId,
          fechaCreacion: e2.fechaCreacion,
          total: validacion.total
        };''',
'identidad y total estables en edición'
)

if s != original:
    PATH.write_text(s, encoding='utf-8')
    print('PM14_P01_PATCH_APPLIED=1')
else:
    print('PM14_P01_ALREADY_APPLIED=1')
