// Validación pura de la petición «crear la cuenta del dueño de una empresa cliente».
// Vive aparte de la función de servidor para poder probarla en Node sin Supabase.

export const EMPRESA_ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function limpiar(valor, max) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

// Contraseña inicial que entrega el administrador de la plataforma: más exigente que la de un
// empleado (mínimo 10, letras y números, sin el correo dentro). El dueño debe cambiarla al entrar.
export function motivoContrasenaDebil(password, email) {
  if (typeof password !== "string" || password.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (password.length > 200) return "La contraseña es demasiado larga.";
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/[0-9]/.test(password)) {
    return "La contraseña debe mezclar letras y números.";
  }
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return "La contraseña no puede contener el correo.";
  }
  return null;
}

export function validarNuevoPropietario(body) {
  // Un tope de 121 (uno más que el máximo válido) hace que un identificador demasiado largo falle la validación en vez de recortarse en silencio.
  const empresaId = limpiar(body?.empresaId, 121);
  const nombre = limpiar(body?.nombre, 160);
  const email = limpiar(body?.email, 320).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";

  if (!empresaId || !nombre || !email || !password) {
    return { ok: false, status: 400, error: "Faltan datos obligatorios de la cuenta." };
  }
  if (!EMPRESA_ID_RE.test(empresaId)) return { ok: false, status: 400, error: "La empresa indicada no es válida." };
  if (nombre.length < 2) return { ok: false, status: 400, error: "El nombre es demasiado corto." };
  if (!EMAIL_RE.test(email)) return { ok: false, status: 400, error: "El correo no es válido." };
  const debil = motivoContrasenaDebil(password, email);
  if (debil) return { ok: false, status: 400, error: debil };

  return { ok: true, datos: { empresaId, nombre, email, password } };
}
