from pathlib import Path

p=Path('fuente.js')
s=p.read_text(encoding='utf-8')

def uno(txt,viejo,nuevo,nombre):
    n=txt.count(viejo)
    assert n==1, f'{nombre}: esperado 1, encontrado {n}'
    print('OK',nombre)
    return txt.replace(viejo,nuevo,1)

# 1) Migración histórica de las nuevas colecciones locales.
viejo='''      const movimientosCajaFinales = (mc || []).map((m2) => m2.localId ? m2 : { ...m2, localId: localActivoFinal || null });'''
nuevo='''      const movimientosCajaFinales = (mc || []).map((m2) => m2.localId ? m2 : { ...m2, localId: localActivoFinal || null });
      const inferirLocalFichaMigracion = (ficha) => {
        const ids = [...new Set([
          localPorProductoMigracion.get(ficha && ficha.productoVinculadoId),
          ...((ficha && ficha.componentes) || []).map((c2) => localPorProductoMigracion.get(c2 && c2.productoId))
        ].filter(Boolean))];
        return ids.length === 1 ? ids[0] : localActivoFinal || null;
      };
      const fichasCostoFinales = (fc || []).map((f2) => f2.localId ? f2 : { ...f2, localId: inferirLocalFichaMigracion(f2) });
      const ordenesProduccionFinales = (op || []).map((o2) => o2.localId ? o2 : { ...o2, localId: localPorProductoMigracion.get(o2.productoVinculadoId) || inferirLocalLineasMigracion(o2.ingredientes) });
      const puntosControlFinales = (pc || []).map((p2) => p2.localId ? p2 : { ...p2, localId: localActivoFinal || null });
      const localPorPuntoMigracion = new Map(puntosControlFinales.map((p2) => [p2.id, p2.localId || localActivoFinal || null]));
      const registrosAppccFinales = (ra || []).map((r2) => r2.localId ? r2 : { ...r2, localId: localPorPuntoMigracion.get(r2.puntoId) || localActivoFinal || null });
      const freidorasFinales = (fre || []).map((f2) => f2.localId ? f2 : { ...f2, localId: localPorProductoMigracion.get(f2.productoAceiteId) || localActivoFinal || null });
      const localPorFreidoraMigracion = new Map(freidorasFinales.map((f2) => [f2.id, f2.localId || localActivoFinal || null]));
      const registrosAceiteFinales = (rac || []).map((r2) => r2.localId ? r2 : { ...r2, localId: localPorFreidoraMigracion.get(r2.freidoraId) || localPorProductoMigracion.get(r2.productoAceiteId) || localActivoFinal || null });'''
s=uno(s,viejo,nuevo,'Migración: colecciones bloque 6')

viejo='''      setArqueos(arqueosFinales);
      setMovimientosCaja(movimientosCajaFinales);'''
nuevo='''      setArqueos(arqueosFinales);
      setMovimientosCaja(movimientosCajaFinales);
      setFichasCosto(fichasCostoFinales);
      setOrdenesProduccion(ordenesProduccionFinales);
      setPuntosControl(puntosControlFinales);
      setRegistrosAppcc(registrosAppccFinales);
      setFreidoras(freidorasFinales);
      setRegistrosAceite(registrosAceiteFinales);'''
s=uno(s,viejo,nuevo,'Migración: asignar estados bloque 6')

viejo='''      if (JSON.stringify(movimientosCajaFinales) !== JSON.stringify(mc || [])) await saveKey("movimientosCaja", movimientosCajaFinales);'''
nuevo='''      if (JSON.stringify(movimientosCajaFinales) !== JSON.stringify(mc || [])) await saveKey("movimientosCaja", movimientosCajaFinales);
      if (JSON.stringify(fichasCostoFinales) !== JSON.stringify(fc || [])) await saveKey("fichasCosto", fichasCostoFinales);
      if (JSON.stringify(ordenesProduccionFinales) !== JSON.stringify(op || [])) await saveKey("ordenesProduccion", ordenesProduccionFinales);
      if (JSON.stringify(puntosControlFinales) !== JSON.stringify(pc || [])) await saveKey("puntosControl", puntosControlFinales);
      if (JSON.stringify(registrosAppccFinales) !== JSON.stringify(ra || [])) await saveKey("registrosAppcc", registrosAppccFinales);
      if (JSON.stringify(freidorasFinales) !== JSON.stringify(fre || [])) await saveKey("freidoras", freidorasFinales);
      if (JSON.stringify(registrosAceiteFinales) !== JSON.stringify(rac || [])) await saveKey("registrosAceite", registrosAceiteFinales);'''
