import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5-20251001";
const MAX_PAGINAS = 36;
const MAX_BASE64_POR_PAGINA = 8_000_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function hoyMadrid() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function instrucciones(hoy: string) {
  return `Eres un asistente especializado en facturas de proveedores de hostelería en España. Recibirás todas las páginas de una sola factura, que puede incluir albaranes semanales o mensuales.

REGLA DE ORO: no inventes ningún dato. Si no se ve con claridad, devuelve null y añade un aviso breve. Hoy es ${hoy}.

OBJETIVO
1. Extrae la cabecera y los totales de la factura.
2. Identifica cada albarán incluido o mencionado.
3. Agrupa cada línea bajo el albarán al que pertenece, incluso cuando continúa en la página siguiente.
4. Si la factura solo menciona un albarán pero no contiene sus líneas, crea el albarán con lineas=[] y añade un aviso. Nunca reconstruyas productos por deducción.
5. Mantén separadas las líneas de distintos albaranes y no dupliques cabeceras repetidas por paginación.

PROVEEDOR Y CLIENTE
El proveedor es el emisor. El cliente es el destinatario. No confundas sus nombres ni NIF/CIF. Copia razón social, NIF/CIF, dirección, teléfono, correo, web y condiciones de pago únicamente si están impresos.

FACTURA
Extrae numeroFactura, serie, fechaFactura, vencimiento, formaPago, descuentos, cargos y totalFactura. No confundas el número de factura con pedido, albarán, código cliente, referencia o expedición.

IVA
Devuelve una fila por cada tipo de IVA con su base y cuota impresas. Conserva tipos 0, 4, 5, 10, 21 u otros que aparezcan. No calcules un tipo si no puede asignarse con certeza.

ALBARANES Y LÍNEAS
Para cada albarán devuelve numeroAlbaran, fecha, numeroPedido, totalAlbaran y sus líneas. Une descripciones partidas. LOTE, caducidad, trazabilidad, peso y subunidades pertenecen al producto anterior. precioUnitario es el precio por unidad de venta; importeLinea es el importe final impreso después de descuentos. C.CARGA, ruta, chófer, reparto, bultos y peso son logística, no importes monetarios.

SALIDA
Devuelve únicamente JSON con esta forma exacta:
{
  "proveedorNombre": "string o null",
  "proveedorCif": "string o null",
  "proveedorDireccion": "string o null",
  "proveedorTelefono": "string o null",
  "proveedorEmail": "string o null",
  "proveedorWeb": "string o null",
  "condicionesPago": "string o null",
  "diasPago": "number o null",
  "clienteNombre": "string o null",
  "clienteCif": "string o null",
  "numeroFactura": "string o null",
  "serie": "string o null",
  "fechaFactura": "AAAA-MM-DD o null",
  "vencimiento": "AAAA-MM-DD o null",
  "formaPago": "string o null",
  "tiposIva": [{"tipo": number, "base": number, "cuota": number}],
  "descuentos": number,
  "cargos": number,
  "totalFactura": "number o null",
  "albaranes": [
    {
      "numeroAlbaran": "string o null",
      "fecha": "AAAA-MM-DD o null",
      "numeroPedido": "string o null",
      "totalAlbaran": "number o null",
      "lineas": [{
        "codigo": "string o null",
        "descripcion": "string",
        "cantidad": number,
        "unidad": "string o null",
        "udsPorCaja": "number o null",
        "precioUnitario": number,
        "descuentoPct": number,
        "iva": "number o null",
        "canon": number,
        "lote": "string o null",
        "caducidadTexto": "string o null",
        "caducidad": "AAAA-MM-DD o null",
        "importeLinea": number
      }],
      "confianza": "alta | media | baja",
      "avisos": ["dudas reales y accionables en español"]
    }
  ],
  "confianza": "alta | media | baja",
  "avisos": ["dudas reales y accionables en español"]
}
Los decimales JSON llevan punto. No añadas explicaciones ni bloques Markdown.`;
}

