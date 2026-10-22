import { createClient } from "npm:@supabase/supabase-js@2";
import { validarNuevoPropietario } from "../_shared/plataforma-propietario.js";

// Crea la cuenta de acceso del DUEÑO de una empresa cliente y la hace Propietario de esa empresa.
// Solo puede llamarla el administrador de la plataforma (se comprueba en el servidor con
// plataforma_estado, con el JWT de quien llama, y la función de base de datos vuelve a comprobarlo).
// La clave de servicio solo se usa para crear/borrar la cuenta en Auth; la pertenencia a la empresa
// la decide la función de base de datos plataforma_asignar_propietario, nunca el navegador.

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
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin") || "";

  if (req.method === "OPTIONS") {
    if (!origenPermitido(origen)) return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    return new Response("ok", { status: 200, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, { ok: false, error: "Método no permitido." }, 405);
  if (!origenPermitido(origen)) return json(req, { ok: false, error: "Origen no permitido." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json(req, { ok: false, error: "Configuración del servidor incompleta." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { ok: false, error: "Sesión no válida." }, 401);

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
    if (errorUsuario || !actor) return json(req, { ok: false, error: "No se pudo verificar tu sesión." }, 401);

    // Solo el administrador de la plataforma. La respuesta no revela nada más a quien no lo es.
    const { data: estado, error: errorEstado } = await caller.rpc("plataforma_estado");
    if (errorEstado || estado?.es_admin !== true) {
      return json(req, { ok: false, error: "Solo el administrador de la plataforma puede hacer esto." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const validada = validarNuevoPropietario(body);
    if (!validada.ok) return json(req, { ok: false, error: validada.error }, validada.status);
    const { empresaId, nombre, email, password } = validada.datos;

    // La empresa tiene que existir y estar activa: se lee en el servidor, no se acepta nada del cliente.
    const { data: empresa, error: errorEmpresa } = await admin
      .from("empresas")
      .select("id,activo")
      .eq("id", empresaId)
      .maybeSingle();
    if (errorEmpresa || !empresa) return json(req, { ok: false, error: "Empresa no encontrada." }, 404);
    if (empresa.activo !== true) {
      return json(req, { ok: false, error: "La empresa está desactivada: reactívala antes de darle un dueño." }, 409);
    }

    const { data: nuevoUsuario, error: errorCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // El dueño debe cambiar esta contraseña inicial al entrar (la pantalla lo exigirá en la fase 3).
      user_metadata: { nombre, debe_cambiar_contrasena: true },
    });
    if (errorCrear || !nuevoUsuario?.user) {
      const duplicado = String(errorCrear?.message || "").toLowerCase().includes("already");
      return json(req, { ok: false, error: duplicado ? "Ya existe una cuenta con ese correo." : "No se pudo crear la cuenta." }, 409);
    }

    const nuevoUserId = nuevoUsuario.user.id;
    const { data: asignado, error: errorAsignar } = await caller.rpc("plataforma_asignar_propietario", {
      p_operation_id: `propietario:${nuevoUserId}:${empresaId}`.slice(0, 120),
      p_empresa_id: empresaId,
      p_user_id: nuevoUserId,
    });

    if (errorAsignar || asignado?.ok !== true) {
      // Todo o nada: si no se pudo hacer Propietario, la cuenta no se queda a medias.
      const { error: errorBorrar } = await admin.auth.admin.deleteUser(nuevoUserId);
      if (errorBorrar) {
        await admin.auth.admin.updateUserById(nuevoUserId, { ban_duration: "876000h" }).catch(() => undefined);
        return json(req, { ok: false, error: "Falló la configuración y la cuenta se ha intentado bloquear." }, 500);
      }
      return json(req, { ok: false, error: "No se pudo completar la cuenta; no se dejó un acceso parcial." }, 409);
    }

    // El nombre se guarda en el perfil (no es crítico: si falla, la cuenta ya es válida).
    await admin.from("perfiles").update({ nombre }).eq("user_id", nuevoUserId).then(() => undefined, () => undefined);

    return json(req, { ok: true, userId: nuevoUserId, empresaId });
  } catch {
    return json(req, { ok: false, error: "Error inesperado creando la cuenta." }, 500);
  }
});
