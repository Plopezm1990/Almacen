from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

# PM11 Compra P05 — frontera explícita albarán -> factura.
# Objetivos:
# - un albarán simple (esFactura !== true) no crea deuda;
# - una factura de proveedor exige número/fecha/contexto explícitos;
# - la obligación financiera queda identificada de forma canónica;
# - una misma identidad de factura no puede quedar confirmada en dos albaranes;
# - pagar/revertir solo se permite sobre una factura explícita, confirmada y válida.

# 1) La firma documental P04 también debe congelar la semántica financiera.
if 'esFactura: alb?.esFactura === true' not in s:
    old = '''    fecha: String(alb?.fecha || "").trim(),\n    numero: String(alb?.numero || "").trim(),\n    lineas: lineas.map((ln2) => ({'''
    new = '''    fecha: String(alb?.fecha || "").trim(),\n    numero: String(alb?.numero || "").trim(),\n    esFactura: alb?.esFactura === true,\n    numeroFactura: String(alb?.numeroFactura || "").trim(),\n    fechaFactura: String(alb?.fechaFactura || "").trim(),\n    lineas: lineas.map((ln2) => ({'''
    if old not in s:
        raise SystemExit('No se encontró la firma P04 para ampliar con identidad financiera')
    s = s.replace(old, new, 1)

# 2) Helpers canónicos P05 antes de la lógica de albaranes.
if 'function validarIdentidadFacturaAlbaranPM11(' not in s:
    pos = s.find('function crearLogicaAlbaranes({')
    if pos < 0:
        raise SystemExit('No se encontró crearLogicaAlbaranes')
    helper = r'''function normalizarNumeroFacturaPM11(valor) {
  return String(valor == null ? "" : valor).trim().toLowerCase().replace(/\s+/g, " ");
}
function fechaFacturaValidaPM11(valor) {
  const texto = String(valor == null ? "" : valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [y, m, d] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}
function albaranEsFacturaOperativaPM11(alb) {
  return !!alb && alb.estado === "confirmado" && alb.esFactura === true && !!normalizarNumeroFacturaPM11(alb.numeroFactura) && fechaFacturaValidaPM11(alb.fechaFactura);
}
function claveObligacionFacturaAlbaranPM11(alb, empresaIdEfectiva = null) {
  const empresa = String(alb?.empresaId || empresaIdEfectiva || "").trim();
  const proveedor = String(alb?.proveedorId || "").trim();
  const numero = normalizarNumeroFacturaPM11(alb?.numeroFactura);
  return empresa && proveedor && numero ? `${empresa}:${proveedor}:${numero}` : "";
}
function validarIdentidadFacturaAlbaranPM11({ alb, albaranes = [], empresaId = null, localActivoId = null, exigirFactura = false } = {}) {
  if (!alb || alb.esFactura !== true) {
    if (exigirFactura) return { ok: false, codigo: "no_es_factura", campo: "esFactura", error: "El albarán no está marcado explícitamente como factura." };
    return { ok: true, esFactura: false, clave: null, numeroFactura: "", fechaFactura: "" };
  }
  const id = String(alb.id || "").trim();
  const empresa = String(alb.empresaId || empresaId || "").trim();
  const local = String(alb.localId || localActivoId || "").trim();
  const proveedor = String(alb.proveedorId || "").trim();
  const numeroFactura = String(alb.numeroFactura || "").trim();
  const numeroNormalizado = normalizarNumeroFacturaPM11(numeroFactura);
  const fechaFactura = String(alb.fechaFactura || "").trim();
  if (!id) return { ok: false, codigo: "campo_obligatorio", campo: "id", error: "La factura necesita la identidad estable del albarán." };
  if (!empresa || !local || !proveedor) return { ok: false, codigo: "contexto_incompleto", campo: "factura", error: "La factura necesita empresa, local y proveedor explícitos." };
  if (!numeroNormalizado) return { ok: false, codigo: "campo_obligatorio", campo: "numeroFactura", error: "Indica el número de factura del proveedor." };
  if (!fechaFacturaValidaPM11(fechaFactura)) return { ok: false, codigo: "fecha_invalida", campo: "fechaFactura", error: "Indica una fecha de factura válida." };
  const clave = claveObligacionFacturaAlbaranPM11({ ...alb, empresaId: empresa, proveedorId: proveedor, numeroFactura }, empresa);
  const duplicada = (Array.isArray(albaranes) ? albaranes : []).find((otra) => {
    if (!otra || String(otra.id || "") === id) return false;
    if (!albaranEsFacturaOperativaPM11(otra)) return false;
    return claveObligacionFacturaAlbaranPM11(otra, otra.empresaId) === clave;
  }) || null;
  if (duplicada) {
    return { ok: false, codigo: "factura_duplicada", campo: "numeroFactura", error: "Ya existe otra factura confirmada de este proveedor con el mismo número.", duplicadaId: duplicada.id };
  }
  return { ok: true, esFactura: true, id, empresaId: empresa, localId: local, proveedorId: proveedor, numeroFactura, fechaFactura, clave };
}
'''
    s = s[:pos] + helper + s[pos:]

