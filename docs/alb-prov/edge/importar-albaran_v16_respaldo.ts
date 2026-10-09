import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5-20251001";

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
  return `Eres un asistente que lee albaranes de proveedores de hostelería en España y extrae datos estructurados.

## REGLA DE ORO
NUNCA inventes un dato. Si algo no se lee con claridad, pon null. Copia literalmente los textos de fecha cuando se te pida y deja que el servidor los valide.

## FECHA ACTUAL
Hoy es ${hoy}. Solo marca una fecha como futura si es estrictamente posterior a ${hoy}.

## ANOTACIONES Y DATOS LOGÍSTICOS
Ignora firmas, sellos y anotaciones manuscritas. No generes avisos sobre ellas.
C.CARGA, CARGA, RUTA, CHÓFER, REPARTO, HORARIO, EXPEDICIÓN, BULTOS, PESO, MUELLE, VEHÍCULO y similares son datos logísticos: NUNCA son cargos monetarios.
En particular, "C.CARGA: 178,00" NO son 178 euros y debe ignorarse para todos los totales.

## NÚMERO Y FECHA DEL ALBARÁN
Busca primero Nº ALBARÁN, ALBARAN Nº, Núm. Alb. o Núm.Albarán. Si no existe, puede usarse NOTA ENTR. o NOTA DE ENTREGA.
No confundas con referencia, pedido, factura, código cliente, trazabilidad, proforma o expedición.
Para fecha usa únicamente la fecha IMPRESA etiquetada como Fecha, FECHA o Fecha Albarán. Devuelve AAAA-MM-DD.

## LÍNEAS
Un producto puede ocupar varios renglones.
- Punto Verde es canon del producto anterior.
- SUBUNIDADES/NETO no es producto; udsPorCaja = totalSubunidades / cantidadCajas.
- LOTE, P.Neto, F.Cad y Cad pertenecen al producto anterior.
- Une descripciones partidas.
- S/Pedido, Trazabilidad y Expedición no son productos.
- cantidad y unidad van separadas.
- precioUnitario es precio por unidad de venta.
- importeLinea es el importe final impreso de la línea, después de descuentos.
- descuentoPct es el porcentaje impreso si existe.
- Si el IVA por línea no puede asignarse con certeza, usa iva=null. No inventes tipos de IVA.

## CADUCIDAD — COPIA LITERAL
Para cada producto:
- caducidadTexto: copia EXACTAMENTE el texto de caducidad tal como aparece impreso, por ejemplo "31/12/99", "28/02/26" o "2026-09-30". No interpretes el año ni lo corrijas.
- caducidad: puedes proponer AAAA-MM-DD solo si es inequívoca, pero el servidor usará caducidadTexto como fuente principal.
Fechas como 31/12/99, 31/12/2099, 01/01/00 o equivalentes suelen ser valores de sistema; no las conviertas a otro año distinto.

## TOTALES DEL PIE
Extrae:
- sumaImportes: valor impreso "Suma de Importes", "Subtotal" o equivalente antes del IVA.
- ivaTotal: IMPORTE TOTAL de IVA. Si hay varias filas, suma únicamente los importes de IVA, no las bases.
- totalAlbaran: total final con IVA.
- cargos: solo un cargo monetario real claramente etiquetado como PORTES, TRANSPORTE, RECARGO, GASTOS, SUPLEMENTO o SERVICIO.
- cargosConcepto: copia la etiqueta exacta del cargo monetario. Si no hay cargo real, cargos=0 y cargosConcepto=null.

Ejemplo: Suma de Importes 113,50 + IVA 5,19 = Total Albarán 118,69. Eso cuadra.
Nunca metas C.CARGA ni cifras logísticas en cargos.

## AVISOS
Incluye solo dudas reales y accionables.
No avises de firmas, manuscritos, forma de pago, horarios, C.CARGA o datos logísticos.
No pongas comprobaciones positivas como "cuadra" o "coincide".
No repitas el mismo problema.

## SALIDA
Devuelve únicamente JSON:
{
  "proveedorNombre": "string o null",
  "proveedorCif": "string o null",
  "numeroAlbaran": "string o null",
  "numeroFactura": "string o null",
  "fecha": "AAAA-MM-DD o null",
  "numeroPedido": "string o null",
  "lineas": [
    {
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
    }
  ],
  "cargos": number,
  "cargosConcepto": "string o null",
  "sumaImportes": "number o null",
  "ivaTotal": "number o null",
  "totalAlbaran": "number o null",
  "confianza": "alta | media | baja",
  "avisos": ["dudas reales y accionables, en español"]
}
Los decimales JSON llevan punto.`;
}

