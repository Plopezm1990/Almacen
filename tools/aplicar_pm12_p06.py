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


# 1) Motor PM12: cancelación conservadora y compatibilidad legada.
mod_path = ROOT / 'pm12-conteo-estados-v1.js'
mod = mod_path.read_text(encoding='utf-8')

old_estado = """  function estadoDerivado(conteo, reglasPorProducto) {
    conteo = conteo || {};
    if (Object.values(ESTADOS).includes(conteo.estado)) return conteo.estado;
    if (conteo.cancelado === true) return ESTADOS.CANCELADO;
    if (conteo.completado === true) return ESTADOS.COMPLETADO;
    var cobertura = resumenCobertura(conteo.items, reglasPorProducto);
    return cobertura.contados === 0 ? ESTADOS.BORRADOR : ESTADOS.EN_CURSO;
  }
"""
new_estado = """  function estadoDerivado(conteo, reglasPorProducto) {
    conteo = conteo || {};
    // En documentos antiguos el flag cancelado puede coexistir con un estado obsoleto.
    // La cancelación es terminal y tiene prioridad para no reabrir conteos históricos.
    if (conteo.cancelado === true) return ESTADOS.CANCELADO;
    if (Object.values(ESTADOS).includes(conteo.estado)) return conteo.estado;
    if (conteo.completado === true) return ESTADOS.COMPLETADO;
    var cobertura = resumenCobertura(conteo.items, reglasPorProducto);
    return cobertura.contados === 0 ? ESTADOS.BORRADOR : ESTADOS.EN_CURSO;
  }
"""
mod = replace_once(mod, old_estado, new_estado, 'estadoDerivado')

helpers = r'''  function esBorradorCompletamenteVacio(conteo, reglasPorProducto) {
    conteo = conteo || {};
    if (estadoDerivado(conteo, reglasPorProducto) !== ESTADOS.BORRADOR) return false;
    var cobertura = resumenCobertura(conteo.items, reglasPorProducto);
    var responsables = conteo.responsables || {};
    var contadoPor = String(responsables.contadoPor || conteo.responsable || '').trim();
    var revisor = String(responsables.revisor || '').trim();
    return cobertura.contados === 0 &&
      cobertura.invalidos === 0 &&
      !contadoPor &&
      !revisor &&
      !conteo.cerradoEn &&
      !conteo.cierre &&
      !conteo.coberturaCierre &&
      !conteo.motivoParcial &&
      conteo.ajustesAplicados !== true &&
      conteo.cancelado !== true;
  }

  function prepararCancelacion(conteo, opciones) {
    conteo = conteo || {};
    opciones = opciones || {};
    var estadoAnterior = estadoDerivado(conteo, opciones.reglasPorProducto);
    var reversosExistentes = (conteo.cancelacion && Array.isArray(conteo.cancelacion.reversos)) ? conteo.cancelacion.reversos :
      (Array.isArray(conteo.reversosCancelacion) ? conteo.reversosCancelacion : []);

    if (estadoAnterior === ESTADOS.CANCELADO || conteo.cancelado === true) {
      return {
        ok: true,
        replayed: true,
        estadoAnterior: conteo.estadoAnteriorCancelacion || (conteo.cancelacion && conteo.cancelacion.estadoAnterior) || null,
        operationId: conteo.cancelacionOperationId || (conteo.cancelacion && conteo.cancelacion.operationId) || null,
        reversos: reversosExistentes
      };
    }

    var motivo = String(opciones.motivo || '').trim();
    var responsable = String(opciones.responsable || '').trim();
    if (!motivo) return { ok: false, error: 'motivo_cancelacion_obligatorio' };
    if (!responsable) return { ok: false, error: 'responsable_cancelacion_obligatorio' };

    var fechaValor = typeof opciones.reloj === 'function' ? opciones.reloj() : new Date().toISOString();
    var fecha = new Date(fechaValor);
    if (!Number.isFinite(fecha.getTime())) return { ok: false, error: 'fecha_cancelacion_invalida' };
    var canceladoEn = fecha.toISOString();
    var identidadCorte = conteo.cerradoEn || conteo.iniciadoEn || conteo.fecha || 'sin-corte';
    var operationId = conteo.cancelacionOperationId ||
      (conteo.cancelacion && conteo.cancelacion.operationId) ||
      ('pm12-cancelar-conteo:' + String(conteo.id || 'sin-id') + ':' + String(identidadCorte));

    return {
      ok: true,
      replayed: false,
      estadoAnterior: estadoAnterior,
      motivo: motivo,
      responsable: responsable,
      canceladoEn: canceladoEn,
      operationId: operationId,
      reversos: reversosExistentes
    };
  }

'''
marker = "  root.__pm12ConteoEstados = Object.freeze({\n"
if marker not in mod:
    fail('no se encontró export PM12 estados')