# 3) Nuevas escrituras de albarán nunca heredan la ambigüedad legacy undefined => factura.
alb_ini = s.find('function crearLogicaAlbaranes({')
if alb_ini < 0:
    raise SystemExit('No se encontró crearLogicaAlbaranes')

guardar_ini = s.find('  function guardarAlbaran(alb) {', alb_ini)
guardar_fin = s.find('  function duplicadosDe(alb) {', guardar_ini)
if guardar_ini < 0 or guardar_fin < 0:
    raise SystemExit('No se encontró guardarAlbaran/duplicadosDe')
guardar = s[guardar_ini:guardar_fin]
if 'limpioOriginalPM11' not in guardar:
    old = '    const limpioBase = sinFotoIncrustada(alb);\n'
    new = '''    const limpioOriginalPM11 = sinFotoIncrustada(alb);\n    const existenteEscrituraPM11 = limpioOriginalPM11.id ? albaranes.find((x3) => x3.id === limpioOriginalPM11.id) : null;\n    const limpioBase = !existenteEscrituraPM11 && limpioOriginalPM11.esFactura == null ? { ...limpioOriginalPM11, esFactura: false } : limpioOriginalPM11;\n'''
    if old not in guardar:
        raise SystemExit('No se encontró normalización base de guardarAlbaran')
    guardar = guardar.replace(old, new, 1)
    s = s[:guardar_ini] + guardar + s[guardar_fin:]

# 4) Los cuatro flujos de alta PM11 deben nacer como albarán simple explícito.
#    (pedido->albarán, IA/documento y alta manual heredaban true por defecto).
s = s.replace('      esFactura: true,', '      esFactura: false,')
s = s.replace('        esFactura: true,', '        esFactura: false,')

# 5) Lectura/UI financiera: solo true explícito. undefined/null deja de significar factura.
s = s.replace('esFactura !== false', 'esFactura === true')
# Donde además se exige confirmado, centralizamos la condición completa (nº/fecha válidos).
s = s.replace('a22.estado === "confirmado" && a22.esFactura === true', 'albaranEsFacturaOperativaPM11(a22)')

# Aviso de duplicado de nº de factura solo compara otros documentos explícitamente factura.
old_dup = 'factura: numFactura ? otros.find((a22) => norm(a22.numeroFactura) === numFactura) || null : null'
new_dup = 'factura: numFactura ? otros.find((a22) => a22.esFactura === true && norm(a22.numeroFactura) === numFactura) || null : null'
if old_dup in s:
    s = s.replace(old_dup, new_dup, 1)

# Aclarar en UI que el nº de factura ya no puede omitirse/fallback al albarán.
s = s.replace('N\\xBA de factura (si es distinto del albar\\xE1n)', 'N\\xBA de factura (obligatorio)')

# 6) Confirmación: validar frontera financiera antes del replay/efecto y persistir identidad de obligación.
conf_ini = s.find('  function confirmarAlbaran(alb) {', alb_ini)
conf_fin = s.find('  function anularAlbaran(alb) {', conf_ini)
if conf_ini < 0 or conf_fin < 0:
    raise SystemExit('No se encontró confirmarAlbaran/anularAlbaran')
conf = s[conf_ini:conf_fin]
if 'validarIdentidadFacturaAlbaranPM11' not in conf:
    needle = '''    const albaranId = String(alb?.id || "").trim();\n    if (!albaranId) return errorValidacionPM10("campo_obligatorio", "id", "El albarán necesita una identidad estable antes de confirmarse.");\n    const clavePM11 = claveConfirmacionAlbaranPM11(alb, empresaId, localActivoId);'''
    repl = '''    const albaranId = String(alb?.id || "").trim();\n    if (!albaranId) return errorValidacionPM10("campo_obligatorio", "id", "El albarán necesita una identidad estable antes de confirmarse.");\n    const facturaPM11 = validarIdentidadFacturaAlbaranPM11({ alb, albaranes, empresaId, localActivoId });\n    if (!facturaPM11.ok) return errorValidacionPM10(facturaPM11.codigo, facturaPM11.campo, facturaPM11.error);\n    const clavePM11 = claveConfirmacionAlbaranPM11(alb, empresaId, localActivoId);'''
    if needle not in conf:
        raise SystemExit('No se encontró guardia P04 dentro de confirmarAlbaran')
    conf = conf.replace(needle, repl, 1)