function n(v: unknown): number | null {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function cerca(a: number, b: number, minimo = 0.06, pct = 0.006) {
  return Math.abs(a - b) <= Math.max(minimo, Math.abs(b) * pct);
}

function normalizarAviso(a: string) {
  return a.toLowerCase().replace(/[€.,;:()]/g, " ").replace(/\s+/g, " ").trim();
}

function limpiarAvisos(avisos: unknown, fechaDocumento: unknown, hoy: string): string[] {
  if (!Array.isArray(avisos)) return [];
  const ignorar = [
    /c\.?\s*carga/i,
    /firma/i,
    /manuscrit/i,
    /sello/i,
    /ruta\b/i,
    /ch[oó]fer/i,
    /forma de pago/i,
    /campo.*no capturad/i,
    /horario/i,
    /expedici[oó]n/i,
  ];
  const fechaNoFutura =
    typeof fechaDocumento === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fechaDocumento) &&
    fechaDocumento <= hoy;

  const salida: string[] = [];
  const vistos = new Set<string>();
  for (const raw of avisos) {
    if (typeof raw !== "string") continue;
    const a = raw.trim();
    if (!a) continue;
    if (ignorar.some((r) => r.test(a))) continue;
    if (fechaNoFutura && /futur[oa]/i.test(a)) continue;
    if (/\b(cuadra|coincide|verificad[oa]s?|correctamente)\b/i.test(a) &&
        !/(no\s+cuadra|no\s+coincide|difiere|diferencia|discrepancia|error|incorrect)/i.test(a)) continue;
    const k = normalizarAviso(a);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(a);
  }
  return salida;
}

function parseCaducidadTexto(raw: unknown): { fecha: string | null; legado: boolean } {
  if (typeof raw !== "string") return { fecha: null, legado: false };
  const t = raw.trim();
  if (!t) return { fecha: null, legado: false };

  let d: number, m: number, y: number;
  let match = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
  if (match) {
    d = Number(match[1]);
    m = Number(match[2]);
    const ys = match[3];
    if (ys.length === 2) {
      const yy = Number(ys);
      if (yy === 99 || yy === 0) return { fecha: null, legado: true };
      y = yy <= 69 ? 2000 + yy : 1900 + yy;
    } else {
      y = Number(ys);
      if ([1900, 1999, 2000, 2099].includes(y)) return { fecha: null, legado: true };
    }
  } else {
    match = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return { fecha: null, legado: false };
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
    if ([1900, 1999, 2000, 2099].includes(y)) return { fecha: null, legado: true };
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return { fecha: null, legado: false };
  const fecha = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${fecha}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) ||
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() + 1 !== m ||
      dt.getUTCDate() !== d) {
    return { fecha: null, legado: false };
  }
  return { fecha, legado: false };
}

function normalizarCaducidades(lineas: any[], hoy: string) {
  const avisos: string[] = [];
  for (const l of lineas) {
    const ref = String(l?.codigo || l?.descripcion || "producto");
    const texto = typeof l?.caducidadTexto === "string" ? l.caducidadTexto.trim() : "";
    if (texto) {
      const p = parseCaducidadTexto(texto);
      if (p.legado) {
        l.caducidad = null;
        avisos.push(`La caducidad impresa de ${ref} (${texto}) parece un valor de sistema/legado y se dejó vacía para revisión.`);
      } else if (p.fecha) {
        l.caducidad = p.fecha;
        if (p.fecha < hoy) {
          avisos.push(`La caducidad de ${ref} (${p.fecha}) ya ha pasado. Revisa el producto antes de confirmar.`);
        }
      } else {
        l.caducidad = null;
        avisos.push(`No se pudo interpretar con seguridad la caducidad impresa de ${ref} (${texto}). Revísala antes de confirmar.`);
      }
      continue;
    }

    if (typeof l?.caducidad === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.caducidad)) {
      if (["1900-01-01", "1999-12-31", "2000-01-01", "2099-12-31"].includes(l.caducidad)) {
        l.caducidad = null;
        avisos.push(`La caducidad de ${ref} parece un valor de sistema/legado y se dejó vacía para revisión.`);
      } else if (l.caducidad < hoy) {
        avisos.push(`La caducidad de ${ref} (${l.caducidad}) ya ha pasado. Revisa el producto antes de confirmar.`);
      }
    }
  }
  return avisos;
}

