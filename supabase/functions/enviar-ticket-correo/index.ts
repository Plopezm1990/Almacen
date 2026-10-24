// T6 Hoja QA-6 (Etapa 5): ticket por correo.
// Única pieza que toca la clave RESEND_API_KEY — nunca llega al navegador.
// No es un documento fiscal ni sustituye el ticket impreso.
//
// El importe y la forma de pago que aparecen en el correo vienen siempre de
// abc_datos_ticket_correo (lectura autenticada del cobro real); las líneas
// del pedido las manda el cliente (ya las tiene en pantalla) y se escapan
// antes de insertarlas en el HTML.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_HOST = "chic-entremet-9107cf.netlify.app";

function origenPermitido(origen: string) {
  if (!origen) return true;
  try {
    const u = new URL(origen);
    return u.protocol === "https:" &&
      (u.hostname === SITE_HOST || u.hostname.endsWith("--" + SITE_HOST));
  } catch {
    return false;
  }
}

function cors(req: Request) {
  const origen = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origenPermitido(origen) ? origen : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function escapeHtml(v: unknown) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(v ?? "").replace(/[&<>"']/g, (c) => map[c]);
}

function fmt(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") {
    if (!origenPermitido(origen)) return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    return new Response("ok", { status: 200, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "Método no permitido." });
  if (!origenPermitido(origen)) return json(req, 403, { ok: false, error: "Origen no permitido." });

  // De aquí en adelante, cualquier fallo se devuelve con estado 200 y
  // { ok:false, error }: así el mensaje concreto llega siempre al cliente
  // (supabase.functions.invoke solo entrega el cuerpo de la respuesta sin
  // más cuando el estado HTTP es 2xx; con un estado de error devuelve un
  // mensaje genérico). Los estados 403/405 de arriba son de verdad
  // excepcionales (origen u método no permitidos) y no deben pasar nunca
  // en uso normal desde la pantalla.
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!supabaseUrl || !anonKey) return json(req, 200, { ok: false, error: "Configuración del servidor incompleta." });
  if (!resendKey) return json(req, 200, { ok: false, error: "El envío de correo no está configurado todavía (falta RESEND_API_KEY)." });

  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+.+/i.test(authorization)) return json(req, 200, { ok: false, error: "Debes iniciar sesión." });

  // Cliente con la sesión del propio usuario (no service role): así
  // abc_datos_ticket_correo y abc_registrar_ticket_correo_enviado ven el
  // auth.uid() real y aplican exactamente el mismo control de permisos
  // (ABC_COBRO_INICIAR) que el resto del cobro.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const operationId = clean(body?.operationId, 200);
    const empresaId = clean(body?.empresaId, 120);
    const localId = clean(body?.localId, 120);
    const checkoutId = clean(body?.checkoutId, 60);
    const email = clean(body?.email, 254).toLowerCase();
    const lineas = Array.isArray(body?.lineas) ? body.lineas.slice(0, 200) : [];

    if (!operationId || !empresaId || !localId || !checkoutId || !email) {
      return json(req, 200, { ok: false, error: "Faltan datos para enviar el ticket." });
    }

    const { data: datos, error: errorDatos } = await supabase.rpc("abc_datos_ticket_correo", {
      p_empresa_id: empresaId,
      p_local_id: localId,
      p_checkout_id: checkoutId,
      p_email: email,
    });
    if (errorDatos || !datos?.ok) {
      return json(req, 200, { ok: false, error: errorDatos?.message || "No se pudieron leer los datos del cobro." });
    }

    const filas = lineas
      .map((l: Record<string, unknown>) => {
        const nombre = escapeHtml(clean(l?.nombre as string, 120) || "Producto");
        const cantidad = escapeHtml(clean(String(l?.cantidad ?? ""), 20) || "1");
        const total = fmt(l?.total);
        return `<tr><td style="padding:4px 8px;">${nombre}</td><td style="padding:4px 8px;text-align:center;">${cantidad}</td><td style="padding:4px 8px;text-align:right;">€${total}</td></tr>`;
      })
      .join("");

    const medios = Array.isArray(datos.medios) ? datos.medios : [];
    const medioTexto = medios.map((m: Record<string, unknown>) => `${escapeHtml(m.medio)} (€${fmt(m.importe)})`).join(", ") || "—";
    const fecha = datos.fecha ? new Date(String(datos.fecha)).toLocaleString("es-ES") : "";
    const empresaNombre = escapeHtml(datos.empresaNombre || "");

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="margin-bottom:4px;">${empresaNombre}</h2>
        <div style="color:#555;font-size:12px;margin-bottom:16px;">${escapeHtml(fecha)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid #ddd;text-align:left;">
              <th style="padding:4px 8px;">Producto</th><th style="padding:4px 8px;">Cant.</th><th style="padding:4px 8px;text-align:right;">Importe</th>
            </tr>
          </thead>
          <tbody>${filas || '<tr><td colspan="3" style="padding:4px 8px;">Sin detalle de líneas.</td></tr>'}</tbody>
        </table>
        <div style="margin-top:16px;font-size:14px;"><b>Total pagado: €${fmt(datos.total)}</b></div>
        <div style="font-size:12px;color:#555;">Forma de pago: ${medioTexto}</div>
        <div style="margin-top:24px;font-size:11px;color:#999;">Este correo es un resumen informativo de tu compra, enviado a petición en el momento del cobro.</div>
      </div>
    `;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": operationId.slice(0, 256),
      },
      body: JSON.stringify({
        from: "L&A Suite <onboarding@resend.dev>",
        to: [email],
        subject: `Ticket de tu compra${empresaNombre ? " — " + datos.empresaNombre : ""}`,
        html,
      }),
    });
    const resendData = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok) {
      return json(req, 200, { ok: false, error: "No se pudo enviar el correo. Inténtalo de nuevo." });
    }

    // El correo ya salió de verdad en este punto. Si falla solo este
    // registro de auditoría, no deshacemos ni fingimos que no se envió.
    await supabase.rpc("abc_registrar_ticket_correo_enviado", {
      p_operation_id: operationId,
      p_empresa_id: empresaId,
      p_local_id: localId,
      p_checkout_id: checkoutId,
      p_email: email,
      p_resend_id: resendData?.id || null,
    });

    return json(req, 200, { ok: true, mensaje: "Ticket enviado por correo.", resendId: resendData?.id || null });
  } catch (_error) {
    return json(req, 200, { ok: false, error: "No se pudo enviar el ticket por correo." });
  }
});
