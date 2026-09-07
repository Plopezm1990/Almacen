from pathlib import Path
import re

ROOT = Path('.')


def fail(msg):
    raise SystemExit(msg)


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        fail(f'{label}: se esperaba 1 coincidencia y hay {n}')
    return text.replace(old, new, 1)


def replace_regex_once(text, pattern, repl, label, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        fail(f'{label}: se esperaba 1 coincidencia y hay {n}')
    return out


# 1) Motor PM12: autorización explícita para mutaciones de ajustes de inventario.
mod_path = ROOT / 'pm12-conteo-estados-v1.js'
mod = mod_path.read_text(encoding='utf-8')

permiso_helper = r'''  var ROLES_AJUSTE_INVENTARIO = Object.freeze(['Propietario', 'Encargado']);

  function autorizarAjusteInventario(contexto) {
    contexto = contexto || {};
    var rol = String(contexto.rol || '').trim();
    var actorId = String(contexto.actorId || '').trim();
    var actorNombre = String(contexto.actorNombre || '').trim();
    var empresaId = String(contexto.empresaId || '').trim();
    var localId = String(contexto.localId || '').trim();
    var conteoEmpresaId = String(contexto.conteoEmpresaId || '').trim();
    var conteoLocalId = String(contexto.conteoLocalId || '').trim();

    if (ROLES_AJUSTE_INVENTARIO.indexOf(rol) < 0) {
      return { ok: false, error: 'ajuste_no_autorizado', rol: rol || null };
    }
    if (!actorId && !actorNombre) return { ok: false, error: 'actor_ajuste_obligatorio' };
    if (!empresaId || !localId) return { ok: false, error: 'contexto_ajuste_incompleto' };
    if (contexto.todosLosLocales === true || localId.toLowerCase() === 'todos') {
      return { ok: false, error: 'todos_no_es_destino' };
    }
    if (!conteoEmpresaId || !conteoLocalId) return { ok: false, error: 'identidad_conteo_incompleta' };
    if (conteoEmpresaId !== empresaId) return { ok: false, error: 'empresa_no_coincide' };
    if (conteoLocalId !== localId) return { ok: false, error: 'local_no_coincide' };

    return {
      ok: true,
      rol: rol,
      actorId: actorId || null,
      actorNombre: actorNombre,
      empresaId: empresaId,
      localId: localId
    };
  }

'''
marker = "  root.__pm12ConteoEstados = Object.freeze({\n"
if marker not in mod:
    fail('motor: no se encontró export __pm12ConteoEstados')
mod = mod.replace(marker, permiso_helper + marker, 1)
mod = replace_once(
    mod,
    "    esBorradorCompletamenteVacio: esBorradorCompletamenteVacio,\n    prepararCancelacion: prepararCancelacion\n",
    "    esBorradorCompletamenteVacio: esBorradorCompletamenteVacio,\n    prepararCancelacion: prepararCancelacion,\n    ROLES_AJUSTE_INVENTARIO: ROLES_AJUSTE_INVENTARIO,\n    autorizarAjusteInventario: autorizarAjusteInventario\n",
    'motor: exports P07'
)
mod_path.write_text(mod, encoding='utf-8')


# 2) Runtime + fuente recuperada: guardas dentro de la mutación y UX coherente.
for rel in ['fuente.js', 'source-recovery/fuente-recuperado.js']:
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')

    text = replace_once(
        text,
        'function crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId }) {',
        'function crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId, empresaActivaId, obtenerContextoActor }) {',
        f'{rel}: firma crearLogicaConteos'
    )

    text = replace_once(
        text,
        '''  function conteoEsDelLocalActivo(conteo) {
    if (!conteo) return false;
    if (!localActivoId) return true;
    return localDeConteo(conteo) === localActivoId;
  }
''',
        '''  function conteoEsDelLocalActivo(conteo) {
    if (!conteo) return false;
    if (empresaActivaId && conteo.empresaId && conteo.empresaId !== empresaActivaId) return false;
    if (!localActivoId) return true;
    return localDeConteo(conteo) === localActivoId;
  }
''',
        f'{rel}: aislamiento empresa conteo'
    )

    permisos_internos = r'''  function contextoAjustePara(conteo) {
    const base = typeof obtenerContextoActor === "function" ? obtenerContextoActor() || {} : {};
    const localConteo = localDeConteo(conteo);
    const empresaContexto = base.empresaId || empresaActivaId || (conteo && conteo.empresaId) || null;
    const localContexto = base.localId || localActivoId || null;
    return {
      rol: base.rol,
      actorId: base.actorId,
      actorNombre: base.actorNombre,
      empresaId: empresaContexto,
      localId: localContexto,
      todosLosLocales: base.todosLosLocales === true || String(localContexto || "").toLowerCase() === "todos",
      conteoEmpresaId: (conteo && conteo.empresaId) || empresaContexto,
      conteoLocalId: localConteo || (conteo && conteo.localId) || null
    };
  }
  function autorizarMutacionAjustes(conteo) {
    const estadosApi = typeof window !== "undefined" ? window.__pm12ConteoEstados : null;
    if (!estadosApi || typeof estadosApi.autorizarAjusteInventario !== "function") {
      return { ok: false, error: "motor_permisos_no_disponible" };
    }
    return estadosApi.autorizarAjusteInventario(contextoAjustePara(conteo));
  }
  function respuestaPermisoAjuste(permiso) {
    const codigo = permiso && permiso.error || "ajuste_no_autorizado";
    const mensajes = {
      ajuste_no_autorizado: "Solo Propietario o Encargado puede aplicar o revertir ajustes de inventario.",
      actor_ajuste_obligatorio: "No se pudo identificar a la persona responsable del ajuste.",
      contexto_ajuste_incompleto: "Selecciona una empresa y un local concreto antes de ajustar inventario.",
      todos_no_es_destino: "Todos los locales es una vista de consulta y no puede recibir ajustes de inventario.",
      identidad_conteo_incompleta: "El conteo no tiene una identidad de empresa y local válida para ajustar stock.",
      empresa_no_coincide: "El conteo pertenece a otra empresa.",
      local_no_coincide: "El conteo pertenece a otro local.",
      motor_permisos_no_disponible: "No se pudo validar el permiso para ajustar inventario. Recarga la página e inténtalo de nuevo."
    };
    return { ok: false, codigo, error: mensajes[codigo] || "No tienes permiso para modificar el stock desde este conteo.", ajustados: 0, traspasados: [] };
  }
'''
    text = replace_regex_once(
        text,
        r'(  function movimientoEsDelLocalActivo\([^\n]+\) \{[\s\S]*?\n  \}\n)(  function crearProductoEnConteo\()',
        lambda m: m.group(1) + permisos_internos + m.group(2),
        f'{rel}: helpers permiso interno',
        re.S
    )

    text = replace_once(
        text,
        '''    const conteo = {
      id: uid(),
      localId: localActivoId || null,
      fecha: todayISO(),
''',
        '''    const conteo = {
      id: uid(),
      empresaId: empresaActivaId || null,
      localId: localActivoId || null,
      fecha: todayISO(),
''',
        f'{rel}: empresa en nuevo conteo'
    )

    text = replace_regex_once(
        text,
        r'(  function aplicarAjustes\(conteoId, motivos = \{\}\) \{\n    const conteo = conteos\.find\([^\n]+\);\n    if \(!conteoEsDelLocalActivo\(conteo\)\) return [^\n]+;\n)',
        lambda m: m.group(1) + '    const permisoAjuste = autorizarMutacionAjustes(conteo);\n    if (!permisoAjuste.ok) return respuestaPermisoAjuste(permisoAjuste);\n',
        f'{rel}: guarda aplicarAjustes'
    )

    text = replace_regex_once(
        text,
        r'(  function revertirUltimaAplicacion\(conteoId\) \{\n    const conteo = conteos\.find\([^\n]+\);\n    if \(!conteoEsDelLocalActivo\(conteo\)\) return [^\n]+;\n)',
        lambda m: m.group(1) + '    const permisoAjusteReversion = autorizarMutacionAjustes(conteo);\n    if (!permisoAjusteReversion.ok) return respuestaPermisoAjuste(permisoAjusteReversion);\n',
        f'{rel}: guarda revertirUltimaAplicacion'
    )

    text = replace_regex_once(
        text,
        r'(  function eliminarConteo\(conteoId, opciones = \{\}\) \{[\s\S]*?\n    const generados = movimientos\.filter\([^\n]+\);\n)',
        lambda m: m.group(1) + '''    if (generados.length > 0) {
      const permisoCancelacionStock = autorizarMutacionAjustes(conteo);
      if (!permisoCancelacionStock.ok) return respuestaPermisoAjuste(permisoCancelacionStock);
    }
''',
        f'{rel}: guarda reversos cancelacion',
        re.S
    )

    text = replace_once(
        text,
        '      registrarAuditoria("Aplicar ajustes de inventario", `${idsAplicados.length} producto(s) ajustado(s)`);',
        '      registrarAuditoria("Aplicar ajustes de inventario", `${idsAplicados.length} producto(s) ajustado(s) · ${permisoAjuste.rol} · ${permisoAjuste.actorNombre || permisoAjuste.actorId || "sin nombre"} · local ${permisoAjuste.localId}`);',
        f'{rel}: auditoria actor ajuste'
    )

    text = replace_once(
        text,
        'ajustesCantidad: idsAplicados.length, ajustesTraspasados: traspasados',
        'ajustesCantidad: idsAplicados.length, ajustesTraspasados: traspasados, ajustesActor: { id: permisoAjuste.actorId || null, nombre: permisoAjuste.actorNombre || "", rol: permisoAjuste.rol }, ajustesEmpresaId: permisoAjuste.empresaId, ajustesLocalId: permisoAjuste.localId',
        f'{rel}: trazabilidad permiso ajuste'
    )

    llamada_antigua = '  const { crearProductoEnConteo, iniciarConteo, actualizarConteoItem, actualizarResponsable, finalizarConteo, aplicarAjustes, eliminarConteo, revertirUltimaAplicacion } = crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId });'
    contexto_ui = r'''  function obtenerContextoAjusteConteo() {
    const empleadoActivo = usuarioActivoId ? empleados.find((e) => e.id === usuarioActivoId) : null;
    const rol = miPerfil && miPerfil.rol ? miPerfil.rol : modoEmpleado ? empleadoActivo && empleadoActivo.rol || "" : "Propietario";
    const actorNombre = miPerfil && miPerfil.nombre ? miPerfil.nombre : modoEmpleado ? empleadoActivo && empleadoActivo.nombre || "" : "Propietario/a";
    return {
      rol,
      actorId: usuarioActivoId || "",
      actorNombre,
      empresaId: empresaDelLocalActivo && empresaDelLocalActivo.id || null,
      localId: localActivoId || null,
      todosLosLocales: String(localActivoId || "").toLowerCase() === "todos"
    };
  }
  const puedeAplicarAjustesInventario = (() => {
    const api = typeof window !== "undefined" ? window.__pm12ConteoEstados : null;
    if (!api || typeof api.autorizarAjusteInventario !== "function") return false;
    const ctx = obtenerContextoAjusteConteo();
    return api.autorizarAjusteInventario({
      ...ctx,
      conteoEmpresaId: ctx.empresaId,
      conteoLocalId: ctx.localId
    }).ok === true;
  })();
  const { crearProductoEnConteo, iniciarConteo, actualizarConteoItem, actualizarResponsable, finalizarConteo, aplicarAjustes, eliminarConteo, revertirUltimaAplicacion } = crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId, empresaActivaId: empresaDelLocalActivo && empresaDelLocalActivo.id || null, obtenerContextoActor: obtenerContextoAjusteConteo });'''
    text = replace_once(text, llamada_antigua, contexto_ui, f'{rel}: contexto actor GestionAlmacen')

    bloque_nuevo = r'''function BloqueAplicarAjustes({ activo, procesandoCierre, onAplicar, onCerrarSinAjustar, onPedirRevertir, puedeAplicar = false }) {
  if (activo.ajustesAplicados) {
    return /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-4 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement(Card, { style: { background: C2.accentSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium mb-1" }, "Ajustes ya aplicados"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, activo.ajustesAplicadosEn ? `El ${new Date(activo.ajustesAplicadosEn).toLocaleString("es-ES")} — ` : "", "no se pueden volver a aplicar, para no duplicar la corrección sobre el stock.")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap mt-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", small: true, disabled: !puedeAplicar, title: !puedeAplicar ? "Solo Propietario o Encargado puede revertir ajustes de inventario." : "Revertir únicamente una aplicación duplicada", onClick: onPedirRevertir }, "¿Se aplicó dos veces por error? Revertir la última aplicación"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", small: true, onClick: onCerrarSinAjustar }, "Cerrar")));
  }
  if (!puedeAplicar) {
    return /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-4 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement(Card, { style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium mb-1" }, "Conteo cerrado sin permiso de ajuste"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Puedes cerrar y revisar el conteo, pero solo Propietario o Encargado puede aplicar ajustes al stock.")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: onCerrarSinAjustar, disabled: procesandoCierre }, "Cerrar sin ajustar")));
  }
  return /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-4 flex gap-2 flex-wrap no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { disabled: procesandoCierre, onClick: onAplicar }, procesandoCierre ? "Aplicando…" : "Aplicar ajustes al stock"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: onCerrarSinAjustar, disabled: procesandoCierre }, "Cerrar sin ajustar"));
}
'''
    text = replace_regex_once(
        text,
        r'function BloqueAplicarAjustes\([\s\S]*?\n\}\n(?=function InventarioCiego\()',
        bloque_nuevo,
        f'{rel}: UX BloqueAplicarAjustes',
        re.S
    )

    text = replace_once(
        text,
        'function InventarioCiego({ productos, proveedores, conteos, iniciarConteo, actualizarConteoItem, actualizarResponsable, finalizarConteo, aplicarAjustes, eliminarConteo, revertirUltimaAplicacion, productoPorId, crearProductoEnConteo, clasificacionABC, almacenCongelado }) {',
        'function InventarioCiego({ productos, proveedores, conteos, iniciarConteo, actualizarConteoItem, actualizarResponsable, finalizarConteo, aplicarAjustes, eliminarConteo, revertirUltimaAplicacion, productoPorId, crearProductoEnConteo, clasificacionABC, almacenCongelado, puedeAplicarAjustes = false }) {',
        f'{rel}: prop InventarioCiego'
    )

    text = replace_once(
        text,
        '''  }), /* @__PURE__ */ import_react4.default.createElement(BloqueAplicarAjustes, {
    activo,
    procesandoCierre,
''',
        '''  }), /* @__PURE__ */ import_react4.default.createElement(BloqueAplicarAjustes, {
    activo,
    procesandoCierre,
    puedeAplicar: puedeAplicarAjustes,
''',
        f'{rel}: pasar permiso BloqueAplicarAjustes'
    )

    text = replace_once(
        text,
        '''      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes"''',
        '''      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      puedeAplicarAjustes: puedeAplicarAjustesInventario
    }
  ), tab === "reportes"''',
        f'{rel}: pasar permiso a InventarioCiego'
    )

    path.write_text(text, encoding='utf-8')

print('PM12_P07_PATCH_OK=1')