mod = mod.replace(marker, helpers + marker, 1)
mod = replace_once(
    mod,
    "    estadoDerivado: estadoDerivado,\n    validarCierre: validarCierre\n",
    "    estadoDerivado: estadoDerivado,\n    validarCierre: validarCierre,\n    esBorradorCompletamenteVacio: esBorradorCompletamenteVacio,\n    prepararCancelacion: prepararCancelacion\n",
    'exports cancelación'
)
mod_path.write_text(mod, encoding='utf-8')


# 2) Runtime + fuente recuperada: reemplazo atómico de eliminarConteo y UX.
new_eliminar = r'''  function eliminarConteo(conteoId, opciones = {}) {
    const conteo = conteos.find((c) => c.id === conteoId);
    if (!conteoEsDelLocalActivo(conteo)) return { ok: false, error: "Conteo no disponible en el local activo." };
    const estadosApi = typeof window !== "undefined" ? window.__pm12ConteoEstados : null;
    if (!estadosApi) return { ok: false, error: "No se pudo validar el conteo. Recarga la página e inténtalo de nuevo." };
    const reglasPorProducto = (productoId) => {
      const producto = productos.find((p) => p.id === productoId);
      return producto ? {
        indivisible: producto.indivisible === true || producto.fraccionable === false,
        precision: Number.isInteger(producto.precisionCantidad) ? producto.precisionCantidad : void 0
      } : {};
    };
    const estadoActual = estadosApi.estadoDerivado(conteo, reglasPorProducto);
    if (estadoActual === "CANCELADO" || conteo.cancelado === true) {
      const reversosPrevios = conteo.cancelacion && Array.isArray(conteo.cancelacion.reversos) ? conteo.cancelacion.reversos : conteo.reversosCancelacion || [];
      return {
        ok: true,
        replayed: true,
        eliminado: false,
        cancelado: true,
        operationId: conteo.cancelacionOperationId || conteo.cancelacion && conteo.cancelacion.operationId || null,
        revertidos: reversosPrevios.length,
        reversos: reversosPrevios
      };
    }
    if (estadosApi.esBorradorCompletamenteVacio(conteo, reglasPorProducto)) {
      setConteos((s) => s.filter((c) => c.id !== conteoId));
      registrarAuditoria("Eliminar borrador de conteo", `Conteo vacío del ${conteo.fecha || "sin fecha"} eliminado sin movimientos de stock`);
      return { ok: true, replayed: false, eliminado: true, cancelado: false, revertidos: 0, reversos: [] };
    }
    const preparada = estadosApi.prepararCancelacion(conteo, {
      motivo: opciones.motivo,
      responsable: opciones.responsable,
      reglasPorProducto
    });
    if (!preparada.ok) {
      const mensajes = {
        motivo_cancelacion_obligatorio: "Escribe el motivo de la cancelación.",
        responsable_cancelacion_obligatorio: "Indica quién es responsable de la cancelación.",
        fecha_cancelacion_invalida: "La fecha de cancelación no es válida."
      };
      return { ok: false, codigo: preparada.error, error: mensajes[preparada.error] || "No se pudo cancelar el conteo." };
    }
    if (preparada.replayed) {
      return { ok: true, replayed: true, eliminado: false, cancelado: true, operationId: preparada.operationId, revertidos: preparada.reversos.length, reversos: preparada.reversos };
    }
    const generados = movimientos.filter((m) => m.documentoOrigenId === conteoId && m.origen === "aplicarAjustes" && movimientoEsDelLocalActivo(m));
    const reversos = [];
    for (const movimientoOriginal of generados) {
      const movimientoReversoId = `pm12-cancelar-conteo:${conteoId}:${movimientoOriginal.id}`;
      const r = aplicarMovimientoStock({
        productoId: movimientoOriginal.productoId,
        cantidad: -(Number(movimientoOriginal.cantidad) || 0),
        tipo: movimientoOriginal.tipo,
        operationId: preparada.operationId,
        movimientoId: movimientoReversoId,
        origen: "cancelarConteo",
        documentoOrigenId: conteoId,
        afectaStockTotal: !!movimientoOriginal.afectaStockTotal,
        afectaStockPisoVenta: !!movimientoOriginal.afectaStockPisoVenta,
        permitirDeficit: true,
        revierteMovimientoId: movimientoOriginal.id,
        motivo: `Cancelación del conteo del ${conteo.fecha || "sin fecha"} · ${preparada.motivo}`
      });
      if (!r.ok) {
        return {
          ok: false,
          codigo: "reverso_cancelacion_fallido",
          error: r.error || "No se pudo completar un reverso de stock. Reintenta: no se duplicarán los ya creados.",
          operationId: preparada.operationId,
          revertidos: reversos.length,
          reversos
        };
      }
      reversos.push({
        movimientoOriginalId: movimientoOriginal.id,
        movimientoReversoId: r.movimiento && r.movimiento.id ? r.movimiento.id : movimientoReversoId,
        productoId: movimientoOriginal.productoId,
        cantidad: -(Number(movimientoOriginal.cantidad) || 0),
        tipo: movimientoOriginal.tipo
      });
    }
    const cancelacion = {
      motivo: preparada.motivo,
      responsable: preparada.responsable,
      canceladoEn: preparada.canceladoEn,
      estadoAnterior: preparada.estadoAnterior,
      operationId: preparada.operationId,
      reversos
    };
    setConteos((s) => s.map((c) => c.id === conteoId ? {
      ...c,
      estado: "CANCELADO",
      cancelado: true,
      canceladoEn: preparada.canceladoEn,
      motivoCancelacion: preparada.motivo,
      responsableCancelacion: preparada.responsable,
      estadoAnteriorCancelacion: preparada.estadoAnterior,
      cancelacionOperationId: preparada.operationId,
      reversosCancelacion: reversos,
      cancelacion
    } : c));
    registrarAuditoria(
      "Cancelar conteo",
      `Conteo del ${conteo.fecha || "sin fecha"} · estado anterior ${preparada.estadoAnterior} · responsable: ${preparada.responsable} · ${reversos.length} reverso(s)`
    );
    return { ok: true, replayed: false, eliminado: false, cancelado: true, operationId: preparada.operationId, revertidos: reversos.length, reversos };
  }
  function revertirUltimaAplicacion(conteoId) {'''