s=uno(s,viejo,nuevo,'Migración: persistir bloque 6')

# 2) Colecciones derivadas del local activo, antes de las alertas APPCC.
ancla='''  const alertasAppcc = (0, import_react4.useMemo)(() => {'''
assert s.count(ancla)==1, 'Derivados: ancla alertas APPCC'
derivados='''  const fichasCostoDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? fichasCosto : fichasCosto.filter((f2) => f2.localId === localActivoId), [fichasCosto, localActivoId]);
  const ordenesProduccionDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? ordenesProduccion : ordenesProduccion.filter((o2) => o2.localId === localActivoId), [ordenesProduccion, localActivoId]);
  const puntosControlDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? puntosControl : puntosControl.filter((p2) => p2.localId === localActivoId), [puntosControl, localActivoId]);
  const registrosAppccDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? registrosAppcc : registrosAppcc.filter((r2) => r2.localId === localActivoId), [registrosAppcc, localActivoId]);
  const freidorasDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? freidoras : freidoras.filter((f2) => f2.localId === localActivoId), [freidoras, localActivoId]);
  const registrosAceiteDelLocalActivo = (0, import_react4.useMemo)(() => !localActivoId ? registrosAceite : registrosAceite.filter((r2) => r2.localId === localActivoId), [registrosAceite, localActivoId]);
'''
s=s.replace(ancla,derivados+ancla,1)
print('OK Derivados bloque 6')

# Alertas APPCC solo del local activo.
i=s.index('  const alertasAppcc ='); j=s.index('  (0, import_react4.useEffect)(() => {',i); b=s[i:j]
b=uno(b,'const activos = (puntosControl || []).filter','const activos = (puntosControlDelLocalActivo || []).filter','APPCC alertas puntos local')
b=b.replace('(registrosAppcc || [])','(registrosAppccDelLocalActivo || [])')
b=uno(b,'], [puntosControl, registrosAppcc]);','], [puntosControlDelLocalActivo, registrosAppccDelLocalActivo]);','APPCC dependencias alertas local')
s=s[:i]+b+s[j:]

# 3) Fichas de costo: CRUD y alérgenos protegidos por local.
i=s.index('function crearLogicaFichasCosto('); j=s.index('\nfunction ',i+10); b=s[i:j]
b=uno(b,'function crearLogicaFichasCosto({ productos, setFichasCosto }) {','function crearLogicaFichasCosto({ productos, setFichasCosto, localActivoId }) {\n  const fichaEsDelLocalActivo = (f2) => !!f2 && (!localActivoId || f2.localId === localActivoId);\n  const productoEsDelLocalActivoFicha = (p2) => !!p2 && (!localActivoId || p2.localId === localActivoId);','Fichas firma local')
b=uno(b,'setFichasCosto((s2) => [...s2, { id: uid(), ...data }]);','setFichasCosto((s2) => [...s2, { id: uid(), ...data, localId: localActivoId || data.localId || null }]);','Fichas alta local')
b=uno(b,'setFichasCosto((s2) => s2.map((f2) => f2.id === id ? { ...f2, ...data } : f2));','setFichasCosto((s2) => s2.map((f2) => f2.id === id && fichaEsDelLocalActivo(f2) ? { ...f2, ...data, localId: f2.localId || localActivoId || null } : f2));','Fichas update protegido')
b=uno(b,'setFichasCosto((s2) => s2.filter((f2) => f2.id !== id));','setFichasCosto((s2) => s2.filter((f2) => f2.id !== id || !fichaEsDelLocalActivo(f2)));','Fichas delete protegido')
b=uno(b,'const p2 = productos.find((x3) => x3.id === c2.productoId);','const p2 = productos.find((x3) => x3.id === c2.productoId && productoEsDelLocalActivoFicha(x3));','Fichas alérgenos producto local')
s=s[:i]+b+s[j:]