function conceptoCargoValido(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  if (/c\.?\s*carga|carga|ruta|expedici[oó]n|bultos|peso|muelle|veh[ií]culo/i.test(s)) return false;
  return /(portes?|transporte|recargo|gastos?|suplemento|servicio)/i.test(s);
}

function validarYCalcularConfianza(extraido: any, hoy: string) {
  let avisos = limpiarAvisos(extraido?.avisos, extraido?.fecha, hoy);
  const lineas = Array.isArray(extraido?.lineas) ? extraido.lineas : [];

  let score = 100;
  const faltan: string[] = [];
  if (!extraido?.proveedorNombre) { score -= 12; faltan.push("proveedor"); }
  if (!extraido?.numeroAlbaran) { score -= 20; faltan.push("número de albarán"); }
  if (!extraido?.fecha) { score -= 15; faltan.push("fecha"); }
  if (!lineas.length) { score -= 55; faltan.push("líneas de producto"); }
  if (n(extraido?.totalAlbaran) === null) { score -= 10; faltan.push("total"); }

  let esenciales = 0;
  let completos = 0;
  let matematicasComprobables = 0;
  let matematicasCuadran = 0;

  for (const l of lineas) {
    const descOk = typeof l?.descripcion === "string" && l.descripcion.trim().length > 0;
    const cant = n(l?.cantidad);
    const precio = n(l?.precioUnitario);
    const imp = n(l?.importeLinea);
    const dto = n(l?.descuentoPct) ?? 0;
    const canon = n(l?.canon) ?? 0;

    esenciales += 4;
    if (descOk) completos++;
    if (cant !== null && cant > 0) completos++;
    if (precio !== null && precio >= 0) completos++;
    if (imp !== null && imp >= 0) completos++;

    if (cant !== null && precio !== null && imp !== null && cant > 0) {
      matematicasComprobables++;
      const esperado = cant * precio * (1 - dto / 100);
      if (cerca(imp, esperado) || cerca(imp, esperado + canon) || cerca(imp - canon, esperado)) {
        matematicasCuadran++;
      }
    }
  }

  const completitud = esenciales ? completos / esenciales : 0;
  if (lineas.length && completitud < 0.75) score -= 20;
  else if (lineas.length && completitud < 0.9) score -= 8;

  const ratioMat = matematicasComprobables ? matematicasCuadran / matematicasComprobables : null;
  if (ratioMat !== null && matematicasComprobables >= 2) {
    if (ratioMat < 0.5) score -= 18;
    else if (ratioMat < 0.75) score -= 8;
  }

  avisos = avisos.filter((a) => !/caducidad/i.test(a));
  avisos.push(...normalizarCaducidades(lineas, hoy));

  const sumaLineas = lineas.length && lineas.every((l: any) => n(l?.importeLinea) !== null)
    ? lineas.reduce((acc: number, l: any) => acc + (n(l.importeLinea) ?? 0), 0)
    : null;
  const sumaImportes = n(extraido?.sumaImportes);
  const ivaTotal = n(extraido?.ivaTotal);
  const total = n(extraido?.totalAlbaran);

  let cargos = n(extraido?.cargos) ?? 0;
  const concepto = extraido?.cargosConcepto;
  if (cargos < 0 || !conceptoCargoValido(concepto)) cargos = 0;

  if (sumaImportes !== null && ivaTotal !== null && total !== null &&
      cerca(sumaImportes + ivaTotal, total, 0.12, 0.008)) {
    cargos = 0;
  }
  extraido.cargos = cargos;

  let sumaLineasCuadra: boolean | null = null;
  if (sumaLineas !== null && sumaImportes !== null) {
    sumaLineasCuadra = cerca(sumaLineas, sumaImportes, 0.12, 0.008);
    if (!sumaLineasCuadra) {
      score -= 12;
      avisos.push(`La suma de las líneas (${sumaLineas.toFixed(2)} €) no coincide con la Suma de Importes impresa (${sumaImportes.toFixed(2)} €). Revisa las líneas antes de confirmar.`);
    }
  }

  let totalCuadra: boolean | null = null;
  if (sumaImportes !== null && ivaTotal !== null && total !== null) {
    const calculadoPie = sumaImportes + ivaTotal + cargos;
    totalCuadra = cerca(calculadoPie, total, 0.12, 0.008);
    if (!totalCuadra) {
      score -= 15;
      avisos.push(`El pie no cuadra: Suma de Importes + IVA + cargos = ${calculadoPie.toFixed(2)} €, pero el total impreso es ${total.toFixed(2)} €. Revisa esos importes.`);
    }
  }

  if (faltan.length) {
    avisos.unshift(`Faltan datos esenciales por leer: ${faltan.join(", ")}.`);
  }

  const vistos = new Set<string>();
  extraido.avisos = avisos.filter((a) => {
    const k = normalizarAviso(a);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  extraido.confianza = score >= 80 ? "alta" : score >= 55 ? "media" : "baja";
  extraido.validacionAutomatica = {
    score,
    completitudLineasPct: Math.round(completitud * 100),
    matematicasComprobables,
    matematicasCuadran,
    sumaLineasCuadra,
    totalCuadra,
    cargosAceptados: cargos,
  };
  return extraido;
}

async function autorizar(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: 500, error: "La autenticación del servidor no está configurada." };
  }

  const authorization = req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "Debes iniciar sesión para importar albaranes." };

  const rUsuario = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${match[1]}` },
  });
  if (!rUsuario.ok) return { ok: false, status: 401, error: "La sesión no es válida o ha caducado. Vuelve a iniciar sesión." };
  const usuario = await rUsuario.json();
  if (!usuario?.id) return { ok: false, status: 401, error: "No se pudo identificar al usuario." };

  const rPerfil = await fetch(
    `${supabaseUrl}/rest/v1/perfiles?user_id=eq.${encodeURIComponent(usuario.id)}&select=rol,activo&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!rPerfil.ok) return { ok: false, status: 503, error: "No se pudo comprobar el permiso del usuario." };

  const perfiles = await rPerfil.json();
  const perfil = Array.isArray(perfiles) ? perfiles[0] : null;
  if (perfil?.activo !== true || !["Propietario", "Encargado"].includes(perfil?.rol)) {
    return { ok: false, status: 403, error: "No tienes permiso para importar albaranes." };
  }
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
    if (!Array.isArray(imagenes) || imagenes.length === 0) {
      return json(400, { ok: false, error: "No se ha recibido ninguna imagen." });
    }

    const hoy = hoyMadrid();
    const contenido = [
      {
        type: "text",
        text: `Lee este albarán y devuelve el JSON según las instrucciones. Hoy es ${hoy}. Copia literalmente las caducidades y no conviertas C.CARGA en dinero.`,
      },
      ...imagenes.map((img: { base64: string; mediaType: string }) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      })),
    ];

    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 4000,
        system: instrucciones(hoy),
        messages: [{ role: "user", content: contenido }],
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      return json(502, { ok: false, error: "La IA no ha podido procesar la imagen.", detalle });
    }

    const datos = await respuesta.json();
    const texto = datos.content?.[0]?.text || "";
    const limpio = texto.replace(/```json\s*|```\s*/g, "").trim();

    let extraido;
    try {
      extraido = JSON.parse(limpio);
    } catch {
      return json(200, { ok: false, error: "No se ha podido leer correctamente esta información. Revísala antes de continuar." });
    }

    extraido = validarYCalcularConfianza(extraido, hoy);
    return json(200, { ok: true, datos: extraido, uso: datos.usage });
  } catch (e) {
    return json(500, { ok: false, error: "Error inesperado procesando el albarán.", detalle: String(e) });
  }
});