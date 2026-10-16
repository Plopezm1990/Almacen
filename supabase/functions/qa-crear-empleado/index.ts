import { createClient } from "npm:@supabase/supabase-js@2";

// QA-only counterpart of crear-cuenta-empleado. It uses the same server-side
// authorization and compensating cleanup, but is reachable only from the
// isolated Deploy Preview hosts and never from the production site.
const SITE_HOST = "chic-entremet-9107cf.netlify.app";
const ROLES_VALIDOS = new Set([
  "Encargado",
  "Básico",
  "Camarero/a",
  "Cajero/a",
  "Churrero/a",
]);

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
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin") || "";

  if (req.method === "OPTIONS") {
    if (!origenPermitido(origen)) return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    return new Response("ok", { status: 200, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, { ok: false, qa: true, error: "Método no permitido." }, 405);
  if (!origenPermitido(origen)) return json(req, { ok: false, qa: true, error: "Origen no permitido." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json(req, { ok: false, qa: true, error: "Configuración del servidor incompleta." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { ok: false, qa: true, error: "Sesión no válida." }, 401);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: datosUsuario, error: errorUsuario } = await caller.auth.getUser();
    const actor = datosUsuario?.user;
    if (errorUsuario || !actor) return json(req, { ok: false, qa: true, error: "No se pudo verificar tu sesión." }, 401);

    const body = await req.json().catch(() => ({}));
    const empleadoId = clean(body?.empleadoId, 160);
    const nombre = clean(body?.nombre, 160);
    const email = clean(body?.email, 320).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const rol = clean(body?.rol, 60);

    if (!empleadoId || !nombre || !email || !password || !rol) {
      return json(req, { ok: false, qa: true, error: "Faltan datos obligatorios de la cuenta." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(req, { ok: false, qa: true, error: "El correo no es válido." }, 400);
    }
    if (password.length < 6 || password.length > 200) {
      return json(req, { ok: false, qa: true, error: "La contraseña no cumple la longitud permitida." }, 400);
    }
    if (!ROLES_VALIDOS.has(rol)) return json(req, { ok: false, qa: true, error: "Ese rol de acceso no está permitido." }, 400);

    const { data: preflight, error: errorPreflight } = await admin.rpc(
      "pm11_preparar_cuenta_empleado",
      { p_actor_user_id: actor.id, p_empleado_id: empleadoId },
    );
    if (errorPreflight || !preflight?.ok) {
      const codigo = preflight?.codigo || "";
      if (codigo === "empleado_no_encontrado") return json(req, { ok: false, qa: true, error: "Empleado no encontrado." }, 404);
      if (codigo === "empleado_no_activo") return json(req, { ok: false, qa: true, error: "Solo se puede crear cuenta a un empleado activo." }, 409);
      if (codigo === "perfil_no_activo") return json(req, { ok: false, qa: true, error: "El perfil del usuario no está activo." }, 403);
      if (codigo === "sin_alcance") return json(req, { ok: false, qa: true, error: "No tienes alcance de Propietario sobre este empleado." }, 403);
      if (codigo === "local_inactivo") return json(req, { ok: false, qa: true, error: "El local del empleado no está activo." }, 409);
      return json(req, { ok: false, qa: true, error: "No se pudo comprobar el empleado." }, errorPreflight ? 500 : 403);
    }

    const empleado = preflight.empleado;
    const perfilExistente = preflight.cuenta || null;
    if (perfilExistente?.userId) {
      const mismoEmail = String(perfilExistente.email || "").toLowerCase() === email;
      if (mismoEmail && perfilExistente.activo === true && perfilExistente.rol === rol) {
        return json(req, { ok: true, qa: true, yaCreada: true, userId: perfilExistente.userId, empleadoId, rol });
      }
      return json(req, { ok: false, qa: true, error: "El empleado ya tiene otra cuenta vinculada." }, 409);
    }

    const { data: nuevoUsuario, error: errorCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, qa: true },
    });
    if (errorCrear || !nuevoUsuario?.user) {
      const duplicado = String(errorCrear?.message || "").toLowerCase().includes("already");
      return json(req, { ok: false, qa: true, error: duplicado ? "Ya existe una cuenta con ese correo." : "No se pudo crear la cuenta." }, 409);
    }

    const nuevoUserId = nuevoUsuario.user.id;
    const { data: finalizado, error: errorFinalizar } = await admin.rpc(
      "pm11_finalizar_creacion_cuenta_empleado",
      {
        p_actor_user_id: actor.id,
        p_user_id: nuevoUserId,
        p_empresa_id: empleado.empresa_id,
        p_local_id: empleado.local_id,
        p_empleado_id: empleadoId,
        p_nombre: nombre,
        p_rol: rol,
      },
    );

    if (errorFinalizar || !finalizado?.ok) {
      const { error: errorBorrar } = await admin.auth.admin.deleteUser(nuevoUserId);
      if (errorBorrar) {
        await admin.auth.admin.updateUserById(nuevoUserId, { ban_duration: "876000h" }).catch(() => undefined);
        return json(req, { ok: false, qa: true, error: "Falló la configuración y la cuenta se ha intentado bloquear." }, 500);
      }
      return json(req, { ok: false, qa: true, error: "No se pudo completar la cuenta; no se dejó un acceso parcial." }, 409);
    }

    return json(req, { ok: true, qa: true, yaCreada: finalizado.yaCreada === true, userId: nuevoUserId, empleadoId, rol });
  } catch {
    return json(req, { ok: false, qa: true, error: "Error inesperado creando la cuenta." }, 500);
  }
});