s=uno(s,
'const { addFichaCosto, updateFichaCosto, deleteFichaCosto, alergenosDeFicha } = crearLogicaFichasCosto({ productos, setFichasCosto });',
'const { addFichaCosto, updateFichaCosto, deleteFichaCosto, alergenosDeFicha } = crearLogicaFichasCosto({ productos, setFichasCosto, localActivoId });',
'Fichas invocación local')

# 4) Producción: stock y órdenes del mismo local.
i=s.index('function crearLogicaProduccion('); j=s.index('\nfunction ',i+10); b=s[i:j]
b=uno(b,
'function crearLogicaProduccion({ fichasCosto, productos, setProductos, movimientos, setMovimientos, setOrdenesProduccion, registrarAuditoria }) {',
'function crearLogicaProduccion({ fichasCosto, productos, setProductos, movimientos, setMovimientos, setOrdenesProduccion, registrarAuditoria, localActivoId }) {\n  const productoEsDelLocalActivoProduccion = (p2) => !!p2 && (!localActivoId || p2.localId === localActivoId);\n  const ordenEsDelLocalActivoProduccion = (o2) => !!o2 && (!localActivoId || o2.localId === localActivoId);',
'Producción firma local')
b=uno(b,
'    const elaboradoOriginal = productos.find((p2) => p2.id === ficha.productoVinculadoId);\n    if (!elaboradoOriginal) {',
'    const elaboradoOriginal = productos.find((p2) => p2.id === ficha.productoVinculadoId);\n    if (elaboradoOriginal && !productoEsDelLocalActivoProduccion(elaboradoOriginal)) return { ok: false, error: "El producto elaborado pertenece a otro local." };\n    if (!elaboradoOriginal) {',
'Producción elaborado local')
b=uno(b,
'    let costoIngredientes = 0;\n    ingredientesReales.forEach((ing) => {',
'    const ingredienteFueraDeLocal = ingredientesReales.find((ing) => ing.productoId && Number(ing.cantidadReal) > 0 && !productoEsDelLocalActivoProduccion(productos.find((p2) => p2.id === ing.productoId)));\n    if (ingredienteFueraDeLocal) return { ok: false, error: "La producción incluye un ingrediente inexistente o de otro local." };\n    let costoIngredientes = 0;\n    ingredientesReales.forEach((ing) => {',
'Producción ingredientes protegidos')
b=uno(b,
'    const elaborado = productos.find((p2) => p2.id === ficha.productoVinculadoId);\n    if (elaborado) {',
'    const elaborado = productos.find((p2) => p2.id === ficha.productoVinculadoId);\n    if (elaborado && !productoEsDelLocalActivoProduccion(elaborado)) return { ok: false, error: "El producto elaborado pertenece a otro local." };\n    if (elaborado) {',
'Producción entrada local')
b=uno(b,'      id: ordenId,\n      fecha: todayISO(),','      id: ordenId,\n      localId: localActivoId || elaboradoOriginal.localId || null,\n      fecha: todayISO(),','Producción orden con localId')
b=uno(b,'  function anularProduccion(orden) {\n    function movimientoOriginalDe(productoId, tipo) {','  function anularProduccion(orden) {\n    if (!ordenEsDelLocalActivoProduccion(orden)) return { ok: false, error: "La producción pertenece a otro local." };\n    const idsProductosOrden = [...(orden.ingredientes || []).map((ing) => ing.productoId), orden.productoVinculadoId].filter(Boolean);\n    if (idsProductosOrden.some((id) => !productoEsDelLocalActivoProduccion(productos.find((p2) => p2.id === id)))) return { ok: false, error: "La producción contiene productos de otro local." };\n    function movimientoOriginalDe(productoId, tipo) {','Producción anulación protegida')
b=uno(b,
'(m2) => (m2.documentoOrigenId === orden.id || m2.ordenId === orden.id) && m2.productoId === productoId && (m2.tipo === tipo || m2.tipo === "salida" || m2.tipo === "entrada")',
'(m2) => (!localActivoId || m2.localId === localActivoId) && (m2.documentoOrigenId === orden.id || m2.ordenId === orden.id) && m2.productoId === productoId && (m2.tipo === tipo || m2.tipo === "salida" || m2.tipo === "entrada")',
'Producción movimiento original local')
s=s[:i]+b+s[j:]