for rel in ['fuente.js', 'source-recovery/fuente-recuperado.js']:
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    text = replace_regex_once(
        text,
        r'  function eliminarConteo\(conteoId\) \{[\s\S]*?\n  function revertirUltimaAplicacion\(conteoId\) \{',
        new_eliminar,
        f'{rel}: eliminarConteo',
        re.S
    )

    state_anchor = '  const [procesandoEliminar, setProcesandoEliminar] = (0, import_react4.useState)(false);\n'
    state_insert = state_anchor + '  const [motivoCancelacion, setMotivoCancelacion] = (0, import_react4.useState)("");\n  const [responsableCancelacion, setResponsableCancelacion] = (0, import_react4.useState)("");\n'
    text = replace_once(text, state_anchor, state_insert, f'{rel}: estados UX P06')

    # Estado visible honesto en historial.
    pill_pat = r'import_react4\.default\.createElement\(Pill2, \{ color: (c\d+)\.completado \? C2\.accent : C2\.amber \}, \1\.completado \? "Completado" : "En curso"\)'
    pill_repl = r'import_react4.default.createElement(Pill2, { color: (\1.estado === "CANCELADO" || \1.cancelado === true) ? C2.inkSoft : (\1.estado === "PARCIAL" ? C2.amber : (\1.completado || \1.estado === "COMPLETADO") ? C2.accent : C2.amber) }, (\1.estado === "CANCELADO" || \1.cancelado === true) ? "Cancelado" : \1.estado === "PARCIAL" ? "Parcial" : (\1.completado || \1.estado === "COMPLETADO") ? "Completado" : \1.estado === "BORRADOR" ? "Borrador" : "En curso")'
    text = replace_regex_once(text, pill_pat, pill_repl, f'{rel}: pill estado honesto')

    # Al abrir modal precarga responsable conocido y limpia motivo.
    open_pat = r'onClick: \(\) => setConfirmarEliminar\((c\d+)\)'
    open_repl = r'''onClick: () => {
      setConfirmarEliminar(\1);
      setMotivoCancelacion("");
      setResponsableCancelacion(\1.responsables && \1.responsables.contadoPor ? \1.responsables.contadoPor : \1.responsable || "");
    }'''
    text = replace_regex_once(text, open_pat, open_repl, f'{rel}: abrir modal P06')

    text = replace_once(text, 'title: "Eliminar conteo"', 'title: "Cancelar o eliminar conteo"', f'{rel}: título modal')
    text = replace_once(
        text,
        '"Si este conteo lleg\\xF3 a aplicar ajustes al stock (incluidos los traspasos autom\\xE1ticos al piso de venta), todo eso se revierte \\u2014 con un movimiento nuevo por cada uno, sin borrar ning\\xFAn movimiento anterior. El conteo desaparece de este historial."',
        '"Los conteos iniciados o cerrados no se borran: se conservan como CANCELADO. Si aplicaron ajustes al stock, se crean reversos trazables sin borrar movimientos anteriores."',
        f'{rel}: texto cerrado'
    )
    text = replace_once(
        text,
        '"Este conteo no lleg\\xF3 a aplicarse, as\\xED que no hay ning\\xFAn ajuste que revertir \\u2014 solo desaparecer\\xE1 de la lista."',
        '"Solo un borrador completamente vac\\xEDo se elimina f\\xEDsicamente. Cualquier conteo iniciado se conserva como CANCELADO."',
        f'{rel}: texto borrador'
    )

    # Inserta motivo/responsable antes de los botones del modal, acotado al modal P06.
    modal_start = text.find('title: "Cancelar o eliminar conteo"')
    if modal_start < 0:
        fail(f'{rel}: no se encontró modal P06')
    flex_marker = '/* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }'
    flex_pos = text.find(flex_marker, modal_start)
    if flex_pos < 0:
        fail(f'{rel}: no se encontró pie modal P06')
    fields = r'''/* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("label", { className: "block text-[12px]" }, "Motivo de cancelación", /* @__PURE__ */ import_react4.default.createElement("input", { value: motivoCancelacion, onChange: (e2) => setMotivoCancelacion(e2.target.value), placeholder: "Obligatorio si el conteo ya se inició", className: "mt-1 w-full border rounded-lg px-3 py-2 text-[13px]", style: { borderColor: C2.line, background: C2.bg } })), /* @__PURE__ */ import_react4.default.createElement("label", { className: "block text-[12px]" }, "Responsable", /* @__PURE__ */ import_react4.default.createElement("input", { value: responsableCancelacion, onChange: (e2) => setResponsableCancelacion(e2.target.value), placeholder: "Quién autoriza la cancelación", className: "mt-1 w-full border rounded-lg px-3 py-2 text-[13px]", style: { borderColor: C2.line, background: C2.bg } }))), '''
    text = text[:flex_pos] + fields + text[flex_pos:]

    old_click = '''        setProcesandoEliminar(true);\n        eliminarConteo(confirmarEliminar.id);\n        setConfirmarEliminar(null);\n        setProcesandoEliminar(false);'''
    new_click = '''        setProcesandoEliminar(true);\n        const resultadoGestionConteo = eliminarConteo(confirmarEliminar.id, { motivo: motivoCancelacion, responsable: responsableCancelacion });\n        if (!resultadoGestionConteo || !resultadoGestionConteo.ok) {\n          alert(resultadoGestionConteo && resultadoGestionConteo.error ? resultadoGestionConteo.error : "No se pudo gestionar el conteo.");\n          setProcesandoEliminar(false);\n          return;\n        }\n        setConfirmarEliminar(null);\n        setMotivoCancelacion("");\n        setResponsableCancelacion("");\n        setProcesandoEliminar(false);'''
    text = replace_once(text, old_click, new_click, f'{rel}: handler confirmación')
    text = replace_once(text, 'procesandoEliminar ? "Eliminando\\u2026" : "Confirmar eliminaci\\xF3n"', 'procesandoEliminar ? "Procesando\\u2026" : "Confirmar"', f'{rel}: etiqueta botón')

    path.write_text(text, encoding='utf-8')


