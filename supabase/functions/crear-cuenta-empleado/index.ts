import { createClient } from "npm:@supabase/supabase-js@2";

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
    if (u.protocol !== "https:") return false;
    return u.hostname === "chic-entremet-9107cf.netlify.app"
      || u.hostname.endsWith("--chic-entremet-9107cf.netlify.app");
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

function mensajeError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Error desconocido");
  }
  return String(error || "Error desconocido");
}

Deno.serve(async (req) => {
  const origen = req.headers.get("Origin") || "";

  if (req.method === "OPTIONS") {
    if (!origenPermitido(origen)) {
      return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    }
    return new Response("ok", { status: 200, headers: cors(req) });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Método no permitido." }, 405);
  }
  if (!origenPermitido(origen)) {
    return json(req, { ok: false, error: "Origen no permitido." }, 403);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(req, { ok: false, error: "Sesión no válida." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json(req, { ok: false, error: "Configuración del servidor incompleta." }, 500);
  }

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
    if (errorUsuario || !actor) {
      return json(req, { ok: false, error: "No se pudo verificar tu sesión." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const empleadoId = String(body?.empleadoId || "").trim();
    const nombre = String(body?.nombre || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const rol = String(body?.rol || "").trim();

    if (!empleadoId || !nombre || !email || !password || !rol) {
      return json(req, { ok: false, error: "Faltan datos obligatorios de la cuenta." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(req, { ok: false, error: "El correo no es válido." }, 400);
    }
    if (password.length < 6) {
      return json(req, { ok: false, error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }
    if (!ROLES_VALIDOS.has(rol)) {
      return json(req, { ok: false, error: "Ese rol de acceso no está permitido." }, 400);
    }

    const { data: empleado, error: errorEmpleado } = await admin
      .from("empleados")
      .select("id,empresa_id,local_id,estado,nombre")
      .eq("id", empleadoId)
      .maybeSingle();

    if (errorEmpleado || !empleado) {
      return json(req, { ok: false, error: "Empleado no encontrado." }, 404);
    }
    if (empleado.estado !== "activo") {
      return json(req, { ok: false, error: "Solo se puede crear cuenta a un empleado activo." }, 409);
    }

    const { data: perfilActor } = await admin
      .from("perfiles")
      .select("activo")
      .eq("user_id", actor.id)
      .maybeSingle();
    const { data: membresiasActor } = await admin
      .from("membresias_usuario")
      .select("empresa_id,local_id,todos_locales,rol,activo")
      .eq("user_id", actor.id)
      .eq("activo", true)
      .eq("empresa_id", empleado.empresa_id);

    const autorizado = perfilActor?.activo === true && (membresiasActor || []).some((m) =>
      m.rol === "Propietario"
      && (m.todos_locales === true || (m.todos_locales === false && m.local_id === empleado.local_id))
    );
    if (!autorizado) {
      return json(req, { ok: false, error: "Solo un Propietario activo de la empresa/local puede crear esta cuenta." }, 403);
    }

    // Reintento seguro: si la cuenta ya quedó vinculada por una ejecución anterior,
    // no se crea otro usuario ni se duplica auditoría.
    const { data: perfilExistente } = await admin
      .from("perfiles")
      .select("user_id,rol,activo,empleado_id")
      .eq("empleado_id", empleadoId)
      .maybeSingle();

    if (perfilExistente?.user_id) {
      const { data: usuarioExistente } = await admin.auth.admin.getUserById(perfilExistente.user_id);
      const mismoEmail = usuarioExistente?.user?.email?.toLowerCase() === email;
      if (mismoEmail && perfilExistente.activo === true && perfilExistente.rol === rol) {
        return json(req, {
          ok: true,
          yaCreada: true,
          userId: perfilExistente.user_id,
          empleadoId,
          rol,
        });
      }
      return json(req, { ok: false, error: "El empleado ya tiene otra cuenta vinculada." }, 409);
    }

    const { data: nuevoUsuario, error: errorCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (errorCrear || !nuevoUsuario?.user) {
      const mensaje = errorCrear?.message?.toLowerCase().includes("already")
        ? "Ya existe una cuenta con ese correo."
        : mensajeError(errorCrear || "No se pudo crear el usuario Auth.");
      return json(req, { ok: false, error: mensaje }, 409);
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
      // Compensación: si la parte DB falla, la cuenta Auth recién creada no puede
      // quedar huérfana. Si delete fallase, se intenta bloquear como segunda barrera.
      const { error: errorBorrar } = await admin.auth.admin.deleteUser(nuevoUserId);
      if (errorBorrar) {
        await admin.auth.admin.updateUserById(nuevoUserId, { ban_duration: "876000h" }).catch(() => undefined);
        return json(req, {
          ok: false,
          error: "Falló la configuración de la cuenta y no pudo completarse la compensación automática. La cuenta se ha intentado bloquear.",
        }, 500);
      }
      return json(req, {
        ok: false,
        error: "No se pudo completar la cuenta; no se guardó ningún acceso parcial.",
      }, 409);
    }

    return json(req, {
      ok: true,
      yaCreada: finalizado.yaCreada === true,
      userId: nuevoUserId,
      empleadoId,
      rol,
    });
  } catch (error) {
    return json(req, { ok: false, error: "Error del servidor: " + mensajeError(error) }, 500);
  }
});