s=uno(s,
'const { producir, anularProduccion } = crearLogicaProduccion({ fichasCosto, productos, setProductos, movimientos, setMovimientos, setOrdenesProduccion, registrarAuditoria });',
'const { producir, anularProduccion } = crearLogicaProduccion({ fichasCosto, productos, setProductos, movimientos, setMovimientos, setOrdenesProduccion, registrarAuditoria, localActivoId });',
'Producción invocación local')

# 5) APPCC: puntos físicos y registros locales.
i=s.index('function crearLogicaAppcc('); j=s.index('\nfunction ',i+10); b=s[i:j]
b=uno(b,'function crearLogicaAppcc({ setPuntosControl, setRegistrosAppcc }) {','function crearLogicaAppcc({ puntosControl, registrosAppcc, setPuntosControl, setRegistrosAppcc, localActivoId }) {\n  const puntoEsDelLocalActivoAppcc = (p2) => !!p2 && (!localActivoId || p2.localId === localActivoId);\n  const registroEsDelLocalActivoAppcc = (r2) => !!r2 && (!localActivoId || r2.localId === localActivoId);','APPCC firma local')
b=uno(b,'setPuntosControl((s2) => [...s2, { id: uid(), activo: true, ...data }]);','setPuntosControl((s2) => [...s2, { id: uid(), activo: true, ...data, localId: localActivoId || data.localId || null }]);','APPCC alta punto local')
b=uno(b,'setPuntosControl((s2) => s2.map((p2) => p2.id === id ? { ...p2, ...data } : p2));','setPuntosControl((s2) => s2.map((p2) => p2.id === id && puntoEsDelLocalActivoAppcc(p2) ? { ...p2, ...data, localId: p2.localId || localActivoId || null } : p2));','APPCC update punto protegido')
b=uno(b,'setPuntosControl((s2) => s2.filter((p2) => p2.id !== id));','setPuntosControl((s2) => s2.filter((p2) => p2.id !== id || !puntoEsDelLocalActivoAppcc(p2)));','APPCC delete punto protegido')
b=uno(b,'setRegistrosAppcc((s2) => [{ id: uid(), fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), ...data }, ...s2]);','const punto = puntosControl.find((p2) => p2.id === data.puntoId);\n    if (data.puntoId && !puntoEsDelLocalActivoAppcc(punto)) return false;\n    setRegistrosAppcc((s2) => [{ id: uid(), fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), ...data, localId: localActivoId || (punto && punto.localId) || null }, ...s2]);\n    return true;','APPCC registro local')
b=uno(b,'setRegistrosAppcc((s2) => s2.filter((r) => r.id !== id));','const registro = registrosAppcc.find((r2) => r2.id === id);\n    if (!registroEsDelLocalActivoAppcc(registro)) return false;\n    setRegistrosAppcc((s2) => s2.filter((r) => r.id !== id));\n    return true;','APPCC delete registro protegido')
s=s[:i]+b+s[j:]

s=uno(s,
'const { addPuntoControl, updatePuntoControl, deletePuntoControl, registrarAppcc, eliminarRegistroAppcc } = crearLogicaAppcc({ setPuntosControl, setRegistrosAppcc });',
'const { addPuntoControl, updatePuntoControl, deletePuntoControl, registrarAppcc, eliminarRegistroAppcc } = crearLogicaAppcc({ puntosControl, registrosAppcc, setPuntosControl, setRegistrosAppcc, localActivoId });',
'APPCC invocación local')