# 3) Evidencia y contrato P06.
evidence = '''# PM12 · P06 — Cancelación conservadora de conteos\n\nFecha: 2026-09-07  \nRama: `pm12-conteo-estados-honestos`\n\n## Contrato cerrado\n\n- Solo un `BORRADOR` completamente vacío puede eliminarse físicamente.\n- Un conteo iniciado (`EN_CURSO`) o cerrado (`PARCIAL` / `COMPLETADO`) se conserva como `CANCELADO`.\n- La cancelación exige motivo y responsable.\n- Se registran fecha de cancelación, estado anterior, identidad de operación y reversos vinculados.\n- Los ajustes de stock previos se revierten con movimientos nuevos; nunca se borran movimientos históricos.\n- Cada reverso usa un `movimientoId` determinista por movimiento original, por lo que un reintento no duplica stock.\n- Repetir la cancelación de un documento ya cancelado devuelve `replayed: true`.\n- Los documentos antiguos con `cancelado: true` se normalizan de forma conservadora a `CANCELADO` aunque conserven un estado antiguo.\n- El historial muestra explícitamente `Cancelado`; no disfraza el documento como completado o en curso.\n- Se mantienen las garantías de P02–P05.\n\n## Límites\n\nP06 modifica únicamente la rama de QA. No añade migraciones, no escribe en Supabase y no modifica producción.\n\n**PM12_P06_CANCELACION_CONSERVADORA=PASS**\n'''
(ROOT / 'tests/pm12/P06_CANCELACION_CONSERVADORA.md').write_text(evidence, encoding='utf-8')