function numero(v: unknown, fallback: number | null = null) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function texto(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function fecha(v: unknown) {
  const s = texto(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizarDocumento(v: unknown) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function redondear(v: unknown) {
  return Math.round((numero(v, 0) || 0) * 100) / 100;
}

function sanearExtraido(raw: Record<string, unknown>) {
  const avisos = Array.isArray(raw.avisos) ? raw.avisos.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
  const vistos = new Set<string>();
  let hayBloqueo = false;

  const albaranes = (Array.isArray(raw.albaranes) ? raw.albaranes : []).map((entrada) => {
    const alb = entrada && typeof entrada === "object" ? entrada as Record<string, unknown> : {};
    const numeroAlbaran = texto(alb.numeroAlbaran);
    const clave = normalizarDocumento(numeroAlbaran);
    const avisosAlbaran = Array.isArray(alb.avisos) ? alb.avisos.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
    if (!clave) {
      avisosAlbaran.push("Falta el número del albarán.");
      hayBloqueo = true;
    } else if (vistos.has(clave)) {
      avisosAlbaran.push("El albarán aparece repetido en la lectura.");
      hayBloqueo = true;
    }
    if (clave) vistos.add(clave);

    const lineas = (Array.isArray(alb.lineas) ? alb.lineas : []).map((entradaLinea) => {
      const linea = entradaLinea && typeof entradaLinea === "object" ? entradaLinea as Record<string, unknown> : {};
      return {
        codigo: texto(linea.codigo),
        descripcion: texto(linea.descripcion) || "",
        cantidad: Math.max(0, numero(linea.cantidad, 0) || 0),
        unidad: texto(linea.unidad),
        udsPorCaja: numero(linea.udsPorCaja),
        precioUnitario: Math.max(0, numero(linea.precioUnitario, 0) || 0),
        descuentoPct: Math.max(0, numero(linea.descuentoPct, 0) || 0),
        iva: numero(linea.iva),
        canon: Math.max(0, numero(linea.canon, 0) || 0),
        lote: texto(linea.lote),
        caducidadTexto: texto(linea.caducidadTexto),
        caducidad: fecha(linea.caducidad),
        importeLinea: Math.max(0, numero(linea.importeLinea, 0) || 0),
      };
    }).filter((linea) => linea.descripcion || linea.codigo);

    if (!lineas.length) {
      avisosAlbaran.push("El albarán está mencionado, pero faltan sus líneas o sus páginas.");
      hayBloqueo = true;
    }
    return {
      numeroAlbaran,
      fecha: fecha(alb.fecha),
      numeroPedido: texto(alb.numeroPedido),
      totalAlbaran: numero(alb.totalAlbaran),
      lineas,
      confianza: ["alta", "media", "baja"].includes(String(alb.confianza)) ? alb.confianza : "media",
      avisos: [...new Set(avisosAlbaran)],
    };
  });

  const tiposIva = (Array.isArray(raw.tiposIva) ? raw.tiposIva : []).map((entrada) => {
    const fila = entrada && typeof entrada === "object" ? entrada as Record<string, unknown> : {};
    return { tipo: numero(fila.tipo, 0) || 0, base: Math.max(0, redondear(fila.base)), cuota: Math.max(0, redondear(fila.cuota)) };
  }).filter((fila) => fila.base > 0 || fila.cuota > 0);

  const base = redondear(tiposIva.reduce((acc, fila) => acc + fila.base, 0));
  const iva = redondear(tiposIva.reduce((acc, fila) => acc + fila.cuota, 0));
  const totalCalculado = redondear(base + iva + redondear(raw.cargos) - redondear(raw.descuentos));
  const totalFactura = numero(raw.totalFactura);
  if (!texto(raw.numeroFactura)) { avisos.push("Falta el número de factura."); hayBloqueo = true; }
  if (!fecha(raw.fechaFactura)) { avisos.push("Falta una fecha de factura válida."); hayBloqueo = true; }
  if (!tiposIva.length) { avisos.push("No se han podido identificar las bases y cuotas de IVA."); hayBloqueo = true; }
  if (totalFactura == null) { avisos.push("Falta el total de la factura."); hayBloqueo = true; }
  else if (tiposIva.length && Math.abs(totalCalculado - totalFactura) > 0.12) { avisos.push("Las bases, el IVA y los ajustes no coinciden con el total de la factura."); hayBloqueo = true; }
  const totalAlbaranes = redondear(albaranes.reduce((acc, alb) => acc + (alb.totalAlbaran || 0), 0));
  if (albaranes.length && totalAlbaranes > 0 && totalFactura != null && Math.abs(totalAlbaranes - totalFactura) > 0.12) {
    avisos.push("La suma de los albaranes no coincide con el total de la factura.");
    hayBloqueo = true;
  }

  return {
    proveedorNombre: texto(raw.proveedorNombre), proveedorCif: texto(raw.proveedorCif), proveedorDireccion: texto(raw.proveedorDireccion),
    proveedorTelefono: texto(raw.proveedorTelefono), proveedorEmail: texto(raw.proveedorEmail), proveedorWeb: texto(raw.proveedorWeb),
    condicionesPago: texto(raw.condicionesPago), diasPago: numero(raw.diasPago), clienteNombre: texto(raw.clienteNombre), clienteCif: texto(raw.clienteCif),
    numeroFactura: texto(raw.numeroFactura), serie: texto(raw.serie), fechaFactura: fecha(raw.fechaFactura), vencimiento: fecha(raw.vencimiento),
    formaPago: texto(raw.formaPago), tiposIva, descuentos: Math.max(0, redondear(raw.descuentos)), cargos: Math.max(0, redondear(raw.cargos)),
    totalFactura, albaranes, confianza: hayBloqueo ? "baja" : (["alta", "media", "baja"].includes(String(raw.confianza)) ? raw.confianza : "media"),
    avisos: [...new Set(avisos)], requiereRevision: hayBloqueo,
  };
}

async function autorizar(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, status: 500, error: "La autenticación del servidor no está configurada." };
  const authorization = req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "Debes iniciar sesión para importar facturas." };
  const rUsuario = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${match[1]}` } });
  if (!rUsuario.ok) return { ok: false, status: 401, error: "La sesión no es válida o ha caducado. Vuelve a iniciar sesión." };
  const usuario = await rUsuario.json();
  if (!usuario?.id) return { ok: false, status: 401, error: "No se pudo identificar al usuario." };
  const rPerfil = await fetch(`${supabaseUrl}/rest/v1/perfiles?user_id=eq.${encodeURIComponent(usuario.id)}&select=rol,activo&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" },
  });
  if (!rPerfil.ok) return { ok: false, status: 503, error: "No se pudo comprobar el permiso del usuario." };
  const perfiles = await rPerfil.json();
  const perfil = Array.isArray(perfiles) ? perfiles[0] : null;
  if (perfil?.activo !== true || !["Propietario", "Encargado"].includes(perfil?.rol)) return { ok: false, status: 403, error: "No tienes permiso para importar facturas." };
  return { ok: true, status: 200, error: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "Método no permitido." });
  try {
    const auth = await autorizar(req);
    if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });
    if (!ANTHROPIC_API_KEY) return json(500, { ok: false, error: "Falta configurar la clave de la IA en Supabase." });
    const { imagenes } = await req.json();
    if (!Array.isArray(imagenes) || imagenes.length === 0) return json(400, { ok: false, error: "No se ha recibido ninguna página." });
    if (imagenes.length > MAX_PAGINAS) return json(400, { ok: false, error: `Puedes enviar como máximo ${MAX_PAGINAS} páginas por factura.` });
    const permitidos = new Set(["image/jpeg", "image/png", "image/webp"]);
    for (const imagen of imagenes) {
      if (!imagen || !permitidos.has(imagen.mediaType) || typeof imagen.base64 !== "string" || !imagen.base64 || imagen.base64.length > MAX_BASE64_POR_PAGINA) {
        return json(400, { ok: false, error: "Una de las páginas tiene un formato o tamaño no admitido." });
      }
    }
    const hoy = hoyMadrid();
    const contenido = [
      { type: "text", text: `Lee la factura completa y todos sus albaranes. Las imágenes están ordenadas por página. Hoy es ${hoy}. Devuelve únicamente el JSON solicitado.` },
      ...imagenes.map((img: { base64: string; mediaType: string }, indice: number) => ([
        { type: "text", text: `Página ${indice + 1} de ${imagenes.length}` },
        { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
      ])).flat(),
    ];
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELO, max_tokens: 8000, system: instrucciones(hoy), messages: [{ role: "user", content: contenido }] }),
    });
    if (!respuesta.ok) return json(502, { ok: false, error: "La IA no ha podido procesar la factura.", detalle: await respuesta.text() });
    const respuestaIA = await respuesta.json();
    const limpio = String(respuestaIA.content?.[0]?.text || "").replace(/```json\s*|```\s*/g, "").trim();
    let extraido: Record<string, unknown>;
    try { extraido = JSON.parse(limpio); }
    catch { return json(200, { ok: false, error: "No se ha podido leer correctamente esta factura. Guárdala como borrador y revísala manualmente." }); }
    return json(200, { ok: true, datos: sanearExtraido(extraido), uso: respuestaIA.usage });
  } catch (e) {
    return json(500, { ok: false, error: "Error inesperado procesando la factura.", detalle: String(e) });
  }
});