# 6) Aceite/freidoras: equipos, registros y stock locales.
i=s.index('function crearLogicaAceite('); j=s.index('\nfunction ',i+10); b=s[i:j]
b=uno(b,
'function crearLogicaAceite({ freidoras, setFreidoras, registrosAceite, setRegistrosAceite, productos, setProductos, movimientos, setMovimientos, registrarAuditoria }) {',
'function crearLogicaAceite({ freidoras, setFreidoras, registrosAceite, setRegistrosAceite, productos, setProductos, movimientos, setMovimientos, registrarAuditoria, localActivoId }) {\n  const productoEsDelLocalActivoAceite = (p2) => !!p2 && (!localActivoId || p2.localId === localActivoId);\n  const freidoraEsDelLocalActivoAceite = (f2) => !!f2 && (!localActivoId || f2.localId === localActivoId);\n  const registroEsDelLocalActivoAceite = (r2) => !!r2 && (!localActivoId || r2.localId === localActivoId);',
'Aceite firma local')
b=uno(b,'      productoAceiteId: data.productoAceiteId || "",\n      activa: true','      productoAceiteId: productoEsDelLocalActivoAceite(productos.find((p2) => p2.id === data.productoAceiteId)) ? data.productoAceiteId : "",\n      activa: true,\n      localId: localActivoId || null','Aceite alta freidora local')
b=uno(b,'  function updateFreidora(id, data) {\n    setFreidoras((s2) => s2.map((f2) => f2.id === id ? { ...f2, ...data } : f2));\n  }','  function updateFreidora(id, data) {\n    const actual = freidoras.find((f2) => f2.id === id);\n    if (!freidoraEsDelLocalActivoAceite(actual)) return false;\n    if (data.productoAceiteId && !productoEsDelLocalActivoAceite(productos.find((p2) => p2.id === data.productoAceiteId))) return false;\n    setFreidoras((s2) => s2.map((f2) => f2.id === id ? { ...f2, ...data, localId: f2.localId || localActivoId || null } : f2));\n    return true;\n  }','Aceite update freidora protegido')
b=uno(b,'    const f2 = freidoras.find((x3) => x3.id === id);\n    registrarAuditoria','    const f2 = freidoras.find((x3) => x3.id === id);\n    if (!freidoraEsDelLocalActivoAceite(f2)) return false;\n    registrarAuditoria','Aceite delete freidora protegido')
b=uno(b,'    const prod = productos.find((p2) => p2.id === productoAceiteId);\n    if (!prod) return { ok: false, error: "El aceite enlazado ya no existe en el cat\\xE1logo." };','    const prod = productos.find((p2) => p2.id === productoAceiteId);\n    if (!prod) return { ok: false, error: "El aceite enlazado ya no existe en el cat\\xE1logo." };\n    if (!productoEsDelLocalActivoAceite(prod)) return { ok: false, error: "El aceite pertenece a otro local." };','Aceite producto stock local')
# Ambas operaciones localizan freidora con la misma línea.
viejo='const f2 = freidoras.find((x3) => x3.id === freidoraId);\n    if (!f2) return { ok: false, error: "Selecciona una freidora." };'
nuevo='const f2 = freidoras.find((x3) => x3.id === freidoraId);\n    if (!f2) return { ok: false, error: "Selecciona una freidora." };\n    if (!freidoraEsDelLocalActivoAceite(f2)) return { ok: false, error: "La freidora pertenece a otro local." };'
assert b.count(viejo)==2, f'Aceite freidora operaciones: {b.count(viejo)}'
b=b.replace(viejo,nuevo)
print('OK Aceite operaciones freidora local')
# Ambos registros contienen id seguido de freidoraId.
viejo='      id: registroId,\n      freidoraId,'
nuevo='      id: registroId,\n      localId: localActivoId || f2.localId || null,\n      freidoraId,'
assert b.count(viejo)==2, f'Aceite registros localId: {b.count(viejo)}'
b=b.replace(viejo,nuevo)
print('OK Aceite registros con localId')
b=uno(b,'  function eliminarRegistroAceite(registro) {\n    const freidoraDelRegistro = freidoras.find((f2) => f2.id === registro.freidoraId);','  function eliminarRegistroAceite(registro) {\n    if (!registroEsDelLocalActivoAceite(registro)) return { ok: false, error: "El registro pertenece a otro local." };\n    const freidoraDelRegistro = freidoras.find((f2) => f2.id === registro.freidoraId && freidoraEsDelLocalActivoAceite(f2));','Aceite eliminar registro protegido')
b=uno(b,'(m2) => m2.documentoOrigenId === registro.id || m2.registroAceiteId === registro.id','(m2) => (!localActivoId || m2.localId === localActivoId) && (m2.documentoOrigenId === registro.id || m2.registroAceiteId === registro.id)','Aceite movimiento original local')
b=uno(b,'    const lista = registros || registrosAceite || [];','    const lista = (registros || registrosAceite || []).filter((r2) => registroEsDelLocalActivoAceite(r2));','Aceite consumo ciclo local')
s=s[:i]+b+s[j:]

