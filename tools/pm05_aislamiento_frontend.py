from pathlib import Path

root=Path(__file__).resolve().parents[1]
idx=root/'index.html'
src=root/'source-recovery'/'fuente-recuperado.js'

def rep(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: esperado 1, encontrado {n}')
    return text.replace(old,new,1)

s=idx.read_text()

s=rep(s,
'''  var TABLAS_POR_FILA = {\n    movimientos: "movimientos_registro",\n    fichajes: "fichajes_registro",\n    auditoria: "auditoria_registro",\n  };''',
'''  var TABLAS_POR_FILA = {\n    movimientos: "movimientos_registro",\n    fichajes: "fichajes_registro",\n    auditoria: "auditoria_registro",\n  };\n  // PM-05: proveedores y clientes dejan de compartir un bloque global.\n  // Cada registro conserva empresa_id en una tabla con RLS real.\n  var TABLAS_EMPRESA = {\n    proveedores: "proveedores_empresa",\n    clientes: "clientes_empresa",\n  };\n  var CLAVES_CACHE_POR_USUARIO = { proveedores: true, clientes: true, auditoria: true };\n\n  async function claveCacheLocal(key) {\n    if (!CLAVES_CACHE_POR_USUARIO[key] || !window.__nubeCliente) return key;\n    try {\n      var ses = await window.__nubeCliente.auth.getSession();\n      var uid = ses && ses.data && ses.data.session && ses.data.session.user && ses.data.session.user.id;\n      if (uid) return key + "::usuario:" + uid;\n    } catch (e) {}\n    return key + "::sin-sesion";\n  }\n\n  async function leerColeccionEmpresa(tabla) {\n    var r = await window.__nubeCliente.from(tabla).select("id,empresa_id,datos").order("updated_at", { ascending: true });\n    if (r.error) throw r.error;\n    return (r.data || []).map(function (fila) {\n      var d = fila.datos || {};\n      if (!d.empresaId) d = Object.assign({}, d, { empresaId: fila.empresa_id });\n      return d;\n    });\n  }\n\n  async function sincronizarColeccionEmpresa(tabla, listaLocal) {\n    if (!Array.isArray(listaLocal)) throw new Error("La colección empresarial debe ser una lista");\n    var invalidos = listaLocal.filter(function (x) { return !x || !x.id || !x.empresaId; });\n    if (invalidos.length) throw new Error("Hay registros sin id/empresaId; se bloquea la sincronización para evitar mezcla entre empresas");\n    var rLee = await window.__nubeCliente.from(tabla).select("id,empresa_id,datos");\n    if (rLee.error) throw rLee.error;\n    var remotos = rLee.data || [];\n    var porId = {}; remotos.forEach(function (r) { porId[r.id] = r; });\n    var filas = listaLocal.map(function (x) { return { id: x.id, empresa_id: x.empresaId, datos: x, updated_at: new Date().toISOString() }; });\n    if (filas.length) {\n      var rUp = await window.__nubeCliente.from(tabla).upsert(filas);\n      if (rUp.error) throw rUp.error;\n    }\n    var vivos = {}; listaLocal.forEach(function (x) { vivos[x.id]=true; });\n    var borrar = remotos.filter(function (r) { return !vivos[r.id]; }).map(function (r) { return r.id; });\n    if (borrar.length) {\n      var rDel = await window.__nubeCliente.from(tabla).delete().in("id", borrar);\n      if (rDel.error) throw rDel.error;\n    }\n  }''', 'insert tablas empresa')

s=rep(s,
'''        var valor = LOCAL.get(key);\n        var tablaEspecial = TABLAS_POR_FILA[key];\n        if (tablaEspecial) {\n          await encolarPorClave(key, function () { return sincronizarColeccionPorFila(tablaEspecial, JSON.parse(valor), key); });\n        } else {''',
'''        var cacheKey = await claveCacheLocal(key);\n        var valor = LOCAL.get(cacheKey);\n        var tablaEmpresa = TABLAS_EMPRESA[key];\n        var tablaEspecial = TABLAS_POR_FILA[key];\n        if (tablaEmpresa) {\n          await encolarPorClave(key, function () { return sincronizarColeccionEmpresa(tablaEmpresa, JSON.parse(valor)); });\n        } else if (tablaEspecial) {\n          await encolarPorClave(key, function () { return sincronizarColeccionPorFila(tablaEspecial, JSON.parse(valor), key); });\n        } else {''', 'pendientes empresa')

s=rep(s,
'''            p_fecha: d.fecha, p_hora: d.hora,\n          });''',
'''            p_fecha: d.fecha, p_hora: d.hora, p_empresa_id: d.empresaId || null, p_local_id: d.localId || null,\n          });''', 'rpc audit index')

s=rep(s,
'''    async get(key) {\n      var tablaEspecial = TABLAS_POR_FILA[key];''',
'''    async get(key) {\n      var tablaEmpresa = TABLAS_EMPRESA[key];\n      var tablaEspecial = TABLAS_POR_FILA[key];\n      var cacheKey = await claveCacheLocal(key);''', 'get vars')

s=rep(s,
'''          if (tablaEspecial) {\n            lista = await conTiempoLimite(leerColeccionPorFila(tablaEspecial, key), ESPERA_NUBE_MS);\n          } else {''',
'''          if (tablaEmpresa) {\n            lista = await conTiempoLimite(leerColeccionEmpresa(tablaEmpresa), ESPERA_NUBE_MS);\n          } else if (tablaEspecial) {\n            lista = await conTiempoLimite(leerColeccionPorFila(tablaEspecial, key), ESPERA_NUBE_MS);\n          } else {''', 'get empresa')

s=rep(s,
'''          LOCAL.set(key, texto); // copia local, para poder trabajar sin red\n          return { key: key, value: texto, shared: false };\n        } catch (e) { /* si falla la nube, seguimos con lo local */ }\n      }\n      return { key: key, value: LOCAL.get(key), shared: false };''',
'''          LOCAL.set(cacheKey, texto); // cache segregada por identidad en datos sensibles\n          return { key: key, value: texto, shared: false };\n        } catch (e) { /* si falla la nube, seguimos con la cache de ESA identidad */ }\n      }\n      return { key: key, value: LOCAL.get(cacheKey), shared: false };''', 'get secure cache')

s=rep(s,
'''    async set(key, value) {\n      var tablaEspecial = TABLAS_POR_FILA[key];\n\n      // Qué había guardado antes en este equipo.''',
'''    async set(key, value) {\n      var tablaEmpresa = TABLAS_EMPRESA[key];\n      var tablaEspecial = TABLAS_POR_FILA[key];\n      var cacheKey = await claveCacheLocal(key);\n\n      // Qué había guardado antes en este equipo.''', 'set vars')

s=s.replace('try { anterior = LOCAL.get(key); } catch (e) { anterior = null; }','try { anterior = LOCAL.get(cacheKey); } catch (e) { anterior = null; }',1)
s=s.replace('        LOCAL.set(key, value);','        LOCAL.set(cacheKey, value);',1)
s=s.replace('try { if (anterior !== null) LOCAL.set(key, anterior); } catch (e2) {}','try { if (anterior !== null) LOCAL.set(cacheKey, anterior); } catch (e2) {}',1)

s=rep(s,
'''          if (tablaEspecial) {\n            await conTiempoLimite(\n              encolarPorClave(key, function () { return sincronizarColeccionPorFila(tablaEspecial, JSON.parse(value), key); }),\n              ESPERA_NUBE_MS\n            );\n          } else {''',
'''          if (tablaEmpresa) {\n            await conTiempoLimite(\n              encolarPorClave(key, function () { return sincronizarColeccionEmpresa(tablaEmpresa, JSON.parse(value)); }),\n              ESPERA_NUBE_MS\n            );\n          } else if (tablaEspecial) {\n            await conTiempoLimite(\n              encolarPorClave(key, function () { return sincronizarColeccionPorFila(tablaEspecial, JSON.parse(value), key); }),\n              ESPERA_NUBE_MS\n            );\n          } else {''', 'set empresa')

s=rep(s,
'''    async delete(key) {\n      LOCAL.delete(key);\n      if (window.__nubeActiva && window.__nubeCliente) {\n        try {\n          var tablaEspecial = TABLAS_POR_FILA[key];\n          if (tablaEspecial) {''',
'''    async delete(key) {\n      var cacheKey = await claveCacheLocal(key);\n      LOCAL.delete(cacheKey);\n      if (window.__nubeActiva && window.__nubeCliente) {\n        try {\n          var tablaEmpresa = TABLAS_EMPRESA[key];\n          var tablaEspecial = TABLAS_POR_FILA[key];\n          if (tablaEmpresa) {\n            var rEmpDel = await conTiempoLimite(window.__nubeCliente.from(tablaEmpresa).delete().neq("id", ""), ESPERA_NUBE_MS);\n            if (rEmpDel.error) throw rEmpDel.error;\n          } else if (tablaEspecial) {''', 'delete empresa')

idx.write_text(s)

f=src.read_text()
f=rep(f,
'''function crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria }) {\n  function addProveedor(data) {\n    setProveedores((s2) => [...s2, { id: uid(), ...data }]);\n  }\n  function updateProveedor(id, data) {\n    setProveedores((s2) => s2.map((p2) => p2.id === id ? { ...p2, ...data } : p2));''',
'''function crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria, empresaId }) {\n  function addProveedor(data) {\n    if (!empresaId) return { ok: false, error: "Selecciona una empresa antes de crear el proveedor." };\n    const nuevo = { id: uid(), ...data, empresaId };\n    setProveedores((s2) => [...s2, nuevo]);\n    return { ok: true, proveedor: nuevo };\n  }\n  function updateProveedor(id, data) {\n    setProveedores((s2) => s2.map((p2) => p2.id === id && p2.empresaId === empresaId ? { ...p2, ...data, empresaId: p2.empresaId } : p2));''', 'proveedores ownership')

f=rep(f,
'''function crearLogicaClientes({ clientes, setClientes, registrarAuditoria }) {\n  function addCliente(data) {\n    const nuevo = { id: uid(), fechaAlta: todayISO(), ...data };''',
'''function crearLogicaClientes({ clientes, setClientes, registrarAuditoria, empresaId }) {\n  function addCliente(data) {\n    if (!empresaId) return null;\n    const nuevo = { id: uid(), fechaAlta: todayISO(), ...data, empresaId };''', 'clientes ownership')

f=rep(f,
'''  const { addProveedor, updateProveedor, deleteProveedor } = crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria });''',
'''  const { addProveedor, updateProveedor, deleteProveedor } = crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria, empresaId: empresaDelLocalActivo?.id || null });''', 'caller proveedores')
f=rep(f,
'''  const { addCliente, updateCliente, deleteCliente, anonimizarCliente } = crearLogicaClientes({ clientes, setClientes, registrarAuditoria });''',
'''  const { addCliente, updateCliente, deleteCliente, anonimizarCliente } = crearLogicaClientes({ clientes, setClientes, registrarAuditoria, empresaId: empresaDelLocalActivo?.id || null });''', 'caller clientes')

f=rep(f,
'''    const entrada = { id: uid(), fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), usuario, accion, detalle };''',
'''    const entrada = { id: uid(), fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), usuario, accion, detalle, empresaId: empresaDelLocalActivo?.id || null, localId: localActivoId || null };''', 'audit context')

f=rep(f,
'''            p_detalle: detalle,\n            p_fecha: entrada.fecha,\n            p_hora: entrada.hora''',
'''            p_detalle: detalle,\n            p_fecha: entrada.fecha,\n            p_hora: entrada.hora,\n            p_empresa_id: entrada.empresaId,\n            p_local_id: entrada.localId''', 'audit rpc source')

# updateCliente must not cross company; preserve ownership.
old='''    setClientes((s2) => s2.map((c2) => c2.id === id ? { ...c2, ...data } : c2));'''
if old in f:
    f=f.replace(old,'''    setClientes((s2) => s2.map((c2) => c2.id === id && c2.empresaId === empresaId ? { ...c2, ...data, empresaId: c2.empresaId } : c2));''',1)
else:
    raise SystemExit('updateCliente ownership: patrón no encontrado')

src.write_text(f)
print('PM05_FRONTEND_PATCH_OK=1')