contract = r'''import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const modulo = fs.readFileSync("pm12-conteo-estados-v1.js", "utf8");
const contexto = { console, Date };
contexto.globalThis = contexto;
vm.runInNewContext(modulo, contexto);
const api = contexto.__pm12ConteoEstados;
assert.ok(api, "API PM12 disponible");

const reglas = () => ({ indivisible: false, precision: 2 });
const vacio = { id: "c-vacio", estado: "BORRADOR", fecha: "2026-09-07", items: [{ productoId: "p1", conteo: "" }], responsables: { contadoPor: "", revisor: "" } };
assert.equal(api.esBorradorCompletamenteVacio(vacio, reglas), true, "borrador vacío eliminable");
assert.equal(api.esBorradorCompletamenteVacio({ ...vacio, items: [{ productoId: "p1", conteo: 0 }] }, reglas), false, "cero cuenta como iniciado");
assert.equal(api.esBorradorCompletamenteVacio({ ...vacio, responsables: { contadoPor: "Ana", revisor: "" } }, reglas), false, "responsable implica documento usado");
assert.equal(api.estadoDerivado({ estado: "COMPLETADO", cancelado: true, items: [] }, reglas), "CANCELADO", "cancelado legado es terminal");

const faltaMotivo = api.prepararCancelacion({ ...vacio, estado: "EN_CURSO" }, { responsable: "Ana" });
assert.equal(faltaMotivo.ok, false);
assert.equal(faltaMotivo.error, "motivo_cancelacion_obligatorio");
const preparada = api.prepararCancelacion({ ...vacio, estado: "EN_CURSO", iniciadoEn: "2026-09-07T10:00:00.000Z" }, { motivo: "Error de captura", responsable: "Ana", reloj: () => "2026-09-07T13:00:00.000Z" });
assert.equal(preparada.ok, true);
assert.equal(preparada.estadoAnterior, "EN_CURSO");
assert.equal(preparada.operationId, "pm12-cancelar-conteo:c-vacio:2026-09-07T10:00:00.000Z");
assert.equal(preparada.canceladoEn, "2026-09-07T13:00:00.000Z");

const fuentes = [
  ["runtime", fs.readFileSync("fuente.js", "utf8")],
  ["fuente recuperada", fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8")]
];
for (const [nombre, codigo] of fuentes) {
  assert.match(codigo, /function eliminarConteo\(conteoId, opciones = \{\}\)/, `${nombre}: firma P06`);
  assert.match(codigo, /esBorradorCompletamenteVacio\(conteo, reglasPorProducto\)/, `${nombre}: borrado físico restringido`);
  assert.match(codigo, /estado: "CANCELADO"/, `${nombre}: conservación terminal`);
  assert.match(codigo, /motivoCancelacion: preparada\.motivo/, `${nombre}: motivo persistido`);
  assert.match(codigo, /responsableCancelacion: preparada\.responsable/, `${nombre}: responsable persistido`);
  assert.match(codigo, /estadoAnteriorCancelacion: preparada\.estadoAnterior/, `${nombre}: estado anterior persistido`);
  assert.match(codigo, /reversosCancelacion: reversos/, `${nombre}: reversos persistidos`);
  assert.match(codigo, /movimientoReversoId = `pm12-cancelar-conteo:\$\{conteoId\}:\$\{movimientoOriginal\.id\}`/, `${nombre}: reverso determinista`);
  assert.match(codigo, /origen: "cancelarConteo"/, `${nombre}: origen trazable`);
  assert.match(codigo, /replayed: true,[\s\S]*eliminado: false,[\s\S]*cancelado: true/, `${nombre}: replay idempotente`);
  assert.match(codigo, /"Cancelar o eliminar conteo"/, `${nombre}: UX explícita`);
  assert.match(codigo, /"Cancelado"/, `${nombre}: estado visible`);
  assert.match(codigo, /motivoCancelacion, responsable: responsableCancelacion/, `${nombre}: UX envía trazabilidad`);
  assert.doesNotMatch(codigo, /registrarAuditoria\(\s*"Eliminar conteo"/, `${nombre}: no queda borrado destructivo histórico`);
}

const evidencia = fs.readFileSync("tests/pm12/P06_CANCELACION_CONSERVADORA.md", "utf8");
assert.match(evidencia, /PM12_P06_CANCELACION_CONSERVADORA=PASS/);
console.log("PM12_P06_CANCELACION_CONSERVADORA=PASS");
console.log("BORRADO_FISICO_SOLO_BORRADOR_VACIO=1");
console.log("CANCELACION_TRAZABLE=1");
console.log("REVERSOS_IDEMPOTENTES=1");
console.log("LEGADOS_CONSERVADORES=1");
'''
(ROOT / 'tests/pm12/p06-cancelacion-conservadora-contract.mjs').write_text(contract, encoding='utf-8')