if 'const obligacionFacturaPM11 =' not in conf:
    needle = '''    const guardadoPM11 = guardarAlbaran({ ...alb, lineas: lineasResueltas, estado: "confirmado", avisosPrecio: avisos || [], confirmacionPM11 });'''
    repl = '''    const obligacionFacturaPM11 = facturaPM11.esFactura ? {\n      version: 1,\n      clave: facturaPM11.clave,\n      facturaId: albaranId,\n      origenFactura: "albaran",\n      empresaId: facturaPM11.empresaId,\n      localId: facturaPM11.localId,\n      proveedorId: facturaPM11.proveedorId,\n      numeroFactura: facturaPM11.numeroFactura,\n      fechaFactura: facturaPM11.fechaFactura\n    } : null;\n    const guardadoPM11 = guardarAlbaran({\n      ...alb,\n      lineas: lineasResueltas,\n      estado: "confirmado",\n      avisosPrecio: avisos || [],\n      confirmacionPM11,\n      esFactura: facturaPM11.esFactura === true,\n      numeroFactura: facturaPM11.esFactura ? facturaPM11.numeroFactura : (alb.numeroFactura || ""),\n      fechaFactura: facturaPM11.esFactura ? facturaPM11.fechaFactura : (alb.fechaFactura || ""),\n      obligacionFacturaPM11\n    });'''
    if needle not in conf:
        raise SystemExit('No se encontró persistencia P04 de albarán confirmado')
    conf = conf.replace(needle, repl, 1)

s = s[:conf_ini] + conf + s[conf_fin:]

# 7) Pago/reverso: prohibido contra albarán simple, ambiguo, no confirmado o factura incompleta/duplicada.
marcar_ini = s.find('  async function marcarPagada(id, pagada, importe)', alb_ini)
procesar_ini = s.find('  function procesarRecepcion({', marcar_ini)
if marcar_ini < 0 or procesar_ini < 0:
    raise SystemExit('No se encontró marcarPagada/procesarRecepcion')
marcar = s[marcar_ini:procesar_ini]
if 'exigirFactura: true' not in marcar:
    nueva = r'''  async function marcarPagada(id, pagada, importe) {
    const a22 = albaranes.find((x3) => x3.id === id);
    if (!a22 || !empresaId || !localActivoId || a22.empresaId !== empresaId || a22.localId !== localActivoId) return { ok: false, error: "Factura fuera del contexto autorizado." };
    if (a22.estado !== "confirmado") return { ok: false, codigo: "documento_no_confirmado", campo: "estado", error: "El albarán debe estar confirmado antes de poder pagarse." };
    const facturaPM11 = validarIdentidadFacturaAlbaranPM11({ alb: a22, albaranes, empresaId, localActivoId, exigirFactura: true });
    if (!facturaPM11.ok) return { ok: false, codigo: facturaPM11.codigo, campo: facturaPM11.campo, error: facturaPM11.error };
    const total = calcularTotalesFacturaAlbaran(a22).total;
    const doc = {
      ...a22,
      id: a22.id,
      empresaId: facturaPM11.empresaId,
      localId: facturaPM11.localId,
      proveedorId: facturaPM11.proveedorId,
      numero: facturaPM11.numeroFactura,
      numeroFactura: facturaPM11.numeroFactura,
      fecha: facturaPM11.fechaFactura,
      fechaFactura: facturaPM11.fechaFactura,
      total,
      obligacionFacturaPM11: a22.obligacionFacturaPM11 || {
        version: 1,
        clave: facturaPM11.clave,
        facturaId: a22.id,
        origenFactura: "albaran",
        empresaId: facturaPM11.empresaId,
        localId: facturaPM11.localId,
        proveedorId: facturaPM11.proveedorId,
        numeroFactura: facturaPM11.numeroFactura,
        fechaFactura: facturaPM11.fechaFactura
      }
    };
    const r2 = pagada ? await registrarPagoPM06({ factura: doc, origenFactura: "albaran", importe: importe == null ? calcularSaldoFacturaPM06(pagosFacturas, id, "albaran", total, a22.empresaId, a22.localId, a22.pagada).pendiente : importe, pagosFacturas, setPagosFacturas }) : await revertirUltimoPagoPM06({ factura: doc, origenFactura: "albaran", pagosFacturas, setPagosFacturas });
    if (r2.ok && !r2.replayed) registrarAuditoria(pagada ? "Registrar pago factura" : "Revertir pago factura", `Factura ${facturaPM11.numeroFactura} · €${redondearDineroPM06(r2.pago?.importe || importe || 0).toFixed(2)} · ${a22.empresaId}/${a22.localId}`);
    return r2;
  }
'''
    s = s[:marcar_ini] + nueva + s[procesar_ini:]

p.write_text(s, encoding='utf-8')
print('PM11 Compra P05: semántica e identidad de factura aplicadas')