s=uno(s,
'const { addFreidora, updateFreidora, deleteFreidora, registrarCambio, registrarRelleno, eliminarRegistroAceite, consumoPorCiclo } = crearLogicaAceite({ freidoras, setFreidoras, registrosAceite, setRegistrosAceite, productos, setProductos, movimientos, setMovimientos, registrarAuditoria });',
'const { addFreidora, updateFreidora, deleteFreidora, registrarCambio, registrarRelleno, eliminarRegistroAceite, consumoPorCiclo } = crearLogicaAceite({ freidoras, setFreidoras, registrosAceite, setRegistrosAceite, productos, setProductos, movimientos, setMovimientos, registrarAuditoria, localActivoId });',
'Aceite invocación local')

# 7) Renders locales.
# Fichas de costo.
i=s.index('tab === "fichas"'); j=s.index('tab === "produccion"',i); b=s[i:j]
b=uno(b,'      fichasCosto,\n','      fichasCosto: fichasCostoDelLocalActivo,\n','Render Fichas colección local')
b=uno(b,'      productos,\n','      productos: productosDelLocalActivo,\n','Render Fichas productos local')
b=uno(b,'      ordenesProduccion,\n','      ordenesProduccion: ordenesProduccionDelLocalActivo,\n','Render Fichas producción local')
s=s[:i]+b+s[j:]

s=uno(s,
'tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto, productos, ordenesProduccion, producir, anularProduccion, traspasarStock })',
'tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock })',
'Render Producción local')
s=uno(s,
'tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos, fichasCosto, alergenosDeFicha })',
'tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha })',
'Render Etiquetas local')

# APPCC.
i=s.index('tab === "appcc"'); j=s.index('tab === "saldo"',i); b=s[i:j]
b=uno(b,'      puntosControl,\n','      puntosControl: puntosControlDelLocalActivo,\n','Render APPCC puntos local')
b=uno(b,'      registrosAppcc,\n','      registrosAppcc: registrosAppccDelLocalActivo,\n','Render APPCC registros local')
b=uno(b,'      productos,\n','      productos: productosDelLocalActivo,\n','Render APPCC productos local')
b=uno(b,'      fichasCosto,\n','      fichasCosto: fichasCostoDelLocalActivo,\n','Render APPCC fichas local')
s=s[:i]+b+s[j:]

# Aceite.
i=s.index('tab === "aceite"'); j=s.index('tab === "buscar"',i); b=s[i:j]
b=uno(b,'      freidoras,\n','      freidoras: freidorasDelLocalActivo,\n','Render Aceite freidoras local')
b=uno(b,'      registrosAceite,\n','      registrosAceite: registrosAceiteDelLocalActivo,\n','Render Aceite registros local')
b=uno(b,'      productos,\n','      productos: productosDelLocalActivo,\n','Render Aceite productos local')
s=s[:i]+b+s[j:]

# Guardas finales.
requeridos=[
'fichasCostoDelLocalActivo', 'ordenesProduccionDelLocalActivo', 'puntosControlDelLocalActivo',
'registrosAppccDelLocalActivo', 'freidorasDelLocalActivo', 'registrosAceiteDelLocalActivo',
'localId: localActivoId || elaboradoOriginal.localId || null',
'La producción incluye un ingrediente inexistente o de otro local.',
'localId: localActivoId || data.localId || null',
'El aceite pertenece a otro local.',
'const fichasCostoFinales =', 'const ordenesProduccionFinales =', 'const puntosControlFinales =',
'const registrosAppccFinales =', 'const freidorasFinales =', 'const registrosAceiteFinales ='
]
for x in requeridos: assert x in s, x

p.write_text(s,encoding='utf-8')
print('GUARDAS_BLOQUE6_OK')