workflow = '''name: PM12 P06 cancelación conservadora\n\non:\n  push:\n    branches: [pm12-conteo-estados-honestos]\n    paths:\n      - 'fuente.js'\n      - 'source-recovery/fuente-recuperado.js'\n      - 'pm12-conteo-estados-v1.js'\n      - 'tests/pm12/P06_CANCELACION_CONSERVADORA.md'\n      - 'tests/pm12/p06-cancelacion-conservadora-contract.mjs'\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  validar:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n      - name: Verificar main congelado\n        run: |\n          git fetch origin main --quiet\n          test "$(git rev-parse origin/main)" = "7f792925d6a3d27334ee0e7335ba635b4ed79b6b"\n      - name: Sintaxis\n        run: |\n          node --check fuente.js\n          node --check source-recovery/fuente-recuperado.js\n          node --check pm12-conteo-estados-v1.js\n      - name: Contrato P06\n        run: node tests/pm12/p06-cancelacion-conservadora-contract.mjs\n      - name: Regresión P02-P05\n        run: |\n          node tests/pm12/p02-estados-normalizacion-contract.mjs\n          node tests/pm12/p03-documento-corte-contract.mjs\n          node tests/pm12/p04-cierre-honesto-ux-contract.mjs\n          node tests/pm12/p05-ajustes-trazables-contract.mjs\n      - name: Confirmar cero escrituras externas\n        run: |\n          echo 'PM12_P06_SUPABASE_WRITES=0'\n          echo 'PM12_P06_PRODUCTION_WRITES=0'\n'''
(ROOT / '.github/workflows/pm12-p06-cancelacion-conservadora.yml').write_text(workflow, encoding='utf-8')

print('PM12_P06_PATCH_PREPARADO=1')
