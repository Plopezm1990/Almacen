// PM33 P05 -- helper compartido: extrae la referencia de proyecto de una
// URL de Supabase (API) y de una cadena de conexión Postgres (directa o
// vía pooler), y exige que coincidan antes de dejar seguir a ningún
// script. Sin esto, un SUPABASE_DB_URL copiado de otro proyecto por error
// escribiría datos de prueba en un entorno distinto del que
// SUPABASE_PROJECT_URL/SUPABASE_ANON_KEY leerían después -- silenciosamente,
// sin ningún error visible hasta mucho más tarde.
export function refDeProjectUrl(url) {
  if (!url) return null;
  const m = /^https?:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url);
  return m ? m[1] : null;
}

export function refDeDbUrl(dbUrl) {
  if (!dbUrl) return null;
  // Conexión directa: db.<ref>.supabase.co
  let m = /@db\.([a-z0-9]+)\.supabase\.co/i.exec(dbUrl);
  if (m) return m[1];
  // Pooler (pgbouncer): usuario postgres.<ref>@...pooler.supabase.com
  m = /postgres\.([a-z0-9]+)@/i.exec(dbUrl);
  if (m) return m[1];
  return null;
}

export function exigirMismoEntorno({ projectUrl, dbUrl }) {
  const refApi = refDeProjectUrl(projectUrl);
  const refDb = refDeDbUrl(dbUrl);
  if (!refApi || !refDb) {
    throw new Error(
      `No se pudo determinar la referencia de proyecto de forma fiable ` +
      `(API: ${refApi || 'no reconocida'}, DB: ${refDb || 'no reconocida'}). ` +
      `Por seguridad, no se continúa sin poder comprobar que SUPABASE_PROJECT_URL ` +
      `y SUPABASE_DB_URL apuntan al mismo proyecto.`
    );
  }
  if (refApi !== refDb) {
    throw new Error(
      `SUPABASE_PROJECT_URL (proyecto "${refApi}") y SUPABASE_DB_URL (proyecto "${refDb}") ` +
      `NO apuntan al mismo entorno. Esto es exactamente el tipo de error que podría ` +
      `escribir datos de prueba en un proyecto y leerlos de otro sin que nadie lo note. Abortado.`
    );
  }
  return refApi;
}
